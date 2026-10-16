export const routes=['image','texture','sfx','music','model'] as const;
export type Route=typeof routes[number];
export const catalog=[
 {id:'qwen-image-2.1-turbo',name:'Qwen Image 2.1 Turbo',detail:'Q4_K_M · 8 steps · 512–768 px',routes:['image','texture'],bytes:9902859608,license:'Qwen Research',url:'https://huggingface.co/Qwen/Qwen-Image-2.1-Turbo',experimental:false,
  files:['models/qwen-image-2.1-turbo/diffusion.gguf','models/qwen-image-2.1-turbo/text-encoder.gguf','models/qwen-image-2.1-turbo/vae.safetensors'],gate:false},
 {id:'stable-audio-3-small-sfx',name:'Stable Audio 3 Small SFX',detail:'Q8 · audio.cpp Metal / Vulkan / existing CUDA · up to 120 seconds',routes:['sfx'],bytes:1683570688,license:'Stability AI Community + Gemma terms',url:'https://huggingface.co/audio-cpp/audio.cpp-gguf',experimental:false,
  files:['bin/audiocpp_cli.exe','models/stable-audio-3-small-sfx/model.gguf','stable-audio-3-small-sfx.ready.json'],gate:false},
 {id:'stable-audio-3-small-music',name:'Stable Audio 3 Small Music',detail:'Q8 · audio.cpp Metal / Vulkan / existing CUDA · up to 120 seconds',routes:['music'],bytes:1683570752,license:'Stability AI Community + Gemma terms',url:'https://huggingface.co/audio-cpp/audio.cpp-gguf',experimental:false,
  files:['bin/audiocpp_cli.exe','models/stable-audio-3-small-music/model.gguf','stable-audio-3-small-music.ready.json'],gate:false},
 {id:'hunyuan3d-2-turbo',name:'Hunyuan3D 2.0 Turbo',detail:'Balanced default · experimental high-density 200k / 2K profile · sequential shape and paint',routes:['model'],bytes:19531944814,license:'Tencent Hunyuan3D Community + component terms',url:'https://github.com/YanWenKun/Hunyuan3D-2-WinPortable',experimental:true,
  files:['Hunyuan3D-2/hy3dgen/shapegen/pipelines.py','models/tencent/Hunyuan3D-2/hunyuan3d-dit-v2-0-turbo/model.fp16.safetensors','models/tencent/Hunyuan3D-2/hunyuan3d-paint-v2-0-turbo/unet/genex-original-fp16.safetensors','hunyuan3d-2-turbo.ready.json'],gate:false},
] as const;
export type ModelId=typeof catalog[number]['id'];
export type Assignments=Record<Route,ModelId|null>;
export const defaults:Assignments={image:'qwen-image-2.1-turbo',texture:'qwen-image-2.1-turbo',sfx:null,music:null,model:null};
export function validateAssignments(value:unknown):Assignments{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected task assignments.');
 const source=value as Record<string,unknown>;
 if(Object.keys(source).some(key=>!routes.includes(key as Route)))throw Error('Unknown task.');
 const result={...defaults};
 for(const route of routes){
  // Preserve every other route while replacing the retired adapter in old settings.
  const id=route==='model'&&source[route]==='trellis-2-low-vram'?'hunyuan3d-2-turbo':source[route];
  if(id===null){result[route]=null;continue;}
  const model=catalog.find(model=>model.id===id);
  if(!model||!(model.routes as readonly string[]).includes(route))throw Error(`Choose a compatible model for ${route}.`);
  result[route]=model.id;
 }
 return result;
}
