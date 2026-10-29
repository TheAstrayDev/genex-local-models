/** Disposable registry acceptance; never initializes or mutates the person's Genex profile. */
import {mkdir,readFile,writeFile,cp,access} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

if(!process.env.GENEX_SOURCE_DIR)throw Error('Set GENEX_SOURCE_DIR to a Genex checkout. No timeout patch is needed.');
const host=path.resolve(process.env.GENEX_SOURCE_DIR),source=path.resolve(import.meta.dirname,'../package');
const load=(file:string)=>import(pathToFileURL(path.join(host,file)).href);
const {PluginRegistry}=await load('src/substrate/plugins/registry.ts');
const {inspectPackage}=await load('src/substrate/plugins/manifest.ts');
const {scanPackage}=await load('src/substrate/plugins/scan.ts');
const {PluginServices}=await load('src/substrate/plugins/services.ts');
const evidence=path.resolve(import.meta.dirname,'../.evidence/host-'+randomUUID());
const root=path.join(evidence,'registry'),seeds=path.join(evidence,'seeds'),game=path.join(evidence,'game');
for(const directory of [seeds,game])await mkdir(directory,{recursive:true});
const binding={project:'acceptance-fixture',directory:game,threadId:'same-chat-fixture'};
const id='theastraydev-local-models',services=new PluginServices(path.join(root,'data'),{},async()=>{throw Error('No gameplay observation was requested');});
let serviceCalls=0,nativeRuns=0;
const registry=new PluginRegistry(root,seeds,path.join(host,'src/plugin-sdk/backend.mjs'),async(plugin:string,method:string,args:unknown,bound:unknown)=>{
 assert.equal(plugin,id);serviceCalls++;return services.call(plugin,method,args,bound);
});
// Synthetic consent only in this disposable fixture, and only for harmless reads.
// This is not evidence that a real person completed the application's trust flow.
registry.consent=async(plugin:string,tool:any)=>{
 assert.equal(plugin,id);assert.ok(['status','assets'].includes(tool.name));
 return {approved:true,by:'user'};
};
registry.nativeService=async(_manifest:unknown,_directory:string,method:string)=>{
 if(method==='runtime.detect')return {state:'missing',detail:'No weights provisioned in this isolated acceptance fixture'};
 if(method==='native.jobs')return [];
 if(method==='native.run')nativeRuns++;
 throw Error('Unexpected native operation: '+method);
};
try{
 await registry.init();
 const manifest=await inspectPackage(source),scan=await scanPackage(source,manifest);
 assert.equal(manifest.id,id);assert.notEqual(scan.verdict,'dangerous');
 // A synthetic previous version proves same-identity assignment preservation, not historical stock acceptance.
 const previous=path.join(evidence,'previous');await cp(source,previous,{recursive:true});
 await writeFile(path.join(previous,'plugin.json'),JSON.stringify({...manifest,version:'0.1.11'},null,2));
 await registry.installLocal(previous,'local',manifest.capabilities,undefined,await scanPackage(previous,await inspectPackage(previous)));
 await registry.setEnabled(id,true);
 await registry.setSetting(id,'hunyuan-python','C:/prepared-runtime/python.exe');
 const settings={image:null,texture:'qwen-image-2.1-turbo',sfx:null,music:'stable-audio-3-small-music',model:null};
 await registry.action(id,'assign',settings,binding);
 await registry.installLocal(source,'local',manifest.capabilities,undefined,scan);
 await registry.setEnabled(id,true);
 assert.equal((await registry.settings(id))['hunyuan-python'],'C:/prepared-runtime/python.exe');
 const snapshot=registry.snapshot();
 assert.equal(snapshot.tools.filter((tool:any)=>tool.name===id+'__skill').length,1);
 assert.equal(snapshot.applied.skills.length,15);
 const status=await registry.tool(id+'__status',{},binding);
 assert.deepEqual(status.assignments,settings);assert.equal(status.execution.active,false);
 const assets=await registry.tool(id+'__assets',{},binding);assert.deepEqual(assets.assets,[]);
 const checked=[];
 for(const skill of manifest.skills.filter((skill:any)=>skill.file)){
  const card=await registry.tool(id+'__skill',{name:skill.name},binding);
  assert.equal(card.skill,skill.name);
  for(const file of card.references)assert.equal((await registry.tool(id+'__skill',{name:skill.name,file},binding)).file,file);
  checked.push(skill.name);
 }
 const assetCard=await registry.tool(id+'__skill',{name:'asset-preference'},binding);
 assert.deepEqual(assetCard.references,['skills/asset-preference/references/build-orchestration.md']);
 await assert.rejects(registry.tool(id+'__skill',{name:'game-quality',file:assetCard.references[0]},binding));
 await assert.rejects(registry.tool(id+'__skill',{name:'game-quality',file:'../backend.mjs'},binding));
 await registry.setEnabled(id,false);assert.equal(registry.snapshot().tools.length,0);assert.equal(registry.snapshot().applied.skills.length,0);
 await assert.rejects(registry.tool(id+'__status',{},binding));
 await registry.setEnabled(id,true);assert.equal((await registry.tool(id+'__status',{},binding)).execution.active,false);
 await registry.remove(id);assert.equal(registry.snapshot().tools.length,0);assert.equal(registry.snapshot().applied.skills.length,0);
 await assert.rejects(registry.tool(id+'__status',{},binding));
 await access(path.join(root,'data',id,'assignments.json'));assert.equal(nativeRuns,0);
 const referenceFiles=manifest.skills.reduce((count:number,skill:any)=>count+(skill.references?.length??0),0);
 assert.equal(referenceFiles,5);
 const result={passed:true,version:manifest.version,id,freshRegistryInstall:true,harmlessToolCalls:['status','assets'],sameBindingEnableAndUse:true,syntheticPreviousVersion:'0.1.11',assignmentsPreserved:true,disabledToolsAndSkillsWithdrawn:true,removedToolsAndSkillsWithdrawn:true,removedStoragePreserved:true,fileSkills:checked.length,referenceFiles,orchestrationReferenceReadable:true,crossSkillReferenceRejected:true,nativeRuns,serviceCalls,accountFlow:'none',realAppChat:false,realInference:false};
 await writeFile(path.join(evidence,'validation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,evidence},null,2));
}finally{registry.cancel();}
