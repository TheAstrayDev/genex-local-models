import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestFor,activate} from '../src/backend.ts';
import {defaults,validateAssignments} from '../src/catalog.ts';

test('route assignments reject incompatible models and unknown tasks',()=>{
 assert.deepEqual(validateAssignments(defaults),defaults);
 assert.throws(()=>validateAssignments({...defaults,music:'qwen-image-2.1-turbo'}),/compatible/);
 assert.throws(()=>validateAssignments({...defaults,shell:'anything'}),/Unknown task/);
});

test('retiring TRELLIS changes only its 3D assignment and keeps disabled routes',()=>{
 const previous={image:'qwen-image-2.1-turbo',texture:null,sfx:'stable-audio-3-small-sfx',music:null,model:'trellis-2-low-vram'};
 assert.deepEqual(validateAssignments(previous),{...previous,model:'hunyuan3d-2-turbo'});
 assert.throws(()=>validateAssignments({...defaults,image:'trellis-2-low-vram'}),/compatible/);
});
test('generation arguments never choose paths, commands or unreviewed weights',()=>{
 const valid={name:'wood',prompt:'wood texture'};
 assert.equal(requestFor('generate-image',valid).route,'image');
 for(const extra of [{program:'cmd.exe'},{model:'untrusted'},{size:999999},{seed:-1},{prompt:''},{name:'../x'}])
  assert.throws(()=>requestFor('generate-image',{...valid,...extra}));
 for(const image of ['C:/secret.png','public/../../secret.png','public\\..\\secret.png','file:///x.png','assets/foo.py'])
  assert.throws(()=>requestFor('generate-model',{name:'test',image}));
 assert.equal(requestFor('generate-model',{name:'test',image:'public/assets/reference.png'}).route,'model');
});
test('activation performs no host operations',async()=>{
 let called=false;const plugin=await activate(()=>{called=true;throw Error('activation host call')});
 assert.equal(called,false);assert.ok(plugin.tool);assert.ok(plugin.action);
});

test('image defaults request native transparency while textures and scenes keep their background',()=>{
 const image={name:'coin',prompt:'A gold game coin'};
 assert.equal(requestFor('generate-image',image).request.purpose,'asset');
 assert.equal(requestFor('generate-image',{...image,purpose:'icon'}).request.purpose,'icon');
 assert.equal(requestFor('generate-image',{...image,purpose:'model-reference'}).request.purpose,'model-reference');
 assert.equal(requestFor('generate-image',{...image,purpose:'scene'}).request.purpose,'scene');
 assert.equal(requestFor('generate-image',{...image,task:'texture'}).request.purpose,'texture');
 assert.throws(()=>requestFor('generate-image',{...image,purpose:'anything'}));
 assert.throws(()=>requestFor('generate-image',{...image,task:'texture',purpose:'icon'}));
});

test('model quality selects a fixed profile rather than arbitrary GPU parameters',()=>{
 const args={name:'car',image:'assets/car.png'};
 assert.equal(requestFor('generate-model',args).request.quality,'balanced');
 assert.equal(requestFor('generate-model',{...args,quality:'high'}).request.quality,'high');
 assert.throws(()=>requestFor('generate-model',{...args,quality:'ultra'}));
 assert.throws(()=>requestFor('generate-model',{...args,octree:8192}));
});
