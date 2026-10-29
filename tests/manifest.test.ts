import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('prebuilt package fits the stock five-minute policy and retains stage handoffs',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../package/plugin.json',import.meta.url),'utf8'));
 assert.ok(manifest.nativeJobs.every((job:any)=>Number.isInteger(job.timeoutMs)&&job.timeoutMs>=1000&&job.timeoutMs<=300000));
 const shape=manifest.nativeJobs.find((job:any)=>job.id==='model-shape'),paint=manifest.nativeJobs.find((job:any)=>job.id==='model-paint');
 assert.deepEqual(shape.inputs,['image']);assert.deepEqual(shape.outputs,['shape.glb','reference.png']);
 assert.deepEqual(paint.inputs,['image','shape']);assert.deepEqual(paint.outputs,['model.glb']);
 assert.equal(manifest.nativeJobs.some((job:any)=>job.id==='model'),false);
 assert.equal(manifest.tools.find((tool:any)=>tool.name==='generate-model').parameters.properties.shapeJobId.type,'string');
});

test('each runtime uses a declared path setting and portable candidates for supported platforms',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../package/plugin.json',import.meta.url),'utf8'));
 for(const runtime of manifest.nativeRuntimes){
  const setting=`${runtime.id}-python`;
  assert.ok(manifest.settings.some((item:any)=>item.key===setting&&item.type==='string'));
  for(const entry of runtime.platforms){
   assert.ok(['win32-x64','darwin-arm64'].includes(entry.platform));
   assert.equal('arch' in entry,false);
   assert.ok(entry.candidates.includes(`setting:${setting}`));
   assert.ok(entry.candidates.some((candidate:string)=>candidate.startsWith('storage:')));
   assert.ok(entry.candidates.every((candidate:string)=>! /^[A-Za-z]:/.test(candidate.replace(/^(setting|storage|home):/,''))));
  }
  assert.ok(runtime.candidates.includes(`setting:${setting}`));
 }
});
