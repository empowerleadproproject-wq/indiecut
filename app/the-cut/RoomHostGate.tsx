'use client';

import {useEffect,useState,type ReactNode} from 'react';
import {createClient} from '../../lib/supabase/browser';

type GateState='checking'|'open'|'waiting'|'upcoming'|'paywall'|'unavailable';
type Premium={premium:boolean;allowed:boolean;signedIn?:boolean;admissionMode?:string;entryPriceCents?:number;productKind?:string;productName?:string;productPriceCents?:number};

function getClientId(){
  const key='indiecut_cut_client_id';
  let id=localStorage.getItem(key);
  if(!id){
    id=typeof crypto!=='undefined'&&'randomUUID' in crypto
      ? crypto.randomUUID()
      : `cut-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key,id);
  }
  return id;
}

function formatSchedule(value:string){
  try{return new Date(value).toLocaleString([],{dateStyle:'medium',timeStyle:'short'})}
  catch{return value}
}

export default function RoomHostGate({children}:{children:ReactNode}){
  const[state,setState]=useState<GateState>('checking');
  const[roomTitle,setRoomTitle]=useState('');
  const[scheduledFor,setScheduledFor]=useState('');
  const[viewerIsHost,setViewerIsHost]=useState(false);
  const[starting,setStarting]=useState(false);
  const[error,setError]=useState('');
  const[premium,setPremium]=useState<Premium|null>(null);
  const[paying,setPaying]=useState(false);

  useEffect(()=>{
    let alive=true;

    const check=async()=>{
      const slug=new URLSearchParams(window.location.search).get('room');
      if(!slug){
        if(alive){setState('open');setRoomTitle('');setScheduledFor('');setViewerIsHost(false);setError('')}
        return;
      }

      try{
        const supabase=createClient();
        const clientId=getClientId();
        const{data,error:e}=await supabase.rpc('cut_room_snapshot_for_client',{p_room_slug:slug,p_client_id:clientId});
        if(!alive)return;
        if(e)throw e;
        if(!data){
          setState('unavailable');
          setError('');
          return;
        }

        setRoomTitle(String(data.title||''));
        const pr=await fetch('/api/the-cut/premium-status?room='+encodeURIComponent(slug),{cache:'no-store'}).then(r=>r.json()).catch(()=>null);
        if(pr?.premium){setPremium(pr);if(!pr.allowed){setState('paywall');setError('');return}}else setPremium(null);
        setScheduledFor(String(data.scheduledFor||data.scheduled_for||''));
        setViewerIsHost(!!data.viewer_is_host);
        setError('');

        if(data.status==='upcoming'){
          setState('upcoming');
          return;
        }

        setState(data.viewer_is_host||data.host_present?'open':'waiting');
      }catch{
        if(!alive)return;
        setError('We could not refresh the room right now. Retrying…');
        setState(current=>current==='open'?'open':current);
      }
    };

    check();
    const timer=window.setInterval(check,3000);
    const onFocus=()=>check();
    window.addEventListener('focus',onFocus);
    window.addEventListener('pageshow',onFocus);
    document.addEventListener('visibilitychange',onFocus);
    return()=>{
      alive=false;
      window.clearInterval(timer);
      window.removeEventListener('focus',onFocus);
      window.removeEventListener('pageshow',onFocus);
      document.removeEventListener('visibilitychange',onFocus);
    };
  },[]);

  async function checkout(choice:'entry'|'product'){
    const slug=new URLSearchParams(window.location.search).get('room');if(!slug||paying)return;setPaying(true);setError('');
    try{const r=await fetch('/api/the-cut/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({roomSlug:slug,choice})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Checkout could not start');if(j.url)location.href=j.url;else throw new Error('Checkout URL unavailable')}catch(e:any){setError(e.message||'Checkout could not start');setPaying(false)}
  }

  async function startRoom(){
    const slug=new URLSearchParams(window.location.search).get('room');
    if(!slug||starting)return;
    setStarting(true);setError('');
    try{
      const supabase=createClient();
      const{data,error:e}=await supabase.rpc('cut_start_room',{p_room_slug:slug,p_client_id:getClientId()});
      if(e)throw e;
      if(!data)throw new Error('Room could not be started.');
      setState('open');
    }catch(err:any){
      setError(err?.message||'Room could not be started. Try again.');
      setStarting(false);
    }
  }

  if(state==='open')return <>{children}</>;

  const title=state==='checking'?'Checking the room…'
    :state==='waiting'?'Please wait while the host opens the room.'
    :state==='upcoming'?'Scheduled room'
    :state==='paywall'?'Premium Room'
    :'Room unavailable';

  return <main style={{minHeight:'100dvh',background:'#000',color:'#fff',display:'grid',placeItems:'center',padding:24,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',boxSizing:'border-box'}}>
    <section style={{width:'min(560px,100%)',textAlign:'center',background:'#0d0f13',border:'1px solid #262a31',borderRadius:24,padding:'34px 26px',boxShadow:'0 24px 80px rgba(0,0,0,.45)'}}>
      <div style={{fontWeight:900,letterSpacing:'.08em',fontSize:12,color:'#8d79ff'}}>THE CUT</div>
      <div style={{width:54,height:54,borderRadius:'50%',margin:'18px auto 14px',display:'grid',placeItems:'center',background:'#171a20',border:'1px solid #343a44',fontSize:24}}>
        {state==='checking'?'…':state==='upcoming'?'◷':state==='waiting'?'◉':'×'}
      </div>
      <h1 style={{fontSize:30,margin:'0 0 10px'}}>{title}</h1>
      {roomTitle&&<p style={{fontWeight:800,margin:'0 0 8px'}}>{roomTitle}</p>}
      {state==='checking'&&<p style={{color:'#9da4af',margin:'0 0 20px'}}>One moment.</p>}
      {state==='waiting'&&<p style={{color:'#9da4af',lineHeight:1.5,margin:'0 0 22px'}}>This room will open automatically as soon as the host is live.</p>}
      {state==='upcoming'&&<p style={{color:'#9da4af',lineHeight:1.5,margin:'0 0 22px'}}>{scheduledFor?`Scheduled for ${formatSchedule(scheduledFor)}. `:''}{viewerIsHost?'You are the host. Start it whenever you are ready.':'This room will open when the host starts it.'}</p>}
      {state==='paywall'&&<div style={{margin:'16px 0 22px'}}>{!premium?.signedIn?<p style={{color:'#9da4af'}}>Sign in to purchase access to this premium room.</p>:<><p style={{color:'#9da4af'}}>Choose how you want to enter.</p><div style={{display:'grid',gap:10}}>{premium?.admissionMode!=='purchase_required'&&<button disabled={paying} onClick={()=>checkout('entry')} style={{border:0,borderRadius:999,background:'#785cff',color:'#fff',padding:13,fontWeight:900,cursor:'pointer'}}>Pay ${(Number(premium?.entryPriceCents||0)/100).toFixed(2)} Entry</button>}{premium?.admissionMode!=='entry_fee'&&<button disabled={paying} onClick={()=>checkout('product')} style={{border:'1px solid #444',borderRadius:999,background:'#171a20',color:'#fff',padding:13,fontWeight:900,cursor:'pointer'}}>Buy {premium?.productName||'Package'} — ${(Number(premium?.productPriceCents||0)/100).toFixed(2)}</button>}</div>{premium?.productKind==='physical'&&<small style={{display:'block',color:'#777',marginTop:10}}>Shipping address is collected securely at checkout. The host fulfills physical orders.</small>}</>}</div>}
      {state==='unavailable'&&<p style={{color:'#9da4af',lineHeight:1.5,margin:'0 0 22px'}}>This room may have ended or the link is no longer active.</p>}
      {error&&<p style={{color:'#ff8397',fontWeight:700,fontSize:13,lineHeight:1.4}}>{error}</p>}
      {state==='upcoming'&&viewerIsHost&&<button onClick={startRoom} disabled={starting} style={{display:'inline-block',border:0,borderRadius:999,background:'#785cff',color:'#fff',fontWeight:900,padding:'13px 20px',margin:'0 8px 10px',cursor:'pointer',opacity:starting?.65:1}}>{starting?'Starting…':'Start Room'}</button>}
      <a href="/the-cut" style={{display:'inline-block',borderRadius:999,background:'#fff',color:'#111',textDecoration:'none',fontWeight:900,padding:'12px 18px',margin:'0 8px 10px'}}>Back to The Cut</a>
    </section>
  </main>;
}
