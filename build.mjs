import {mkdir,readFile,writeFile,cp,unlink} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {fileSkills,localWorkflow} from './skills.mjs';
const root=import.meta.dirname,out=path.join(root,'package');await mkdir(out,{recursive:true});
const version=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
const OTHER_TIMEOUT_MS=5*60*1000;
await build({entryPoints:[path.join(root,'src/backend.ts')],bundle:true,platform:'node',format:'esm',target:'node22',banner:{js:'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'},outfile:path.join(out,'backend.mjs')});
const browser=await build({entryPoints:[path.join(root,'src/panel.ts')],bundle:true,platform:'browser',format:'iife',write:false});
await writeFile(path.join(out,'panel.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local Models</title><style>${await readFile(path.join(root,'src/style.css'),'utf8')}</style><main id="root"></main><script>${await readFile(path.join(root,'vendor/panel.js'),'utf8')}</script><script>${browser.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></html>`);
const string={type:'string'},number={type:'number'};
const tools=[
 {name:'inspect-use',description:'Required after integrating a generated asset. Observe the current game through the same host service as Genex Tools. Reports missing runtime loads, captures the actual frame, and verifies audible playback. A delivered file or loader stub is not integration.',parameters:{type:'object',properties:{id:string},required:['id']}},
 {name:'verify-use',description:'Record visible asset use after a successful current inspect-use. Use its exact inspectionId and describe what is visible in the attached frame. Cannot verify missing runtime loads.',parameters:{type:'object',properties:{id:string,inspectionId:string,note:string},required:['id','inspectionId','note']}},
 {name:'status',description:'Inspect assigned local generation models and readiness. No weights are loaded. Use before creating an asset.',parameters:{type:'object',properties:{}}},
 {name:'generate-image',description:'Generate a local PNG. Default assets, icons and model-reference purposes automatically receive Qwen native RGBA instructions and must pass a real alpha check. Agent supplies only its object description. Use purpose:scene for a full illustration or task:texture for an opaque material. One bounded native retry on alpha failure; no image editing or paid fallback.',parameters:{type:'object',properties:{name:string,prompt:string,task:{type:'string',description:'image or texture'},purpose:{type:'string',enum:['asset','icon','model-reference','scene'],description:'Default asset: native transparent PNG. icon: readable icon. model-reference: isolated three-quarter object. scene: full image with a background. Do not set purpose for task:texture.'},size:{type:'number',description:'512 or 768; default 512'},seed:number},required:['name','prompt']}},
 {name:'generate-audio',description:'Generate sound effects or music with an assigned installed Stable Audio model. Requires licensed Hugging Face access before setup. One worker, unloaded after completion. No paid fallback.',parameters:{type:'object',properties:{name:string,prompt:string,task:{type:'string',description:'sfx or music'},duration:{type:'number',description:'1 to 120 seconds'},seed:number},required:['name','prompt']}},
 {name:'generate-model',description:'Generate a textured GLB with local Hunyuan3D. Use exactly one: prompt to save a Qwen reference and return nextCall (immediately follow it to finish Hunyuan3D in a separate tool call); imageJobId to reuse an existing image without copying paths; or image for a project image under assets/ or public/. GPU phases run sequentially. Reference is retained if mesh generation fails. No animation.',parameters:{type:'object',properties:{name:string,quality:{type:'string',enum:['high','balanced'],description:'Default balanced: 384 shape, 50k triangles, native 512px paint views, 1K atlas. Experimental high: 512 shape, up to 200k triangles, 512px views, 2K atlas; may introduce texture noise and takes longer. Both preserve surface normals. Higher density does not guarantee better appearance; inspect the result. No silent downgrade.'},prompt:{type:'string',description:'Describe the object and art style. The plugin automatically requests a native transparent three-quarter RGBA reference, then creates a textured GLB.'},imageJobId:{type:'string',description:'Exact completed image job UUID from this game; no manual copy or new image generation.'},image:{type:'string',description:'Exact project-relative PNG/JPEG/WebP path under assets/ or public/.'},seed:number},required:['name']}},
 {name:'retrieve',description:'Restore a retained job into the current game/build through normal Genex Assets delivery. Reuses saved bytes, never regenerates; refuses to overwrite changed files. Only jobs belonging to this game.',parameters:{type:'object',properties:{id:string},required:['id']}},
 {name:'assets',description:'List this game\'s retained Local Models assets and exact job IDs, including results from stopped builds. Read only: no models run and no files are copied. Use retrieve to restore a result into the current workspace.',parameters:{type:'object',properties:{}}}
];
const chunks=Array.from({length:12},(_,index)=>`r${index}`);
const jobs=[['image','image.png'],['audio','audio.wav'],['model-shape','shape.glb'],['model-paint','model.glb']].map(([kind,output])=>{
 const inputs=kind==='model-paint'?['image','shape']:kind==='model-shape'?['image']:[];
 return {id:kind,runtime:kind==='image'?'qwen':'theastraydev-local-models',args:[{source:'package',name:'worker.py'},kind,{source:'output',name:output},...chunks.map(name=>({source:'value',name})),...inputs.map(name=>({source:'input',name}))],inputs,values:Object.fromEntries(chunks.map(key=>[key,{pattern:'^[A-Za-z0-9+/=.]{1,1024}$',maxLength:1024}])),outputs:kind==='model-shape'?[output,'reference.png']:[output],timeoutMs:OTHER_TIMEOUT_MS,maxOutputBytes:128000,maxAssetBytes:104857600,gpu:true};
});
const manifest={apiVersion:3,id:'theastraydev-local-models',version:'0.1.0',name:'Local Models',publisher:'TheAstrayDev',description:'Local asset generation with one model at a time. Qwen images, gated Stable Audio setup and experimental Hunyuan3D 2.0 Turbo. Standard Genex API 3; no customization API required.',icon:'icon.svg',backend:'backend.mjs',capabilities:['native-runtime','project.read','project.write','jobs'],tools,
skills:[{name:'local-assets',text:'For asset generation prefer assigned local models when this plugin is enabled. First call theastraydev-local-models__status. Use theastraydev-local-models__generate-image for images or textures, theastraydev-local-models__generate-audio for music/sfx and theastraydev-local-models__generate-model for 3D from a reference PNG. Only installed, assigned adapters work; a chat LLM cannot substitute for an audio, image or mesh model. There is one model process at a time. If busy, wait for completion before trying again. Cancellation may take time to release GPU memory. Preserve exact delivered paths, load the returned asset in the game and verify visible or audible use. Do not call a paid genex generation tool as a silent fallback. This plugin does not replace publishing or account tools and cannot animate meshes.'}],panels:[{id:'setup',title:'Local Models',file:'panel.html',placement:'settings'}],settings:[],actions:[{name:'status',label:'Model status'},{name:'discover',label:'Find existing models'},{name:'assign',label:'Save assignments'}],nativeRuntimes:[],nativeJobs:jobs};
manifest.description='Choose local models for images, textures, sound, music and 3D. Qwen Turbo Q4/Q8, Stable Audio and Hunyuan3D Turbo/Mini. Experimental platform profiles; 3D needs separate Windows CUDA setup. Each native job is capped at five minutes. New Q8/Mini inference is not yet verified.';
manifest.version=version;
manifest.skills=[localWorkflow,...await fileSkills(root)];
tools.find(tool=>tool.name==='generate-audio').description='Generate sound effects or music with the assigned installed Stable Audio 3 Small Q8 model. One worker, unloaded after completion. No paid fallback.';
const modelTool=tools.find(tool=>tool.name==='generate-model');
modelTool.description='Generate Hunyuan3D in separate five-minute jobs. Exactly one input: prompt saves a reference; imageJobId or image saves an untextured shape; shapeJobId paints that retained shape. Immediately follow nextCall between stages. A paint failure returns paint-incomplete with retained shapeAssets, never a finished textured model. Reuse job IDs; never retry failed work automatically. Windows x64 NVIDIA CUDA; RTX 4070 12 GB / 32 GB RAM tested; slower hardware may time out.';
modelTool.parameters.properties.shapeJobId={type:'string',description:'Exact completed model-shape job UUID from this project. Reuses its mesh, prepared PNG, seed and quality without regenerating the reference or shape.'};
modelTool.parameters.properties.prompt.description='Describe the object and art style. Returns a reference-ready continuation, then shape-ready, then the textured GLB. Follow each nextCall in a separate call.';
manifest.capabilities.push('network','observe');
manifest.network={hosts:['huggingface.co','github.com','www.python.org']};
// The host stores these declared settings and uses them for native discovery.
// An optional existing runtime can live anywhere the person chooses.
for(const family of ['qwen','audio','hunyuan']){
 const key=family+'-python';
 manifest.settings.push({key,label:family+' Python program (optional full path to a prepared runtime)',type:'string',default:''});
 const selected='setting:'+key;
 const win=[selected,`home:Genex-Local-Models/${family}/python.exe`,`storage:runtimes/${family}/python.exe`];
 const mac=[selected,`home:Genex-Local-Models/${family}.app/Contents/bin/python3.11`,`storage:runtimes/${family}.app/Contents/bin/python3.11`];
 const platforms=[{platform:'win32-x64',candidates:win}];
 if(family!=='hunyuan')platforms.push({platform:'darwin-arm64',candidates:mac});
 manifest.nativeRuntimes.push({id:family,label:family+' local runtime',candidates:family==='hunyuan'?win:[...win,...mac.filter(candidate=>candidate!==selected)],version:{args:['--version'],pattern:'Python (\\d+\\.\\d+\\.\\d+)',minimum:'3.11.0'},platforms});
}
manifest.actions.push({name:'install',label:'Install model',confirmation:'Download the selected public model and its verified runtime? The review shows the size and folders. Original model licenses apply. No account or token is sent.'},{name:'cancel-install',label:'Cancel model download'});
manifest.actions.push({name:'restore-assets',label:'Restore generated assets to this game'});
manifest.actions.push({name:'activity',label:'Generation activity'});
for(const job of manifest.nativeJobs)if(job.id!=='image')job.runtime=job.id==='audio'?'audio':'hunyuan';
await writeFile(path.join(out,'plugin.json'),JSON.stringify(manifest,null,2));
await cp(path.join(root,'plugin/skills'),path.join(out,'skills'),{recursive:true});
await cp(path.join(root,'plugin/worker.py'),path.join(out,'worker.py'));
await cp(path.join(root,'plugin/hunyuan.py'),path.join(out,'hunyuan.py'));
await cp(path.join(root,'plugin/native'),path.join(out,'native'),{recursive:true});
await cp(path.join(root,'plugin/lpac_path.h'),path.join(out,'lpac_path.h'));
await cp(path.join(root,'plugin/audio-runtime.json'),path.join(out,'audio-runtime.json'));
for(const file of ['audio.py','trellis.py'])await unlink(path.join(out,file)).catch(error=>{if(error.code!=='ENOENT')throw error;});
for(const file of ['README.md','LICENSE'])await cp(path.join(root,file),path.join(out,file));
await cp(path.join(root,'docs'),path.join(out,'docs'),{recursive:true});
await cp(path.join(root,'validation.json'),path.join(out,'validation.json'));
await cp(path.join(root,'vendor/LICENSE.genex'),path.join(out,'LICENSE.genex'));
await cp(path.join(root,'vendor/LICENSE.rembg'),path.join(out,'LICENSE.rembg'));
await mkdir(path.join(out,'vendor'),{recursive:true});
await cp(path.join(root,'vendor/LICENSE.genex'),path.join(out,'vendor/LICENSE.genex'));
const licenses=[['yauzl','LICENSE'],['pend','LICENSE'],['tar','LICENSE.md'],['chownr','LICENSE.md'],['minipass','LICENSE.md'],['minizlib','LICENSE'],['yallist','LICENSE.md'],['@isaacs/fs-minipass','LICENSE']];
await writeFile(path.join(out,'THIRD-PARTY-NOTICES.txt'),(await Promise.all(licenses.map(async([dependency,file])=>`${dependency}\n${await readFile(path.join(root,'node_modules',dependency,file),'utf8')}`))).join('\n\n'));
await writeFile(path.join(out,'icon.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#151515"/><g fill="none" stroke="#8890d9" stroke-width="3"><rect x="16" y="16" width="32" height="32" rx="7"/><path d="M25 25h14v14H25zM24 8v8m8-8v8m8-8v8M24 48v8m8-8v8m8-8v8M8 24h8M8 32h8M8 40h8m32-16h8m-8 8h8m-8 8h8"/></g></svg>');
console.log(out);
