'use client';

import {useEffect,useState} from 'react';
import {createClient} from '../../lib/supabase/browser';

type GateState='checking'|'open'|'waiting';

export default function RoomHostGate({children}:{children:React.ReactNode}){
  const[state,setState]=useState<GateState>('checking');
  const[roomTitle,setRoomTitle]=useState('');

  useEffect(()=>{
    const slug=new URLSearchParams(window.location.search).get('room');
    if(!slug){setState('open');return}

    let alive=true;
    const check=async()=>{
      try{
        const supabase=createClient();
        const{data,error}=await supabase.rpc('cut_room_snapshot',{p_room_slug:slug});
        if(!alive)return;
        if(error||!data){setState('open');return}
        setRoomTitle(String(data.title||''));
        setState(data.viewer_is_host||data.host_present?'open':'waiting');
      }catch{
        if(alive)setState('open');
      }
    };

    check();
    const timer=window.setInterval(check,3000);
    const onFocus=()=>check();
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onFocus);
    return()=>{alive=false;window.clearInterval(timer);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onFocus)};
  },[]);

  if(state==='open')return <>{children}</>;

  return <main style={{minHeight:'100dvh',background:'#000',color:'#fff',display:'grid',placeItems:'center',padding:24,fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',boxSizing:'border-box'}}>
    <section style={{width:'min(560px,100%)',textAlign:'center',background:'#0d0f13',border:'1px solid #262a31',borderRadius:24,padding:'34px 26px',boxShadow:'0 24px 80px rgba(0,0,0,.45)'}}>
      <div style={{fontWeight:900,letterSpacing:'.08em',fontSize:12,color:'#8d79ff'}}>THE CUT</div>
      {state==='checking'?<><h1 style={{fontSize:30,margin:'12px 0 8px'}}>Checking the room…</h1><p style={{color:'#9da4af',margin:'0 0 20px'}}>One moment.</p></>:<><div style={{width:54,height:54,borderRadius:'50%',margin:'18px auto 14px',display:'grid',placeItems:'center',background:'#171a20',border:'1px solid #343a44',fontSize:24}}>🔒</div><h1 style={{fontSize:30,margin:'0 0 10px'}}>Please wait while the host opens the room.</h1>{roomTitle&&<p style={{fontWeight:800,margin:'0 0 8px'}}>{roomTitle}</p>}<p style={{color:'#9da4af',lineHeight:1.5,margin:'0 0 22px'}}>This room will open automatically when the host arrives.</p></>}
      <a href="/the-cut" style={{display:'inline-block',borderRadius:999,background:'#fff',color:'#111',textDecoration:'none',fontWeight:900,padding:'12px 18px'}}>Back to The Cut</a>
    </section>
  </main>;
}
