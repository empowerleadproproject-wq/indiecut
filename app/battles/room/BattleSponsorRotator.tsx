'use client';

import {useEffect,useMemo,useState} from 'react';
import styles from './room-sponsors.module.css';

export default function BattleSponsorRotator({sponsors=[]}:{sponsors?:any[]}){
 const initial=useMemo(()=>(sponsors||[]).filter((x:any)=>x&&x.image_url&&x.active!==false),[sponsors]);
 const [active,setActive]=useState<any[]>(initial);
 const [index,setIndex]=useState(0);

 useEffect(()=>{
  setActive(initial);
  setIndex(0);
  let cancelled=false;
  fetch('/api/battle-room-sponsors',{cache:'no-store'})
   .then(r=>r.json())
   .then(j=>{if(!cancelled&&Array.isArray(j?.sponsors)&&j.sponsors.length){setActive(j.sponsors);setIndex(0)}})
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

 return <section className={styles.wrap} aria-label="Battle Room sponsor">
  <div className={styles.topline}><span className={styles.label}>ADVERTISEMENT</span></div>
  <a className={styles.ad} href={sponsor.destination_url||'#'} target="_blank" rel="noopener noreferrer sponsored" aria-label={sponsor.name?`Visit ${sponsor.name}`:'Visit sponsor'}>
   <img src={sponsor.image_url} alt={sponsor.name||'Battle Room sponsor'}/>
  </a>
 </section>;
}
