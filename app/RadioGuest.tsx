'use client';
import {useEffect,useRef,useState} from 'react';
import {startLivePcm,type LivePcmHandle} from './radioPcmClient';

export default function RadioGuest({token}:{token:string}){
 const [name,setName]=useState(''),[joined,setJoined]=useState(false),[guestId,setGuestId]=useState(''),[msg,setMsg]=useState('');
 const stream=useRef<MediaStream|null>(null),live=useRef<LivePcmHandle|null>(null),polling=useRef(false);
 async function join(){
  if(!name.trim())return setMsg('Enter your name.');
  try{
   stream.current=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   const r=await fetch('/api/radio/live-guest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,name})});
   const j=await r.json();if(!r.ok)throw new Error(j.error);
   setGuestId(j.guest.id);setJoined(true);setMsg('Microphone connected. Waiting for the host to admit you.');
  }catch(e:any){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setMsg(e.message||'Could not connect microphone.')}
 }
 useEffect(()=>{
  if(!joined||!guestId||polling.current)return;polling.current=true;
  let dead=false;
  const check=async()=>{
   try{
    const r=await fetch('/api/radio/live-session?role=guest&token='+encodeURIComponent(token)+'&guest_id='+encodeURIComponent(guestId),{cache:'no-store'});
    const j=await r.json();
    if(dead)return;
    if(r.ok&&j.authorized&&j.worker_url&&stream.current&&!live.current){
      live.current=await startLivePcm({stream:stream.current,workerUrl:j.worker_url,role:'guest',token,guestId,onStatus:setMsg});
      setMsg('YOU ARE LIVE — the host can hear you and your microphone is in the broadcast mix.');
    }else if(!live.current){
      setMsg(j.session_status==='live'?'Waiting for the host to admit you.':'Waiting for the host to start the live session.');
    }
   }catch{}
  };
  void check();const id=setInterval(check,2000);
  return()=>{dead=true;clearInterval(id);polling.current=false};
 },[joined,guestId,token]);
 useEffect(()=>()=>{live.current?.stop();stream.current?.getTracks().forEach(t=>t.stop())},[]);
 return <main style={{maxWidth:620,margin:'60px auto',padding:24}}><div className="panel" style={{padding:28}}><div className="kicker">INDIE CUT RADIO</div><h1>Live Interview Guest</h1>{!joined?<><p>Enter your name, connect your microphone, and keep headphones on during the interview.</p><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/><button onClick={join}>JOIN STUDIO</button></>:<><h2>Studio connected</h2><p>Keep this page open. Once the host admits you and starts the show, your microphone will enter the live mix automatically.</p></>}{msg&&<div className="ic-message">{msg}</div>}</div></main>
}
