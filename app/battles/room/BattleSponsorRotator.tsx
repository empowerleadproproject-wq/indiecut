'use client';

import {useEffect,useState} from 'react';
import styles from './room-sponsors.module.css';

export default function BattleSponsorRotator({sponsors=[]}:{sponsors?:any[]}){
 const active=(sponsors||[]).filter((x:any)=>x&&x.image_url&&x.active!==false);
 const [index,setIndex]=useState(0);
 useEffect(()=>{setIndex(0)},[active.length]);
 useEffect(()=>{if(active.length<2)return;const id=setInterval(()=>setIndex(i=>(i+1)%active.length),15000);return()=>clearInterval(id)},[active.length]);
 if(!active.length)return <section className={styles.wrap}><div className={styles.label}>ADVERTISEMENT</div><div className={styles.placeholder}><strong>SPONSOR PLACEMENT</strong><span>Battle Room sponsor creative will rotate here.</span></div></section>;
 const sponsor=active[index%active.length];
 return <section className={styles.wrap} aria-label="Battle Room sponsor">
  <div className={styles.topline}><span className={styles.label}>ADVERTISEMENT</span><span className={styles.counter}>{active.length>1?`${index+1} / ${active.length}`:'SPONSOR'}</span></div>
  <a className={styles.ad} href={sponsor.destination_url||'#'} target="_blank" rel="noopener noreferrer sponsored" aria-label={sponsor.name?`Visit ${sponsor.name}`:'Visit sponsor'}>
   <img src={sponsor.image_url} alt={sponsor.name||'Battle Room sponsor'}/>
  </a>
 </section>;
}
