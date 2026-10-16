import {catalog,routes,type Assignments} from './catalog.ts';
declare const studioPlugin:{call(method:string,name:string,args:unknown):Promise<any>};
const root=document.getElementById('root')!;
let snapshot:any;
let busy=false;
const labels={image:'Images',texture:'Textures',sfx:'Sound effects',music:'Music',model:'3D objects'};
const escape=(text:unknown)=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function message(text:string,error=false){const el=document.getElementById('message')!;el.textContent=text;el.classList.toggle('error',error);}
function render(){
 const state=snapshot.execution;
 root.innerHTML=`<header><div><h1>Local Models</h1><p>One task. One model. Memory back when it finishes.</p></div><button id="refresh">Refresh</button></header>
 <div class="execution"><span class="dot ${state.active?'working':''}"></span><strong>${state.active?'Working on one task':'Models asleep'}</strong><span>${state.pending>1?`${state.pending-1} waiting`:'Only one worker can run at a time'}</span></div>
 <section><div class="section-heading"><h2>Choose a model for each task</h2><span>Applies to new requests</span></div>
 <div class="routes">${routes.map(route=>`<label class="route"><span>${labels[route]}</span><select data-route="${route}" aria-label="${labels[route]} model"><option value="">Not assigned</option>${snapshot.models.filter((model:any)=>model.routes.includes(route)).map((model:any)=>`<option value="${model.id}" ${snapshot.assignments[route]===model.id?'selected':''}>${escape(model.name)}${model.ready?'':' · unavailable'}</option>`).join('')}</select></label>`).join('')}</div>
 <button id="save" class="primary">Save assignments</button></section>
 <section><div class="section-heading"><h2>On this computer</h2><button id="discover">Find existing models</button></div>
 <div id="installation" role="status" aria-live="polite"></div>
 <div class="models">${snapshot.models.map((model:any)=>`<article><div class="model-heading"><h3>${escape(model.name)}</h3><span class="badge ${model.ready?'ready':''}">${model.state==='working'?'Working':model.ready?'Sleeping':model.gate?'Access required':'Not installed'}</span></div><p>${escape(model.detail)}</p><p class="reason">${escape(model.reason)}</p><div class="model-footer"><span>${escape(model.license)}${model.bytes?` · ${(model.bytes/1e9).toFixed(1)} GB`:''}${model.experimental?' · Experimental':''}</span><a href="${escape(model.url)}" target="_blank" rel="noreferrer">Model details ↗</a></div></article>`).join('')}</div><div id="discovery"></div></section>
 <section><div class="section-heading"><h2>Saved assets</h2><button id="restore-assets" ${snapshot.project?'':'disabled'}>Restore assets</button></div><p>${snapshot.project?`Restore retained results into <strong>${escape(snapshot.project)}</strong> and its Genex Assets panel. No models run; existing changed files are preserved.`:'Open a game, then open this plugin to restore its saved assets.'}</p></section>
 <section><div class="section-heading"><h2>Recent generations</h2><span>Measured on this computer</span></div>${snapshot.recent.length?`<div class="history">${snapshot.recent.slice(0,5).map((job:any)=>`<div><strong>${escape(labels[job.task as keyof typeof labels]??job.task)}</strong><span>${escape(job.model)}</span><span>${Number(job.seconds).toFixed(1)}s · asleep</span></div>`).join('')}</div>`:'<p class="empty">Ask Studio for an asset after assigning an installed model. Timing appears after the first completed job.</p>'}</section>
 <footer><p>Weights stay on disk. Each request starts a fresh process; its model memory is released when the process exits. Cold starts depend on disk speed and model size.</p><p>Local tools: <code>theastraydev-local-models__generate-image</code>, <code>theastraydev-local-models__generate-audio</code>, <code>theastraydev-local-models__generate-model</code>. No paid fallback. Animation is not supported by these models.</p></footer><p id="message" role="status" aria-live="polite"></p>`;
 document.getElementById('refresh')!.onclick=()=>void refresh();
 document.getElementById('restore-assets')!.onclick=async()=>{
  const button=document.getElementById('restore-assets') as HTMLButtonElement;button.disabled=true;
  try{
   const result=await studioPlugin.call('action','restore-assets',{});
   message(`${result.restored.length} saved jobs restored to Genex Assets.${result.failed.length?' '+result.failed.length+' could not be restored: '+result.failed.map((failure:any)=>failure.error).join('; '):''}`,result.failed.length>0);
  }catch(error){message(String(error),true);}
  finally{button.disabled=!snapshot.project;}
 };
 for(const model of snapshot.models.filter((model:any)=>!model.ready)){
  const card=[...document.querySelectorAll('article')][snapshot.models.indexOf(model)];
  const button=document.createElement('button');button.textContent='Install';button.disabled=Boolean(snapshot.installation?.active);
  button.onclick=async()=>{try{await studioPlugin.call('action','install',{model:model.id});await refresh();}catch(error){message(String(error),true);}};card.append(button);
 }
 showInstallation();
 document.getElementById('save')!.onclick=async()=>{
  if(busy)return;busy=true;
  try{const selections={} as Record<string,string|null>;document.querySelectorAll<HTMLSelectElement>('[data-route]').forEach(select=>{selections[select.dataset.route!]=select.value||null;});
   await studioPlugin.call('action','assign',selections);snapshot.assignments=selections;message('Assignments saved.');
  }catch(error){message(String(error),true);}finally{busy=false;}
 };
 document.getElementById('discover')!.onclick=async()=>{
  if(busy)return;busy=true;
  try{const result=await studioPlugin.call('action','discover',{});document.getElementById('discovery')!.innerHTML=`<p>${escape(result.note)}</p>${result.found.map((model:any)=>`<div class="found"><strong>${escape(model.id)}</strong><span>Adapter not installed</span></div>`).join('')||'<p>No additional model caches found.</p>'}`;}
  catch(error){message(String(error),true);}finally{busy=false;}
 };
}
async function refresh(){
 if(busy)return;busy=true;
 try{snapshot=await studioPlugin.call('action','status',{});render();}
 catch(error){root.innerHTML=`<h1>Local Models</h1><p class="error">${escape(error)}</p><button id="retry">Retry</button>`;document.getElementById('retry')!.onclick=()=>void refresh();}
 finally{busy=false;}
}
void refresh();
function showInstallation(){
 const element=document.getElementById('installation'),setup=snapshot.installation;if(!element||!setup)return;
 if(!setup.active){element.textContent=setup.error??(setup.phase==='ready'?'Model installed and verified.':'');return;}
 element.innerHTML=`<p>${escape(setup.model)} · ${escape(setup.phase)} · ${(setup.completed/1e9).toFixed(2)} / ${(setup.total/1e9).toFixed(2)} GB</p><progress max="${setup.total}" value="${setup.completed}"></progress> <button id="cancel-install">Cancel download</button>`;
 document.getElementById('cancel-install')!.onclick=async()=>{await studioPlugin.call('action','cancel-install',{});};
}
setInterval(()=>{if(!snapshot?.installation?.active||document.hidden||busy)return;void studioPlugin.call('action','status',{}).then(value=>{const wasActive=snapshot.installation.active;snapshot=value;showInstallation();if(wasActive&&!value.installation.active)render();}).catch(()=>{});},1500);
