/** Download only pinned interpreters/CLIs into a disposable fixture. No weights,
 * personal runtime directory, game, account or model inference are touched. */
import {mkdtemp,mkdir,cp,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {installationPlan,currentHost} from '../src/platform.ts';
import {downloadAsset,prepareRuntime} from '../src/installer.ts';

const evidence=await mkdtemp(path.join(os.tmpdir(),'glm-native-smoke-'));
const cache=path.join(evidence,'cache');await mkdir(cache);
const signal=new AbortController().signal;
const results=[];
for(const model of ['qwen-image-2.1-turbo','stable-audio-3-small-sfx']){
 const plan=installationPlan(model,currentHost());
 const files=new Map<string,string>();
 for(const asset of [plan.python,...plan.assets.filter(a=>a.folder==='downloads')]){
  if(process.env.GENEX_RUNTIME_ARCHIVES){
   await mkdir(path.join(cache,asset.folder),{recursive:true});
   const original=decodeURIComponent(new URL(asset.url).pathname.split('/').at(-1)!);
   await cp(path.join(process.env.GENEX_RUNTIME_ARCHIVES,original),path.join(cache,asset.folder,asset.name));
  }
  files.set(asset.name,await downloadAsset(cache,asset,signal));
 }
 const stage=path.join(evidence,plan.family);await mkdir(stage);
 const staged=await prepareRuntime(plan,files,stage,signal);
 const root=plan.apple?path.join(evidence,plan.family+'.app','Contents'):staged;
 if(plan.apple)await cp(staged,root,{recursive:true});
 const python=path.join(root,plan.apple?'bin/python3.11':'python.exe');
 const cli=path.join(root,plan.family==='qwen'?'sd-cpp':'bin',plan.executable);
 for(const [binary,args] of [[python,['-c','import json,ssl,subprocess,zlib; print("stdlib-ready")']],[cli,['--help']]] as [string,string[]][]){
  const run=spawnSync(binary,args,{cwd:root,timeout:60000,encoding:'utf8',windowsHide:true});
  assert.equal(run.error,undefined,String(run.error));
  assert.equal(run.status,0,binary+': '+(run.stderr+run.stdout).slice(-3000));
  assert.ok((run.stdout+run.stderr).length>0);
 }
 assert.ok((await readFile(cli)).length>0);
 results.push({family:plan.family,backend:plan.backend,pythonImports:true,cliHelp:true,inference:false});
}
const result={host:currentHost(),results,personalProfileTouched:false,modelWeightsDownloaded:false};
await writeFile(path.join(evidence,'results.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,evidence},null,2));
