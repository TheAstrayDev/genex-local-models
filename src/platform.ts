import os from 'node:os';
import path from 'node:path';
import qwenAssets from '../scripts/qwen-assets.json' with {type:'json'};
import audioAssets from '../scripts/audio-assets.json' with {type:'json'};
import assets from '../scripts/platform-assets.json' with {type:'json'};
import {catalog} from './catalog.ts';

const QWEN_Q8={name:'diffusion-q8.gguf',folder:'runtime/models/qwen-image-2.1-turbo',size:7640860480,
 sha256:'399d2ddc3636f36456e2f5bfa57187da4e38721bc046430317f42a9eab5b1712',
 url:'https://huggingface.co/unsloth/Qwen-Image-2.1-Turbo-GGUF/resolve/5d1f9f759ea877ae556cda88dbec958b62ad3809/qwen-image-2.1-turbo-Q8_0.gguf'};

export interface Host {platform:string;arch:string;release:string}
export const currentHost=():Host=>({platform:process.platform,arch:process.arch,release:os.release()});
export function compatibility(model:string,host:Host=currentHost()){
 const entry=catalog.find(entry=>entry.id===model);
 if(!entry)return {supported:false,canInstall:false,requirement:'Unknown reviewed model.'};
 const windows=host.platform==='win32'&&host.arch==='x64';
 const apple=host.platform==='darwin'&&host.arch==='arm64';
 const [major=0,minor=0]=host.release.split('.').map(Number);
 if(model==='hunyuan3d-2-mini-turbo')return {supported:windows,canInstall:false,
  requirement:'Experimental Windows x64 NVIDIA CUDA adapter; live mini inference, memory fit and five-minute fit are unverified. Separate mini shape checkpoint and verified Turbo painter setup are required. No Mac/AMD adapter.'};
 if(entry.family==='hunyuan')return {supported:windows,canInstall:false,
  requirement:'Windows x64 + NVIDIA CUDA. RTX 4070 12 GB VRAM / 32 GB RAM tested; five-minute cap per shape/paint job, slower GPUs may time out. Separate verified Hunyuan Portable shape/texture setup; no Mac/AMD adapter in this release.'};
 const image=entry.family==='qwen';
 const supported=windows||(apple&&(image?major>=25:major>22||(major===22&&minor>=4)));
 if(model==='qwen-image-2.1-turbo-q8')return {supported,canInstall:supported,requirement:'Windows x64 with a Vulkan-capable GPU and current driver, or Apple Silicon with macOS 26+. About 13.3 GB weights; uses more memory than Q4. Shared text encoder and VAE. Live Q8 inference and five-minute fit are unverified.'};
 return {supported,canInstall:supported,requirement:image
  ?'Windows x64 with a Vulkan-capable GPU and current driver (AMD/NVIDIA), or Apple Silicon with macOS 26+. About 10 GB weights; plan for 12 GB VRAM or 24 GB unified memory. Inference speed is hardware-dependent.'
  :'Windows x64 with a Vulkan-capable GPU and current driver (AMD/NVIDIA), or Apple Silicon with macOS 13.3+. About 1.7 GB per audio model. Metal/Vulkan generation still needs hardware validation.'};
}
export function runtimeDirectory(binary:string){
 const portable=binary.replaceAll('\\','/');
 const marker=portable.indexOf('.app/Contents/');
 return marker>=0?portable.slice(0,marker)+'.app/Contents':path.dirname(binary);
}
export function installationPlan(model:string,host:Host=currentHost(),legacyCuda=false){
 const entry=catalog.find(entry=>entry.id===model);
 if(!entry)throw Error('Unknown reviewed model.');
 const support=compatibility(model,host);
 if(!support.supported)throw Error('Model is not available on this computer. '+support.requirement);
 if(!support.canInstall)throw Error('Hunyuan3D uses a separately provisioned Windows Portable runtime. Complete its verified CUDA texture setup before assigning it; generation never installs dependencies.');
 const apple=host.platform==='darwin',family=entry.family==='qwen'?'qwen':'audio';
 const modelDirectory=family==='qwen'?'qwen-image-2.1-turbo':model;
 const backend=apple?'metal':legacyCuda?'cuda':'vulkan';
 const weights=(family==='qwen'?qwenAssets:audioAssets).filter(a=>a.folder!=='downloads'&&(family==='qwen'||a.folder.endsWith(model)))
  .map(asset=>model==='qwen-image-2.1-turbo-q8'&&asset.name==='diffusion.gguf'?QWEN_Q8:asset);
 const binaries=backend==='cuda'?(family==='qwen'?qwenAssets:audioAssets).filter(a=>a.folder==='downloads'):[assets[`${family==='qwen'?'sd':'audio'}-${backend}` as 'sd-metal'|'sd-vulkan'|'audio-metal'|'audio-vulkan']];
 return {family,backend,apple,modelDirectory,python:apple?assets['python-macos']:assets['python-windows'],assets:[...binaries,...weights],
  executable:(family==='qwen'?'sd-cli':'audiocpp_cli')+(apple?'':'.exe')};
}
