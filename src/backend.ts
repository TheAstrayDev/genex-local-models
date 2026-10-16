import {mkdir,readFile,writeFile,rename,lstat,readdir,realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {catalog,defaults,routes,validateAssignments,type Route,type Assignments} from './catalog.ts';
import {ModelQueue} from './queue.ts';
import {installation,startInstallation,cancelInstallation,modelHome} from './installer.ts';
import {assetEntries,nativeResult,retrieve,retainedAssets,restoreAssets} from './assets.ts';
import type {Activate,PluginContext} from '../vendor/genex-sdk.d.ts';
import {integrationFor,inspectUse,verifyUse} from './integration.ts';
import {currentHost,compatibility,runtimeDirectory,installationPlan,type Host} from './platform.ts';

const queue=new ModelQueue();
let activeModel:string|null=null;
const runtimeId='qwen';
const MODEL_RESULT='GENEX_LOCAL_RESULT ';

async function storage(ctx:PluginContext){return ctx.host('storage.root');}
async function assignments(root:string):Promise<Assignments>{
 try{return validateAssignments(JSON.parse(await readFile(path.join(root,'assignments.json'),'utf8')));}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {...defaults};throw error;}
}
async function regular(root:string,file:string){
 const target=path.join(root,file);
 try{
  const actual=await realpath(target),base=await realpath(root),relative=path.relative(base,actual);
  return relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&(await lstat(target)).isFile();
 }catch{return false;}
}
async function state(ctx:PluginContext,host:Host){
 const root=await storage(ctx),runtime=await ctx.host('runtime.detect',{runtime:runtimeId});
 const qwen=await ctx.host('runtime.detect',{runtime:'qwen'});
 const audio=await ctx.host('runtime.detect',{runtime:'audio'});
 const hunyuan=await ctx.host('runtime.detect',{runtime:'hunyuan'});
 const runtimeRoot=runtime.path?runtimeDirectory(runtime.path):null;
 const models=await Promise.all(catalog.map(async model=>{
  const selected=model.id==='qwen-image-2.1-turbo'?qwen:model.id==='hunyuan3d-2-turbo'?hunyuan:audio;
  const modelRoot=selected.path?runtimeDirectory(selected.path):null;
  const support=compatibility(model.id,host);
  const required=model.files.map(file=>host.platform==='darwin'?file.replace('audiocpp_cli.exe','audiocpp_cli'):file);
  const available=modelRoot?await Promise.all(required.map(file=>regular(modelRoot,file))):[];
  const ready=support.supported&&selected.state==='ready'&&available.length>0&&available.every(Boolean);
  return {...model,...support,ready,runtimeRoot:modelRoot,state:!support.supported?'unsupported':model.id===activeModel?'working':ready?'sleeping':model.gate?'access-required':'not-installed',
   reason:!support.supported?support.requirement:model.id===activeModel?'One model worker is active. Other models stay asleep.':ready?'Loads only when assigned work starts.':model.id==='hunyuan3d-2-turbo'?'The Hunyuan3D Windows Portable runtime needs its verified local texture setup.':'Use Install to download and verify the public weights and runtime. No account or token is needed.'};
 }));
 let recent:unknown[]=[];
 try{recent=JSON.parse(await readFile(path.join(root,'recent.json'),'utf8'));}catch{}
 return {project:ctx.project??null,host,runtime,qwen,root:runtimeRoot,models,downloadCache:await modelHome(),modelDirectory:path.join(os.homedir(),'Genex-Local-Models'),installation:installation(),assignments:await assignments(root),
  execution:{policy:'one-model-at-a-time',sleep:'terminate-process',active:queue.active,model:activeModel,pending:queue.pending},recent};
}

/** Bounded metadata-only discovery. A filename is not evidence a model can perform every task. */
async function discover(){
 const roots=[path.join(os.homedir(),'.cache/huggingface/hub'),path.join(os.homedir(),'.lmstudio/models'),path.join(os.homedir(),'.cache/lm-studio/models'),path.join(os.homedir(),'.ollama/models/manifests'),'D:/hf-cache/hub','D:/models'];
 const found:{id:string;source:string;supported:boolean}[]=[];
 for(const root of roots){
  try{
   const entries=await readdir(root,{withFileTypes:true});
   for(const entry of entries.slice(0,100)){
    if(entry.isSymbolicLink()||!entry.isDirectory())continue;
    found.push({id:entry.name.replace(/^models--/,'').replace('--','/'),source:root,supported:false});
   }
  }catch(error){if(!['ENOENT','EACCES'].includes((error as NodeJS.ErrnoException).code??''))throw error;}
 }
 return {found,note:'Existing models are listed without loading weights. Only verified task adapters can be assigned; a chat model cannot automatically generate meshes or audio.'};
}

export function requestFor(name:string,args:Record<string,unknown>):{route:Route;request:Record<string,string|number>;inputs:Record<string,string>}{
 const allowed=name==='generate-image'?['name','prompt','task','purpose','size','seed']:name==='generate-audio'?['name','prompt','task','duration','seed']:name==='generate-model'?['name','image','seed','quality']:[];
 if(!allowed.length||Object.keys(args).some(key=>!allowed.includes(key)))throw Error('Unknown generation argument.');
 if(typeof args.name!=='string'||!/^[a-z0-9][a-z0-9-]{0,39}$/.test(args.name))throw Error('Choose a lowercase asset name, up to 40 characters.');
 const seed=args.seed??42;
 if(!Number.isInteger(seed)||Number(seed)<0||Number(seed)>2147483647)throw Error('Seed must be an integer from 0 to 2147483647.');
 let route:Route;
 if(name==='generate-model'){
  const quality=args.quality??'balanced';
  if(quality!=='balanced'&&quality!=='high')throw Error('Choose model quality high or balanced.');
  if(typeof args.image!=='string'||!args.image||path.isAbsolute(args.image)||/^[a-z]:/i.test(args.image)||args.image.includes('\\')||args.image.split('/').some(p=>!p||p.startsWith('.'))||!/^(public\/|assets\/).*\.(png|jpe?g|webp)$/i.test(args.image))throw Error('Use an existing project-relative PNG, JPEG or WebP under public/ or assets/.');
  route='model';
  return {route,request:{seed:Number(seed),quality},inputs:{image:args.image}};
 }
 if(typeof args.prompt!=='string'||!args.prompt.trim()||args.prompt.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(args.prompt))throw Error('Describe the asset in 1 to 2000 characters.');
 if(name==='generate-image'){
  route=(args.task??'image') as Route;
  if(!['image','texture'].includes(route))throw Error('Choose image or texture.');
  const size=args.size??512;
  if(![512,768].includes(Number(size))||typeof size!=='number')throw Error('Choose size 512 or 768 for the 12 GB profile.');
  if(args.purpose!==undefined&&(!['asset','icon','model-reference','scene'].includes(String(args.purpose))||route==='texture'))throw Error('Choose an image purpose: asset, icon, model-reference or scene. Textures use task:texture without purpose.');
  const purpose=route==='texture'?'texture':args.purpose??'asset';
  return {route,request:{prompt:args.prompt,seed:Number(seed),size:Number(size),purpose:purpose as string},inputs:{}};
 }
 route=(args.task??'sfx') as Route;
 if(!['sfx','music'].includes(route))throw Error('Choose sfx or music.');
 const duration=args.duration??(route==='music'?30:5);
 if(typeof duration!=='number'||!Number.isFinite(duration)||duration<1||duration>120)throw Error('Duration must be 1 to 120 seconds.');
 return {route,request:{prompt:args.prompt,seed:Number(seed),duration},inputs:{}};
}

async function generate(name:string,args:Record<string,unknown>,ctx:PluginContext,host:Host){
 const request=requestFor(name,args),root=await storage(ctx);
 const selection=await assignments(root),selected=selection[request.route];
 if(!selected)throw Error(`No local model is assigned to ${request.route}. Choose one in Plugins → Local Models.`);
 const snapshot=await state(ctx,host),model=snapshot.models.find(model=>model.id===selected);
 if(!model?.ready)throw Error(`${model?.name??selected}: ${model?.reason??'not installed'}`);
 return queue.run(root,ctx.signal,async()=>{
  activeModel=selected;
  try{
  const started=Date.now();
  const encoded=Buffer.from(JSON.stringify({...request.request,model:selected})).toString('base64');
  if(encoded.length>12288)throw Error('Encoded generation request exceeds the native API limit.');
  const values=Object.fromEntries(Array.from({length:12},(_,index)=>[`r${index}`,encoded.slice(index*1024,(index+1)*1024)||'.']));
  const job=await ctx.host('native.run',{job:request.route==='model'?'model':request.route==='music'||request.route==='sfx'?'audio':'image',inputs:request.inputs,values});
  if(job.state!=='completed')throw Error(`Local generation ${job.state}: ${job.reason??''} ${job.stdout?.slice(-1800)??''} ${job.stderr?.slice(-1200)??''}. The worker has stopped; no paid fallback was used.`);
  const line=job.stdout?.split('\n').findLast(line=>line.startsWith(MODEL_RESULT));
  if(!line)throw Error(`Job ${job.id} produced no verified worker receipt. Inspect this job before retrying.`);
  const receipt=JSON.parse(line.slice(MODEL_RESULT.length));
  const files=await ctx.host('assets.deliver',{output:job.output,jobId:job.id});
  const result={jobId:job.id,name:args.name,model:selected,task:request.route,files,assets:assetEntries(files),seconds:(Date.now()-started)/1000,worker:receipt,sleep:'process exited; model weights released',use:{stage:'unconfirmed'},integration:integrationFor(job.id,files)};
  await ctx.host('jobs.write',{id:job.id,value:result});
  let recent:any[]=[];try{recent=JSON.parse(await readFile(path.join(root,'recent.json'),'utf8'));}catch{}
  recent.unshift({...result,at:new Date().toISOString()});
  const temp=path.join(root,`recent-${randomUUID()}.tmp`);await writeFile(temp,JSON.stringify(recent.slice(0,20)));await rename(temp,path.join(root,'recent.json'));
  return result;
  }finally{activeModel=null;}
 });
}

/** One request can create its own reference; every GPU phase keeps the existing single-worker lease. */
async function generateModel(args:Record<string,unknown>,ctx:PluginContext,host:Host){
 const allowed=['name','image','imageJobId','prompt','seed','quality'];
 if(Object.keys(args).some(key=>!allowed.includes(key)))throw Error('Unknown generation argument.');
 const choices=['image','imageJobId','prompt'].filter(key=>args[key]!==undefined);
 if(choices.length!==1)throw Error('Choose exactly one of image, imageJobId or prompt.');
 if(choices[0]==='image')return generate('generate-model',args,ctx,host);
 // Validate everything before an expensive reference generation or any delivery.
 const selection=await state(ctx,host),selected=selection.assignments.model;
 const model=selection.models.find(model=>model.id===selected);
 if(!model?.ready)throw Error(`No ready local model is assigned to model. ${model?.reason??'Choose Hunyuan3D in Plugins → Local Models.'}`);
 const profile=requestFor('generate-model',{name:args.name,image:'assets/reference.png',seed:args.seed,quality:args.quality}).request.quality;
 let referenceJobId=args.imageJobId;
 if(choices[0]==='prompt'){
  const image=await generate('generate-image',{name:args.name,prompt:args.prompt,task:'image',purpose:'model-reference',size:profile==='high'?768:512,seed:args.seed},ctx,host);
  // Hunyuan can use most of Genex's five-minute tool budget itself. Retain the
  // reference and let Studio continue in a second call, without asking the user.
  return {state:'reference-ready',completed:false,referenceJobId:image.jobId,referenceAssets:image.assets,
   nextCall:{tool:'theastraydev-local-models__generate-model',arguments:{name:args.name,imageJobId:image.jobId,seed:args.seed??42,quality:profile}},
   instruction:'The 3D model is not generated yet. Immediately make nextCall to finish the authorized request. Do not regenerate this reference or ask the user to copy files. Separate calls preserve Genex\'s native time limit.'};
 }
 const reference=await nativeResult(ctx,referenceJobId);
 if(reference.state!=='completed'||reference.recipe!=='image')throw Error('Use a completed image job from this project as the 3D reference.');
 const delivered=await retrieve(ctx,reference.id),image=delivered.record.files.find((file:string)=>/\.(png|jpe?g|webp)$/i.test(file));
 if(!image)throw Error(`Reference job ${reference.id} has no delivered image. Retrieve it before retrying; do not regenerate it.`);
 try{
  const result={...await generate('generate-model',{name:args.name,image,seed:args.seed,quality:profile},ctx,host),referenceJobId:reference.id};
  await ctx.host('jobs.write',{id:result.jobId,value:result});
  return result;
 }catch(error){throw Error(`3D generation did not complete. Reference job ${reference.id} is retained. Retry with imageJobId=${reference.id} and quality=${profile} to reuse it. ${String(error)}`);}
}

/** Inject only host identity for deterministic cross-platform workflow fixtures. */
export const createPlugin=(host:Host):Awaited<ReturnType<Activate>>=>({
 async review(name,args){
  if(name!=='install')return {};
  if(Object.keys(args).length!==1||typeof args.model!=='string')throw Error('Choose a reviewed model.');
  const plan=installationPlan(args.model,host);
  const directory=path.join(os.homedir(),'Genex-Local-Models',plan.family+(plan.apple?'.app/Contents':''));
  return {message:`Download and verify ${args.model} and its ${plan.backend} runtime (about ${((plan.python.size+plan.assets.reduce((n,a)=>n+a.size,0))/1e9).toFixed(1)} GB). Download cache: ${await modelHome()}. Working files: ${directory}. Existing verified CUDA installations retain CUDA. Original model licenses apply. No account or token is used; generation does not download models.`};
 },
 async action(name,args,ctx){
  if(name==='status')return state(ctx,host);
  if(name==='discover')return discover();
  if(name==='restore-assets')return restoreAssets(ctx);
  if(name==='install'){
   if(Object.keys(args).length!==1||typeof args.model!=='string')throw Error('Choose a reviewed model.');
   return startInstallation(args.model);
  }
  if(name==='cancel-install')return cancelInstallation();
  if(name==='assign'){
   const value=validateAssignments(args),root=await storage(ctx);await mkdir(root,{recursive:true});
   const temp=path.join(root,`assignments-${randomUUID()}.tmp`);await writeFile(temp,JSON.stringify(value));await rename(temp,path.join(root,'assignments.json'));return value;
  }
  throw Error('Unknown Local Models action.');
 },
 async tool(name,args,ctx){
  if(name==='status')return state(ctx,host);
  if(name==='assets')return retainedAssets(ctx);
  if(name==='inspect-use'){
   if(Object.keys(args).some(key=>key!=='id'))throw Error('Unknown inspection argument.');
   return inspectUse(ctx,args.id);
  }
  if(name==='verify-use'){
   if(Object.keys(args).some(key=>!['id','inspectionId','note'].includes(key)))throw Error('Unknown verification argument.');
   return verifyUse(ctx,args);
  }
  if(name==='retrieve'){
   if(Object.keys(args).some(key=>key!=='id'))throw Error('Unknown retrieval argument.');
   return retrieve(ctx,args.id);
  }
  if(name==='generate-model')return generateModel(args,ctx,host);
  return generate(name,args,ctx,host);
 }
});
export const activate:Activate=()=>createPlugin(currentHost());
