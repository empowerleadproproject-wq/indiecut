'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import PublicHeader from '../PublicHeader';
import styles from './thecut.module.css';

type Person={id:string;name:string;avatar:string;role:'host'|'speaker'|'listener';muted?:boolean;verified?:boolean};
const initial:Person[]=[{id:'host',name:'Indie Cut',avatar:'IC',role:'host',verified:true},{id:'m1',name:'Maya',avatar:'M',role:'speaker'},{id:'d1',name:'Dre',avatar:'D',role:'speaker',muted:true},{id:'j1',name:'Jordan',avatar:'J',role:'listener'},{id:'a1',name:'Alex',avatar:'A',role:'listener'},{id:'t1',name:'Taylor',avatar:'T',role:'listener'}];
export default function TheCutPage(){
 const [joined,setJoined]=useState(false),[speaking,setSpeaking]=useState(false),[muted,setMuted]=useState(true),[raised,setRaised]=useState(false),[copied,setCopied]=useState(false);
 const stream=useRef<MediaStream|null>(null);const stage=initial.filter(p=>p.role!=='listener'),listeners=initial.filter(p=>p.role==='listener');
 const count=useMemo(()=>initial.length+(joined?1:0),[joined]);useEffect(()=>()=>stream.current?.getTracks().forEach(t=>t.stop()),[]);
 async function mic(){try{if(!stream.current)stream.current=await navigator.mediaDevices.getUserMedia({audio:true});setSpeaking(true);setMuted(false);setRaised(false)}catch{alert('Microphone permission is required to speak. You can still listen.')}}
 function leave(){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setJoined(false);setSpeaking(false);setMuted(true);setRaised(false)}
 async function share(){await navigator.clipboard?.writeText(location.href);setCopied(true);setTimeout(()=>setCopied(false),1400)}
 return <><PublicHeader/><main className={styles.shell}><div className={styles.topbar}><div><span className={styles.brand}>THE CUT</span><span className={styles.liveDot}>LIVE</span></div><button onClick={share}>{copied?'Copied':'Share ↗'}</button></div><section className={styles.room}>
  <header className={styles.roomHeader}><div><div className={styles.topic}>INDIE CUT · LIVE CONVERSATION</div><h1>What independent creators need right now</h1><p>Hosted by <b>Indie Cut</b> · {count} people</p></div><button className={styles.more}>•••</button></header>
  <div className={styles.stage}>{stage.map(p=><PersonCard key={p.id} p={p}/>)}{joined&&speaking&&<PersonCard p={{id:'you',name:'You',avatar:'YOU',role:'speaker',muted}}/>}</div>
  <div className={styles.audienceTitle}><span>Listeners</span><span>{listeners.length+(joined&&!speaking?1:0)}</span></div><div className={styles.audience}>{listeners.map(p=><PersonCard key={p.id} p={p}/>)}{joined&&!speaking&&<PersonCard p={{id:'you',name:'You',avatar:'YOU',role:'listener'}}/>}</div>
  <footer className={styles.dock}>{!joined?<><button className={styles.leaveQuiet} onClick={()=>setJoined(true)}>Join as listener</button><button className={styles.round} onClick={share}>↗</button></>:<><button className={styles.leaveQuiet} onClick={leave}>Leave quietly ✌</button><button className={`${styles.round} ${raised?styles.active:''}`} onClick={()=>setRaised(v=>!v)}>✋</button>{!speaking&&raised&&<button className={styles.round} onClick={mic}>🎙</button>}{speaking&&<button className={`${styles.round} ${!muted?styles.active:''}`} onClick={()=>setMuted(v=>!v)}>{muted?'🎙':'🔇'}</button>}<button className={styles.round} onClick={share}>↗</button></>}</footer>
 </section></main></>}
function PersonCard({p}:{p:Person}){return <div className={styles.person}><div className={`${styles.avatar} ${p.role==='host'?styles.host:''}`}>{p.avatar}{p.role!=='listener'&&<span className={p.muted?styles.muted:styles.mic}>{p.muted?'⌁':'🎙'}</span>}</div><strong>{p.role==='host'&&<span className={styles.badge}>★</span>}{p.name}</strong>{p.role!=='listener'&&<small>{p.role==='host'?'Host':'Speaker'}</small>}</div>}
