import {mkdir,open,unlink} from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

/** Cross-backend lease. Never steal a lease on a timer: a slow GPU can still own memory. */
export class ModelQueue {
 pending=0;
 active=false;
 async run<T>(root:string,signal:AbortSignal,work:()=>Promise<T>):Promise<T>{
  signal.throwIfAborted();
  if(this.pending>=4)throw Error('The local model queue is full. Retrieve the current job before retrying.');
  this.pending++;
  const lock=path.join(root,'generation.lock');
  const deadline=Date.now()+15000;
  let lease:Awaited<ReturnType<typeof open>>|undefined;
  try{
   await mkdir(root,{recursive:true});
   while(!lease){
    signal.throwIfAborted();
    try{lease=await open(lock,'wx',0o600);}
    catch(error){
     if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
     if(Date.now()>=deadline)throw Error('A local model is still running. No second model was loaded. Wait for its result, then retry. If Genex crashed, inspect the generation.lock record before recovery.');
     await delay(75,undefined,{signal});
    }
   }
   await lease.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
   signal.throwIfAborted();this.active=true;
   // Do not race work against abort. The host owns process-tree cancellation and must
   // confirm the worker has stopped before another model receives the lease.
   return await work();
  }finally{
   this.pending--;
   if(lease){this.active=false;await lease.close();await unlink(lock);}
  }
 }
}
