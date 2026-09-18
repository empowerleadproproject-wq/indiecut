import express from 'express';
import {WebSocketServer} from 'ws';
import {spawn} from 'node:child_process';
import http from 'node:http';
import https from 'node:https';

const PORT=Number(process.env.PORT||8080);
const BASE_URL=(process.env.INDIECUT_BASE_URL||'https://indiecut.info').replace(/\/$/,'');
const WORKER_TOKEN=process.env.RADIO_WORKER_TOKEN||'';
const FRAME_SAMPLES=960, FRAME_BYTES=FRAME_SAMPLES*2;
const app=express(),server=http.createServer(app),wss=new WebSocketServer({server,path:'/live'});
const listeners=new Set();
const peers=new Map();
let automationProc=null,liveEncoder=null,liveSessionId=null,nowPlaying=null,sourceMode='idle',icecastReq=null,stopping=false;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const status=()=>({ok:true,mode:sourceMode,live_session_id:liveSessionId,stream_clients:listeners.size,studio_clients:peers.size,now_playing:nowPlaying,live365_configured:Boolean(process.env.LIVE365_HOST&&process.env.LIVE365_PASSWORD)});

app.get('/health',(_req,res)=>res.json(status()));
app.get('/status',(_req,res)=>res.json(status()));
app.get('/stream.mp3',(req,res)=>{
  res.writeHead(200,{'Content-Type':'audio/mpeg','Cache-Control':'no-store, no-cache','Connection':'keep-alive','Access-Control-Allow-Origin':'*','icy-name':'Indie Cut Radio','icy-br':'128'});
  listeners.add(res);req.on('close',()=>listeners.delete(res));
});

function openIcecast(){
  if(icecastReq||!process.env.LIVE365_HOST||!process.env.LIVE365_PASSWORD)return;
  const secure=(process.env.LIVE365_TLS||'true')!=='false',lib=secure?https:http;
  const port=Number(process.env.LIVE365_PORT||(secure?443:80)),mount=(process.env.LIVE365_MOUNT||'/stream').replace(/^([^/])/,'/$1');
  const user=process.env.LIVE365_USERNAME||'source',pass=process.env.LIVE365_PASSWORD;
  const req=lib.request({hostname:process.env.LIVE365_HOST,port,path:mount,method:process.env.LIVE365_METHOD||'PUT',headers:{
    'Authorization':'Basic '+Buffer.from(user+':'+pass).toString('base64'),
    'Content-Type':'audio/mpeg','Ice-Name':'Indie Cut Radio','Ice-Public':'1','User-Agent':'IndieCut-Radio/1.0'
  }},res=>{res.resume();if((res.statusCode||500)>=400){console.error('Live365 source rejected',res.statusCode);try{req.destroy()}catch{}}});
  req.on('error',e=>{console.error('Live365 source error',e.message);if(icecastReq===req)icecastReq=null});
  req.on('close',()=>{if(icecastReq===req)icecastReq=null});
  req.setTimeout(30000,()=>req.destroy(new Error('Live365 source timeout')));
  req.flushHeaders();icecastReq=req;
}
function broadcast(chunk){
  for(const res of [...listeners]){try{res.write(chunk)}catch{listeners.delete(res)}}
  openIcecast();if(icecastReq){try{icecastReq.write(chunk)}catch{}}
}
function stopProc(p){if(!p)return;try{p.kill('SIGTERM')}catch{}setTimeout(()=>{try{p.kill('SIGKILL')}catch{}},1500)}
function attachEncoded(proc){
  proc.stdout.on('data',broadcast);
  proc.stderr.on('data',d=>{const s=String(d);if(/error|invalid|failed/i.test(s))console.error(s.slice(-1000))});
}
async function validateStudio(role,token,guestId){
  const u=new URL(BASE_URL+'/api/radio/live-session');u.searchParams.set('role',role);u.searchParams.set('token',token);if(guestId)u.searchParams.set('guest_id',guestId);
  const r=await fetch(u,{cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok||!j.authorized)throw new Error('Studio authorization failed');return j;
}
function startLiveEncoder(sessionId){
  if(liveEncoder&&liveSessionId===sessionId)return;
  stopProc(automationProc);automationProc=null;stopProc(liveEncoder);
  liveSessionId=sessionId;sourceMode='live';nowPlaying={title:'Live on Indie Cut Radio',source:'live'};
  liveEncoder=spawn('ffmpeg',['-hide_banner','-loglevel','warning','-f','s16le','-ar','48000','-ac','1','-i','pipe:0','-vn','-codec:a','libmp3lame','-b:a','128k','-ar','44100','-f','mp3','pipe:1'],{stdio:['pipe','pipe','pipe']});
  attachEncoded(liveEncoder);
  liveEncoder.on('exit',()=>{liveEncoder=null;if(liveSessionId===sessionId){liveSessionId=null;sourceMode='idle'}});
}
function stopLiveIfNoHost(sessionId){
  setTimeout(()=>{const hasHost=[...peers.values()].some(p=>p.sessionId===sessionId&&p.role==='host');if(!hasHost&&liveSessionId===sessionId){stopProc(liveEncoder);liveEncoder=null;liveSessionId=null;sourceMode='idle'}},1800);
}
setInterval(()=>{
  if(!liveEncoder||!liveSessionId||liveEncoder.stdin.destroyed)return;
  const active=[...peers.values()].filter(p=>p.sessionId===liveSessionId);
  if(!active.length)return;
  const out=Buffer.alloc(FRAME_BYTES);const mixed=new Int16Array(out.buffer,out.byteOffset,FRAME_SAMPLES);
  for(const p of active){
    let frame;
    if(p.pcm.length>=FRAME_BYTES){frame=p.pcm.subarray(0,FRAME_BYTES);p.pcm=p.pcm.subarray(FRAME_BYTES)}
    else{frame=Buffer.alloc(FRAME_BYTES);if(p.pcm.length){p.pcm.copy(frame);p.pcm=Buffer.alloc(0)}}
    const v=new Int16Array(frame.buffer,frame.byteOffset,FRAME_SAMPLES);
    for(let i=0;i<FRAME_SAMPLES;i++){const n=mixed[i]+v[i];mixed[i]=Math.max(-32768,Math.min(32767,n))}
  }
  try{liveEncoder.stdin.write(out)}catch{}
},20);

wss.on('connection',async(ws,req)=>{
  try{
    const u=new URL(req.url,'http://localhost'),role=u.searchParams.get('role'),token=u.searchParams.get('token')||'',guestId=u.searchParams.get('guest_id')||'';
    if(!['host','guest'].includes(role))throw new Error('Invalid studio role');
    const auth=await validateStudio(role,token,guestId);
    if(auth.session_status!=='live')throw new Error('Session is not live');
    const peer={sessionId:auth.session_id,role,pcm:Buffer.alloc(0)};peers.set(ws,peer);
    if(role==='host')startLiveEncoder(peer.sessionId);
    ws.on('message',(data,isBinary)=>{
      if(!isBinary)return;
      const chunk=Buffer.from(data);if(chunk.length>262144)return;
      peer.pcm=Buffer.concat([peer.pcm,chunk]);if(peer.pcm.length>48000*2*2)peer.pcm=peer.pcm.subarray(peer.pcm.length-48000*2);
      for(const [other,op] of peers){if(other!==ws&&op.sessionId===peer.sessionId&&op.role!==peer.role&&other.readyState===1){try{other.send(chunk,{binary:true})}catch{}}}
    });
    ws.on('close',()=>{peers.delete(ws);if(role==='host')stopLiveIfNoHost(peer.sessionId)});
    ws.send(JSON.stringify({type:'ready',session_id:peer.sessionId,role}));
  }catch(e){try{ws.close(1008,String(e.message||'Unauthorized').slice(0,100))}catch{}}
});

async function nextItem(){
  if(!WORKER_TOKEN)throw new Error('RADIO_WORKER_TOKEN is missing');
  const r=await fetch(BASE_URL+'/api/radio/automation',{headers:{authorization:'Bearer '+WORKER_TOKEN},cache:'no-store'});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||('Automation HTTP '+r.status));return j;
}
async function recordPlay(mediaId,source){
  if(!mediaId)return;
  try{await fetch(BASE_URL+'/api/radio/automation',{method:'POST',headers:{authorization:'Bearer '+WORKER_TOKEN,'content-type':'application/json'},body:JSON.stringify({media_id:mediaId,source})})}catch{}
}
async function playUrl(item,source){
  return await new Promise(resolve=>{
    sourceMode=source||'automation';nowPlaying={id:item.id,title:item.title,artist:item.artist_or_host||'',source:sourceMode};
    const p=spawn('ffmpeg',['-hide_banner','-loglevel','warning','-re','-i',item.audio_url,'-vn','-codec:a','libmp3lame','-b:a','128k','-ar','44100','-ac','2','-f','mp3','pipe:1'],{stdio:['ignore','pipe','pipe']});
    automationProc=p;attachEncoded(p);let interrupted=false;
    p.on('error',e=>{console.error('playback spawn error',e.message);resolve(false)});
    p.on('exit',code=>{if(automationProc===p)automationProc=null;interrupted=Boolean(liveSessionId);resolve(code===0&&!interrupted)});
  });
}
async function automationLoop(){
  while(!stopping){
    try{
      if(liveSessionId){await sleep(500);continue}
      const next=await nextItem();
      if(next?.item?.audio_url){
        const completed=await playUrl(next.item,next.source);if(completed)await recordPlay(next.item.id,next.source);
      }else{sourceMode=next?.source||'silence';nowPlaying=null;await sleep(1200)}
    }catch(e){sourceMode='error';console.error('automation',e.message);await sleep(3000)}
  }
}
process.on('SIGTERM',()=>{stopping=true;stopProc(automationProc);stopProc(liveEncoder);try{icecastReq?.end()}catch{};server.close(()=>process.exit(0))});
server.listen(PORT,'0.0.0.0',()=>{console.log('Indie Cut Radio worker listening on',PORT);void automationLoop()});
