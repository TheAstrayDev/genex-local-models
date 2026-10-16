import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {downloadAsset,child,startInstallation,extractZip,extractTar} from '../src/installer.ts';
const data=Buffer.from('verified test model data');
const asset={name:'test.gguf',folder:'models/test',size:data.length,sha256:createHash('sha256').update(data).digest('hex'),url:'https://example.invalid/pinned-model'};
test('download resumes a partial, verifies it, and reuses verified bytes without a request',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'glm-download-'));await mkdir(path.join(root,asset.folder),{recursive:true});
 await writeFile(path.join(root,asset.folder,asset.name+'.part'),data.subarray(0,6));let calls=0;
 const get:typeof fetch=async(_url,options)=>{calls++;assert.equal((options!.headers as any).Range,`bytes=6-${data.length-1}`);return new Response(data.subarray(6),{status:206,headers:{'Content-Range':`bytes 6-${data.length-1}/${data.length}`}});};
 const file=await downloadAsset(root,asset,new AbortController().signal,()=>{},get);assert.deepEqual(await readFile(file),data);
 await downloadAsset(root,asset,new AbortController().signal,()=>{},get);assert.equal(calls,1);
});
test('corrupt downloads and ignored resume ranges never activate a model',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'glm-corrupt-'));
 const corrupt:typeof fetch=async()=>new Response(Buffer.alloc(data.length),{status:200});
 await assert.rejects(downloadAsset(root,asset,new AbortController().signal,()=>{},corrupt),/SHA-256/);
 await assert.rejects(access(path.join(root,asset.folder,asset.name)));
 await writeFile(path.join(root,asset.folder,asset.name+'.part'),data.subarray(0,3));
 await assert.rejects(downloadAsset(root,asset,new AbortController().signal,()=>{},corrupt),/ignored resume/);
});
test('paths and model identifiers cannot select an arbitrary install destination',()=>{
 for(const file of ['../escape','..\\escape','C:/elsewhere','C:elsewhere','C:\\elsewhere','\\\\server\\share','/elsewhere','..'])assert.throws(()=>child('C:/managed',file));
 assert.throws(()=>startInstallation('https://arbitrary-model'),/Unknown reviewed/);
});
test('zip extraction rejects traversal and links and extracts a regular file',async()=>{
 const fixtures=JSON.parse(await readFile(new URL('./zip-fixtures.json',import.meta.url),'utf8'));
 const root=await mkdtemp(path.join(tmpdir(),'glm-archive-'));
 for(const key of Object.keys(fixtures)){
  const archive=path.join(root,key+'.zip');await writeFile(archive,Buffer.from(fixtures[key],'base64'));
  if(key==='safe'){await extractZip(archive,path.join(root,key),new AbortController().signal);assert.equal(await readFile(path.join(root,key,'nested/test.txt'),'utf8'),'safe');}
  else await assert.rejects(extractZip(archive,path.join(root,key),new AbortController().signal));
 }
});

test('tar preflight refuses escaping and special entries and does not materialize Python aliases',async()=>{
 const {gzipSync}=await import('node:zlib');
 const root=await mkdtemp(path.join(tmpdir(),'glm-tar-'));
 function header(name:string,type:string,link=''){
  const h=Buffer.alloc(512);h.write(name,0);h.write('0000755\0',100);h.write('0000000\0',108);h.write('0000000\0',116);
  h.write('00000000000\0',124);h.write('00000000000\0',136);h.fill(32,148,156);h.write(type,156);h.write(link,157);h.write('ustar\0',257);h.write('00',263);
  h.write([...h].reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148);return h;
 }
 for(const [name,type,link,valid] of [['python/bin/python3.11','0','',true],['../escape','0','',false],['python/bin/python3','2','python3.11',true],['python/bin/python','2','../../../escape',false],['pipe','6','',false],['absolute','2','/tmp/escape',false],['hard','1','anything',false]] as const){
  const archive=path.join(root,Math.random()+'.tar.gz'),target=archive+'.out';
  await writeFile(archive,gzipSync(Buffer.concat([header(name,type,link),Buffer.alloc(1024)])));
  if(valid){await extractTar(archive,target,new AbortController().signal);if(type==='0')await access(path.join(target,name));else await assert.rejects(access(path.join(target,name)));}
  else await assert.rejects(extractTar(archive,target,new AbortController().signal));
 }
});
