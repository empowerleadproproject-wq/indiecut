'use client';

import {FormEvent,useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {createClient} from '../../lib/supabase/browser';

type Room={id:string;slug:string;club:string;title:string;status:string;people:any[];listening:number;host_present?:boolean;viewer_is_host?:boolean};
function getClientId(){const key='indiecut_cut_client_id';let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id)}return id}

export default function HallwayRooms(){
  const[mount,setMount]=useState<HTMLElement|null>(null);
  const[rooms,setRooms]=useState<Room[]>([]);
  const[loading,setLoading]=useState(true);
  const[open,setOpen]=useState(false);
  const[title,setTitle]=useState('');
  const[creating,setCreating]=useState(false);
  const[error,setError]=useState('');

  useEffect(()=>{
    if(new URLSearchParams(location.search).get('room'))return;
    const original=document.querySelector('section[class*="roomFeed"]') as HTMLElement|null;
    if(!original)return;
    original.style.display='none';
    const node=document.createElement('div');
    node.setAttribute('data-cut-community-rooms','1');
    original.insertAdjacentElement('afterend',node);
    setMount(node);
    return()=>{original.style.display='';node.remove()};
  },[]);

  async function refresh(){
    try{
      const supabase=createClient();
      const{data,error:e}=await supabase.rpc('cut_hallway_rooms',{p_client_id:getClientId()});
      if(e)throw e;
      setRooms(Array.isArray(data)?data.filter(Boolean):[]);
    }catch{}
    finally{setLoading(false)}
  }
  useEffect(()=>{if(!mount)return;refresh();const t=setInterval(refresh,5000);return()=>clearInterval(t)},[mount]);

  async function createRoom(e:FormEvent){
    e.preventDefault();setError('');
    if(title.trim().length<3){setError('Give your room a name.');return}
    setCreating(true);
    try{
      const supabase=createClient();
      const{data,error:e}=await supabase.rpc('cut_create_room',{p_client_id:getClientId(),p_title:title.trim()});
      if(e)throw e;
      if(!data?.slug)throw new Error('Room could not be created.');
      location.href=`/the-cut?room=${encodeURIComponent(data.slug)}`;
    }catch(err:any){setError(err?.message||'Room could not be created.');setCreating(false)}
  }

  if(!mount)return null;
  return createPortal(<section style={{maxWidth:860,margin:'0 auto',padding:'0 0 110px',color:'#fff'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:14,margin:'2px 0 18px'}}><div><h2 style={{fontSize:22,margin:0}}>Live rooms</h2><p style={{color:'#888',fontSize:13,margin:'4px 0 0'}}>Join a conversation or start your own.</p></div><button onClick={()=>{setOpen(true);setError('')}} style={{border:0,borderRadius:999,background:'#fff',color:'#111',padding:'12px 18px',fontWeight:900,cursor:'pointer'}}>＋ Start a Room</button></div>
    {loading?<div style={{background:'#101116',border:'1px solid #282b32',borderRadius:20,padding:28,color:'#999',textAlign:'center'}}>Loading live rooms…</div>:rooms.length===0?<div style={{background:'#101116',border:'1px solid #282b32',borderRadius:20,padding:28,color:'#999',textAlign:'center'}}>No rooms are live yet. Start the first one.</div>:<div style={{display:'grid',gap:14}}>{rooms.map(room=>{const people=Array.isArray(room.people)?room.people:[];const lead=people[0];const speakers=people.filter((p:any)=>p.role==='host'||p.role==='speaker').length;return <article key={room.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:18,background:'#101116',border:'1px solid #282b32',borderRadius:20,padding:'18px 20px'}}><div style={{minWidth:0}}><small style={{color:room.host_present===false?'#d8a54b':'#9da4af',fontWeight:900}}>{room.host_present===false?'● WAITING FOR HOST':'🔴 LIVE'}　•　{room.club||'THE CUT'}</small><h2 style={{fontSize:25,lineHeight:1.05,margin:'8px 0 13px'}}>{room.title}</h2><div style={{display:'flex',gap:12,alignItems:'center'}}><div style={{display:'flex'}}>{people.slice(0,4).map((p:any,i:number)=><span key={p.id||i} style={{width:42,height:42,borderRadius:'50%',display:'grid',placeItems:'center',overflow:'hidden',background:'#24272d',border:'2px solid #ddd',marginRight:-8,fontSize:11,fontWeight:900,zIndex:4-i}}>{p.avatar?<img src={p.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:(String(p.name||'IC').slice(0,2).toUpperCase())}</span>)}</div><div><strong>{lead?.name||'Room opening'}</strong><div style={{color:'#999',fontSize:13,marginTop:3}}>{room.listening||0} listening　•　{speakers} speakers</div></div></div></div><button onClick={()=>location.href=`/the-cut?room=${encodeURIComponent(room.slug)}`} style={{border:0,borderRadius:999,background:room.host_present===false?'#2a2d34':'#13c568',color:'#fff',padding:'13px 18px',fontWeight:900,cursor:'pointer',whiteSpace:'nowrap'}}>{room.host_present===false?'View Room':'Enter Room'}</button></article>})}</div>}
    {open&&<div onClick={()=>!creating&&setOpen(false)} style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,.72)',display:'grid',placeItems:'center',padding:18}}><form onSubmit={createRoom} onClick={e=>e.stopPropagation()} style={{width:'min(500px,100%)',background:'#11151b',border:'1px solid #303744',borderRadius:24,padding:26,boxSizing:'border-box'}}><button type="button" onClick={()=>setOpen(false)} style={{float:'right',border:0,borderRadius:'50%',width:34,height:34,background:'#1d2128',color:'#fff',fontSize:22}}>×</button><div style={{fontSize:12,fontWeight:900,letterSpacing:'.08em',color:'#8d79ff'}}>START A ROOM</div><h2 style={{fontSize:30,margin:'8px 0'}}>What do you want to talk about?</h2><p style={{color:'#9da4af',lineHeight:1.5}}>Your room appears in the Hallway immediately and you enter as the host.</p><label style={{display:'block',fontWeight:900,fontSize:13,marginTop:16}}>Room name<input autoFocus maxLength={90} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Independent filmmakers: what are you working on?" style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:8,border:'1px solid #343b47',borderRadius:12,background:'#090c11',color:'#fff',padding:'14px 15px',fontSize:16}}/></label>{error&&<p style={{color:'#ff6b88',fontWeight:800,fontSize:13}}>{error}</p>}<button disabled={creating} style={{width:'100%',border:0,borderRadius:999,background:'#785cff',color:'#fff',padding:14,fontWeight:900,fontSize:15,marginTop:18,opacity:creating?.65:1}}>{creating?'Opening room…':'Go Live'}</button><p style={{color:'#777',fontSize:11,textAlign:'center'}}>You need a Cut account to host a room.</p></form></div>}
  </section>,mount);
}
