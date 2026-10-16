import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {downloadAsset,child,startInstallation,extractZip} from '../src/installer.ts';
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
