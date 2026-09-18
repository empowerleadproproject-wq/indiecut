'use client';

export type LivePcmHandle={stop:()=>void};

function wsUrl(base:string,params:Record<string,string>){
  const u=new URL(base.replace(/^http:/,'ws:').replace(/^https:/,'wss:'));
  u.pathname='/live';
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  return u.toString();
}
function toInt16(input:Float32Array,fromRate:number,toRate=48000){
  if(fromRate===toRate){
    const out=new Int16Array(input.length);
    for(let i=0;i<input.length;i++){const s=Math.max(-1,Math.min(1,input[i]));out[i]=s<0?s*32768:s*32767}
    return out;
  }
  const ratio=fromRate/toRate,outLen=Math.max(1,Math.round(input.length/ratio)),out=new Int16Array(outLen);
  for(let i=0;i<outLen;i++){const p=i*ratio,a=Math.floor(p),b=Math.min(input.length-1,a+1),t=p-a;const s=Math.max(-1,Math.min(1,input[a]*(1-t)+input[b]*t));out[i]=s<0?s*32768:s*32767}
  return out;
}
function playPcm(ctx:AudioContext,data:ArrayBuffer,next:{time:number}){
  const pcm=new Int16Array(data);if(!pcm.length)return;
  const buffer=ctx.createBuffer(1,pcm.length,48000),ch=buffer.getChannelData(0);
  for(let i=0;i<pcm.length;i++)ch[i]=pcm[i]/32768;
  const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);
  const when=Math.max(ctx.currentTime+.03,next.time||0);source.start(when);next.time=when+buffer.duration;
}
export async function startLivePcm(opts:{stream:MediaStream;workerUrl:string;role:'host'|'guest';token:string;guestId?:string;onStatus?:(s:string)=>void}):Promise<LivePcmHandle>{
  const {stream,workerUrl,role,token,guestId,onStatus}=opts;
  if(!workerUrl)throw new Error('Radio worker is not connected yet.');
  const socket=new WebSocket(wsUrl(workerUrl,{role,token,...(guestId?{guest_id:guestId}:{})}));
  socket.binaryType='arraybuffer';
  await new Promise<void>((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Live audio connection timed out.')),10000);socket.onopen=()=>{clearTimeout(t);resolve()};socket.onerror=()=>{clearTimeout(t);reject(new Error('Could not connect to the live audio relay.'))}});
  onStatus?.('Live audio connected.');
  const ctx=new AudioContext({sampleRate:48000});await ctx.resume();
  const source=ctx.createMediaStreamSource(stream);
  const processor=ctx.createScriptProcessor(2048,1,1);
  const silent=ctx.createGain();silent.gain.value=0;
  source.connect(processor);processor.connect(silent);silent.connect(ctx.destination);
  processor.onaudioprocess=e=>{if(socket.readyState!==WebSocket.OPEN)return;const pcm=toInt16(e.inputBuffer.getChannelData(0),ctx.sampleRate,48000);socket.send(pcm.buffer)};
  const next={time:0};
  socket.onmessage=e=>{if(e.data instanceof ArrayBuffer)playPcm(ctx,e.data,next)};
  socket.onclose=()=>onStatus?.('Live audio disconnected.');
  return {stop(){processor.onaudioprocess=null;try{source.disconnect();processor.disconnect();silent.disconnect()}catch{}try{socket.close()}catch{}stream.getTracks().forEach(t=>t.stop());void ctx.close()}};
}
