import os from 'node:os';
import path from 'node:path';
import qwenAssets from '../scripts/qwen-assets.json' with {type:'json'};
import audioAssets from '../scripts/audio-assets.json' with {type:'json'};
import assets from '../scripts/platform-assets.json' with {type:'json'};

export interface Host {platform:string;arch:string;release:string}
export const currentHost=():Host=>({platform:process.platform,arch:process.arch,release:os.release()});
export function compatibility(model:string,host:Host=currentHost()){
 const windows=host.platform==='win32'&&host.arch==='x64';
 const apple=host.platform==='darwin'&&host.arch==='arm64';
 const [major=0,minor=0]=host.release.split('.').map(Number);
 if(model==='hunyuan3d-2-turbo')return {supported:windows,canInstall:false,
  requirement:'Windows x64 + NVIDIA CUDA. RTX 4070 12 GB VRAM / 32 GB RAM tested; five-minute cap per shape/paint job, slower GPUs may time out. Separate verified Hunyuan Portable shape/texture setup; no Mac/AMD adapter in this release.'};
 const image=model==='qwen-image-2.1-turbo';
 const supported=windows||(apple&&(image?major>=25:major>22||(major===22&&minor>=4)));
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
 if(!['qwen-image-2.1-turbo','stable-audio-3-small-music','stable-audio-3-small-sfx','hunyuan3d-2-turbo'].includes(model))throw Error('Unknown reviewed model.');
 const support=compatibility(model,host);
 if(!support.supported)throw Error('Model is not available on this computer. '+support.requirement);
 if(!support.canInstall)throw Error('Hunyuan3D uses a separately provisioned Windows Portable runtime. Complete its verified CUDA texture setup before assigning it; generation never installs dependencies.');
 const apple=host.platform==='darwin',family=model==='qwen-image-2.1-turbo'?'qwen':'audio';
 const backend=apple?'metal':legacyCuda?'cuda':'vulkan';
 const weights=(family==='qwen'?qwenAssets:audioAssets).filter(a=>a.folder!=='downloads'&&(family==='qwen'||a.folder.endsWith(model)));
 const binaries=backend==='cuda'?(family==='qwen'?qwenAssets:audioAssets).filter(a=>a.folder==='downloads'):[assets[`${family==='qwen'?'sd':'audio'}-${backend}` as 'sd-metal'|'sd-vulkan'|'audio-metal'|'audio-vulkan']];
 return {family,backend,apple,python:apple?assets['python-macos']:assets['python-windows'],assets:[...binaries,...weights],
  executable:(family==='qwen'?'sd-cli':'audiocpp_cli')+(apple?'':'.exe')};
}
