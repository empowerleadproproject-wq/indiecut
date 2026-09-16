'use client';

import {useEffect,useMemo,useRef,useState} from 'react';

type Ad={_id:string;advertiser:string;title:string;creative_url:string;creative_media_type:string;destination_url:string};
type BreakMode='none'|'interval'|'custom';
function parseTimestamp(v:string){const parts=v.trim().split(':').map(Number);if(parts.some(n=>!Number.isFinite(n)))return null;if(parts.length===2)return parts[0]*60+parts[1];if(parts.length===3)return parts[0]*3600+parts[1]*60+parts[2];return null}

export default function AdSupportedVideo({src,poster,breakMode='interval',intervalMinutes=6,customBreaks=''}:{src:string;poster?:string;breakMode?:BreakMode;intervalMinutes?:number;customBreaks?:string}){
 const playerRef=useRef<HTMLDivElement>(null);const contentRef=useRef<HTMLVideoElement>(null);const adRef=useRef<HTMLVideoElement>(null);const resumeAtRef=useRef(0);const playedRef=useRef<Set<string>>(new Set());const activeRef=useRef(false);
 const [ads,setAds]=useState<Ad[]>([]);const [activeAd,setActiveAd]=useState<Ad|null>(null);const [adIndex,setAdIndex]=useState(0);const [countdown,setCountdown]=useState(0);const [fullscreen,setFullscreen]=useState(false);
 const interval=Math.max(1,Number(intervalMinutes)||6)*60;
 const customTimes=useMemo(()=>customBreaks.split(',').map(parseTimestamp).filter((n):n is number=>n!==null&&n>0).sort((a,b)=>a-b),[customBreaks]);
 useEffect(()=>{fetch('/api/public/ads?placement=video-midroll',{cache:'no-store'}).then(r=>r.json()).then(j=>setAds((j.ads||[]).filter((a:Ad)=>a.creative_url&&String(a.creative_media_type||'').startsWith('video/')))).catch(()=>setAds([]))},[]);
 useEffect(()=>{const onFs=()=>setFullscreen(document.fullscreenElement===playerRef.current);document.addEventListener('fullscreenchange',onFs);return()=>document.removeEventListener('fullscreenchange',onFs)},[]);

 async function resumeProgram(){const program=contentRef.current;activeRef.current=false;setActiveAd(null);setCountdown(0);if(!program)return;try{program.currentTime=resumeAtRef.current}catch{}try{await program.play()}catch{}}
 async function playAd(key:string){if(activeRef.current||playedRef.current.has(key)||!ads.length)return;const program=contentRef.current;if(!program)return;const ad=ads[adIndex%ads.length];if(!ad)return;playedRef.current.add(key);activeRef.current=true;resumeAtRef.current=program.currentTime;program.pause();setActiveAd(ad);setAdIndex(i=>i+1);setCountdown(0)}
 useEffect(()=>{if(!activeAd)return;const adVideo=adRef.current;if(!adVideo)return;const start=()=>{try{adVideo.currentTime=0}catch{};adVideo.play().catch(()=>void resumeProgram())};if(adVideo.readyState>=2)start();else adVideo.addEventListener('canplay',start,{once:true});return()=>adVideo.removeEventListener('canplay',start)},[activeAd]);
 function checkBreak(){const program=contentRef.current;if(!program||activeRef.current||!ads.length||breakMode==='none')return;const t=program.currentTime;if(breakMode==='interval'){const breakNo=Math.floor(t/interval);if(breakNo>=1){const key=`i:${breakNo}`;if(!playedRef.current.has(key))void playAd(key)}return}for(const at of customTimes){const key=`c:${at}`;if(t>=at&&!playedRef.current.has(key)){void playAd(key);break}}}
 function adTime(){const a=adRef.current;if(a&&Number.isFinite(a.duration))setCountdown(Math.max(0,Math.ceil(a.duration-a.currentTime)))}
 async function toggleFullscreen(){const player=playerRef.current;if(!player)return;try{if(document.fullscreenElement)await document.exitFullscreen();else await player.requestFullscreen()}catch{}}
 const scheduleLabel=breakMode==='none'?'NO ADS':breakMode==='custom'?'CUSTOM AD BREAKS':`ADS EVERY ${Math.max(1,Number(intervalMinutes)||6)} MIN`;
 return <div ref={playerRef} style={{position:'relative',width:'100%',height:fullscreen?'100vh':'auto',background:'#000',overflow:'hidden',display:'grid',placeItems:'center'}}>
  <video ref={contentRef} src={src} poster={poster} controls={!activeAd} controlsList="nofullscreen" disablePictureInPicture playsInline preload="metadata" onTimeUpdate={checkBreak} onSeeked={checkBreak} style={{width:'100%',height:fullscreen?'100%':'auto',aspectRatio:fullscreen?undefined:'16/9',maxHeight:fullscreen?'100vh':720,background:'#000',objectFit:'contain',display:'block'}}/>
  {!activeAd&&<button type="button" onClick={toggleFullscreen} aria-label={fullscreen?'Exit Indie Cut fullscreen':'Indie Cut fullscreen'} title={fullscreen?'Exit fullscreen':'Fullscreen'} style={{position:'absolute',right:12,bottom:fullscreen?18:48,zIndex:50,width:42,height:38,border:'1px solid rgba(255,255,255,.35)',borderRadius:4,background:'rgba(0,0,0,.78)',color:'#fff',fontSize:22,cursor:'pointer',display:'grid',placeItems:'center'}}>{fullscreen?'↙':'⛶'}</button>}
  {activeAd&&<div style={{position:'absolute',inset:0,zIndex:60,background:'#000',display:'grid',placeItems:'center'}}>
   <video ref={adRef} key={activeAd._id} src={activeAd.creative_url} preload="auto" autoPlay playsInline onTimeUpdate={adTime} onEnded={()=>void resumeProgram()} onError={()=>void resumeProgram()} controls={false} style={{width:'100%',height:'100%',objectFit:'contain',background:'#000'}}/>
   <div style={{position:'absolute',left:14,top:12,padding:'6px 9px',background:'rgba(0,0,0,.72)',color:'#fff',fontSize:12,fontWeight:800,letterSpacing:'.06em'}}>ADVERTISEMENT{countdown>0?` · ${countdown}s`:''}</div>
   {activeAd.destination_url&&<a href={activeAd.destination_url} target="_blank" rel="noreferrer" style={{position:'absolute',right:14,bottom:14,padding:'9px 13px',background:'#fff',color:'#111',fontSize:12,fontWeight:900,textDecoration:'none'}}>LEARN MORE</a>}
  </div>}
  {breakMode!=='none'&&ads.length>0&&!activeAd&&<div style={{position:'absolute',right:58,top:10,padding:'5px 8px',background:'rgba(0,0,0,.6)',color:'#fff',fontSize:10,fontWeight:800,zIndex:45}}>{scheduleLabel}</div>}
 </div>
}
