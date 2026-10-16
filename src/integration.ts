import {randomUUID} from 'node:crypto';
import type {PluginContext} from '../vendor/genex-sdk.d.ts';
import {nativeResult,retrieve,savedRecord} from './assets.ts';

/** Generation and delivery are not runtime use. The agent receives an explicit remaining step. */
export function integrationFor(jobId:string,files:string[]){
 const model=files.find(file=>file.endsWith('.glb'));
 const url=model?'/'+model.replace(/^public\//,'').split('/').map(encodeURIComponent).join('/'):null;
 return {state:'integration-required',instruction:'Integrate these exact delivered files into the game now, before another generation. Delivery alone does not replace a placeholder. Never leave carModel:null or a loader returning car:null when the requested model is ready. Preserve other game behavior.',
  ...(url?{threeJs:{import:'import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";',load:`const gltf = await new GLTFLoader().loadAsync(${JSON.stringify(url)});`,attach:'Pass gltf.scene to the real gameplay entity (for example carModel: generated.car). Inspect its forward/up axes, rotate it to match gameplay, center it, fit its bounds and ground it before replacing the placeholder. A loaded model can still face sideways. The template loadAsset(name) only accepts short root slugs; do not pass a delivered nested URL to it.'}}:{}),
  inspect:{tool:'theastraydev-local-models__inspect-use',arguments:{id:jobId}},acceptance:'Inspect runtime loading and the returned frame. Only a successful current inspection can be verified; code references or file existence are insufficient.'};
}

/** Uses the same host observation service as Genex Tools, bound to the current game/workspace. */
export async function inspectUse(ctx:PluginContext,id:unknown){
 if(typeof ctx.project!=='string'||typeof ctx.directory!=='string')throw Error('Open a game before inspecting asset use.');
 const restored=await retrieve(ctx,id);
 if(!restored.restored)throw Error('Inspect requires a completed, retained asset.');
 const record=restored.record,files=record.files as string[];
 const observed:any=await ctx.host('observe',{project:ctx.project,root:ctx.directory,files});
 ctx.signal.throwIfAborted();
 const loadedFiles=files.filter(file=>Array.isArray(observed.loadedFiles)&&observed.loadedFiles.includes(file));
 const audioFiles=files.filter(file=>/\.(wav|mp3|ogg|flac|m4a)$/i.test(file));
 const audio=audioFiles.length===files.length&&files.length>0;
 const audible=audio&&audioFiles.every(file=>observed.audio?.some((a:any)=>a.file===file&&a.state==='playing'&&Number.isFinite(a.rms)&&a.rms>0.0001&&a.advancedSeconds>0));
 const allLoaded=files.length>0&&loadedFiles.length===files.length;
 const use={stage:audible?'verified':allLoaded&&!audio?'integrated':'unconfirmed',workspace:ctx.directory,inspectionId:randomUUID(),observedAt:new Date().toISOString(),loadedFiles,verification:audible?'runtime-audio-playback':allLoaded&&!audio?'pending-visual':'not-established',audio:observed.audio};
 await ctx.host('jobs.write',{id:record.jobId,value:{...record,use}});
 const image=observed.image?Buffer.from(observed.image):null;
 return {ok:audible||allLoaded&&!audio,jobId:record.jobId,use,missingFiles:files.filter(file=>!loadedFiles.includes(file)),
  ...(image?{images:[{mimeType:'image/jpeg',data:image.toString('base64'),label:'Asset use in the running game'}]}:{}),
  guidance:audible?'Audible playback established.':allLoaded&&!audio?'The game loaded this asset. Inspect the attached frame, then call verify-use with this inspectionId and describe its visible use.':'Asset integration is incomplete. Wire the delivered file into the actual game entity or audio event and inspect again. Do not report the asset requirement as complete.'};
}

/** A visual verification is the agent's stated observation against the current runtime inspection. */
export async function verifyUse(ctx:PluginContext,args:Record<string,unknown>){
 const native=await nativeResult(ctx,args.id),record=await savedRecord(ctx,native.id);
 if(record.use?.stage!=='integrated'||record.use.workspace!==ctx.directory||record.use.verification!=='pending-visual'||args.inspectionId!==record.use.inspectionId)throw Error('A matching current runtime-loaded visual inspection is required.');
 if(typeof args.note!=='string'||args.note.trim().length<12||args.note.length>2000)throw Error('Describe the asset visible in the inspection frame (12 to 2000 characters).');
 const use={...record.use,stage:'verified',verification:'agent-visual-observation',note:args.note.trim()};
 await ctx.host('jobs.write',{id:native.id,value:{...record,use}});
 return {ok:true,jobId:native.id,use};
}
