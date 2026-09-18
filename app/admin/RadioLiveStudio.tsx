'use client';
import {useEffect,useRef,useState} from 'react';
import {startLivePcm,type LivePcmHandle} from '../radioPcmClient';

export default function RadioLiveStudio(){
 const [sessions,setSessions]=useState<any[]>([]),[title,setTitle]=useState(''),[host,setHost]=useState(''),[guest,setGuest]=useState(''),[msg,setMsg]=useState(''),[workerUrl,setWorkerUrl]=useState('');
 const live=useRef<LivePcmHandle|null>(null);
 const load=()=>fetch('/api/admin/radio-live',{cache:'no-store'}).then(r=>r.json()).then(j=>setSessions(j.sessions||[]));
 useEffect(()=>{load();fetch('/api/admin/radio',{cache:'no-store'}).then(r=>r.json()).then(j=>setWorkerUrl(j.worker_url||'')).catch(()=>{});const i=setInterval(load,4000);return()=>{clearInterval(i);live.current?.stop()}},[]);
 async function act(action:string,extra:any={}){setMsg('Working…');const r=await fetch('/api/admin/radio-live',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...extra})});const j=await r.json();setMsg(r.ok?(action==='end'?'Live ended. Music automation resumed.':'Saved.'):j.error||'Failed');if(r.ok)load();return {ok:r.ok,...j}}
 async function start(session:any){
   let stream:MediaStream|null=null;
   try{
     if(!workerUrl)throw new Error('The radio relay is not connected yet.');
     stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
     const started=await act('start',{id:session.id});if(!started.ok)throw new Error(started.error||'Could not start session.');
     live.current=await startLivePcm({stream,workerUrl,role:'host',token:session.broadcast_token,onStatus:setMsg});
     setMsg('YOU ARE LIVE — host microphone is feeding Indie Cut Radio.');
   }catch(e:any){
     stream?.getTracks().forEach(t=>t.stop());live.current?.stop();live.current=null;
     if(session?.id)await act('end',{id:session.id}).catch(()=>{});
     setMsg(e?.message||'Microphone permission is required to start the studio.');
   }
 }
 async function end(id:string){live.current?.stop();live.current=null;await act('end',{id})}
 const active=sessions.find(s=>s.status!=='ended');
 const streamUrl=workerUrl?workerUrl.replace(/\/$/,'')+'/stream.mp3':'';
 return <section className="panel" style={{padding:24,marginTop:18}}>
  <div className="kicker">LIVE STUDIO</div><h2>Interviews & Live Shows</h2>
  <p>Create a private guest link, admit guests, and broadcast the host and admitted guest microphones through the live radio relay. Headphones are recommended to prevent speaker echo.</p>
  {msg&&<div className="ic-message">{msg}</div>}
  {streamUrl&&<div style={{margin:'14px 0',padding:12,border:'1px solid #ddd'}}><b>Live return / station test</b><br/><audio controls preload="none" src={streamUrl} style={{width:'100%',marginTop:8}}/></div>}
  {!active?
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
    <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Interview / show title"/>
    <input value={host} onChange={e=>setHost(e.target.value)} placeholder="Host name"/>
    <input value={guest} onChange={e=>setGuest(e.target.value)} placeholder="Expected guest"/>
    <button onClick={()=>act('create',{title,host_name:host,guest_name:guest,record_enabled:true})}>CREATE LIVE STUDIO</button>
   </div>:
   <div style={{border:'1px solid #ddd',padding:18}}>
    <h3>{active.title}</h3><div><b>Status:</b> {active.status.toUpperCase()}</div>
    <div style={{margin:'10px 0'}}><b>Guest invitation:</b><input readOnly value={typeof window==='undefined'?'':window.location.origin+'/radio/studio/'+active.guest_token} style={{width:'100%'}}/></div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
     {active.status==='waiting'&&<button onClick={()=>start(active)}>START LIVE</button>}
     {active.status==='live'&&<button onClick={()=>end(active.id)}>END LIVE + RESUME MUSIC</button>}
    </div>
    <h4>Guest Waiting Room</h4>
    {!active.radio_live_guests?.length?<p>No guest connected yet.</p>:active.radio_live_guests.map((g:any)=><div key={g.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderTop:'1px solid #eee'}}><span>{g.name} · {g.status}</span>{g.status==='waiting'&&<button onClick={()=>act('guest',{guest_id:g.id,status:'admitted'})}>ADMIT</button>}</div>)}
   </div>}
 </section>
}
