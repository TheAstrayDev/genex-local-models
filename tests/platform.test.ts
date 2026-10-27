import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compatibility,runtimeDirectory,installationPlan} from '../src/platform.ts';

const windows={platform:'win32',arch:'x64',release:'10.0.26100'};
const mac={platform:'darwin',arch:'arm64',release:'25.0.0'};
test('Apple Silicon and AMD-capable profiles select real binaries without advertising CUDA 3D',()=>{
 assert.equal(compatibility('qwen-image-2.1-turbo',mac).supported,true);
 assert.equal(compatibility('stable-audio-3-small-sfx',{...mac,release:'22.4.0'}).supported,true);
 assert.equal(compatibility('qwen-image-2.1-turbo',{...mac,release:'24.0.0'}).supported,false);
 for(const host of [mac,{...mac,arch:'x64'},{...windows,platform:'linux'}]){
  assert.equal(compatibility('hunyuan3d-2-turbo',host).supported,false);
 }
 const amd=installationPlan('qwen-image-2.1-turbo',windows);
 assert.equal(amd.backend,'vulkan');assert.equal(amd.executable,'sd-cli.exe');
 assert.ok(amd.assets.some(a=>a.url.endsWith('win-vulkan-x64.zip')));
 assert.ok(!amd.assets.some(a=>/cuda/i.test(a.url)));
 const metal=installationPlan('stable-audio-3-small-music',mac);
 assert.equal(metal.backend,'metal');assert.equal(metal.executable,'audiocpp_cli');
 assert.ok(metal.assets.some(a=>a.url.endsWith('macos-arm64-metal.tar.gz')));
 assert.equal(metal.python.sha256.length,64);
 assert.equal(installationPlan('qwen-image-2.1-turbo',windows,true).backend,'cuda','Existing verified CUDA setups keep their backend');
 assert.throws(()=>installationPlan('hunyuan3d-2-turbo',mac),/not available/);
 assert.throws(()=>installationPlan('qwen-image-2.1-turbo',{...mac,arch:'x64'}),/not available/);
 assert.throws(()=>installationPlan('arbitrary',windows),/Unknown reviewed/);
});
test('runtime roots preserve the sandbox application boundary on macOS',()=>{
 assert.equal(runtimeDirectory('/Users/test/Genex-Local-Models/qwen.app/Contents/bin/python3.11'),'/Users/test/Genex-Local-Models/qwen.app/Contents');
 assert.equal(runtimeDirectory('C:/Users/test/Genex-Local-Models/audio/python.exe').replaceAll('\\','/'),'C:/Users/test/Genex-Local-Models/audio');
});

test('Qwen Q8 has a pinned diffusion file and shares the encoder and VAE with Q4',()=>{
 const q4=installationPlan('qwen-image-2.1-turbo',windows);
 const q8=installationPlan('qwen-image-2.1-turbo-q8',windows);
 assert.equal(q8.family,'qwen');
 assert.equal(q8.modelDirectory,q4.modelDirectory);
 const weights=q8.assets.filter(asset=>asset.folder!=='downloads');
 assert.deepEqual(weights.map(asset=>asset.name),['diffusion-q8.gguf','text-encoder.gguf','vae.safetensors']);
 const diffusion=weights[0];
 assert.equal(diffusion?.size,7640860480);
 assert.equal(diffusion?.sha256,'399d2ddc3636f36456e2f5bfa57187da4e38721bc046430317f42a9eab5b1712');
 assert.match(diffusion?.url??'',/5d1f9f759ea877ae556cda88dbec958b62ad3809/);
 assert.equal(compatibility('qwen-image-2.1-turbo-q8',{...mac,release:'24.0.0'}).supported,false);
 assert.match(compatibility('qwen-image-2.1-turbo-q8',windows).requirement,/13\.3 GB/);
});

test('Hunyuan mini uses the separate manual CUDA setup boundary',()=>{
 assert.equal(compatibility('hunyuan3d-2-mini-turbo',windows).supported,true);
 assert.equal(compatibility('hunyuan3d-2-mini-turbo',windows).canInstall,false);
 assert.equal(compatibility('hunyuan3d-2-mini-turbo',mac).supported,false);
 assert.throws(()=>installationPlan('hunyuan3d-2-mini-turbo',windows),/separately provisioned/);
});
