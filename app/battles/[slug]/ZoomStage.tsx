'use client';

import { useEffect,useRef,useState } from 'react';
import styles from '../battles.module.css';

type Props={slug:string,artistA:any,artistB:any};

const videoLayer={width:'100%',height:'100%',position:'relative',zIndex:2} as const;
const placeholderLayer={zIndex:1} as const;

export default function ZoomStage({slug,artistA,artistB}:Props){
 const aRef=useRef<HTMLDivElement>(null);const djRef=useRef<HTMLDivElement>(null);const bRef=useRef<HTMLDivElement>(null);
 const clientRef=useRef<any>(null);const streamRef=useRef<any>(null);const qualityRef=useRef<any>(2);
 const [joined,setJoined]=useState(false);const [audioOn,setAudioOn]=useState(false);const [error,setError]=useState('');

 function slotFor(user:any){
  const name=String(user?.displayName||user?.userName||user?.name||'').toUpperCase();
  if(name.startsWith('[A]'))return aRef.current;
  if(name.startsWith('[B]'))return bRef.current;
  if(name.startsWith('[DJ]'))return djRef.current;
  return null;
 }
 async function attach(user:any){
  const stream=streamRef.current;const slot=slotFor(user);if(!stream||!slot||!user?.bVideoOn)return;
  try{
   const element=await stream.attachVideo(user.userId,qualityRef.current);
   slot.innerHTML='';
   const items=Array.isArray(element)?element:[element];items.forEach((node:any)=>slot.appendChild(node));
  }catch{}
 }
 async function detach(userId:number){try{await streamRef.current?.detachVideo(userId)}catch{}}
 async function join(){
  if(joined)return;
  setError('');
  try{
   const tokenRes=await fetch(`/api/battles/${slug}/zoom-token`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'viewer',userName:'Indie Cut Fan'})});
   const token=await tokenRes.json();if(!tokenRes.ok)throw new Error(token.error||'Live video unavailable');
   const sdk=await import('@zoom/videosdk');
   const ZoomVideo:any=sdk.default;qualityRef.current=(sdk as any).VideoQuality?.Video_360P??2;
   const client=ZoomVideo.createClient();clientRef.current=client;
   await client.init('en-US','Global',{patchJsMedia:true,leaveOnPageUnload:true});
   await client.join(token.sessionName,token.token,token.displayName,token.passcode||'');
   const stream=client.getMediaStream();streamRef.current=stream;setJoined(true);
   const refresh=()=>client.getAllUser().forEach((u:any)=>{if(u.bVideoOn)attach(u)});
   client.on('peer-video-state-change',async(payload:any)=>{const user=client.getAllUser().find((u:any)=>u.userId===payload.userId);if(payload.action==='Start'&&user)await attach(user);else if(payload.action==='Stop')await detach(payload.userId)});
   client.on('user-added',()=>setTimeout(refresh,150));
   client.on('user-removed',(payload:any)=>detach(payload.userId));
   refresh();
  }catch(e:any){setError(e.message||'Live video unavailable')}
 }
 async function enableAudio(){
  try{if(!streamRef.current)return;await streamRef.current.startAudio({speakerOnly:true});setAudioOn(true)}catch(e:any){setError(e.message||'Could not start live audio')}
 }
 useEffect(()=>()=>{try{clientRef.current?.leave()}catch{}},[]);
 return <>
  <div className={styles.stage}>
   <div className={styles.stageSlot}><div ref={aRef} style={videoLayer}/>{artistA?.image_url&&<img src={artistA.image_url} alt="" style={placeholderLayer}/>}<div className={styles.slotLabel}>ARTIST A · {artistA?.artist_name||'TBD'}</div></div>
   <div className={`${styles.stageSlot} ${styles.djSlot}`}><div ref={djRef} style={videoLayer}/><div className={styles.djMark} style={placeholderLayer}>INDIE CUT</div><div className={styles.slotLabel}>DJ / HOST</div></div>
   <div className={styles.stageSlot}><div ref={bRef} style={videoLayer}/>{artistB?.image_url&&<img src={artistB.image_url} alt="" style={placeholderLayer}/>}<div className={styles.slotLabel}>ARTIST B · {artistB?.artist_name||'TBD'}</div></div>
  </div>
  <div className={styles.liveBar}><strong><span className={styles.liveDot}/>Custom Indie Cut live stage</strong><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{!joined&&<button className={styles.enterButton} onClick={join}>JOIN LIVE VIDEO</button>}{joined&&!audioOn&&<button className={styles.shareButton} onClick={enableAudio}>HEAR HOST AUDIO</button>}{joined&&audioOn&&<span style={{color:'#9ad8a5',fontWeight:800}}>Host audio on</span>}</div>{error&&<span style={{color:'#ff8c98',fontSize:12}}>{error}</span>}</div>
 </>
}
