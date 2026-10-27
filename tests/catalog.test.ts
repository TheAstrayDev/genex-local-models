import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalog,defaults,validateAssignments} from '../src/catalog.ts';

test('reviewed image and 3D alternatives remain distinct models, with existing defaults preserved',()=>{
 assert.equal(defaults.image,'qwen-image-2.1-turbo');
 assert.equal(defaults.texture,'qwen-image-2.1-turbo');
 assert.equal(defaults.model,null);
 const choices={...defaults,image:'qwen-image-2.1-turbo-q8',model:'hunyuan3d-2-mini-turbo'};
 assert.deepEqual(validateAssignments(choices),choices);
 const q8=catalog.find(model=>model.id==='qwen-image-2.1-turbo-q8');
 assert.ok(q8);
 assert.equal(q8.family,'qwen');
 assert.ok(q8.files.includes('models/qwen-image-2.1-turbo/diffusion-q8.gguf'));
 assert.ok(q8.files.includes('models/qwen-image-2.1-turbo/text-encoder.gguf'));
 assert.throws(()=>validateAssignments({...choices,music:choices.image}),/compatible/);
});
