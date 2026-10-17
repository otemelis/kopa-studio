// UI action only; the existing local extractor owns retrieval, validation and publication.
const button=document.querySelector('#refresh-apple'),status=document.querySelector('#refresh-action');
let checking=false;
async function watch(){if(checking)return;checking=true;try{const r=await fetch('/api/app-store/refresh',{cache:'no-store'});if(!r.ok)throw Error();const s=await r.json();if(s.status==='running'){button.disabled=true;status.textContent='Reading official Apple reports and checking reconciliation. Previous validated snapshot remains visible.';setTimeout(()=>{checking=false;watch();},2000);return;}
 button.disabled=false;if(s.status==='success'){location.reload();return;}if(s.status==='failed')status.textContent='Refresh failed. Previous validated snapshot retained; no replacement data.';
 }catch{button.disabled=false;status.textContent='Refresh service unavailable. Previous snapshot retained.';}checking=false;}
button.onclick=async()=>{button.disabled=true;status.textContent='Starting official Apple report refresh…';try{const r=await fetch('/api/app-store/refresh',{method:'POST',headers:{'X-Kopa-Refresh':'1'}});if(r.status!==202&&r.status!==409)throw Error();await watch();}catch{button.disabled=false;status.textContent='Could not start refresh. Previous validated snapshot retained.';}};
// Resume only an already-running job. Never start a provider query on page load.
try{const r=await fetch('/api/app-store/refresh',{cache:'no-store'});if(r.ok&&(await r.json()).status==='running')await watch();}catch{}
