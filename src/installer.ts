import {mkdir,readFile,writeFile,rename,open,unlink,lstat,statfs,cp,access,readdir,rm,chmod} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import os from 'node:os';
import yauzl from 'yauzl';
import * as tar from 'tar';
import {currentHost,installationPlan} from './platform.ts';
import audioRuntime from '../plugin/audio-runtime.json' with {type:'json'};

export interface Asset {name:string;folder:string;size:number;sha256:string;url:string}
type Progress={active:boolean;model:string;phase:string;file?:string;completed:number;total:number;error?:string};
let progress:Progress={active:false,model:'',phase:'idle',completed:0,total:0};
let controller:AbortController|undefined;
export const installation=()=>({...progress});
export function cancelInstallation(){controller?.abort();return installation();}
export async function modelHome(){
 if(process.platform==='win32')try{await access('D:/');return 'D:/Genex-Local-Models';}catch{}
 return path.join(os.homedir(),'Genex-Local-Models');
}
export function child(root:string,relative:string){
 const portable=relative.replaceAll('\\','/');
 if(path.posix.isAbsolute(portable)||path.win32.isAbsolute(portable)||/^[a-z]:/i.test(portable))throw Error('Download path must be relative.');
 const result=path.resolve(root,portable),rel=path.relative(path.resolve(root),result);
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
     if(process.platform!=='win32')await chmod(file,(entry.externalFileAttributes>>>16)&0o111?0o755:0o644);
    }
    zip.readEntry();
   })().catch(fail);});zip.readEntry();
  });
 });
}
/** Preflight the entire archive before extraction. Python's internal command aliases
 * are omitted; the declared interpreter is the real bin/python3.11 file. */
export async function extractTar(archive:string,target:string,signal:AbortSignal){
 let count=0,total=0;
 const validate=(name:string,entry:tar.ReadEntry)=>{
  signal.throwIfAborted();const relative=name.replace(/^(\.\/)+/,'').replace(/\/$/,'');
  if(relative===''||relative==='.')return false;
  child(target,relative);
  if(/[:\\]/.test(relative)||++count>20000||(total+=entry.size)>4*1024**3)throw Error('Unsafe or oversized archive.');
  if(entry.type==='SymbolicLink'){
   // Reject escaping links even though no links are ever extracted.
   if(!entry.linkpath||path.posix.isAbsolute(entry.linkpath))throw Error('Unsafe archive link.');
   child(target,path.posix.join(path.posix.dirname(relative),entry.linkpath));return false;
  }
  if(!['Directory','File','OldFile'].includes(entry.type))throw Error('Unsupported archive entry.');
  return true;
 };
 let invalid:unknown;
 await tar.t({file:archive,strict:true,onReadEntry:entry=>{try{validate(entry.path,entry);}catch(error){invalid??=error;}}});
 if(invalid)throw invalid;
 signal.throwIfAborted();await mkdir(target,{recursive:true});
 await tar.x({file:archive,cwd:target,strict:true,preservePaths:false,
  filter:(_name,entry)=>!signal.aborted&&['Directory','File','OldFile'].includes((entry as tar.ReadEntry).type),
  onReadEntry:entry=>{entry.mode=(entry.mode??0o644)&0o755;}});
 signal.throwIfAborted();
}
/** Stage only reviewed interpreters/libraries, never a server or install script. */
export async function prepareRuntime(plan:ReturnType<typeof installationPlan>,files:Map<string,string>,stage:string,signal:AbortSignal){
 const root=path.join(stage,'runtime'),pythonStage=path.join(stage,'python');
 const extract=(archive:string,target:string)=>archive.endsWith('.tar.gz')?extractTar(archive,target,signal):extractZip(archive,target,signal);
 await extract(files.get(plan.python.name)!,pythonStage);
 await cp(plan.apple?path.join(pythonStage,'python'):pythonStage,root,{recursive:true,errorOnExist:true,force:false});
 for(const asset of plan.assets.filter(a=>a.folder==='downloads')){
  const unpack=path.join(stage,asset.name);await extract(files.get(asset.name)!,unpack);
  const destination=path.join(root,plan.family==='qwen'?'sd-cpp':'bin');await mkdir(destination,{recursive:true});
  for(const file of await readdir(unpack)){
   const source=path.join(unpack,file);
   if(!(await lstat(source)).isFile())continue;
   if(file.toLowerCase().endsWith('.dll')||file.endsWith('.dylib')||file.endsWith('.txt')||/^licen[cs]e/i.test(file)||(file===plan.executable&&(plan.backend!=='cuda'||plan.family!=='audio')))
    await cp(source,path.join(destination,file),{errorOnExist:true,force:false});
  }
 }
 if(plan.family==='audio'&&plan.backend==='cuda'){
  const packageRoot=import.meta.filename.endsWith('.ts')?path.resolve(import.meta.dirname,'../plugin'):import.meta.dirname;
  const source=path.join(packageRoot,'native/win32-x64/audiocpp_cli.exe');
  if(await sha(source,signal)!==audioRuntime.sha256)throw Error('Bundled audio runtime digest differs.');
  await cp(source,path.join(root,'bin/audiocpp_cli.exe'));
 }
 return root;
}
async function regularFiles(root:string):Promise<string[]>{
 const result:string[]=[];
 for(const entry of await readdir(root,{withFileTypes:true})){
  const file=path.join(root,entry.name);
  if(entry.isDirectory())result.push(...await regularFiles(file));
  else if(entry.isFile())result.push(file);else throw Error('Staged runtime contains a link or special file.');
 }
 return result;
}
export function startInstallation(model:string){
 const plan=installationPlan(model);
 if(progress.active)throw Error('A model installation is already running.');
 controller=new AbortController();progress={active:true,model,phase:'preparing',completed:0,total:plan.assets.reduce((n,a)=>n+a.size,plan.python.size)};
 void install(model,controller.signal).catch(error=>{progress.phase=controller?.signal.aborted?'cancelled':'failed';progress.error=String(error);}).finally(()=>{progress.active=false;controller=undefined;});
 return installation();
}
async function install(model:string,signal:AbortSignal){
 const host=currentHost(),family=model==='qwen-image-2.1-turbo'?'qwen':'audio';
 const bundle=path.join(os.homedir(),'Genex-Local-Models',family+(host.platform==='darwin'?'.app':''));
 const root=host.platform==='darwin'?path.join(bundle,'Contents'):bundle;
 let legacyCuda=false;
 if(host.platform==='win32'){
  try{legacyCuda=JSON.parse(await readFile(path.join(root,family==='qwen'?'runtime.json':'audio-backend.json'),'utf8')).backend!=='vulkan';}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
   if(family==='audio')try{await access(path.join(root,'audio-lpac.json'));legacyCuda=true;}catch{}
  }
 }
 const plan=installationPlan(model,host,legacyCuda),{assets,python}=plan;
 progress.total=assets.reduce((n,a)=>n+a.size,python.size);
 const base=await modelHome();await mkdir(base,{recursive:true});
 const lock=path.join(base,'setup.lock'),lease=await open(lock,'wx',0o600).catch(()=>{throw Error('Another setup owns setup.lock. Wait for it to finish before retrying.');});
 try{
  await lease.writeFile(JSON.stringify({pid:process.pid,model,at:new Date().toISOString()}));
  let complete=0;const files=new Map<string,string>();
  for(const asset of [python,...assets]){
   progress.phase='downloading and verifying';progress.file=asset.name;
   files.set(asset.name,await downloadAsset(base,asset,signal,bytes=>{progress.completed=complete+bytes;}));complete+=asset.size;
  }
  // audio.cpp normalizes paths through every ancestor. Standard Windows C: profile
  // ancestors support that inside LPAC; ordinary secondary-drive roots often do not.
  await directory(os.homedir(),path.relative(os.homedir(),root));
  const stage=path.join(base,'setup-'+randomUUID());await mkdir(stage);
  progress.phase='extracting runtime';
  // Every archive is verified first. Extract to a fresh directory before exposing any file.
  const stagedRuntime=await prepareRuntime(plan,files,stage,signal);
  const copies:{source:string;destination:string}[]=[];
  for(const file of await regularFiles(stagedRuntime))copies.push({source:file,destination:path.join(root,path.relative(stagedRuntime,file))});
  for(const asset of assets.filter(asset=>asset.folder!=='downloads'))copies.push({source:files.get(asset.name)!,destination:path.join(root,'models',model,asset.name)});
  let needed=0;
  for(const file of copies){
   try{const info=await lstat(file.destination);if(!info.isFile()||info.size!==(await lstat(file.source)).size||await sha(file.destination,signal)!==await sha(file.source,signal))throw Error('Existing runtime differs; preserved for inspection.');}
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
   await writeFile(path.join(root,'runtime.json'),JSON.stringify({sd_cli:'sd-cpp/'+plan.executable,backend:plan.backend,download_digests_verified:true}));
  }
  if(family==='audio'){
   if(plan.backend==='cuda')await writeFile(path.join(root,'audio-lpac.json'),JSON.stringify(audioRuntime));
   await writeFile(path.join(root,'audio-backend.json'),JSON.stringify({backend:plan.backend}));
  }
  if(plan.apple)await writeFile(path.join(root,'Info.plist'),`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>dev.theastray.genex-local-models.${family}</string><key>CFBundleExecutable</key><string>bin/python3.11</string></dict></plist>`);
  progress.phase='ready';progress.file=undefined;
  await writeFile(path.join(root,model+'.ready.json'),JSON.stringify({model,verified:true,at:new Date().toISOString(),assets}));
  const staged=path.resolve(stage),owned=path.resolve(base)+path.sep;
  if(staged.startsWith(owned)&&path.basename(staged).startsWith('setup-')&&!(await lstat(staged)).isSymbolicLink())await rm(staged,{recursive:true});
 }finally{await lease.close();await unlink(lock);}
}
