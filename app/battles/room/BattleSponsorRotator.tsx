'use client';

import {useEffect,useMemo,useState} from 'react';
import styles from './room-sponsors.module.css';

function isVideo(sponsor:any){return String(sponsor?.creative_media_type||'').startsWith('video/')||/\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(sponsor?.image_url||''))}

export default function BattleSponsorRotator({sponsors=[]}:{sponsors?:any[]}){
 const initial=useMemo(()=>(sponsors||[]).filter((x:any)=>x&&x.image_url&&x.active!==false&&x.target_mode!=='local'),[sponsors]);
 const [active,setActive]=useState<any[]>(initial);
 const [index,setIndex]=useState(0);

 useEffect(()=>{
  setActive(initial);
  setIndex(0);
  let cancelled=false;
  fetch(`/api/battle-room-sponsors?t=${Date.now()}`,{cache:'no-store'})
   .then(r=>r.json())
   .then(j=>{if(!cancelled&&Array.isArray(j?.sponsors)){setActive(j.sponsors);setIndex(0)}})
   .catch(()=>{});
  return()=>{cancelled=true};
 },[initial]);

 useEffect(()=>{
  if(active.length<2)return;
  const id=setInterval(()=>setIndex(i=>(i+1)%active.length),15000);
  return()=>clearInterval(id);
 },[active.length]);

 if(!active.length)return null;
 const sponsor=active[index%active.length];
 const media=isVideo(sponsor)?<video src={sponsor.image_url} autoPlay muted loop playsInline style={{display:'block',width:'100%',height:'100%',objectFit:'contain'}}/>:<img src={sponsor.image_url} alt={sponsor.name||'Battle Room sponsor'}/>;

 return <section className={styles.wrap} aria-label="Battle Room sponsor">
  <div className={styles.topline}><span className={styles.label}>ADVERTISEMENT</span></div>
  {sponsor.destination_url?<a className={styles.ad} href={sponsor.destination_url} target="_blank" rel="noopener noreferrer sponsored" aria-label={sponsor.name?`Visit ${sponsor.name}`:'Visit sponsor'}>{media}</a>:<div className={styles.ad}>{media}</div>}
 </section>;
}
