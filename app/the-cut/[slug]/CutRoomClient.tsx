'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {Room,RoomEvent,Track} from 'livekit-client';
import {safeParticipantMeta,CutRole} from '../../../lib/the-cut';

type Person={identity:string;meta:ReturnType<typeof safeParticipantMeta>;local:boolean};
type SpeakerRequest={user_id:string;role:string;request_status:string;requested_at:string;livekit_identity:string;profile?:{display_name?:string;avatar_url?:string;headline?:string;industry_role?:string}|null};

function initials(name:string){return name.split(/\s+/).slice(0,2).map(v=>v[0]).join('').toUpperCase()||'IC'}

export default function CutRoomClient({slug,title,description,category,hostName}:{slug:string;title:string;description?:string|null;category:string;hostName:string}){
  const roomRef=useRef<Room|null>(null);
  const audioMountRef=useRef<HTMLDivElement|null>(null);
  const sessionRef=useRef<string>('');
  const identityRef=useRef<string>('');
  const [entered,setEntered]=useState(false);
  const [connecting,setConnecting]=useState(false);
  const [connected,setConnected]=useState(false);
  const [audioError,setAudioError]=useState('');
  const [people,setPeople]=useState<Person[]>([]);
  const [active,setActive]=useState<Set<string>>(new Set());
  const [ownRole,setOwnRole]=useState<CutRole>('listener');
  const [authenticated,setAuthenticated]=useState(false);
  const [requestStatus,setRequestStatus]=useState('none');
  const [micOn,setMicOn]=useState(false);
  const [pending,setPending]=useState<SpeakerRequest[]>([]);
  const [actionBusy,setActionBusy]=useState('');
  const [shareMessage,setShareMessage]=useState('');

  const snapshot=useCallback((room:Room)=>{
    const list:any[]=[room.localParticipant,...Array.from(room.remoteParticipants.values())];
    setPeople(list.map((p:any)=>({identity:p.identity,meta:safeParticipantMeta(p.metadata),local:p===room.localParticipant})));
  },[]);

  const trackPresence=useCallback(async(action:'join'|'heartbeat'|'leave')=>{
    if(!sessionRef.current||!identityRef.current)return;
    const payload={sessionId:sessionRef.current,participantIdentity:identityRef.current,action};
    try{await fetch(`/api/the-cut/rooms/${encodeURIComponent(slug)}/presence`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),keepalive:true})}catch{}
  },[slug]);

  const enter=useCallback(async()=>{
    if(connecting||connected)return;
    setEntered(true);setConnecting(true);setAudioError('');
    try{
      const tokenRes=await fetch('/api/the-cut/token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({slug})});
      const tokenData=await tokenRes.json();
      if(!tokenRes.ok)throw new Error(tokenData.error||'Could not enter The Cut.');
      const room=new Room({adaptiveStream:true,dynacast:true});
      roomRef.current=room;
      setOwnRole(tokenData.role||'listener');setAuthenticated(Boolean(tokenData.authenticated));
      identityRef.current=tokenData.identity;
      sessionRef.current=crypto.randomUUID();

      const attach=(track:any)=>{
        if(track.kind!==Track.Kind.Audio)return;
        const element=track.attach();
        element.autoplay=true;
        audioMountRef.current?.appendChild(element);
      };
      const detach=(track:any)=>track.detach().forEach((el:HTMLElement)=>el.remove());
      const refresh=()=>snapshot(room);
      room.on(RoomEvent.TrackSubscribed,attach);
      room.on(RoomEvent.TrackUnsubscribed,detach);
      room.on(RoomEvent.ParticipantConnected,refresh);
      room.on(RoomEvent.ParticipantDisconnected,refresh);
      room.on(RoomEvent.ParticipantMetadataChanged,refresh);
      room.on(RoomEvent.ParticipantPermissionsChanged,refresh);
      room.on(RoomEvent.ActiveSpeakersChanged,(speakers:any[])=>setActive(new Set(speakers.map(p=>p.identity))));
      room.on(RoomEvent.Disconnected,()=>setConnected(false));

      await room.connect(tokenData.url,tokenData.token,{autoSubscribe:true});
      try{await room.startAudio()}catch{}
      room.remoteParticipants.forEach((p:any)=>p.trackPublications.forEach((pub:any)=>{if(pub.track)attach(pub.track)}));
      snapshot(room);setConnected(true);setConnecting(false);
      await trackPresence('join');
      if(tokenData.authenticated){
        const state=await fetch(`/api/the-cut/rooms/${encodeURIComponent(slug)}/request`,{cache:'no-store'}).then(r=>r.json()).catch(()=>null);
        if(state){setRequestStatus(state.requestStatus||'none');setOwnRole(state.role||tokenData.role||'listener')}
      }
    }catch(err:any){setAudioError(err.message||'Could not connect to live audio.');setConnecting(false);setConnected(false)}
  },[connected,connecting,slug,snapshot,trackPresence]);

  useEffect(()=>{
    if(!connected)return;
    const heartbeat=window.setInterval(()=>trackPresence('heartbeat'),30_000);
    const room=roomRef.current;
    const leaveBeacon=()=>{
      if(!sessionRef.current||!identityRef.current)return;
      const blob=new Blob([JSON.stringify({sessionId:sessionRef.current,participantIdentity:identityRef.current,action:'leave'})],{type:'application/json'});
      navigator.sendBeacon(`/api/the-cut/rooms/${encodeURIComponent(slug)}/presence`,blob);
    };
    window.addEventListener('pagehide',leaveBeacon);
    return()=>{window.clearInterval(heartbeat);window.removeEventListener('pagehide',leaveBeacon);if(room?.state!=='disconnected')room?.disconnect()};
  },[connected,slug,trackPresence]);

  useEffect(()=>{
    if(!connected||!authenticated||requestStatus!=='requested')return;
    const timer=window.setInterval(async()=>{
      const state=await fetch(`/api/the-cut/rooms/${encodeURIComponent(slug)}/request`,{cache:'no-store'}).then(r=>r.json()).catch(()=>null);
      if(state?.requestStatus){setRequestStatus(state.requestStatus);setOwnRole(state.role||'listener');if(state.requestStatus!=='requested')snapshot(roomRef.current!)}
    },2500);
    return()=>window.clearInterval(timer);
  },[authenticated,connected,requestStatus,slug,snapshot]);

  const loadRequests=useCallback(async()=>{
    if(ownRole!=='host')return;
    const res=await fetch(`/api/the-cut/rooms/${encodeURIComponent(slug)}/moderate`,{cache:'no-store'});
    if(res.ok){const data=await res.json();setPending(data.requests||[])}
  },[ownRole,slug]);

  useEffect(()=>{
    if(!connected||ownRole!=='host')return;
    loadRequests();const timer=window.setInterval(loadRequests,2500);return()=>window.clearInterval(timer);
  },[connected,ownRole,loadRequests]);

  async function requestMic(){
    if(!authenticated){window.location.href=`/the-cut/sign-in?next=${encodeURIComponent(`/the-cut/${slug}`)}`;return}
    setActionBusy('request');
    const res=await fetch(`/api/the-cut/rooms/${encodeURIComponent(slug)}/request`,{method:'POST'});
    const data=await res.json().catch(()=>({}));
    if(res.ok){setRequestStatus(data.requestStatus||'requested');setOwnRole(data.role||'listener')}else setAudioError(data.error||'Could not request the mic.');
    setActionBusy('');
  }

  async function toggleMic(){
    const room=roomRef.current;if(!room)return;
    try{const next=!micOn;await room.localParticipant.setMicrophoneEnabled(next);setMicOn(next)}catch{setAudioError('Microphone access was blocked. Check your browser microphone permission and try again.')}
  }

  async function moderate(userId:string,action:'approve'|'reject'|'remove'|'mute'){
    setActionBusy(`${action}-${userId}`);
    const res=await fetch(`/api/the-cut/rooms/${encodeURIComponent(slug)}/moderate`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,userId})});
    if(!res.ok){const data=await res.json().catch(()=>({}));setAudioError(data.error||'Moderation action failed.')}
    await loadRequests();setActionBusy('');
  }

  async function endRoom(){
    if(!confirm('End this Cut for everyone?'))return;
    await fetch(`/api/the-cut/rooms/${encodeURIComponent(slug)}/moderate`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'end'})});
    await trackPresence('leave');roomRef.current?.disconnect();window.location.href='/the-cut';
  }

  async function leave(){await trackPresence('leave');roomRef.current?.disconnect();window.location.href='/the-cut'}
  async function share(){
    const data={title:`${title} — The Cut`,text:`Listen live on Indie Cut: ${title}`,url:window.location.href};
    try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(window.location.href);setShareMessage('Link copied');setTimeout(()=>setShareMessage(''),1800)}}catch{}
  }

  const normalized=people.map(p=>p.local?{...p,meta:{...p.meta,role:ownRole}}:p);
  const speakers=normalized.filter(p=>['host','cohost','speaker'].includes(p.meta.role));
  const listeners=normalized.filter(p=>!['host','cohost','speaker'].includes(p.meta.role));
  const listenerCount=people.length;
  const canSpeak=['host','cohost','speaker'].includes(ownRole);

  function PersonCard({person}:{person:Person}){
    const m=person.meta;return <div className="cut-person"><div className={`cut-person-avatar ${active.has(person.identity)?'speaking':''}`}>{m.avatarUrl?<img src={m.avatarUrl} alt=""/>:<span className="fallback">{initials(m.displayName)}</span>}{m.role!=='listener'&&<span className="cut-role-badge">{m.role}</span>}</div><strong>{m.displayName}{person.local?' · You':''}</strong><span>{m.industryRole||m.headline||(m.authenticated?'Member':'Listening')}</span>{ownRole==='host'&&!person.local&&['speaker','cohost'].includes(m.role)&&<div style={{display:'flex',justifyContent:'center',gap:5,marginTop:7}}><button className="cut-mini-btn reject" onClick={()=>moderate(m.userId||'', 'mute')} disabled={!m.userId||Boolean(actionBusy)}>Mute</button><button className="cut-mini-btn reject" onClick={()=>moderate(m.userId||'', 'remove')} disabled={!m.userId||Boolean(actionBusy)}>Remove</button></div>}</div>
  }

  return <>
    {!entered&&<div className="cut-modal-backdrop"><div className="cut-modal"><div className="cut-kicker">Live on Indie Cut</div><h2>{title}</h2><p>Tap below to enter as a listener. No account is required to listen. If you want to participate, you can request to Cut In after entering.</p><button className="cut-btn" style={{width:'100%'}} onClick={enter}>Enter The Cut</button></div></div>}
    {entered&&!connected&&connecting&&<div className="cut-modal-backdrop"><div className="cut-modal"><h2>Connecting to The Cut…</h2><p>Getting the live room ready.</p></div></div>}
    {entered&&!connected&&!connecting&&audioError&&<div className="cut-modal-backdrop"><div className="cut-modal"><h2>Couldn’t connect</h2><div className="cut-alert error">{audioError}</div><div className="cut-modal-actions"><a className="cut-btn secondary" href="/the-cut">Back</a><button className="cut-btn" onClick={enter}>Try again</button></div></div></div>}

    <div ref={audioMountRef} style={{display:'none'}} aria-hidden="true"/>
    {audioError&&connected&&<div className="cut-audio-error">{audioError}</div>}
    <section className="cut-room-stage">
      {ownRole==='host'&&pending.length>0&&<div className="cut-request-panel"><h3>Requests to Cut In · {pending.length}</h3>{pending.map(req=><div className="cut-request-row" key={req.user_id}><div className="cut-avatar">{req.profile?.avatar_url?<img src={req.profile.avatar_url} alt=""/>:initials(req.profile?.display_name||'IC')}</div><div className="cut-request-copy"><strong>{req.profile?.display_name||'Indie Cut Member'}</strong><span>{req.profile?.industry_role||req.profile?.headline||'Wants to join the conversation'}</span></div><div className="cut-request-actions"><button className="cut-mini-btn" disabled={Boolean(actionBusy)} onClick={()=>moderate(req.user_id,'approve')}>Bring up</button><button className="cut-mini-btn reject" disabled={Boolean(actionBusy)} onClick={()=>moderate(req.user_id,'reject')}>Not now</button></div></div>)}</div>}
      <div className="cut-stage-label">On stage · {speakers.length}</div><div className="cut-participant-grid">{speakers.map(p=><PersonCard key={p.identity} person={p}/>)}</div>
      {listeners.length>0&&<><div className="cut-stage-label" style={{marginTop:38}}>Listening · {listeners.length}</div><div className="cut-participant-grid">{listeners.slice(0,30).map(p=><PersonCard key={p.identity} person={p}/>)}</div></>}
    </section>

    <div className="cut-controls"><div className="cut-controls-inner"><div className="cut-control-group"><button className="cut-control danger" onClick={leave}>Leave</button><button className="cut-control" onClick={share}>↗ <span className="cut-hide-mobile">{shareMessage||'Share'}</span></button><span className="cut-control" style={{cursor:'default'}}><span className="cut-listener-count">{listenerCount} listening</span></span></div><div className="cut-control-group">{canSpeak?<button className={`cut-control ${micOn?'danger':'primary'}`} onClick={toggleMic}>{micOn?'Mute mic':'Turn mic on'}</button>:<button className={`cut-control ${requestStatus==='requested'?'requested':'primary'}`} disabled={requestStatus==='requested'||requestStatus==='rejected'||actionBusy==='request'} onClick={requestMic}>{requestStatus==='requested'?'Request sent':requestStatus==='rejected'?'Request declined':'✋ Cut In'}</button>}{ownRole==='host'&&<button className="cut-control danger" onClick={endRoom}>End room</button>}</div></div></div>
  </>;
}
