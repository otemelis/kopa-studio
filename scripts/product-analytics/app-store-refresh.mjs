// One local control for the existing extractor; no provider implementation or credential API.
import{spawn}from'node:child_process';import fs from'node:fs';import{fileURLToPath}from'node:url';
const repo=fileURLToPath(new URL('../../',import.meta.url));
function startExtractor(){
 const logs=new URL('../app-store/runs/',import.meta.url);fs.mkdirSync(logs,{recursive:true,mode:0o700});
 const fd=fs.openSync(new URL('web-refresh-'+Date.now()+'.log',logs),'wx',0o600);
 try{return spawn('python3',['scripts/app-store/refresh.py'],{cwd:repo,env:process.env,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);}
}
export function createRefreshControl(start=startExtractor){
 let state={status:'idle',startedAt:null,finishedAt:null};
 return{state:()=>({...state}),start(){if(state.status==='running')return false;state={status:'running',startedAt:new Date().toISOString(),finishedAt:null};const finish=status=>{if(state.status==='running')state={...state,status,finishedAt:new Date().toISOString()};};try{const child=start();child.once('error',()=>finish('failed'));child.once('close',code=>finish(code===0?'success':'failed'));}catch{finish('failed');}return true;}};
}
export function refreshRequest(req,res,port,control){
 const expected='127.0.0.1:'+port,origin='http://'+expected;
 const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
 if(req.headers.host!==expected||!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return send(403,{status:'forbidden'});
 if(req.method==='GET')return send(200,control.state());
 if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return send(405,{status:'method_not_allowed'});}
 if(req.headers.origin!==origin||req.headers['x-kopa-refresh']!=='1')return send(403,{status:'forbidden'});
 const started=control.start();return send(started?202:409,control.state());
}
