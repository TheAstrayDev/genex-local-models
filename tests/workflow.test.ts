import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createPlugin,requestFor} from '../src/backend.ts';
import {catalog} from '../src/catalog.ts';
import type {PluginContext} from '../vendor/genex-sdk.d.ts';
import {assetEntries} from '../src/assets.ts';

const imageId='0c770828-6f7f-446a-9f67-9ca2d9d47ff6';
const modelId='88e6cf05-7940-4485-9737-380215946aa1';

async function fixture(t:any,host={platform:'win32',arch:'x64',release:'10.0.26100'}){
 const root=await mkdtemp(path.join(os.tmpdir(),'local-model-workflow-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 await writeFile(path.join(root,'assignments.json'),JSON.stringify({image:'qwen-image-2.1-turbo',texture:'qwen-image-2.1-turbo',sfx:'stable-audio-3-small-sfx',music:'stable-audio-3-small-music',model:'hunyuan3d-2-turbo'}));
 for(const family of ['qwen','audio','hunyuan']){
  const dir=path.join(root,family);await mkdir(dir,{recursive:true});
  const entries=catalog.filter(m=>family==='qwen'?m.id.startsWith('qwen'):family==='hunyuan'?m.id.startsWith('hunyuan'):m.id.startsWith('stable'));
  for(const entry of entries)for(const file of entry.files){await mkdir(path.dirname(path.join(dir,file)),{recursive:true});await writeFile(path.join(dir,file),'fixture');}
 }
 const calls:{method:string;args:any}[]=[],records=new Map<string,any>(),jobs=new Map<string,any>();
 jobs.set(imageId,{id:imageId,project:'racer',state:'completed',recipe:'image',output:path.join(root,'output'),files:['image.png']});
 const ctx:PluginContext={project:'racer',directory:root,signal:new AbortController().signal,callId:1,host:(async(method:string,args:any)=>{
  calls.push({method,args});
  if(method==='storage.root')return root;
  if(method==='runtime.detect')return {state:'ready',path:path.join(root,args.runtime,'python.exe')};
  if(method==='native.result')return jobs.get(args.id)??null;
  if(method==='native.jobs')return [...jobs.values()];
  if(method==='jobs.read'){if(!records.has(args.id))throw Error('ENOENT');return records.get(args.id);}
  if(method==='jobs.write'){records.set(args.id,args.value);return;}
  if(method==='assets.deliver')return [`assets/theastraydev-local-models/${args.jobId}/${args.jobId===imageId?'image.png':'model.glb'}`];
  if(method==='native.run'){
   const id=args.job==='image'?imageId:modelId;
   const job={id,project:'racer',state:'completed',recipe:args.job,output:path.join(root,'output'),files:[args.job==='image'?'image.png':'model.glb'],stdout:'GENEX_LOCAL_RESULT '+JSON.stringify({file:args.job==='image'?'image.png':'model.glb'})};
   jobs.set(id,job);return job;
  }
  throw Error('Unexpected host call '+method);
 }) as PluginContext['host']};
 const plugin=createPlugin(host);
 return {ctx,plugin,calls,jobs,records};
}

test('Hunyuan3D accepts exact delivered image paths without a public-folder copy',()=>{
 assert.equal(requestFor('generate-model',{name:'car',image:`assets/theastraydev-local-models/${imageId}/image.png`}).inputs.image,`assets/theastraydev-local-models/${imageId}/image.png`);
 for(const image of ['../secret.png','assets/../../secret.png','assets/.secret/x.png','C:/x.png','https://example.com/x.png'])assert.throws(()=>requestFor('generate-model',{name:'car',image}));
});

test('Mac hides incompatible 3D setup and rejects the route before an expensive reference',async t=>{
 const f=await fixture(t,{platform:'darwin',arch:'arm64',release:'25.0.0'});
 const status:any=await f.plugin.tool!('status',{},f.ctx);
 const mesh=status.models.find((m:any)=>m.id==='hunyuan3d-2-turbo');
 assert.equal(mesh.state,'unsupported');assert.equal(mesh.canInstall,false);assert.equal(mesh.ready,false);
 await assert.rejects(f.plugin.tool!('generate-model',{name:'car',prompt:'car'},f.ctx),/no Mac\/AMD adapter/);
 assert.equal(f.calls.filter(c=>c.method==='native.run').length,0);
 assert.equal(status.models.find((m:any)=>m.id==='qwen-image-2.1-turbo').supported,true);
});

test('image job to 3D preserves the exact UUID and does not regenerate the reference',async t=>{
 const f=await fixture(t),result:any=await f.plugin.tool!('generate-model',{name:'car',imageJobId:imageId},f.ctx);
 assert.equal(f.calls.filter(c=>c.method==='native.run').length,1);
 assert.equal(f.calls.find(c=>c.method==='native.run')!.args.inputs.image,`assets/theastraydev-local-models/${imageId}/image.png`);
 assert.equal(result.referenceJobId,imageId);assert.equal(result.jobId,modelId);
 assert.equal(result.assets[0].url,`/assets/theastraydev-local-models/${modelId}/model.glb`);
});

test('text-to-3D returns an explicit continuation before using the mesh tool budget',async t=>{
 const f=await fixture(t),reference:any=await f.plugin.tool!('generate-model',{name:'car',prompt:'Isolated stylized racing car, three quarter view'},f.ctx);
 assert.equal(reference.completed,false);assert.equal(reference.state,'reference-ready');
 assert.deepEqual(f.calls.filter(c=>c.method==='native.run').map(c=>c.args.job),['image']);
 const values=f.calls.find(c=>c.method==='native.run')!.args.values;
 const payload=JSON.parse(Buffer.from(Object.values(values).filter(v=>v!=='.').join(''),'base64').toString('utf8'));
 assert.equal(payload.purpose,'model-reference','3D references must automatically request native transparent RGBA');
 assert.equal(payload.size,512);
 assert.equal(reference.nextCall.arguments.quality,'balanced');
 assert.equal(reference.nextCall.tool,'theastraydev-local-models__generate-model');
 const result:any=await f.plugin.tool!('generate-model',reference.nextCall.arguments,f.ctx);
 assert.deepEqual(f.calls.filter(c=>c.method==='native.run').map(c=>c.args.job),['image','model']);
 assert.equal(result.referenceJobId,imageId);
 await assert.rejects(f.plugin.tool!('generate-model',{name:'car',prompt:'car',imageJobId:imageId},f.ctx),/exactly one/i);
});

test('retrieval restores existing files through host delivery and never loads weights',async t=>{
 const f=await fixture(t);f.records.set(imageId,{jobId:imageId,name:'asphalt',task:'texture',model:'qwen-image-2.1-turbo'});
 const result:any=await f.plugin.tool!('retrieve',{id:imageId},f.ctx);
 assert.equal(result.record.files[0],`assets/theastraydev-local-models/${imageId}/image.png`);
 assert.equal(result.record.assets[0].url,`/assets/theastraydev-local-models/${imageId}/image.png`);
 assert.equal(f.calls.filter(c=>c.method==='assets.deliver').length,1);
 assert.equal(f.calls.filter(c=>c.method==='native.run').length,0);
 f.jobs.delete(imageId);
 await assert.rejects(f.plugin.tool!('retrieve',{id:imageId},f.ctx),/this project/i);
});

test('explicit high quality survives the reference continuation and reaches the model worker',async t=>{
 const f=await fixture(t),reference:any=await f.plugin.tool!('generate-model',{name:'car',prompt:'A clean physical coupe',quality:'high'},f.ctx);
 const decode=(call:any)=>JSON.parse(Buffer.from(Object.values(call.args.values).filter(v=>v!=='.').join(''),'base64').toString('utf8'));
 assert.equal(decode(f.calls.find(c=>c.method==='native.run')).size,768);
 assert.equal(reference.nextCall.arguments.quality,'high');
 await f.plugin.tool!('generate-model',reference.nextCall.arguments,f.ctx);
 assert.equal(decode(f.calls.filter(c=>c.method==='native.run').at(-1)).quality,'high');
});

test('listing retained assets is project scoped, read only, and excludes unfinished jobs',async t=>{
 const f=await fixture(t);f.jobs.set(modelId,{id:modelId,project:'other-game',state:'completed'});
 const result:any=await f.plugin.tool!('assets',{},f.ctx);
 assert.deepEqual(result.assets.map((a:any)=>a.jobId),[imageId]);
 assert.equal(f.calls.filter(c=>['native.run','assets.deliver','jobs.write'].includes(c.method)).length,0);
});

test('retained TRELLIS results stay retrievable after replacing the model adapter',async t=>{
 const f=await fixture(t);
 f.records.set(imageId,{jobId:imageId,name:'legacy-asset',task:'model',model:'trellis-2-low-vram'});
 const listing:any=await f.plugin.tool!('assets',{},f.ctx);
 assert.equal(listing.assets[0].model,'trellis-2-low-vram');
 const restored:any=await f.plugin.tool!('retrieve',{id:imageId},f.ctx);
 assert.equal(restored.record.model,'trellis-2-low-vram');
 assert.equal(f.calls.filter(c=>c.method==='native.run').length,0);
});

test('mesh failure reports its retained reference for retry without another image',async t=>{
 const f=await fixture(t),host=f.ctx.host;
 f.ctx.host=(async(method:string,args:any)=>{
  if(method==='native.run'&&args.job==='model')return {id:modelId,state:'failed',reason:'fixture VRAM failure'};
  return (host as any)(method,args);
 }) as PluginContext['host'];
 const reference:any=await f.plugin.tool!('generate-model',{name:'car',prompt:'An isolated car'},f.ctx);
 await assert.rejects(f.plugin.tool!('generate-model',reference.nextCall.arguments,f.ctx),error=>{
  assert.match(String(error),new RegExp(imageId));assert.match(String(error),/imageJobId/);return true;
 });
 assert.equal(f.calls.filter(c=>c.method==='native.run'&&c.args.job==='image').length,1);
 assert.ok(f.jobs.has(imageId));
});

test('unassigned mesh route blocks an expensive automatic image generation',async t=>{
 const f=await fixture(t);
 await f.plugin.action!('assign',{image:'qwen-image-2.1-turbo',texture:null,sfx:null,music:null,model:null},f.ctx);
 await assert.rejects(f.plugin.tool!('generate-model',{name:'car',prompt:'A car'},f.ctx),/No ready/);
 assert.equal(f.calls.filter(c=>c.method==='native.run').length,0);
});

test('asset URLs follow the host public layout and preserve escaped filenames',()=>{
 assert.deepEqual(assetEntries(['public/assets/a b.png','assets/coin.png','Assets/Generated/theastraydev-local-models/car.glb']).map(a=>a.url),['/assets/a%20b.png','/assets/coin.png',null]);
});

test('a plugin page without an open game cannot restore any files',async t=>{
 const f=await fixture(t);delete f.ctx.project;
 await assert.rejects(f.plugin.action!('restore-assets',{},f.ctx),/Open a game/);
 assert.equal(f.calls.length,0);
});

test('runtime inspection reports an unused delivered model and never generates another',async t=>{
 const f=await fixture(t),host=f.ctx.host;
 f.ctx.host=(async(method:string,args:any)=>method==='observe'?{loadedFiles:[],image:Buffer.from('frame'),consoleAvailable:true}:host(method,args)) as PluginContext['host'];
 const result:any=await f.plugin.tool!('inspect-use',{id:imageId},f.ctx);
 assert.equal(result.ok,false);assert.equal(result.use.stage,'unconfirmed');
 assert.deepEqual(result.missingFiles,[`assets/theastraydev-local-models/${imageId}/image.png`]);
 assert.equal(f.calls.filter(c=>c.method==='native.run').length,0);
 await assert.rejects(f.plugin.tool!('verify-use',{id:imageId,inspectionId:result.use.inspectionId,note:'A car appears in the game.'},f.ctx),/runtime-loaded/);
});

test('visible verification requires a loaded file, current inspection and the same workspace',async t=>{
 const f=await fixture(t),host=f.ctx.host;
 f.ctx.host=(async(method:string,args:any)=>method==='observe'?{loadedFiles:args.files,image:Buffer.from('frame'),consoleAvailable:true}:host(method,args)) as PluginContext['host'];
 const result:any=await f.plugin.tool!('inspect-use',{id:imageId},f.ctx);
 assert.equal(result.ok,true);assert.equal(result.use.stage,'integrated');
 await assert.rejects(f.plugin.tool!('verify-use',{id:imageId,inspectionId:'stale',note:'A car appears in the game.'},f.ctx),/runtime-loaded/);
 await assert.rejects(f.plugin.tool!('verify-use',{id:imageId,inspectionId:result.use.inspectionId,note:'A car appears in the game.'},{...f.ctx,directory:f.ctx.directory+'/another'}),/runtime-loaded/);
 const verified:any=await f.plugin.tool!('verify-use',{id:imageId,inspectionId:result.use.inspectionId,note:'The generated coupe is visible in the running race.'},f.ctx);
 assert.equal(verified.use.stage,'verified');
 await f.plugin.tool!('retrieve',{id:imageId},{...f.ctx,directory:f.ctx.directory+'/another'});
 assert.equal(f.records.get(imageId).use.stage,'unconfirmed');
});

test('audio inspection needs advancing audible playback, not a file request or screenshot',async t=>{
 const f=await fixture(t),host=f.ctx.host,file=`assets/theastraydev-local-models/${imageId}/audio.wav`;
 let rms=0;
 f.ctx.host=(async(method:string,args:any)=>{
  if(method==='assets.deliver')return [file];
  if(method==='observe')return {loadedFiles:[file],image:Buffer.from('frame'),audio:[{file,state:'playing',rms,advancedSeconds:1}]};
  return host(method,args);
 }) as PluginContext['host'];
 const silent:any=await f.plugin.tool!('inspect-use',{id:imageId},f.ctx);
 assert.equal(silent.ok,false);assert.equal(silent.use.stage,'unconfirmed');
 rms=0.02;
 const audible:any=await f.plugin.tool!('inspect-use',{id:imageId},f.ctx);
 assert.equal(audible.use.stage,'verified');assert.equal(audible.use.verification,'runtime-audio-playback');
});
