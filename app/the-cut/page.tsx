'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import PublicHeader from '../PublicHeader';
import styles from './thecut.module.css';

type Person={id:string;name:string;avatar:string;role:'host'|'speaker'|'listener';muted?:boolean};
const initial:Person[]=[
 {id:'host',name:'Indie Cut',avatar:'IC',role:'host'},
 {id:'m1',name:'Maya',avatar:'M',role:'speaker'},
 {id:'d1',name:'Dre',avatar:'D',role:'speaker',muted:true},
 {id:'j1',name:'Jordan',avatar:'J',role:'listener'},
 {id:'a1',name:'Alex',avatar:'A',role:'listener'},
 {id:'t1',name:'Taylor',avatar:'T',role:'listener'}
];

export default function TheCutPage(){
 const [joined,setJoined]=useState(false); const [speaking,setSpeaking]=useState(false); const [muted,setMuted]=useState(true);
 const [raised,setRaised]=useState(false); const [people,setPeople]=useState(initial); const [title,setTitle]=useState('The Cut: What independent creators need right now');
 const [copied,setCopied]=useState(false); const stream=useRef<MediaStream|null>(null);
 const listenerCount=useMemo(()=>people.filter(p=>p.role==='listener').length+(joined&&!speaking?1:0),[people,joined,speaking]);
 useEffect(()=>()=>stream.current?.getTracks().forEach(t=>t.stop()),[]);
 async function enableMic(){
   try{ if(!stream.current) stream.current=await navigator.mediaDevices.getUserMedia({audio:true}); setSpeaking(true); setMuted(false); setRaised(false); }
   catch{ alert('Microphone permission is required to speak. You can still listen.'); }
 }
 function leave(){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setJoined(false);setSpeaking(false);setMuted(true);setRaised(false)}
 async function share(){await navigator.clipboard?.writeText(location.href);setCopied(true);setTimeout(()=>setCopied(false),1500)}
 return <><PublicHeader/><main className={styles.page}>
  <section className={styles.hero}><div><span className={styles.live}><i/> LIVE AUDIO</span><h1>THE CUT</h1><p>Real conversations. Independent voices. Join live, listen in, or take the mic.</p></div><button className={styles.share} onClick={share}>{copied?'LINK COPIED':'SHARE ROOM'}</button></section>
  <section className={styles.room}>
   <div className={styles.roomTop}><div><span className={styles.pill}>LIVE NOW</span><h2>{title}</h2><p>Hosted by Indie Cut · {listenerCount+people.filter(p=>p.role!=='listener').length} in the room</p></div><div className={styles.signal}><b>LIVE</b><span/><span/><span/><span/></div></div>
   <h3>On stage</h3><div className={styles.grid}>{people.filter(p=>p.role!=='listener').map(p=><PersonCard key={p.id} p={p}/>)}{joined&&speaking&&<PersonCard p={{id:'you',name:'You',avatar:'YOU',role:'speaker',muted}}/>}</div>
   <div className={styles.divider}/><div className={styles.sectionHead}><h3>Listening</h3><span>{listenerCount} listeners</span></div><div className={styles.gridSmall}>{people.filter(p=>p.role==='listener').map(p=><PersonCard key={p.id} p={p}/>)}{joined&&!speaking&&<PersonCard p={{id:'you',name:'You',avatar:'YOU',role:'listener'}}/>}</div>
   {!joined?<div className={styles.join}><button onClick={()=>setJoined(true)}>JOIN ROOM</button><p>You’ll enter as a listener. No microphone required.</p></div>:<div className={styles.controls}>
     {speaking?<button className={muted?styles.control:styles.controlOn} onClick={()=>setMuted(v=>!v)}>{muted?'🎙 UNMUTE':'🎙 MUTE'}</button>:<button className={raised?styles.controlOn:styles.control} onClick={()=>setRaised(v=>!v)}>✋ {raised?'HAND RAISED':'REQUEST TO SPEAK'}</button>}
     {!speaking&&raised&&<button className={styles.control} onClick={enableMic}>HOST DEMO: ACCEPT MIC</button>}<button className={styles.leave} onClick={leave}>LEAVE</button>
   </div>}
  </section>
  <section className={styles.info}><div><b>OPEN LISTENING</b><p>Share this room link anywhere. Visitors can see who is speaking and join the audience.</p></div><div><b>SPEAKER REQUESTS</b><p>Listeners raise a hand before getting microphone access, keeping the room controlled.</p></div><div><b>CREATOR PROFILES</b><p>Room identities are designed to connect to Indie Cut member profiles and avatars.</p></div></section>
 </main></>;
}
function PersonCard({p}:{p:Person}){return <div className={styles.person}><div className={`${styles.avatar} ${p.role==='host'?styles.host:''}`}>{p.avatar}<span className={p.muted?styles.muted:styles.mic}>{p.muted?'×':'•'}</span></div><strong>{p.name}</strong><small>{p.role==='host'?'HOST':p.role==='speaker'?'SPEAKER':'LISTENER'}</small></div>}
