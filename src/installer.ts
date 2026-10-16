import {mkdir,readFile,writeFile,rename,open,unlink,lstat,statfs,cp,access,readdir,rm} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import os from 'node:os';
import yauzl from 'yauzl';
import audioAssets from '../scripts/audio-assets.json' with {type:'json'};
import qwenAssets from '../scripts/qwen-assets.json' with {type:'json'};
import audioRuntime from '../plugin/audio-runtime.json' with {type:'json'};

export interface Asset {name:string;folder:string;size:number;sha256:string;url:string}
const python:Asset={name:'python-3.11.9-embed-amd64.zip',folder:'downloads',size:11249023,sha256:'009d6bf7e3b2ddca3d784fa09f90fe54336d5b60f0e0f305c37f400bf83cfd3b',url:'https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip'};
type Progress={active:boolean;model:string;phase:string;file?:string;completed:number;total:number;error?:string};
let progress:Progress={active:false,model:'',phase:'idle',completed:0,total:0};
let controller:AbortController|undefined;
export const installation=()=>({...progress});
export function cancelInstallation(){controller?.abort();return installation();}
export async function modelHome(){
 if(process.platform!=='win32'||process.arch!=='x64')throw Error('This tested runtime profile currently supports Windows x64 with an NVIDIA GPU.');
 try{await access('D:/');return 'D:/Genex-Local-Models';}catch{return path.join(os.homedir(),'Genex-Local-Models');}
}
export function child(root:string,relative:string){
 const result=path.resolve(root,relative),rel=path.relative(path.resolve(root),result);
 if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw Error('Path leaves the managed model directory.');
 return result;
}
async function directory(root:string,relative:string){
 await mkdir(root,{recursive:true});
 if((await lstat(root)).isSymbolicLink())throw Error('Managed root cannot be a link.');
 let current=path.resolve(root);
 for(const part of path.relative(current,child(root,relative)).split(path.sep)){
  current=path.join(current,part);await mkdir(current).catch(error=>{if(error.code!=='EEXIST')throw error;});
  const info=await lstat(current);if(info.isSymbolicLink()||!info.isDirectory())throw Error('Managed directory contains a link or non-directory.');
 }
}
async function sha(file:string,signal:AbortSignal){
 const hash=createHash('sha256');for await(const bytes of createReadStream(file)){signal.throwIfAborted();hash.update(bytes);}return hash.digest('hex');
}
export async function downloadAsset(root:string,asset:Asset,signal:AbortSignal,onProgress:(bytes:number)=>void=()=>{},get:typeof fetch=fetch){
 await directory(root,asset.folder);
 const target=child(root,path.join(asset.folder,asset.name)),partial=target+'.part';
 for(const file of [target,partial])try{if(!(await lstat(file)).isFile())throw Error('Download destination is not a regular file.');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 try{
  const stat=await lstat(target);
  if(stat.size!==asset.size||await sha(target,signal)!==asset.sha256)throw Error(`Existing different file preserved: ${asset.name}`);
  onProgress(asset.size);return target;
 }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 let offset=0;try{offset=(await lstat(partial)).size;}catch{}
 if(offset>asset.size)throw Error('Download partial exceeds pinned size.');
 const disk=await statfs(root),reserve=path.parse(path.resolve(root)).root.toLowerCase()==='c:\\'?15*1024**3:2*1024**3;
 if(disk.bavail*disk.bsize<asset.size-offset+reserve)throw Error('Not enough disk space while preserving the free-space reserve.');
 onProgress(offset);
 while(offset<asset.size){
  signal.throwIfAborted();const end=Math.min(offset+64*1024**2,asset.size)-1;
  const response=await get(asset.url,{headers:{Range:`bytes=${offset}-${end}`},signal:AbortSignal.any([signal,AbortSignal.timeout(60000)]),redirect:'follow'});
  if(!response.ok||!response.body)throw Error(`Download returned HTTP ${response.status}. Retry to resume.`);
  if(offset&&response.status!==206)throw Error('Server ignored resume range; partial preserved.');
  if(response.status===206&&!response.headers.get('content-range')?.startsWith(`bytes ${offset}-`))throw Error('Server returned the wrong download range.');
  const out=await open(partial,offset?'a':'w',0o600),before=offset;
  try{for await(const bytes of response.body){
   signal.throwIfAborted();if(offset+bytes.length>asset.size)throw Error('Download exceeds pinned size.');
   await out.writeFile(bytes);offset+=bytes.length;onProgress(offset);
  }}finally{await out.close();}
  if(offset===before)throw Error('Download stopped without progress. Retry to resume.');
 }
 if(await sha(partial,signal)!==asset.sha256)throw Error('SHA-256 mismatch; partial preserved and model not activated.');
 await rename(partial,target);return target;
}
export async function extractZip(archive:string,target:string,signal:AbortSignal){
 await mkdir(target,{recursive:true});
 await new Promise<void>((resolve,reject)=>{
  yauzl.open(archive,{lazyEntries:true,validateEntrySizes:true},(error,zip)=>{
   if(error||!zip)return reject(error??Error('Invalid archive'));
   let count=0,total=0;
   const fail=(error:unknown)=>{zip.close();reject(error);};
   zip.on('error',fail);zip.on('end',resolve);
   zip.on('entry',entry=>{void(async()=>{
    signal.throwIfAborted();
    if(++count>20000||(total+=entry.uncompressedSize)>4*1024**3||((entry.externalFileAttributes>>>16)&0xf000)===0xa000||/[:\\]/.test(entry.fileName))throw Error('Unsafe or oversized archive.');
    const file=child(target,entry.fileName);
    if(entry.fileName.endsWith('/'))await directory(target,entry.fileName);
    else{
     const dir=path.dirname(entry.fileName);if(dir!=='.')await directory(target,dir);
     const stream=await new Promise<NodeJS.ReadableStream>((resolve,reject)=>zip.openReadStream(entry,(error,stream)=>error||!stream?reject(error):resolve(stream)));
     await pipeline(stream,createWriteStream(file,{flags:'wx'}),{signal});
    }
    zip.readEntry();
   })().catch(fail);});zip.readEntry();
  });
 });
}
function assetsFor(model:string):Asset[]{
 if(model==='qwen-image-2.1-turbo')return qwenAssets;
 if(model==='hunyuan3d-2-turbo')throw Error('Hunyuan3D uses the separately provisioned Windows Portable runtime. Complete its verified CUDA texture setup before assigning it; generation never installs dependencies.');
 if(model==='stable-audio-3-small-music'||model==='stable-audio-3-small-sfx')return audioAssets.filter(a=>a.folder==='downloads'||a.folder.endsWith(model));
 throw Error('Unknown reviewed model.');
}
export function startInstallation(model:string){
 const assets=assetsFor(model);
 if(progress.active)throw Error('A model installation is already running.');
 controller=new AbortController();progress={active:true,model,phase:'preparing',completed:0,total:assets.reduce((n,a)=>n+a.size,python.size)};
 void install(model,assets,controller.signal).catch(error=>{progress.phase=controller?.signal.aborted?'cancelled':'failed';progress.error=String(error);}).finally(()=>{progress.active=false;controller=undefined;});
 return installation();
}
async function install(model:string,assets:Asset[],signal:AbortSignal){
 const base=await modelHome();await mkdir(base,{recursive:true});
 const lock=path.join(base,'setup.lock'),lease=await open(lock,'wx',0o600).catch(()=>{throw Error('Another setup owns setup.lock. Wait for it to finish before retrying.');});
 try{
  await lease.writeFile(JSON.stringify({pid:process.pid,model,at:new Date().toISOString()}));
  let complete=0;const files=new Map<string,string>();
  for(const asset of [python,...assets]){
   progress.phase='downloading and verifying';progress.file=asset.name;
   files.set(asset.name,await downloadAsset(base,asset,signal,bytes=>{progress.completed=complete+bytes;}));complete+=asset.size;
  }
  const family=model==='qwen-image-2.1-turbo'?'qwen':'audio';
  // audio.cpp normalizes paths through every ancestor. Standard Windows C: profile
  // ancestors support that inside LPAC; ordinary secondary-drive roots often do not.
  const root=path.join(os.homedir(),'Genex-Local-Models',family);
  await mkdir(root,{recursive:true});
  const stage=path.join(base,'setup-'+randomUUID());await mkdir(stage);
  progress.phase='extracting runtime';
  // Every archive is verified first. Extract to a fresh directory before exposing any file.
  await extractZip(files.get(python.name)!,path.join(stage,'python'),signal);
  const copies:{source:string;destination:string}[]=[];
  try{await access(path.join(root,'python.exe'));}catch{
   for(const file of await readdir(path.join(stage,'python')))copies.push({source:path.join(stage,'python',file),destination:path.join(root,file)});
  }
  for(const asset of assets.filter(asset=>asset.folder==='downloads')){
   const unpack=path.join(stage,asset.name);await extractZip(files.get(asset.name)!,unpack,signal);
   const destination=path.join(root,family==='qwen'?'sd-cpp':'bin');await mkdir(destination,{recursive:true});
   const executable=family==='qwen'?'sd-cli.exe':'audiocpp_cli.exe';
   for(const file of await readdir(unpack))if(file.toLowerCase().endsWith('.dll')||(file===executable&&family!=='audio')||/^licen[cs]e/i.test(file))copies.push({source:path.join(unpack,file),destination:path.join(destination,file)});
  }
  if(family==='audio'){
   const packageRoot=import.meta.filename.endsWith('.ts')?path.resolve(import.meta.dirname,'../plugin'):import.meta.dirname;
   const source=path.join(packageRoot,'native/win32-x64/audiocpp_cli.exe');
   if(await sha(source,signal)!==audioRuntime.sha256)throw Error('Bundled audio runtime digest differs.');
   copies.push({source,destination:path.join(root,'bin/audiocpp_cli.exe')});
  }
  for(const asset of assets.filter(asset=>asset.folder!=='downloads'))copies.push({source:files.get(asset.name)!,destination:path.join(root,'models',model,asset.name)});
  let needed=0;
  for(const file of copies){
   try{const info=await lstat(file.destination);if(!info.isFile()||info.size!==(await lstat(file.source)).size)throw Error('Existing runtime differs; preserved for inspection.');}
   catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;needed+=(await lstat(file.source)).size;}
  }
  const disk=await statfs(root),reserve=path.parse(root).root.toLowerCase()==='c:\\'?15*1024**3:2*1024**3;
  if(disk.bavail*disk.bsize<needed+reserve)throw Error('Runtime setup would consume the free-space reserve. Downloads remain available for retry.');
  progress.phase='installing verified files';
  for(const file of copies){
   signal.throwIfAborted();try{await access(file.destination);continue;}catch{}
   await mkdir(path.dirname(file.destination),{recursive:true});
   const partial=file.destination+'.copying';await cp(file.source,partial);await rename(partial,file.destination);
  }
  for(const asset of assets.filter(asset=>asset.folder!=='downloads')){
   const destination=path.join(root,'models',model,asset.name);
   if(await sha(destination,signal)!==asset.sha256)throw Error('Installed model digest differs; not activated.');
  }
  if(family==='qwen'){
   await writeFile(path.join(root,'runtime.json'),JSON.stringify({sd_cli:'sd-cpp/sd-cli.exe',download_digests_verified:true}));
  }
  if(family==='audio')await writeFile(path.join(root,'audio-lpac.json'),JSON.stringify(audioRuntime));
  progress.phase='ready';progress.file=undefined;
  await writeFile(path.join(root,model+'.ready.json'),JSON.stringify({model,verified:true,at:new Date().toISOString(),assets}));
  const staged=path.resolve(stage),owned=path.resolve(base)+path.sep;
  if(staged.startsWith(owned)&&path.basename(staged).startsWith('setup-')&&!(await lstat(staged)).isSymbolicLink())await rm(staged,{recursive:true});
 }finally{await lease.close();await unlink(lock);}
}
