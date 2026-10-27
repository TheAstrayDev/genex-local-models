import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createPlugin,requestFor} from '../src/backend.ts';
import {catalog} from '../src/catalog.ts';
import type {PluginContext} from '../vendor/genex-sdk.d.ts';
import {assetEntries} from '../src/assets.ts';
import {createHash} from 'node:crypto';

const imageId='0c770828-6f7f-446a-9f67-9ca2d9d47ff6';
const modelId='88e6cf05-7940-4485-9737-380215946aa1';
const paintId='9b53c139-39b8-4711-a61b-8b11268f6403';

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
  if(method==='assets.deliver'){
   const files=(jobs.get(args.jobId)?.files??[]).map((file:string)=>`assets/theastraydev-local-models/${args.jobId}/${file}`);
   for(const file of files){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),'fixture');}
   return files;
  }
  if(method==='native.run'){
   const id=args.job==='image'?imageId:args.job==='model-shape'?modelId:paintId;
   const request=JSON.parse(Buffer.from(Object.values(args.values).filter(v=>v!=='.').join(''),'base64').toString('utf8'));
   const files=args.job==='image'?['image.png']:args.job==='model-shape'?['shape.glb','reference.png']:['model.glb'];
   const {readFile}=await import('node:fs/promises');
   const inputs=Object.fromEntries(await Promise.all(Object.entries(args.inputs).map(async([key,file])=>[key,{file,sha256:createHash('sha256').update(await readFile(path.join(root,file as string))).digest('hex')}])));
   const job={id,project:'racer',state:'completed',recipe:args.job,output:path.join(root,'output'),inputs,files,stdout:'GENEX_LOCAL_RESULT '+JSON.stringify({file:files[0],model:request.model,seed:request.seed,quality:request.quality})};
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

test('status probes each runtime once and overlaps independent discovery',async t=>{
 const f=await fixture(t),host=f.ctx.host;
 const {setImmediate}=await import('node:timers/promises');
 let active=0,peak=0;
 f.ctx.host=(async(method:string,args:any)=>{
  if(method!=='runtime.detect')return host(method,args);
  active++;peak=Math.max(peak,active);await setImmediate();active--;
  return host(method,args);
 }) as PluginContext['host'];
 await f.plugin.action!('status',{},f.ctx);
 assert.deepEqual(f.calls.filter(c=>c.method==='runtime.detect').map(c=>c.args.runtime).sort(),['audio','hunyuan','qwen']);
 assert.equal(peak,3);
});

test('activity polling does not probe runtimes or read model files',async t=>{
 const f=await fixture(t);
 const activity:any=await f.plugin.action!('activity',{},f.ctx);
 assert.equal(activity.execution.active,false);
 assert.equal(activity.installation.active,false);
 assert.deepEqual(f.calls,[]);
});

test('new incompatible assignments are refused without changing existing choices',async t=>{
 const f=await fixture(t,{platform:'darwin',arch:'arm64',release:'25.0.0'});
 const before:any=await f.plugin.action!('status',{},f.ctx);
 await assert.rejects(f.plugin.action!('assign',{...before.assignments,model:'hunyuan3d-2-mini-turbo'},f.ctx),/not available/);
 const after:any=await f.plugin.action!('status',{},f.ctx);
 assert.deepEqual(after.assignments,before.assignments);
 await f.plugin.action!('assign',{...before.assignments,texture:null},f.ctx);
 assert.equal((await f.plugin.action!('status',{},f.ctx) as any).assignments.texture,null);
});

test('a staged model keeps its chosen adapter when new-request defaults change',async t=>{
 const f=await fixture(t);
 const reference:any=await f.plugin.tool!('generate-model',{name:'car',prompt:'A compact coupe'},f.ctx);
 await f.plugin.action!('assign',{image:'qwen-image-2.1-turbo',texture:null,sfx:null,music:null,model:'hunyuan3d-2-mini-turbo'},f.ctx);
 const shape:any=await f.plugin.tool!('generate-model',reference.nextCall.arguments,f.ctx);
 const painted:any=await f.plugin.tool!('generate-model',shape.nextCall.arguments,f.ctx);
 assert.equal(shape.model,'hunyuan3d-2-turbo');assert.equal(painted.model,'hunyuan3d-2-turbo');
});

test('identical inputs on different 3D models are different requests, never reused as each other',async t=>{
 const f=await fixture(t);
 const turbo:any=await f.plugin.tool!('generate-model',{name:'car',imageJobId:imageId},f.ctx);
 await f.plugin.action!('assign',{image:'qwen-image-2.1-turbo',texture:null,sfx:null,music:null,model:'hunyuan3d-2-mini-turbo'},f.ctx);
 const mini:any=await f.plugin.tool!('generate-model',{name:'car',imageJobId:imageId},f.ctx);
 assert.equal(turbo.model,'hunyuan3d-2-turbo');assert.equal(mini.model,'hunyuan3d-2-mini-turbo');
 assert.notEqual(mini.reused,true);
 assert.equal(f.calls.filter(c=>c.method==='native.run').length,2);
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

test('install review discloses cache, runtime folder and license without starting a native job',async t=>{
 const f=await fixture(t);
 const review=await f.plugin.review!('install',{model:'qwen-image-2.1-turbo'},f.ctx);
 assert.match(review.message!,/Download cache:/);assert.match(review.message!,/Working files:/);
 assert.match(review.message!,/Genex-Local-Models/);assert.match(review.message!,/vulkan/);
 assert.match(review.message!,/Original model licenses/);assert.equal(f.calls.length,0);
 const mac=await fixture(t,{platform:'darwin',arch:'arm64',release:'25.0.0'});
 await assert.rejects(mac.plugin.review!('install',{model:'hunyuan3d-2-turbo'},mac.ctx),/not available/);
 assert.equal(mac.calls.length,0);
});

test('image job to 3D preserves the exact UUID and does not regenerate the reference',async t=>{
 const f=await fixture(t),result:any=await f.plugin.tool!('generate-model',{name:'car',imageJobId:imageId},f.ctx);
 assert.equal(f.calls.filter(c=>c.method==='native.run').length,1);
 assert.equal(f.calls.find(c=>c.method==='native.run')!.args.inputs.image,`assets/theastraydev-local-models/${imageId}/image.png`);
 assert.equal(result.referenceJobId,imageId);assert.equal(result.jobId,modelId);
 assert.equal(result.assets[0].url,`/assets/theastraydev-local-models/${modelId}/shape.glb`);
 assert.equal(result.completed,false);assert.equal(result.textured,false);
 assert.equal(result.nextCall.arguments.shapeJobId,modelId);
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
 assert.deepEqual(f.calls.filter(c=>c.method==='native.run').map(c=>c.args.job),['image','model-shape']);
 assert.equal(result.referenceJobId,imageId);
 const painted:any=await f.plugin.tool!('generate-model',result.nextCall.arguments,f.ctx);
 assert.deepEqual(f.calls.filter(c=>c.method==='native.run').map(c=>c.args.job),['image','model-shape','model-paint']);
 assert.equal(painted.completed,true);assert.equal(painted.textured,true);assert.equal(painted.shapeJobId,modelId);
 assert.equal(painted.assets[0].url,`/assets/theastraydev-local-models/${paintId}/model.glb`);
 const inputs=f.calls.filter(c=>c.method==='native.run').at(-1)!.args.inputs;
 assert.deepEqual(inputs,{image:`assets/theastraydev-local-models/${modelId}/reference.png`,shape:`assets/theastraydev-local-models/${modelId}/shape.glb`});
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
 const shape:any=await f.plugin.tool!('generate-model',reference.nextCall.arguments,f.ctx);
 await f.plugin.tool!('generate-model',shape.nextCall.arguments,f.ctx);
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
  if(method==='native.run'&&args.job==='model-shape')return {id:modelId,state:'failed',reason:'fixture VRAM failure'};
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

test('repeated shape and paint continuations reuse completed jobs instead of generating twice',async t=>{
 const f=await fixture(t),shape:any=await f.plugin.tool!('generate-model',{name:'car',imageJobId:imageId},f.ctx);
 const duplicate:any=await f.plugin.tool!('generate-model',{name:'car',imageJobId:imageId},f.ctx);
 assert.equal(duplicate.shapeJobId,shape.shapeJobId);assert.equal(duplicate.reused,true);
 const painted:any=await f.plugin.tool!('generate-model',shape.nextCall.arguments,f.ctx);
 const again:any=await f.plugin.tool!('generate-model',shape.nextCall.arguments,f.ctx);
 assert.equal(again.jobId,painted.jobId);assert.equal(again.reused,true);assert.equal(again.completed,true);
 assert.deepEqual(f.calls.filter(c=>c.method==='native.run').map(c=>c.args.job),['model-shape','model-paint']);
});

test('a changed project reference is new work, while identical bytes reuse its saved shape',async t=>{
 const f=await fixture(t),file='assets/owned.png';
 await mkdir(path.join(f.ctx.directory!,'assets'),{recursive:true});
 await writeFile(path.join(f.ctx.directory!,file),'first reference');
 await f.plugin.tool!('generate-model',{name:'car',image:file},f.ctx);
 await writeFile(path.join(f.ctx.directory!,file),'changed reference');
 await f.plugin.tool!('generate-model',{name:'car',image:file},f.ctx);
 const reused:any=await f.plugin.tool!('generate-model',{name:'car',image:file},f.ctx);
 assert.equal(reused.reused,true);
 assert.equal(f.calls.filter(c=>c.method==='native.run').length,2);
});

for(const state of ['failed','cancelled','interrupted','running'])test(`paint ${state} retains the shape, reports incomplete texturing and prevents an automatic duplicate`,async t=>{
 const f=await fixture(t),shape:any=await f.plugin.tool!('generate-model',{name:'car',imageJobId:imageId},f.ctx),host=f.ctx.host;
 let launches=0;
 f.ctx.host=(async(method:string,args:any)=>{
  if(method==='native.run'&&args.job==='model-paint'){
   launches++;
   const job={id:paintId,project:'racer',recipe:'model-paint',state,reason:'five-minute timeout or cancellation',inputs:Object.fromEntries(Object.entries(args.inputs).map(([key,file])=>[key,{file,sha256:createHash('sha256').update('fixture').digest('hex')}])),files:[]};
   f.jobs.set(paintId,job);return job;
  }
  return host(method,args);
 }) as PluginContext['host'];
 for(let attempt=0;attempt<2;attempt++){
  const result:any=await f.plugin.tool!('generate-model',shape.nextCall.arguments,f.ctx);
  assert.equal(result.completed,false);assert.equal(result.textured,false);assert.equal(result.state,'paint-incomplete');
  assert.equal(result.shapeJobId,modelId);assert.equal(result.nextCall,undefined);
  assert.match(result.instruction,/Painting did not finish/);
  assert.equal(result.shapeAssets[0].url,`/assets/theastraydev-local-models/${modelId}/shape.glb`);
 }
 assert.equal(launches,1);
 const retained:any=await f.plugin.tool!('retrieve',{id:modelId},f.ctx);
 assert.equal(retained.restored,true);assert.equal(f.jobs.get(modelId).state,'completed');
 const listing:any=await f.plugin.tool!('assets',{},f.ctx);
 assert.ok(listing.assets.some((job:any)=>job.jobId===modelId));
});

test('an aborted paint call releases its lease and still returns the retained shape',async t=>{
 const f=await fixture(t),shape:any=await f.plugin.tool!('generate-model',{name:'car',imageJobId:imageId},f.ctx),host=f.ctx.host;
 const controller=new AbortController();f.ctx.signal=controller.signal;
 f.ctx.host=(async(method:string,args:any)=>{
  if(method==='native.run'&&args.job==='model-paint'){controller.abort();throw new DOMException('Cancelled','AbortError');}
  return host(method,args);
 }) as PluginContext['host'];
 const result:any=await f.plugin.tool!('generate-model',shape.nextCall.arguments,f.ctx);
 assert.equal(result.state,'paint-incomplete');assert.equal(result.shapeJobId,modelId);
 f.ctx.signal=new AbortController().signal;
 const restored:any=await f.plugin.tool!('retrieve',{id:modelId},f.ctx);assert.equal(restored.restored,true);
 const {readFile}=await import('node:fs/promises');
 await assert.rejects(readFile(path.join(f.ctx.directory!,'generation.lock')),{code:'ENOENT'});
});

test('painting rejects cross-project, unfinished, wrong-recipe and changed-profile jobs before inference',async t=>{
 const f=await fixture(t),shape:any=await f.plugin.tool!('generate-model',{name:'car',imageJobId:imageId},f.ctx);
 await assert.rejects(f.plugin.tool!('generate-model',{...shape.nextCall.arguments,quality:'high'},f.ctx),/preserve/);
 for(const change of [{project:'other-game'},{state:'failed'},{recipe:'image'}]){
  const original=f.jobs.get(modelId);f.jobs.set(modelId,{...original,...change});
  await assert.rejects(f.plugin.tool!('generate-model',shape.nextCall.arguments,f.ctx));f.jobs.set(modelId,original);
 }
 assert.equal(f.calls.filter(c=>c.method==='native.run').length,1);
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
