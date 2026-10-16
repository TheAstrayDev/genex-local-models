import type {PluginContext,PluginNativeResult} from '../vendor/genex-sdk.d.ts';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Paths are the host's delivery, never reconstructed from an asset name or UUID. */
export function assetEntries(files:string[]){
 return files.map(file=>({file,url:file.startsWith('Assets/')?null:'/'+file.replace(/^public\//,'').split('/').map(encodeURIComponent).join('/')}));
}

export async function savedRecord(ctx:PluginContext,id:string):Promise<Record<string,any>>{
 try{
  const record=await ctx.host('jobs.read',{id});
  return record&&typeof record==='object'&&!Array.isArray(record)&&'jobId' in record&&record.jobId===id?record as Record<string,any>:{};
 }catch(error){
  if((error as NodeJS.ErrnoException).code==='ENOENT'||/ENOENT/.test(String(error)))return {};
  throw error;
 }
}

/** The host scopes native results to the bound project; check it again before restoring. */
export async function nativeResult(ctx:PluginContext,id:unknown){
 if(typeof id!=='string'||!uuid.test(id))throw Error('Use the exact job UUID returned earlier.');
 if(!ctx.project)throw Error('Open a game before reading or restoring its Local Models assets.');
 const native=await ctx.host('native.result',{id});
 if(!native||native.project!==ctx.project)throw Error('This job is unavailable in this project. No files were copied.');
 return native;
}

const nativeSummary=(native:PluginNativeResult)=>({id:native.id,state:native.state,recipe:native.recipe,files:native.files,createdAt:native.createdAt,finishedAt:native.finishedAt,reason:native.reason});

/** Restore retained bytes via normal host delivery, including its Assets event and quota checks. */
export async function retrieve(ctx:PluginContext,id:unknown){
 const native=await nativeResult(ctx,id),previous=await savedRecord(ctx,native.id);
 if(native.state!=='completed')return {record:previous,native:nativeSummary(native),restored:false};
 const files=await ctx.host('assets.deliver',{output:native.output,jobId:native.id});
 const record={...previous,jobId:native.id,files,assets:assetEntries(files),use:previous.use?.workspace===ctx.directory?previous.use:{stage:'unconfirmed'}};
 await ctx.host('jobs.write',{id:native.id,value:record});
 return {record,native:nativeSummary(native),restored:true,integration:'Use exact assets[].url in this workspace. Never retype a UUID. Delivery registers files in Genex Assets; it does not verify their use in the game.'};
}

/** Read-only discovery of this game's retained assets, even after a failed or removed build. */
export async function retainedAssets(ctx:PluginContext){
 if(!ctx.project)throw Error('Open a game to list its Local Models assets.');
 const jobs=(await ctx.host('native.jobs')).filter(job=>job.project===ctx.project&&job.state==='completed');
 jobs.sort((a,b)=>(b.finishedAt??'').localeCompare(a.finishedAt??''));
 const assets=await Promise.all(jobs.slice(0,100).map(async job=>{
  const record=await savedRecord(ctx,job.id);
  return {jobId:job.id,name:record.name??job.recipe,task:record.task??job.recipe,model:record.model??null,at:job.finishedAt,files:record.files??[],use:record.use?.workspace===ctx.directory?record.use:{stage:'unconfirmed'},availability:'retained; retrieve to deliver into the current workspace'};
 }));
 return {project:ctx.project,assets,truncated:jobs.length>100,next:'Use theastraydev-local-models__retrieve with an exact jobId to restore files into this game or build. No generation or download is needed.'};
}

/** A user setup action, bound by Genex to the currently selected game. */
export async function restoreAssets(ctx:PluginContext){
 const listing=await retainedAssets(ctx),restored=[],failed=[];
 for(const asset of listing.assets){
  ctx.signal.throwIfAborted();
  try{restored.push((await retrieve(ctx,asset.jobId)).record);}
  catch(error){failed.push({jobId:asset.jobId,error:String(error)});}
 }
 return {restored,failed,truncated:listing.truncated};
}
