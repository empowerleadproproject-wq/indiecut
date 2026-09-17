'use client';

import {ChangeEvent,useEffect,useMemo,useRef,useState} from 'react';
import styles from './thecut.module.css';

type Person={id:string;name:string;avatar:string;role:'host'|'speaker'|'listener';muted?:boolean;raised?:boolean};
type Room={id:string;club:string;title:string;people:Person[];listening:number};
type PromoTier={id:string;price:number;minutes:number;roomHopping:boolean};
type PromoSettings={enabled:boolean;messageLimit:number;testMode:boolean;tiers:PromoTier[]};
type ActivePromo={id:string;image:string;message:string;link:string;price:number;minutes:number;roomHopping:boolean;originRoomId:string;startedAt:number;expiresAt:number};

const PROMO_SETTINGS_KEY='indiecut-the-cut-promo-settings';
const ACTIVE_PROMO_KEY='indiecut-the-cut-active-promo';
const DEFAULT_PROMO_SETTINGS:PromoSettings={
  enabled:true,
  messageLimit:36,
  testMode:true,
  tiers:[
    {id:'room-10',price:5,minutes:10,roomHopping:false},
    {id:'roam-20',price:10,minutes:20,roomHopping:true},
  ],
};

const faces=['CF','IL','RB','MS','DJ','AK','TM','JR','NW','LP','KM','SB'];
const names=['Cameron','Ivy','Reggie','Maya','Dre','Alex','Taylor','Jordan','Nia','Luis','Kira','Sam'];
const mk=(i:number,role:Person['role']='listener'):Person=>({id:`p${i}`,name:names[i%names.length],avatar:faces[i%faces.length],role,muted:role==='speaker'&&i%3===0});
const rooms:Room[]=[
  {id:'creators',club:'THE CUT • CREATORS',title:'What independent creators need right now',people:[mk(0,'host'),mk(1,'speaker'),mk(2,'speaker'),mk(3,'speaker'),mk(4),mk(5),mk(6)],listening:74},
  {id:'film',club:'INDIE FILM TALK',title:'Getting your film distributed without giving it away',people:[mk(7,'host'),mk(8,'speaker'),mk(9,'speaker'),mk(10),mk(11)],listening:38},
  {id:'music',club:'INDEPENDENT MUSIC',title:'Artists: how are you actually marketing your music?',people:[mk(3,'host'),mk(4,'speaker'),mk(5,'speaker'),mk(6,'speaker'),mk(1)],listening:52},
  {id:'late',club:'AFTER HOURS',title:'Late night industry talk — open mic',people:[mk(2,'host'),mk(9,'speaker'),mk(11,'speaker'),mk(8)],listening:21},
];

function readPromoSettings():PromoSettings{
  if(typeof window==='undefined')return DEFAULT_PROMO_SETTINGS;
  try{
    const saved=JSON.parse(localStorage.getItem(PROMO_SETTINGS_KEY)||'null');
    if(!saved)return DEFAULT_PROMO_SETTINGS;
    return {
      enabled:saved.enabled!==false,
      messageLimit:Number(saved.messageLimit)||DEFAULT_PROMO_SETTINGS.messageLimit,
      testMode:saved.testMode!==false,
      tiers:Array.isArray(saved.tiers)&&saved.tiers.length?saved.tiers:DEFAULT_PROMO_SETTINGS.tiers,
    };
  }catch{return DEFAULT_PROMO_SETTINGS;}
}

function readActivePromo():ActivePromo|null{
  if(typeof window==='undefined')return null;
  try{
    const promo=JSON.parse(localStorage.getItem(ACTIVE_PROMO_KEY)||'null') as ActivePromo|null;
    if(!promo||promo.expiresAt<=Date.now()){
      localStorage.removeItem(ACTIVE_PROMO_KEY);
      return null;
    }
    return promo;
  }catch{return null;}
}

function formatTime(totalSeconds:number){
  const seconds=Math.max(0,totalSeconds);
  const mins=Math.floor(seconds/60);
  const secs=seconds%60;
  return `${mins}:${String(secs).padStart(2,'0')}`;
}

export default function TheCutPage(){
  const [roomId,setRoomId]=useState<string|null>(null);
  useEffect(()=>{
    const q=new URLSearchParams(location.search).get('room');
    if(q)setRoomId(rooms.some(r=>r.id===q)?q:'creators');
  },[]);
  const room=rooms.find(r=>r.id===roomId);
  return room?<LiveRoom room={room} back={()=>{history.replaceState(null,'','/the-cut');setRoomId(null)}}/>:<Hallway enter={id=>{history.replaceState(null,'',`/the-cut?room=${id}`);setRoomId(id)}}/>;
}

function Hallway({enter}:{enter:(id:string)=>void}){
  return <main className={styles.hall}>
    <div className={styles.siteLink}><a href="/" className={styles.miniBrand}>INDIE<br/>CUT</a><a href="/">← Back to Main Site</a></div>
    <header className={styles.hallHead}><div><div className={styles.cutLogo}>THE CUT</div><p>Live conversations from Indie Cut.</p></div><div className={styles.hallActions}><button aria-label="Search">⌕</button><button aria-label="Notifications">♧<i/></button><span className={styles.me}>CF</span></div></header>
    <div className={styles.hallTabs}><b>HALLWAY</b><span>UPCOMING</span><span>MY ROOMS</span></div>
    <section className={styles.roomFeed}>{rooms.map(r=><article key={r.id} className={styles.roomCard}><div className={styles.cardMain}><small><i/> LIVE　•　{r.club}</small><h2>{r.title}</h2><div className={styles.preview}><div className={styles.faceStack}>{r.people.slice(0,4).map((p,i)=><span key={p.id} style={{zIndex:4-i}}>{p.avatar}</span>)}</div><div><strong>{r.people[0].name} ◌</strong><p>{r.people.slice(1,4).map(p=>p.name).join('　')}　+1 more</p><p>{r.listening} listening　•　{r.people.filter(p=>p.role!=='listener').length} speakers</p></div></div></div><div className={styles.cardActions}><button className={styles.joinCard} onClick={()=>enter(r.id)}>▥　Join Room</button><button className={styles.dots}>•••</button></div></article>)}</section>
    <button className={styles.startRoom}>＋　Start a room</button>
  </main>;
}

function LiveRoom({room,back}:{room:Room;back:()=>void}){
  const [joined,setJoined]=useState(false);
  const [speaking,setSpeaking]=useState(false);
  const [muted,setMuted]=useState(true);
  const [raised,setRaised]=useState(false);
  const [copied,setCopied]=useState(false);
  const [promoOpen,setPromoOpen]=useState(false);
  const [promoSettings,setPromoSettings]=useState<PromoSettings>(DEFAULT_PROMO_SETTINGS);
  const [activePromo,setActivePromo]=useState<ActivePromo|null>(null);
  const [remaining,setRemaining]=useState(0);
  const stream=useRef<MediaStream|null>(null);

  useEffect(()=>{
    setPromoSettings(readPromoSettings());
    setActivePromo(readActivePromo());
    const sync=()=>{setPromoSettings(readPromoSettings());setActivePromo(readActivePromo())};
    window.addEventListener('storage',sync);
    return ()=>{window.removeEventListener('storage',sync);stream.current?.getTracks().forEach(t=>t.stop())};
  },[]);

  useEffect(()=>{
    if(!activePromo){setRemaining(0);return;}
    const tick=()=>{
      const left=Math.max(0,Math.ceil((activePromo.expiresAt-Date.now())/1000));
      setRemaining(left);
      if(left===0){
        localStorage.removeItem(ACTIVE_PROMO_KEY);
        setActivePromo(null);
      }
    };
    tick();
    const timer=window.setInterval(tick,1000);
    return ()=>window.clearInterval(timer);
  },[activePromo]);

  async function mic(){
    try{
      if(!stream.current)stream.current=await navigator.mediaDevices.getUserMedia({audio:true});
      setSpeaking(true);setMuted(false);setRaised(false);
    }catch{alert('Microphone permission is required to speak.');}
  }
  function leave(){stream.current?.getTracks().forEach(t=>t.stop());back();}
  async function share(){await navigator.clipboard?.writeText(location.href);setCopied(true);setTimeout(()=>setCopied(false),1200);}
  function startPromotion(promo:ActivePromo){localStorage.setItem(ACTIVE_PROMO_KEY,JSON.stringify(promo));setActivePromo(promo);setPromoOpen(false);}
  function stopPromotion(){localStorage.removeItem(ACTIVE_PROMO_KEY);setActivePromo(null);}

  const people=useMemo(()=>joined?[...room.people,{id:'you',name:'You',avatar:'YOU',role:speaking?'speaker':'listener',muted} as Person]:room.people,[joined,speaking,muted,room]);
  const promoVisible=Boolean(activePromo&&(activePromo.roomHopping||activePromo.originRoomId===room.id));

  return <main className={styles.space}>
    <header className={styles.spaceTop}><button onClick={back}>⌄</button><div className={styles.topRight}><button onClick={share}>{copied?'✓':'↥'}</button><button>•••</button><button className={styles.leaveTop} onClick={leave}>Leave</button></div></header>
    <section className={styles.spaceInfo}><div><b>LIVE</b> · {room.listening+(joined?1:0)} listening</div><h1>{room.title}</h1><p>{room.club}</p></section>
    {joined&&activePromo&&<div className={styles.privateTimer}><span>YOUR PROMO</span><strong>{formatTime(remaining)}</strong><small>{activePromo.roomHopping?'Works across rooms':'This room only'}</small><button onClick={stopPromotion}>End promo</button></div>}
    <section className={styles.peopleGrid}>{people.map(p=><PersonCard key={p.id} p={p} promo={p.id==='you'&&promoVisible?activePromo:null} promotable={p.id==='you'&&promoSettings.enabled} onPromote={()=>setPromoOpen(true)}/>)}</section>
    <footer className={styles.spaceDock}>{!joined?<button className={styles.joinSpace} onClick={()=>setJoined(true)}>Join this Space</button>:<><button onClick={leave} className={styles.leaveQuiet}>Leave quietly</button>{!speaking&&<button className={raised?styles.activeRound:styles.round} onClick={()=>setRaised(v=>!v)}>✋</button>}{raised&&!speaking&&<button className={styles.round} onClick={mic}>🎙</button>}{speaking&&<button className={!muted?styles.activeRound:styles.round} onClick={()=>setMuted(v=>!v)}>{muted?'🎙':'🔇'}</button>}<button className={styles.round} onClick={share}>↥</button></>}</footer>
    {promoOpen&&<PromoModal room={room} settings={promoSettings} current={activePromo} close={()=>setPromoOpen(false)} start={startPromotion}/>} 
  </main>;
}

function PersonCard({p,promo,promotable,onPromote}:{p:Person;promo:ActivePromo|null;promotable:boolean;onPromote:()=>void}){
  const openPromoLink=(e:React.MouseEvent)=>{e.stopPropagation();if(promo?.link)window.open(promo.link,'_blank','noopener,noreferrer')};
  return <div className={`${styles.person} ${promotable?styles.promotable:''}`} onClick={promotable?onPromote:undefined} role={promotable?'button':undefined} tabIndex={promotable?0:undefined} onKeyDown={e=>{if(promotable&&(e.key==='Enter'||e.key===' '))onPromote()}}>
    {promo&&<button className={styles.promoBubble} onClick={openPromoLink} title={promo.link?'Open promotion':'Promotion'}>{promo.message}</button>}
    <div className={`${styles.avatar} ${p.role==='host'?styles.host:''} ${promo?styles.promoAvatar:''}`}>{promo?<img src={promo.image} alt="Promotion"/>:p.avatar}{p.raised&&<em>✋</em>}{promotable&&!promo&&<i className={styles.promoteDot}>＋</i>}</div>
    <strong>{p.name}</strong><span>{promo?'Promoting now':p.muted&&p.role!=='listener'?'🎙̸ ':p.role==='host'?'Host':p.role==='speaker'?'Speaker':'Listener'}</span>{promotable&&!promo&&<small className={styles.promoteHint}>Tap your photo to promote</small>}
  </div>;
}

function PromoModal({room,settings,current,close,start}:{room:Room;settings:PromoSettings;current:ActivePromo|null;close:()=>void;start:(promo:ActivePromo)=>void}){
  const [image,setImage]=useState(current?.image||'');
  const [message,setMessage]=useState(current?.message||'');
  const [link,setLink]=useState(current?.link||'');
  const [tierId,setTierId]=useState(settings.tiers[0]?.id||'');
  const [error,setError]=useState('');
  const tier=settings.tiers.find(t=>t.id===tierId)||settings.tiers[0];

  function filePicked(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];
    if(!file)return;
    if(!file.type.startsWith('image/')){setError('Please upload an image file.');return;}
    if(file.size>4*1024*1024){setError('Keep the image under 4 MB for this test.');return;}
    const reader=new FileReader();
    reader.onload=()=>{setImage(String(reader.result||''));setError('')};
    reader.onerror=()=>setError('That image could not be loaded.');
    reader.readAsDataURL(file);
  }

  function submit(){
    if(!settings.enabled){setError('Promotions are currently turned off by admin.');return;}
    if(!image){setError('Upload an album cover, product photo, food photo, or other promo image.');return;}
    if(!message.trim()){setError('Add a short promo message.');return;}
    if(!tier){setError('Choose a promotion option.');return;}
    if(link){
      try{new URL(link)}catch{setError('Enter a full link beginning with https://');return;}
    }
    if(!settings.testMode){setError('Live card checkout is not enabled in this test build yet. Turn on Test checkout in The Cut admin to test the full promo experience.');return;}
    const startedAt=Date.now();
    start({id:`promo-${startedAt}`,image,message:message.trim(),link:link.trim(),price:Number(tier.price),minutes:Number(tier.minutes),roomHopping:Boolean(tier.roomHopping),originRoomId:room.id,startedAt,expiresAt:startedAt+Number(tier.minutes)*60*1000});
  }

  return <div className={styles.modalBackdrop} onMouseDown={close}>
    <section className={styles.promoModal} onMouseDown={e=>e.stopPropagation()}>
      <div className={styles.modalHead}><div><small>PROMOTE YOURSELF IN THE CUT</small><h2>Put your promo on your circle</h2></div><button onClick={close}>×</button></div>
      <p className={styles.modalIntro}>Upload your album cover, merch, clothing, restaurant food, event flyer, or brand image. Your normal circle temporarily becomes the promotion.</p>
      <label className={styles.uploadBox}>{image?<img src={image} alt="Promo preview"/>:<span>＋<b>Upload promo image</b><small>Album cover, merch, food, clothing, flyer, etc.</small></span>}<input type="file" accept="image/*" onChange={filePicked}/></label>
      <label className={styles.fieldLabel}>Short message <span>{message.length}/{settings.messageLimit}</span></label>
      <input className={styles.promoInput} value={message} maxLength={settings.messageLimit} onChange={e=>setMessage(e.target.value)} placeholder="Check out my new single"/>
      <label className={styles.fieldLabel}>Link <small>optional</small></label>
      <input className={styles.promoInput} value={link} onChange={e=>setLink(e.target.value)} placeholder="https://your-link.com" inputMode="url"/>
      <div className={styles.tierGrid}>{settings.tiers.map(t=><button type="button" key={t.id} className={tierId===t.id?styles.tierActive:styles.tier} onClick={()=>setTierId(t.id)}><strong>${Number(t.price).toFixed(2)}</strong><span>{t.minutes} minutes</span><small>{t.roomHopping?'Move room to room':'This room only'}</small></button>)}</div>
      {tier&&!tier.roomHopping&&<div className={styles.roomRule}>${Number(tier.price).toFixed(2)} promotion stays in this room. Choose a room-hopping option if you want the promotion to follow you into another room.</div>}
      {tier?.roomHopping&&<div className={styles.roomRule}>This promotion follows you when you move to another room until your time expires.</div>}
      {settings.testMode&&<div className={styles.testBadge}>TEST CHECKOUT IS ON — no card will be charged while you test this feature.</div>}
      {error&&<div className={styles.promoError}>{error}</div>}
      <button className={styles.payButton} onClick={submit}>{settings.testMode?'Start test promotion':tier?`Pay $${Number(tier.price).toFixed(2)} & promote`:'Choose a plan'}</button>
    </section>
  </div>;
}
