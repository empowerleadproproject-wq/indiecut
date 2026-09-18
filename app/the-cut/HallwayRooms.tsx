'use client';

import {FormEvent,useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {createClient} from '../../lib/supabase/browser';

type Tab='hallway'|'upcoming'|'mine';
type CreateMode='live'|'schedule';
type Room={
  id:string;
  slug:string;
  club:string;
  title:string;
  status:'live'|'upcoming'|'ended'|string;
  people:any[];
  listening:number;
  host_present?:boolean;
  viewer_is_host?:boolean;
  scheduledFor?:string|null;
  scheduled_for?:string|null;
};

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

function scheduleValue(room:Room){return room.scheduledFor||room.scheduled_for||''}
function formatSchedule(value:string|null|undefined){
  if(!value)return 'Time to be announced';
  try{return new Date(value).toLocaleString([],{dateStyle:'medium',timeStyle:'short'})}
  catch{return value}
}

export default function HallwayRooms(){
  const[mount,setMount]=useState<HTMLElement|null>(null);
  const[tab,setTab]=useState<Tab>('hallway');
  const[rooms,setRooms]=useState<Room[]>([]);
  const[loading,setLoading]=useState(true);
  const[open,setOpen]=useState(false);
  const[title,setTitle]=useState('');
  const[mode,setMode]=useState<CreateMode>('live');
  const[scheduledFor,setScheduledFor]=useState('');
  const[creating,setCreating]=useState(false);
  const[error,setError]=useState('');
  const[notice,setNotice]=useState('');
  const[refreshKey,setRefreshKey]=useState(0);

  useEffect(()=>{
    if(new URLSearchParams(location.search).get('room'))return;
    const original=document.querySelector('section[class*="roomFeed"]') as HTMLElement|null;
    if(!original)return;
    original.style.display='none';
    const node=document.createElement('div');
    node.setAttribute('data-cut-community-rooms','1');
    original.insertAdjacentElement('afterend',node);
    setMount(node);

    const tabs=Array.from(document.querySelectorAll('div[class*="hallTabs"] > *')) as HTMLElement[];
    const map:Tab[]=['hallway','upcoming','mine'];
    const handlers=tabs.slice(0,3).map((el,i)=>{
      const fn=(event:Event)=>{event.preventDefault();setTab(map[i]);};
      el.addEventListener('click',fn);
      el.setAttribute('role','button');
      el.setAttribute('tabindex','0');
      el.style.cursor='pointer';
      return {el,fn};
    });

    return()=>{
      original.style.display='';
      node.remove();
      handlers.forEach(({el,fn})=>el.removeEventListener('click',fn));
    };
  },[]);

  useEffect(()=>{
    const tabs=Array.from(document.querySelectorAll('div[class*="hallTabs"] > *')) as HTMLElement[];
    const activeIndex=tab==='hallway'?0:tab==='upcoming'?1:2;
    tabs.slice(0,3).forEach((el,i)=>{
      el.style.color=i===activeIndex?'#fff':'#777';
      el.style.opacity=i===activeIndex?'1':'.8';
      el.style.borderBottom=i===activeIndex?'2px solid #785cff':'2px solid transparent';
      el.style.paddingBottom='9px';
      el.style.fontWeight=i===activeIndex?'900':'700';
    });
  },[tab,mount]);

  async function refresh(){
    if(!mount)return;
    setLoading(true);
    try{
      const supabase=createClient();
      const fn=tab==='hallway'?'cut_hallway_rooms':tab==='upcoming'?'cut_upcoming_rooms':'cut_my_rooms';
      const{data,error:e}=await supabase.rpc(fn,{p_client_id:getClientId()});
      if(e)throw e;
      setRooms(Array.isArray(data)?data.filter(Boolean):[]);
      setError('');
    }catch(err:any){
      setRooms([]);
      setError(err?.message||'Rooms could not be loaded. Try again.');
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{
    if(!mount)return;
    refresh();
    const interval=tab==='hallway'?5000:15000;
    const timer=window.setInterval(refresh,interval);
    return()=>window.clearInterval(timer);
  },[mount,tab,refreshKey]);

  useEffect(()=>{
    if(!notice)return;
    const timer=window.setTimeout(()=>setNotice(''),4500);
    return()=>window.clearTimeout(timer);
  },[notice]);

  function resetCreate(){
    setTitle('');
    setMode('live');
    setScheduledFor('');
    setCreating(false);
    setError('');
  }

  async function createRoom(e:FormEvent){
    e.preventDefault();
    setError('');
    if(title.trim().length<3){setError('Give your room a name.');return}
    if(mode==='schedule'&&!scheduledFor){setError('Choose a future date and time.');return}

    setCreating(true);
    try{
      const supabase=createClient();
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error('Sign in to your Indie Cut account before hosting a room.');

      if(mode==='live'){
        const{data,error:e}=await supabase.rpc('cut_create_room',{p_client_id:getClientId(),p_title:title.trim()});
        if(e)throw e;
        if(!data?.slug)throw new Error('Room could not be created.');
        location.href=`/the-cut?room=${encodeURIComponent(data.slug)}`;
        return;
      }

      const when=new Date(scheduledFor);
      if(!Number.isFinite(when.getTime())||when.getTime()<=Date.now())throw new Error('Choose a future date and time.');
      const{data,error:e}=await supabase.rpc('cut_schedule_room',{
        p_client_id:getClientId(),
        p_title:title.trim(),
        p_scheduled_for:when.toISOString()
      });
      if(e)throw e;
      if(!data?.slug)throw new Error('Room could not be scheduled.');

      setOpen(false);
      resetCreate();
      setTab('upcoming');
      setNotice('Room scheduled. It is now listed under Upcoming.');
      setRefreshKey(v=>v+1);
    }catch(err:any){
      setError(err?.message||'Room could not be created.');
      setCreating(false);
    }
  }

  async function startRoom(room:Room){
    setError('');
    try{
      const supabase=createClient();
      const{data,error:e}=await supabase.rpc('cut_start_room',{p_room_slug:room.slug,p_client_id:getClientId()});
      if(e)throw e;
      if(!data?.slug)throw new Error('Room could not be started.');
      location.href=`/the-cut?room=${encodeURIComponent(room.slug)}`;
    }catch(err:any){
      setError(err?.message||'Room could not be started. Try again.');
    }
  }

  const heading=tab==='hallway'?'Live rooms':tab==='upcoming'?'Upcoming rooms':'My rooms';
  const subheading=tab==='hallway'?'Join a conversation or start your own.'
    :tab==='upcoming'?'Scheduled conversations coming up in The Cut.'
    :'Rooms you host, live or scheduled.';

  const minDateTime=useMemo(()=>{
    const d=new Date(Date.now()+60_000-diffTimezoneOffset());
    return d.toISOString().slice(0,16);
  },[]);

  if(!mount)return null;

  return createPortal(<section style={{maxWidth:860,margin:'0 auto',padding:'0 0 110px',color:'#fff'}}>
    {notice&&<div style={{background:'#17231c',border:'1px solid #285d3a',borderRadius:14,padding:'12px 15px',margin:'0 0 16px',color:'#baf4ca',fontWeight:800,fontSize:13}}>{notice}</div>}
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:14,margin:'2px 0 18px',flexWrap:'wrap'}}>
      <div><h2 style={{fontSize:22,margin:0}}>{heading}</h2><p style={{color:'#888',fontSize:13,margin:'4px 0 0'}}>{subheading}</p></div>
      <button onClick={()=>{resetCreate();setOpen(true)}} style={{border:0,borderRadius:999,background:'#fff',color:'#111',padding:'12px 18px',fontWeight:900,cursor:'pointer'}}>＋ Create a Room</button>
    </div>

    {error&&!open&&<div style={{background:'#281317',border:'1px solid #63303a',borderRadius:14,padding:'12px 15px',marginBottom:14,color:'#ff9caf',fontWeight:800,fontSize:13}}>{error}</div>}

    {loading?<div style={{background:'#101116',border:'1px solid #282b32',borderRadius:20,padding:28,color:'#999',textAlign:'center'}}>Loading rooms…</div>
    :rooms.length===0?<div style={{background:'#101116',border:'1px solid #282b32',borderRadius:20,padding:28,color:'#999',textAlign:'center'}}>
      {tab==='hallway'?'No rooms are live yet. Start the first one.':tab==='upcoming'?'No rooms are scheduled yet.':"You don't have any live or scheduled rooms yet."}
    </div>
    :<div style={{display:'grid',gap:14}}>{rooms.map(room=><RoomCard key={room.id} room={room} tab={tab} startRoom={()=>startRoom(room)}/>)}</div>}

    {open&&<div onClick={()=>!creating&&setOpen(false)} style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,.76)',display:'grid',placeItems:'center',padding:18}}>
      <form onSubmit={createRoom} onClick={e=>e.stopPropagation()} style={{width:'min(520px,100%)',maxHeight:'90dvh',overflowY:'auto',background:'#11151b',border:'1px solid #303744',borderRadius:24,padding:26,boxSizing:'border-box',boxShadow:'0 24px 80px rgba(0,0,0,.55)'}}>
        <button type="button" onClick={()=>!creating&&setOpen(false)} style={{float:'right',border:0,borderRadius:'50%',width:34,height:34,background:'#1d2128',color:'#fff',fontSize:22,cursor:'pointer'}}>×</button>
        <div style={{fontSize:12,fontWeight:900,letterSpacing:'.08em',color:'#8d79ff'}}>CREATE A ROOM</div>
        <h2 style={{fontSize:30,margin:'8px 0'}}>Start now or schedule it</h2>
        <p style={{color:'#9da4af',lineHeight:1.5}}>Signed-in Indie Cut members can create a room and automatically become the host.</p>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,background:'#090c11',padding:5,borderRadius:14,margin:'18px 0'}}>
          <button type="button" onClick={()=>setMode('live')} style={{border:0,borderRadius:10,padding:'11px 10px',fontWeight:900,cursor:'pointer',background:mode==='live'?'#785cff':'transparent',color:'#fff'}}>Go Live Now</button>
          <button type="button" onClick={()=>setMode('schedule')} style={{border:0,borderRadius:10,padding:'11px 10px',fontWeight:900,cursor:'pointer',background:mode==='schedule'?'#785cff':'transparent',color:'#fff'}}>Schedule for Later</button>
        </div>

        <label style={{display:'block',fontWeight:900,fontSize:13,marginTop:16}}>Room name
          <input autoFocus maxLength={90} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Independent filmmakers: what are you working on?" style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:8,border:'1px solid #343b47',borderRadius:12,background:'#090c11',color:'#fff',padding:'14px 15px',fontSize:16}}/>
        </label>

        {mode==='schedule'&&<label style={{display:'block',fontWeight:900,fontSize:13,marginTop:16}}>Date & time
          <input type="datetime-local" min={minDateTime} value={scheduledFor} onChange={e=>setScheduledFor(e.target.value)} style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:8,border:'1px solid #343b47',borderRadius:12,background:'#090c11',color:'#fff',padding:'14px 15px',fontSize:16,colorScheme:'dark'}}/>
        </label>}

        {error&&<p style={{color:'#ff6b88',fontWeight:800,fontSize:13,lineHeight:1.4}}>{error}</p>}
        <button disabled={creating} style={{width:'100%',border:0,borderRadius:999,background:'#785cff',color:'#fff',padding:14,fontWeight:900,fontSize:15,marginTop:18,cursor:'pointer',opacity:creating?.65:1}}>{creating?(mode==='live'?'Opening room…':'Scheduling…'):(mode==='live'?'Go Live':'Schedule Room')}</button>
        <p style={{color:'#777',fontSize:11,textAlign:'center',lineHeight:1.4}}>{mode==='live'?'Your room appears in the Hallway immediately.':'Your room appears under Upcoming and you can start it from My Rooms.'}</p>
      </form>
    </div>}
  </section>,mount);
}

function RoomCard({room,tab,startRoom}:{room:Room;tab:Tab;startRoom:()=>void}){
  const people=Array.isArray(room.people)?room.people:[];
  const lead=people[0];
  const speakers=people.filter((p:any)=>p.role==='host'||p.role==='speaker').length;
  const isUpcoming=room.status==='upcoming';
  const isLive=room.status==='live';
  const waiting=isLive&&room.host_present===false;

  return <article style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:18,background:'#101116',border:'1px solid #282b32',borderRadius:20,padding:'18px 20px',flexWrap:'wrap'}}>
    <div style={{minWidth:0,flex:'1 1 420px'}}>
      <small style={{color:isUpcoming?'#b99dff':waiting?'#d8a54b':'#9da4af',fontWeight:900}}>
        {isUpcoming?'◷ UPCOMING':waiting?'● WAITING FOR HOST':'🔴 LIVE'}　•　{room.club||'THE CUT'}
      </small>
      <h2 style={{fontSize:25,lineHeight:1.05,margin:'8px 0 10px'}}>{room.title}</h2>
      {isUpcoming&&<div style={{color:'#c6c8ce',fontSize:14,fontWeight:800,marginBottom:12}}>{formatSchedule(scheduleValue(room))}</div>}
      {isLive&&<div style={{display:'flex',gap:12,alignItems:'center'}}>
        <div style={{display:'flex'}}>{people.slice(0,4).map((p:any,i:number)=><span key={p.id||i} style={{width:42,height:42,borderRadius:'50%',display:'grid',placeItems:'center',overflow:'hidden',background:'#24272d',border:'2px solid #ddd',marginRight:-8,fontSize:11,fontWeight:900,zIndex:4-i}}>{p.avatar?<img src={p.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:(String(p.name||'IC').slice(0,2).toUpperCase())}</span>)}</div>
        <div><strong>{lead?.name||(waiting?'Host is away':'Live room')}</strong><div style={{color:'#999',fontSize:13,marginTop:3}}>{room.listening||0} listening　•　{speakers} speakers</div></div>
      </div>}
    </div>
    <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
      {isUpcoming&&room.viewer_is_host?<button onClick={startRoom} style={primaryButton}>Start Room</button>
      :<button onClick={()=>location.href=`/the-cut?room=${encodeURIComponent(room.slug)}`} style={{...primaryButton,background:waiting||isUpcoming?'#2a2d34':'#13c568'}}>{isUpcoming?'View Room':waiting?'View Room':'Enter Room'}</button>}
      {tab==='mine'&&isLive&&<span style={{fontSize:11,color:'#777',fontWeight:800}}>YOU HOST THIS</span>}
    </div>
  </article>;
}

const primaryButton:React.CSSProperties={border:0,borderRadius:999,background:'#785cff',color:'#fff',padding:'13px 18px',fontWeight:900,cursor:'pointer',whiteSpace:'nowrap'};

function diffTimezoneOffset(){return new Date().getTimezoneOffset()*60_000}
