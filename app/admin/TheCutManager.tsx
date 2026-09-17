'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';

type Room={id:string;title:string;topic:string;status:'draft'|'live'|'ended';listeners:number;speakers:number;created:string};
type PromoTier={id:string;price:number;minutes:number;roomHopping:boolean};
type PromoSettings={enabled:boolean;messageLimit:number;testMode:boolean;tiers:PromoTier[]};

const PROMO_SETTINGS_KEY='indiecut-the-cut-promo-settings';
const DEFAULT_PROMO_SETTINGS:PromoSettings={
  enabled:true,
  messageLimit:36,
  testMode:true,
  tiers:[
    {id:'room-10',price:5,minutes:10,roomHopping:false},
    {id:'roam-20',price:10,minutes:20,roomHopping:true},
  ],
};

function loadPromoSettings():PromoSettings{
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

export default function TheCutManager(){
  const [title,setTitle]=useState('');
  const [topic,setTopic]=useState('');
  const [rooms,setRooms]=useState<Room[]>([]);
  const [copied,setCopied]=useState('');
  const [visible,setVisible]=useState(false);
  const [promoSettings,setPromoSettings]=useState<PromoSettings>(DEFAULT_PROMO_SETTINGS);
  const [promoReady,setPromoReady]=useState(false);

  useEffect(()=>{
    setVisible(localStorage.getItem('indiecut-the-cut-visible')==='true');
    setPromoSettings(loadPromoSettings());
    setPromoReady(true);
  },[]);

  useEffect(()=>{
    if(!promoReady)return;
    localStorage.setItem(PROMO_SETTINGS_KEY,JSON.stringify(promoSettings));
  },[promoSettings,promoReady]);

  const live=useMemo(()=>rooms.filter(r=>r.status==='live'),[rooms]);
  function visibility(v:boolean){setVisible(v);localStorage.setItem('indiecut-the-cut-visible',String(v));}
  function createRoom(goLive=false){
    if(!title.trim())return;
    const room:Room={id:`cut-${Date.now()}`,title:title.trim(),topic:topic.trim(),status:goLive?'live':'draft',listeners:0,speakers:1,created:new Date().toLocaleString()};
    setRooms(r=>[room,...r]);setTitle('');setTopic('');
  }
  function setStatus(id:string,status:Room['status']){setRooms(r=>r.map(x=>x.id===id?{...x,status}:x));}
  async function copy(id:string){await navigator.clipboard.writeText(`${window.location.origin}/the-cut?room=${id}`);setCopied(id);setTimeout(()=>setCopied(''),1500);}
  function updateTier(id:string,patch:Partial<PromoTier>){setPromoSettings(s=>({...s,tiers:s.tiers.map(t=>t.id===id?{...t,...patch}:t)}));}
  function addTier(){setPromoSettings(s=>({...s,tiers:[...s.tiers,{id:`tier-${Date.now()}`,price:15,minutes:30,roomHopping:true}]}));}
  function removeTier(id:string){setPromoSettings(s=>s.tiers.length<=1?s:{...s,tiers:s.tiers.filter(t=>t.id!==id)});}
  function resetPromoSettings(){setPromoSettings(DEFAULT_PROMO_SETTINGS);}

  return <section style={{display:'grid',gap:20}}>
    <div className="panel" style={{padding:24,display:'flex',justifyContent:'space-between',alignItems:'center',gap:20,flexWrap:'wrap'}}>
      <div><div className="kicker">PUBLIC VISIBILITY</div><h2 style={{margin:'6px 0'}}>The Cut is {visible?'visible':'hidden'}</h2><p style={{margin:0,maxWidth:650}}>Keep The Cut hidden while you build and test it. When you are ready, publish it from here.</p></div>
      <div style={{display:'flex',gap:8}}><button onClick={()=>visibility(false)} disabled={!visible}>HIDE THE CUT</button><button onClick={()=>visibility(true)} disabled={visible}>SHOW THE CUT</button></div>
    </div>

    <div className="panel" style={{padding:24}}>
      <div className="kicker">PAID PROFILE PROMOTIONS</div>
      <div style={{display:'flex',justifyContent:'space-between',gap:18,alignItems:'flex-start',flexWrap:'wrap'}}>
        <div style={{maxWidth:680}}><h2 style={{margin:'6px 0 8px'}}>Self-serve room promotions</h2><p style={{marginTop:0}}>Members who have joined a room can tap their own circle, upload an album cover, product, merch, restaurant, food, clothing or brand image, add a short message and link, then choose a timed promotion.</p></div>
        <button onClick={()=>setPromoSettings(s=>({...s,enabled:!s.enabled}))}>{promoSettings.enabled?'TURN PROMOTIONS OFF':'TURN PROMOTIONS ON'}</button>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14,marginTop:18}}>
        <label style={{display:'grid',gap:6,fontWeight:800}}>Message character limit<input type="number" min={12} max={80} value={promoSettings.messageLimit} onChange={e=>setPromoSettings(s=>({...s,messageLimit:Math.max(12,Math.min(80,Number(e.target.value)||12))}))}/></label>
        <label style={{display:'grid',gap:6,fontWeight:800}}>Test checkout
          <select value={promoSettings.testMode?'on':'off'} onChange={e=>setPromoSettings(s=>({...s,testMode:e.target.value==='on'}))}>
            <option value="on">ON — test without charging</option>
            <option value="off">OFF — live checkout</option>
          </select>
        </label>
      </div>

      <div style={{marginTop:20,display:'grid',gap:12}}>
        {promoSettings.tiers.map((tier,index)=><div key={tier.id} style={{display:'grid',gridTemplateColumns:'minmax(90px,.7fr) minmax(100px,.8fr) minmax(180px,1.4fr) auto',gap:10,alignItems:'end',padding:14,border:'1px solid #ddd',borderRadius:12}}>
          <label style={{display:'grid',gap:5,fontWeight:800}}>Price ($)<input type="number" min={1} step="0.01" value={tier.price} onChange={e=>updateTier(tier.id,{price:Math.max(1,Number(e.target.value)||1)})}/></label>
          <label style={{display:'grid',gap:5,fontWeight:800}}>Minutes<input type="number" min={1} step="1" value={tier.minutes} onChange={e=>updateTier(tier.id,{minutes:Math.max(1,Number(e.target.value)||1)})}/></label>
          <label style={{display:'grid',gap:5,fontWeight:800}}>Room access<select value={tier.roomHopping?'hop':'single'} onChange={e=>updateTier(tier.id,{roomHopping:e.target.value==='hop'})}><option value="single">This room only</option><option value="hop">Can move room to room</option></select></label>
          <button onClick={()=>removeTier(tier.id)} disabled={promoSettings.tiers.length<=1} aria-label={`Remove promotion option ${index+1}`}>REMOVE</button>
        </div>)}
      </div>

      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:14}}><button onClick={addTier}>＋ ADD PROMO OPTION</button><button onClick={resetPromoSettings}>RESET TO $5 / 10 MIN + $10 / 20 MIN</button><Link href="/the-cut?room=creators" target="_blank" style={{padding:'10px 14px',border:'1px solid #111',fontWeight:800,textDecoration:'none',color:'#111'}}>TEST IN A ROOM ↗</Link></div>
      <p style={{margin:'14px 0 0',fontSize:13,color:'#555'}}>{promoSettings.testMode?'Test checkout is ON. The promotion flow, timer, image swap, message bubble and room-hopping rules can be tested without charging a card.':'Test checkout is OFF. Live card checkout must be connected before public use.'}</p>
    </div>

    <div className="panel" style={{padding:24}}><div className="kicker">ROOM CREATOR</div><h2 style={{margin:'6px 0 8px'}}>Start a room</h2><p>Create a live social-audio conversation. Listeners enter quietly and can raise their hand to request the mic.</p><label>Room title</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Example: Filmmakers — what is working right now?"/><label>Topic / description</label><textarea rows={4} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Tell listeners what this room is about."/><div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:14}}><button disabled={!title.trim()} onClick={()=>createRoom(true)}>GO LIVE</button><button disabled={!title.trim()} onClick={()=>createRoom(false)}>SAVE DRAFT</button><Link href="/the-cut" target="_blank" style={{padding:'10px 14px',border:'1px solid #111',fontWeight:800,textDecoration:'none',color:'#111'}}>PREVIEW THE CUT ↗</Link></div></div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14}}><div className="panel"><div className="kicker">LIVE NOW</div><h2>{live.length}</h2><p>Active rooms</p></div><div className="panel"><div className="kicker">LISTENERS</div><h2>{live.reduce((n,r)=>n+r.listeners,0)}</h2><p>Across live rooms</p></div><div className="panel"><div className="kicker">ON STAGE</div><h2>{live.reduce((n,r)=>n+r.speakers,0)}</h2><p>Hosts and speakers</p></div></div>

    <div className="panel" style={{padding:24}}><div className="kicker">ROOM CONTROL</div><h2>Rooms</h2>{rooms.length===0?<p>No rooms yet. Create your first room above.</p>:rooms.map(r=><article key={r.id} style={{borderTop:'1px solid #ddd',padding:'18px 0'}}><strong>{r.title}</strong><p>{r.topic||'No description'} · {r.status}</p><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{r.status!=='live'&&<button onClick={()=>setStatus(r.id,'live')}>GO LIVE</button>}{r.status==='live'&&<button onClick={()=>setStatus(r.id,'ended')}>END ROOM</button>}<button onClick={()=>copy(r.id)}>{copied===r.id?'LINK COPIED':'COPY SHARE LINK'}</button><Link href={`/the-cut?room=${r.id}`} target="_blank">VIEW ROOM ↗</Link></div></article>)}</div>
  </section>;
}
