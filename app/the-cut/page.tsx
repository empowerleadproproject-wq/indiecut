'use client';

import {FormEvent,useEffect,useRef,useState} from 'react';
import styles from './thecut.module.css';
import MemberProfileSheet from './MemberProfileSheet';
import HallwayRooms from './HallwayRooms';
import {createClient} from '../../lib/supabase/browser';

type PromoType='brand'|'music'|'movie';
type Promo={
  id?:string;
  name:string;
  message:string;
  link:string;
  minutes:number;
  image:string;
  mediaType:PromoType;
  mediaUrl?:string;
  previewSeconds:number;
  startsAt?:number;
  endsAt?:number;
};
type Person={
  id:string;
  name:string;
  avatar:string;
  role:'host'|'speaker'|'listener';
  handle?:string;
  followers?:string;
  following?:string;
  bio?:string;
  link?:string;
  own?:boolean;
  avatarIsUrl?:boolean;
  accountId?:string;
  profileId?:string;
  promo?:Promo;
};
type Room={id:string;slug:string;club:string;title:string;status:'live'|'upcoming'|'ended';people:Person[];listening:number};

type PromoViewer={promo:Promo;own:boolean};

const fallbackMe:Person={id:'you',name:'You',avatar:'YOU',role:'listener',handle:'',followers:'0',following:'0',bio:'',own:true};

function initials(name:string){return name.trim().split(/\s+/).slice(0,2).map(v=>v[0]?.toUpperCase()||'').join('')||'IC'}
function normalizePromoType(value:any):PromoType{return value==='music'?'music':value==='movie'?'movie':'brand'}
function normalizePublicPromo(raw:any):Promo|null{
  if(!raw||!raw.name)return null;
  return {
    id:raw.id?String(raw.id):undefined,
    name:String(raw.name||'Promotion'),
    message:String(raw.message||''),
    link:String(raw.link||'#'),
    minutes:Number(raw.minutes||0),
    image:String(raw.image||''),
    mediaType:normalizePromoType(raw.mediaType),
    mediaUrl:raw.mediaUrl?String(raw.mediaUrl):raw.audio?String(raw.audio):undefined,
    previewSeconds:Number(raw.previewSeconds||10),
    startsAt:raw.startsAt?Number(raw.startsAt):undefined,
    endsAt:raw.endsAt?Number(raw.endsAt):undefined,
  };
}
function normalizeActivePromo(raw:any):Promo|null{
  const promo=normalizePublicPromo(raw);
  const endsAt=Number(raw?.endsAt||0);
  if(!promo||!Number.isFinite(endsAt)||endsAt<=Date.now())return null;
  promo.endsAt=endsAt;
  promo.startsAt=Number(raw?.startsAt||Date.now());
  promo.minutes=Number(raw?.minutes||promo.minutes||0);
  return promo;
}
function normalizeRoom(raw:any):Room|null{
  if(!raw||!raw.slug)return null;
  const people=Array.isArray(raw.people)?raw.people.filter((p:any)=>p&&p.name).map((p:any)=>({
    id:String(p.id),
    name:String(p.name),
    avatar:p.avatar?String(p.avatar):initials(String(p.name)),
    avatarIsUrl:!!p.avatar,
    role:(p.role==='host'||p.role==='speaker'?p.role:'listener') as Person['role'],
    own:!!p.own,
    accountId:p.account_id?String(p.account_id):undefined,
    profileId:p.profile_id?String(p.profile_id):undefined,
    handle:p.handle?String(p.handle):undefined,
    bio:p.bio?String(p.bio):undefined,
    promo:normalizePublicPromo(p.promo)||undefined,
  })):[];
  return {id:String(raw.id),slug:String(raw.slug),club:String(raw.club||'THE CUT'),title:String(raw.title||'Live room'),status:(raw.status||'live') as Room['status'],people,listening:Number(raw.listening||0)};
}
function formatRemaining(ms:number){const total=Math.max(0,Math.ceil(ms/1000));const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;return h>0?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`}
async function loadMe():Promise<Person>{try{const supabase=createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return fallbackMe;const{data}=await supabase.from('cut_profiles').select('display_name,username,bio,avatar_url,website_url').eq('id',user.id).maybeSingle();const username=data?.username||'';const display=data?.display_name||username||user.email?.split('@')[0]||'You';return{id:user.id,name:display,avatar:data?.avatar_url||initials(display),avatarIsUrl:!!data?.avatar_url,role:'listener',handle:username?`@${username}`:'',followers:'0',following:'0',bio:data?.bio||'',link:data?.website_url||'',own:true}}catch{return fallbackMe}}
function getClientId(){const key='indiecut_cut_client_id';let id=localStorage.getItem(key);if(!id){id=typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():`cut-${Date.now()}-${Math.random().toString(36).slice(2)}`;localStorage.setItem(key,id)}return id}

function Avatar({p,host=false,promo}:{p:Person;host?:boolean;promo?:Promo|null}){
  const promoted=!!promo;
  return <div className={`${styles.avatar} ${host?styles.host:''} ${promoted?styles.promotedAvatar:''}`}>{promoted&&promo?.image?<img src={promo.image} alt={promo.name}/>:p.avatarIsUrl?<img src={p.avatar} alt={p.name}/>:p.avatar}{promoted&&<i className={styles.promotedTag}>PROMOTED</i>}</div>;
}

export default function TheCutPage(){
  const[roomSlug,setRoomSlug]=useState<string|null>(null);
  const[hallRoom,setHallRoom]=useState<Room|null>(null);
  const[me,setMe]=useState<Person>(fallbackMe);
  const[hallLoading,setHallLoading]=useState(true);

  useEffect(()=>{
    const q=new URLSearchParams(location.search).get('room');
    if(q)setRoomSlug(q);
    const refreshMe=()=>loadMe().then(setMe);
    refreshMe();
    window.addEventListener('focus',refreshMe);
    window.addEventListener('pageshow',refreshMe);
    document.addEventListener('visibilitychange',refreshMe);
    return()=>{window.removeEventListener('focus',refreshMe);window.removeEventListener('pageshow',refreshMe);document.removeEventListener('visibilitychange',refreshMe)};
  },[]);

  useEffect(()=>{
    if(roomSlug)return;
    let live=true;
    const refresh=async()=>{try{const supabase=createClient();const{data}=await supabase.rpc('cut_room_snapshot',{p_room_slug:'creators'});if(live)setHallRoom(normalizeRoom(data))}finally{if(live)setHallLoading(false)}};
    refresh();const t=setInterval(refresh,8000);return()=>{live=false;clearInterval(t)};
  },[roomSlug]);

  function enterRoom(slug:string){history.replaceState(null,'',`/the-cut?room=${encodeURIComponent(slug)}`);setRoomSlug(slug)}
  function backToHall(){history.replaceState(null,'','/the-cut');setRoomSlug(null)}

  if(roomSlug)return <LiveRoom slug={roomSlug} back={backToHall}/>;
  const speakers=hallRoom?.people.filter(p=>p.role==='host'||p.role==='speaker').length||0;
  const lead=hallRoom?.people[0];
  return <main className={styles.hall}>
    <div className={styles.siteLink}><a href="/" className={styles.miniBrand}>INDIE<br/>CUT</a><a href="/">← Back to Main Site</a></div>
    <header className={styles.hallHead}><div><div className={styles.cutLogo}>THE CUT</div><p>Live conversations from Indie Cut.</p></div><div className={styles.hallActions}><a href="/the-cut/profile" className={styles.me}>{me.avatarIsUrl?<img src={me.avatar} alt={me.name}/>:me.avatar}</a></div></header>
    <HallwayRooms/>
  </main>;
}

function LiveRoom({slug,back}:{slug:string;back:()=>void}){
  const[room,setRoom]=useState<Room|null>(null);
  const[loading,setLoading]=useState(true);
  const[joined,setJoined]=useState(false);
  const[profile,setProfile]=useState<Person|null>(null);
  const[promoOpen,setPromoOpen]=useState(false);
  const[activePromo,setActivePromo]=useState<Promo|null>(null);
  const[promoRemaining,setPromoRemaining]=useState(0);
  const[promoViewer,setPromoViewer]=useState<PromoViewer|null>(null);
  const[joinOpen,setJoinOpen]=useState(false);
  const[notice,setNotice]=useState('');
  const[profileReminderOpen,setProfileReminderOpen]=useState(false);
  const clientId=useRef<string>('');
  const reminderTimer=useRef<ReturnType<typeof setTimeout>|null>(null);

  async function refreshRoom(){
    if(!clientId.current)return;
    const supabase=createClient();
    try{
      const{data,error}=await supabase.rpc('cut_room_listen',{p_room_slug:slug,p_client_id:clientId.current});
      if(error)throw error;
      const next=normalizeRoom(data);
      setRoom(next);
      if(next?.people.some(p=>p.own)){setJoined(true);localStorage.setItem(`indiecut_cut_joined_${slug}`,'1')}
    }catch{
      // A listener heartbeat write should never make a valid live room look unavailable.
      // Fall back to a read-only snapshot and preserve the last good room on transient failures.
      try{
        const{data,error}=await supabase.rpc('cut_room_snapshot_for_client',{p_room_slug:slug,p_client_id:clientId.current});
        if(error)throw error;
        const next=normalizeRoom(data);
        setRoom(previous=>next||previous);
        if(next?.people.some(p=>p.own)){setJoined(true);localStorage.setItem(`indiecut_cut_joined_${slug}`,'1')}
      }catch{}
    }finally{setLoading(false)}
  }
  async function refreshPromo(){
    if(!clientId.current)return;
    try{
      const supabase=createClient();
      const{data,error}=await supabase.rpc('cut_active_promo',{p_client_id:clientId.current});
      if(error)throw error;
      const promo=normalizeActivePromo(data);
      setActivePromo(promo);
      setPromoRemaining(promo?.endsAt?Math.max(0,promo.endsAt-Date.now()):0);
    }catch{}
  }
  async function checkProfileReminder(){
    if(!clientId.current)return;
    try{
      if(localStorage.getItem('indiecut_profile_saved')==='1'){setProfileReminderOpen(false);return}
      const supabase=createClient();
      const{data,error}=await supabase.rpc('cut_profile_reminder_status',{p_client_id:clientId.current});
      if(error||!data)return;
      if(data.complete){localStorage.setItem('indiecut_profile_saved','1');setProfileReminderOpen(false);return}
      const dueAt=Number(data.dueAt||0),snoozeUntil=Number(localStorage.getItem('indiecut_profile_reminder_snooze_until')||0),now=Date.now();
      if(dueAt&&now>=dueAt&&now>=snoozeUntil){setProfileReminderOpen(true);return}
      const wake=Math.max(dueAt||now+15*60*1000,snoozeUntil)-now;
      if(reminderTimer.current)clearTimeout(reminderTimer.current);
      reminderTimer.current=setTimeout(checkProfileReminder,Math.max(1000,wake+250));
    }catch{}
  }

  useEffect(()=>{
    clientId.current=getClientId();
    setJoined(localStorage.getItem(`indiecut_cut_joined_${slug}`)==='1');
    let alive=true;
    const refresh=async()=>{if(alive)await refreshRoom()};
    refresh();refreshPromo();checkProfileReminder();
    const roomTimer=setInterval(refresh,8000),promoTimer=setInterval(refreshPromo,15000);
    const onFocus=()=>{refreshPromo();refresh();checkProfileReminder()};
    window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onFocus);
    return()=>{alive=false;clearInterval(roomTimer);clearInterval(promoTimer);if(reminderTimer.current)clearTimeout(reminderTimer.current);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onFocus)};
  },[slug]);

  useEffect(()=>{
    if(!activePromo?.endsAt){setPromoRemaining(0);return}
    const tick=()=>{const left=Math.max(0,(activePromo.endsAt||0)-Date.now());setPromoRemaining(left);if(left<=0){setActivePromo(null);if(promoViewer?.own)setPromoViewer(null)}};
    tick();const t=setInterval(tick,1000);return()=>clearInterval(t);
  },[activePromo,promoViewer?.own]);
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(t)},[notice]);

  async function joinSignedIn(){const supabase=createClient();const{data,error}=await supabase.rpc('cut_room_join',{p_room_slug:slug,p_client_id:clientId.current,p_display_name:null,p_email:null});if(error)throw error;const next=normalizeRoom(data);if(next)setRoom(next);setJoined(true);localStorage.setItem(`indiecut_cut_joined_${slug}`,'1');checkProfileReminder()}
  async function requestJoin(){const supabase=createClient();const{data:{user}}=await supabase.auth.getUser();if(user){try{await joinSignedIn()}catch{setNotice('Could not join the room. Try again.')}}else setJoinOpen(true)}
  async function createAccountAndJoin(name:string,email:string){const supabase=createClient();const{data,error}=await supabase.rpc('cut_room_join',{p_room_slug:slug,p_client_id:clientId.current,p_display_name:name,p_email:email});if(error)throw error;const next=normalizeRoom(data);if(next)setRoom(next);setJoined(true);localStorage.setItem(`indiecut_cut_joined_${slug}`,'1');localStorage.removeItem('indiecut_profile_saved');setJoinOpen(false);const redirect=`${location.origin}/the-cut?room=${encodeURIComponent(slug)}`;const{error:otpError}=await supabase.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:redirect,data:{display_name:name}}});setNotice(otpError?'You joined the room.':'You’re in. We also sent a sign-in link to your email.');checkProfileReminder()}
  async function leave(){try{const supabase=createClient();await supabase.rpc('cut_room_leave',{p_room_slug:slug,p_client_id:clientId.current})}catch{}localStorage.removeItem(`indiecut_cut_joined_${slug}`);setJoined(false);back()}
  async function shareRoom(){if(!room)return;const url=`${location.origin}/the-cut?room=${encodeURIComponent(room.slug)}`;try{if(navigator.share){await navigator.share({title:room.title,text:'Join me live in The Cut on Indie Cut.',url})}else{await navigator.clipboard.writeText(url);setNotice('Room link copied.')}}catch(err:any){if(err?.name!=='AbortError'){try{await navigator.clipboard.writeText(url);setNotice('Room link copied.')}catch{setNotice('Copy the room link from your browser address bar.')}}}}
  async function activatePromo(p:Promo){const supabase=createClient();const{data,error}=await supabase.rpc('cut_activate_promo',{p_client_id:clientId.current,p_name:p.name,p_message:p.message,p_link:p.link,p_media_type:p.mediaType,p_image_data:p.image||null,p_audio_data:p.mediaUrl||null,p_preview_seconds:p.previewSeconds,p_minutes:p.minutes});if(error)throw error;const saved=normalizeActivePromo(data);if(!saved)throw new Error('Promotion could not be activated.');setActivePromo(saved);setPromoRemaining(saved.endsAt?Math.max(0,saved.endsAt-Date.now()):0);setPromoOpen(false);setPromoViewer({promo:saved,own:true});setNotice('Promotion activated. Your private countdown is running.');await refreshRoom()}
  async function updatePromo(p:Promo){if(!p.id)throw new Error('Promotion could not be identified.');const supabase=createClient();const{data,error}=await supabase.rpc('cut_update_active_promo',{p_client_id:clientId.current,p_promo_id:p.id,p_name:p.name,p_message:p.message,p_link:p.link});if(error)throw error;const saved=normalizeActivePromo(data);if(!saved)throw new Error('Promotion could not be updated.');setActivePromo(saved);setPromoViewer({promo:saved,own:true});setNotice('Promotion updated. Your original countdown is still running.');await refreshRoom()}
  function snoozeProfileReminder(){localStorage.setItem('indiecut_profile_reminder_snooze_until',String(Date.now()+60*60*1000));setProfileReminderOpen(false);checkProfileReminder()}

  if(loading)return <main className={styles.space}><div className={styles.roomState}>Connecting to the live room…</div></main>;
  if(!room)return <main className={styles.space}><div className={styles.roomState}><h2>Room unavailable</h2><p>This room may have ended or the live room service is unavailable.</p><button onClick={back}>Back to The Cut</button></div></main>;
  const people=room.people;
  return <main className={styles.space}>
    <header className={styles.spaceTop}><div className={styles.roomBrand}><a href="/" className={styles.roomLogo}>INDIE<br/>CUT</a><button onClick={back}>← <span>Back</span></button></div><div className={styles.topRight}><button className={styles.shareTop} onClick={shareRoom}>Share</button><button className={styles.leaveTop} onClick={leave}>Leave</button></div></header>
    <section className={styles.spaceInfo}><div><b>● LIVE</b>　•　{room.listening} listening</div><h1>{room.title}</h1><p>{room.club}</p></section>
    {notice&&<div className={styles.roomNotice}>{notice}</div>}
    {activePromo&&<button onClick={()=>setPromoViewer({promo:activePromo,own:true})} style={{display:'flex',alignItems:'center',gap:10,border:'1px solid #6f50ff',background:'#141021',color:'#fff',borderRadius:999,padding:'10px 15px',fontWeight:900,margin:'0 0 14px',cursor:'pointer'}}><span style={{color:'#9a86ff'}}>● YOUR PROMO</span><strong style={{fontVariantNumeric:'tabular-nums'}}>{formatRemaining(promoRemaining)}</strong><span style={{color:'#aaa',fontSize:12}}>left · only you see this timer</span></button>}
    <section className={styles.peopleGrid}>{people.map(p=>{const shownPromo=p.own&&activePromo?activePromo:p.promo;return <button className={styles.person} key={p.id} onClick={()=>shownPromo?setPromoViewer({promo:shownPromo,own:!!p.own}):setProfile(p)}><Avatar p={p} host={p.role==='host'} promo={shownPromo}/><strong>{shownPromo?shownPromo.name:p.name}</strong><span>{shownPromo?(p.own&&activePromo?`${formatRemaining(promoRemaining)} left`:'Promoted'):p.role==='host'?'Host':p.role==='speaker'?'Speaker':'Listener'}</span></button>})}</section>
    <footer className={styles.spaceDock}>{!joined?<><span className={styles.listenOnly}>You’re listening as a guest</span><button className={styles.joinSpace} onClick={requestJoin}>Join this Space</button></>:<><button className={styles.leaveQuiet} onClick={leave}>Leave quietly</button>{activePromo&&<button onClick={()=>setPromoViewer({promo:activePromo,own:true})} style={{border:0,borderRadius:999,background:'#181225',color:'#fff',padding:'13px 17px',fontWeight:900,fontVariantNumeric:'tabular-nums'}}>⏱ {formatRemaining(promoRemaining)}</button>}<button className={styles.promoteBtn} onClick={()=>setPromoOpen(true)}>Promote</button></>}</footer>
    {profile&&<MemberProfileSheet person={profile} clientId={clientId.current} close={()=>setProfile(null)} promote={()=>{setProfile(null);setPromoOpen(true)}}/>}
    {joinOpen&&<JoinAccountModal roomTitle={room.title} close={()=>setJoinOpen(false)} join={createAccountAndJoin}/>} 
    {promoOpen&&<PromoModal clientId={clientId.current} close={()=>setPromoOpen(false)} activate={activatePromo}/>} 
    {promoViewer&&<PromoDetail promo={promoViewer.promo} own={promoViewer.own} remaining={promoViewer.own?promoRemaining:undefined} close={()=>setPromoViewer(null)} update={promoViewer.own?updatePromo:undefined}/>} 
    {profileReminderOpen&&<ProfileReminder close={snoozeProfileReminder}/>} 
  </main>;
}

function ProfileReminder({close}:{close:()=>void}){return <div className={styles.modalShade}><section className={styles.promoDetail} style={{alignSelf:'center',maxWidth:460}}><div style={{fontSize:13,fontWeight:900,color:'#8f7aff',letterSpacing:'.08em'}}>FINISH YOUR PROFILE</div><h2 style={{marginTop:8}}>Complete your Indie Cut profile</h2><p>Add your photo, bio and links so people in The Cut can recognize you, follow you and learn more about you.</p><a href="/the-cut/profile" className={styles.promoCta}>Complete Profile　→</a><button onClick={close} className={styles.previewPlay}>Remind me later</button></section></div>}

function JoinAccountModal({roomTitle,close,join}:{roomTitle:string;close:()=>void;join:(name:string,email:string)=>Promise<void>}){const[name,setName]=useState(''),[email,setEmail]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState('');async function submit(e:FormEvent){e.preventDefault();if(name.trim().length<2){setError('Enter your name.');return}if(!/^\S+@\S+\.\S+$/.test(email.trim())){setError('Enter a valid email.');return}setSaving(true);setError('');try{await join(name.trim(),email.trim().toLowerCase())}catch(err:any){setError(err?.message||'Could not create your account. Try again.');setSaving(false)}}return <div className={styles.modalShade} onClick={close}><form className={styles.joinModal} onClick={e=>e.stopPropagation()} onSubmit={submit}><button type="button" className={styles.closeModal} onClick={close}>×</button><div className={styles.joinKicker}>JOIN THE CONVERSATION</div><h2>Create your Indie Cut account</h2><p>You can keep listening without an account. To join <strong>{roomTitle}</strong>, enter your name and email.</p><label>Name<input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoComplete="name"/></label><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"/></label>{error&&<div className={styles.joinError}>{error}</div>}<button className={styles.createJoin} disabled={saving}>{saving?'Joining…':'Create account & join'}</button><small>No password needed. We’ll email you a sign-in link.</small></form></div>}

function PromoDetail({promo,own,remaining,close,update}:{promo:Promo;own:boolean;remaining?:number;close:()=>void;update?:(p:Promo)=>Promise<void>}){
  const audio=useRef<HTMLAudioElement|null>(null);
  const[playing,setPlaying]=useState(false);
  const[editing,setEditing]=useState(false);
  const[name,setName]=useState(promo.name);
  const[message,setMessage]=useState(promo.message);
  const[link,setLink]=useState(promo.link);
  const[saving,setSaving]=useState(false);
  const[editError,setEditError]=useState('');
  function play(){const a=audio.current;if(!a)return;a.currentTime=0;a.play();setPlaying(true);window.setTimeout(()=>{a.pause();a.currentTime=0;setPlaying(false)},promo.previewSeconds*1000)}
  async function saveEdit(){if(!update)return;if(!name.trim()||!link.trim()){setEditError('Add a name and destination link.');return}setSaving(true);setEditError('');try{await update({...promo,name:name.trim(),message:message.trim(),link:link.trim()});setEditing(false)}catch(e:any){setEditError(e?.message||'Promotion could not be updated.')}finally{setSaving(false)}}
  const cta=promo.mediaType==='music'?'Listen to Full Song':promo.mediaType==='movie'?'View Movie / Film':'View Promotion';
  return <div className={styles.modalShade} onClick={close}><section className={styles.promoDetail} onClick={e=>e.stopPropagation()}><button className={styles.closeModal} onClick={close}>×</button>{promo.mediaType==='movie'&&promo.mediaUrl?<video src={promo.mediaUrl} poster={promo.image||undefined} controls playsInline style={{width:'100%',maxHeight:360,borderRadius:16,background:'#000',marginBottom:14}}/>:promo.image&&<img className={styles.promoHeroImage} src={promo.image} alt={promo.name}/>}<small>SPONSORED IN THE CUT</small>{own&&typeof remaining==='number'&&<div style={{margin:'10px 0 4px',display:'inline-flex',gap:8,alignItems:'center',background:'#181225',border:'1px solid #6848ff',borderRadius:999,padding:'7px 11px',fontWeight:900,fontVariantNumeric:'tabular-nums'}}>⏱ {formatRemaining(remaining)} remaining</div>}{editing?<div style={{display:'grid',gap:10,margin:'14px 0'}}><label>Name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Promo message<input value={message} maxLength={100} onChange={e=>setMessage(e.target.value)}/></label><label>Destination link<input value={link} onChange={e=>setLink(e.target.value)} placeholder="https://…"/></label>{editError&&<div className={styles.joinError}>{editError}</div>}<div style={{display:'flex',gap:8}}><button className={styles.previewPlay} onClick={saveEdit} disabled={saving}>{saving?'Saving…':'Save Changes'}</button><button className={styles.previewPlay} onClick={()=>{setEditing(false);setName(promo.name);setMessage(promo.message);setLink(promo.link);setEditError('')}} disabled={saving}>Cancel</button></div></div>:<><h2>{promo.name}</h2><p>{promo.message}</p>{own&&update&&<button className={styles.previewPlay} onClick={()=>setEditing(true)}>✎ Edit Promotion</button>}</>}{promo.mediaType==='music'&&promo.mediaUrl&&<><audio ref={audio} src={promo.mediaUrl}/><button className={styles.previewPlay} onClick={play}>{playing?'Playing preview…':`▶ Play ${promo.previewSeconds}-second preview`}</button></>}<a className={styles.promoCta} href={promo.link} target="_blank" rel="noreferrer">{cta}　→</a><p className={styles.promoExpires}>{own?'Your promotion stays active across The Cut rooms until your private countdown reaches zero.':'Sponsored promotion in The Cut.'}</p></section></div>;
}
function PromoModal({clientId,close,activate}:{clientId:string;close:()=>void;activate:(p:Promo)=>Promise<void>}){
  const[name,setName]=useState('');
  const[message,setMessage]=useState('');
  const[link,setLink]=useState('https://');
  const[minutes,setMinutes]=useState(10);
  const[imageFile,setImageFile]=useState<File|null>(null);
  const[imagePreview,setImagePreview]=useState('');
  const[mediaFile,setMediaFile]=useState<File|null>(null);
  const[mediaPreview,setMediaPreview]=useState('');
  const[mediaType,setMediaType]=useState<PromoType>('brand');
  const[submitting,setSubmitting]=useState(false);
  const[error,setError]=useState('');
  const prices:Record<number,number>={10:5,30:12,60:20};
  const previewSeconds=10;

  useEffect(()=>()=>{if(imagePreview)URL.revokeObjectURL(imagePreview);if(mediaPreview)URL.revokeObjectURL(mediaPreview)},[imagePreview,mediaPreview]);

  function chooseType(type:PromoType){setMediaType(type);setMediaFile(null);if(mediaPreview)URL.revokeObjectURL(mediaPreview);setMediaPreview('');setError('')}
  function chooseImage(file?:File){
    if(!file)return;
    if(file.size>5*1024*1024){setError('Promo images must be 5MB or smaller.');return}
    if(!file.type.startsWith('image/')){setError('Choose a JPG, PNG or WEBP image.');return}
    if(imagePreview)URL.revokeObjectURL(imagePreview);
    setImageFile(file);setImagePreview(URL.createObjectURL(file));setError('');
  }
  function chooseMedia(file?:File){
    if(!file)return;
    const lower=file.name.toLowerCase();
    if(mediaType==='music'){
      if(!(lower.endsWith('.mp3')||file.type==='audio/mpeg'||file.type==='audio/mp3')){setError('Choose an MP3 audio file.');return}
      if(file.size>30*1024*1024){setError('MP3 files must be 30MB or smaller.');return}
    }
    if(mediaType==='movie'){
      if(!(lower.endsWith('.mp4')||file.type==='video/mp4')){setError('Choose an MP4 video file.');return}
      if(file.size>100*1024*1024){setError('MP4 files must be 100MB or smaller.');return}
    }
    if(mediaPreview)URL.revokeObjectURL(mediaPreview);
    setMediaFile(file);setMediaPreview(URL.createObjectURL(file));setError('');
  }
  async function upload(file:File,purpose:'image'|'media'){
    const supabase=createClient();
    const ext=(file.name.split('.').pop()|| (purpose==='image'?'jpg':mediaType==='music'?'mp3':'mp4')).toLowerCase().replace(/[^a-z0-9]/g,'');
    const contentType=purpose==='image'?(file.type||'image/jpeg'):mediaType==='music'?'audio/mpeg':'video/mp4';
    const path=`${clientId||getClientId()}/${Date.now()}-${crypto.randomUUID()}-${purpose}.${ext}`;
    const{error:up}=await supabase.storage.from('cut-promos').upload(path,file,{upsert:false,contentType});
    if(up)throw up;
    const{data}=supabase.storage.from('cut-promos').getPublicUrl(path);
    return data.publicUrl;
  }
  async function submit(){
    if(!name.trim()||!imageFile||!link.trim()){setError('Add an image, name and destination link first.');return}
    if(mediaType==='music'&&!mediaFile){setError('Upload an MP3 before continuing.');return}
    if(mediaType==='movie'&&!mediaFile){setError('Upload an MP4 trailer before continuing.');return}
    setSubmitting(true);setError('');
    try{
      const image=await upload(imageFile,'image');
      const mediaUrl=mediaFile?await upload(mediaFile,'media'):undefined;
      await activate({name:name.trim(),message:message.trim(),link:link.trim(),minutes,image,mediaType,mediaUrl,previewSeconds,startsAt:Date.now(),endsAt:Date.now()+minutes*60*1000});
    }catch(err:any){setError(err?.message||'Promotion could not be activated.');setSubmitting(false)}
  }

  const stepLink=mediaType==='brand'?'4':'5';
  const stepLength=mediaType==='brand'?'5':'6';
  return <div className={styles.modalShade} onClick={close}><section className={styles.promoModal} onClick={e=>e.stopPropagation()}><button className={styles.closeModal} onClick={close}>×</button><div className={styles.promoKicker}>📣　PROMOTE • TEST MODE</div><h2>Get Your Brand <span style={{color:'#785cff'}}>In This Room</span></h2><p className={styles.promoIntro}>Test mode simulates a successful payment. Your promo follows you across The Cut rooms. The countdown is private to you.</p><div className={styles.promoType}><button className={mediaType==='brand'?styles.typeActive:''} onClick={()=>chooseType('brand')}>Brand / Merch</button><button className={mediaType==='music'?styles.typeActive:''} onClick={()=>chooseType('music')}>Music</button><button className={mediaType==='movie'?styles.typeActive:''} onClick={()=>chooseType('movie')}>Movie</button></div><div className={styles.promoTop}><label className={styles.uploadBox}><b>1. Add Your Promo Image</b><span className={styles.uploadArea}>{imagePreview?<img src={imagePreview} alt="Preview"/>:<><strong>＋</strong><em>Upload Photo</em><small>JPG, PNG, WEBP (Max 5MB)</small></>}</span><input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={e=>chooseImage(e.target.files?.[0])}/></label><div className={styles.avatarPreview}><b>Preview <span>(How it will look in the room)</span></b><div className={styles.previewRow}><div className={styles.previewAvatar}>{imagePreview?<img src={imagePreview} alt=""/>:<span>+</span>}<i>PROMOTED</i></div><div><strong>{name||'Your Brand Name'}</strong><p>{message||'Your promo message will appear here'}</p></div></div></div></div><label>2. Brand, Artist or Movie Name<input value={name} placeholder="Enter the name" onChange={e=>setName(e.target.value)}/></label><label>3. Your Promo Message (Optional)<input maxLength={100} value={message} placeholder="Tell listeners what you're promoting" onChange={e=>setMessage(e.target.value)}/></label>{mediaType==='music'&&<label>4. Upload MP3<input type="file" accept="audio/mpeg,audio/mp3,.mp3" onChange={e=>chooseMedia(e.target.files?.[0])}/>{mediaPreview&&<audio src={mediaPreview} controls style={{width:'100%',marginTop:10}}/>}<small className={styles.fieldHint}>MP3 up to 30MB. Listeners hear a {previewSeconds}-second preview in The Cut.</small></label>}{mediaType==='movie'&&<label>4. Upload Movie Trailer (MP4)<input type="file" accept="video/mp4,.mp4" onChange={e=>chooseMedia(e.target.files?.[0])}/>{mediaPreview&&<video src={mediaPreview} controls playsInline style={{width:'100%',maxHeight:280,borderRadius:12,background:'#000',marginTop:10}}/>}<small className={styles.fieldHint}>MP4 up to 100MB. The trailer will play inside the promotion.</small></label>}<label>{stepLink}. Link (Website, Store, Spotify, Movie Page, etc.)<input value={link} onChange={e=>setLink(e.target.value)}/></label><b className={styles.lengthTitle}>{stepLength}. Choose Promotion Length</b><div className={styles.durationGrid}>{[10,30,60].map(m=><button key={m} className={minutes===m?styles.durationActive:styles.duration} onClick={()=>setMinutes(m)}><span>{minutes===m?'●':'○'}　{m} Minutes</span><strong>${prices[m].toFixed(2)}</strong><small>{m===10?'Great for a quick shoutout':m===30?'More time. More exposure.':'Maximum visibility'}</small></button>)}</div>{error&&<div className={styles.joinError} style={{marginTop:12}}>{error}</div>}<button className={styles.testPay} onClick={submit} disabled={submitting}>{submitting?'Uploading & activating…':'Continue to Payment　→'}</button><p className={styles.testNote}>TEST MODE • Continue simulates successful payment and starts your private live timer</p></section></div>;
}
