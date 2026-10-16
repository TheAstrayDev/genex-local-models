import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ModelQueue} from '../src/queue.ts';

test('two queue instances cannot overlap; cancelled running work keeps its lease until close', async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'genex-model-queue-'));
 const a=new ModelQueue(),b=new ModelQueue();let active=0,peak=0;
 let release!:()=>void,entered!:()=>void;
 const gate=new Promise<void>(r=>release=r),ready=new Promise<void>(r=>entered=r);
 const cancel=new AbortController();
 const first=a.run(root,cancel.signal,async()=>{active++;peak=Math.max(peak,active);entered();await gate;active--;return 1;});
 await ready; cancel.abort();
 const second=b.run(root,new AbortController().signal,async()=>{active++;peak=Math.max(peak,active);active--;return 2;});
 await new Promise(r=>setTimeout(r,40));assert.equal(active,1);
 release();assert.equal(await first,1);assert.equal(await second,2);assert.equal(peak,1);
 await assert.rejects(readFile(path.join(root,'generation.lock')), {code:'ENOENT'});
 await rm(root,{recursive:true});
});

test('failure releases its lease and queued cancellation never launches work',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'genex-model-queue-'));const queue=new ModelQueue();
 await assert.rejects(queue.run(root,new AbortController().signal,async()=>{throw Error('GPU failure')}),/GPU failure/);
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 const first=queue.run(root,new AbortController().signal,()=>gate);
 const controller=new AbortController();let launched=false;
 const second=queue.run(root,controller.signal,async()=>{launched=true;});
 controller.abort();await assert.rejects(second);release();await first;assert.equal(launched,false);
 await rm(root,{recursive:true});
});
