'use client';

import {useEffect,useMemo,useRef,useState} from 'react';

type Ad={_id:string;advertiser:string;title:string;creative_url:string;creative_media_type:string;destination_url:string;cta_text?:string};
type BreakMode='none'|'interval'|'custom';
type AdStatus='loading'|'playing'|'tap';

function parseTimestamp(v:string){
 const parts=v.trim().split(':').map(Number);
 if(parts.some(n=>!Number.isFinite(n)))return null;
 if(parts.length===2)return parts[0]*60+parts[1];
 if(parts.length===3)return parts[0]*3600+parts[1]*60+parts[2];
 return null;
}

export default function AdSupportedVideo({src,poster,breakMode='interval',intervalMinutes=6,customBreaks=''}:{src:string;poster?:string;breakMode?:BreakMode;intervalMinutes?:number;customBreaks?:string}){
 const playerRef=useRef<HTMLDivElement>(null);
 const contentRef=useRef<HTMLVideoElement>(null);
 const adRef=useRef<HTMLVideoElement>(null);
 const resumeAtRef=useRef(0);
 const playedRef=useRef<Set<string>>(new Set());
 const activeRef=useRef(false);
 const adsRef=useRef<Ad[]>([]);
 const adCursorRef=useRef(0);
 const breakKeyRef=useRef<string|null>(null);
 const attemptedAdsRef=useRef<Set<string>>(new Set());
 const adStartedRef=useRef(false);
 const startupTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
 const stallTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);

 const [ads,setAds]=useState<Ad[]>([]);
 const [activeAd,setActiveAd]=useState<Ad|null>(null);
 const [countdown,setCountdown]=useState(0);
 const [fullscreen,setFullscreen]=useState(false);
 const [adStatus,setAdStatus]=useState<AdStatus>('loading');

 const interval=Math.max(1,Number(intervalMinutes)||6)*60;
 const customTimes=useMemo(()=>customBreaks.split(',').map(parseTimestamp).filter((n):n is number=>n!==null&&n>0).sort((a,b)=>a-b),[customBreaks]);

 useEffect(()=>{
  let cancelled=false;
  fetch('/api/public/ads?placement=video-midroll',{cache:'no-store'})
   .then(r=>r.json())
   .then(j=>{
    if(cancelled)return;
    const rows=(Array.isArray(j?.ads)?j.ads:[]).filter((a:Ad)=>a?.creative_url&&String(a?.creative_media_type||'').startsWith('video/'));
    adsRef.current=rows;
    setAds(rows);
   })
   .catch(()=>{if(!cancelled){adsRef.current=[];setAds([])}});
  return()=>{cancelled=true};
 },[]);

 useEffect(()=>{
  const onFs=()=>setFullscreen(document.fullscreenElement===playerRef.current);
  document.addEventListener('fullscreenchange',onFs);
  return()=>document.removeEventListener('fullscreenchange',onFs);
 },[]);

 function clearTimers(){
  if(startupTimerRef.current){clearTimeout(startupTimerRef.current);startupTimerRef.current=null}
  if(stallTimerRef.current){clearTimeout(stallTimerRef.current);stallTimerRef.current=null}
 }

 async function resumeProgram(markBreak=true){
  clearTimers();
  const key=breakKeyRef.current;
  if(markBreak&&key)playedRef.current.add(key);
  breakKeyRef.current=null;
  attemptedAdsRef.current.clear();
  adStartedRef.current=false;
  activeRef.current=false;
  setActiveAd(null);
  setAdStatus('loading');
  setCountdown(0);
  const program=contentRef.current;
  if(!program)return;
  try{program.currentTime=resumeAtRef.current}catch{}
  try{await program.play()}catch{}
 }

 function selectNextAd(){
  const rows=adsRef.current;
  if(!rows.length){void resumeProgram(true);return}
  let selected:Ad|null=null;
  let selectedIndex=-1;
  for(let offset=0;offset<rows.length;offset++){
   const idx=(adCursorRef.current+offset)%rows.length;
   const candidate=rows[idx];
   const key=candidate?._id||candidate?.creative_url;
   if(candidate&&key&&!attemptedAdsRef.current.has(key)){
    selected=candidate;selectedIndex=idx;break;
   }
  }
  if(!selected){void resumeProgram(true);return}
  attemptedAdsRef.current.add(selected._id||selected.creative_url);
  adCursorRef.current=(selectedIndex+1)%rows.length;
  adStartedRef.current=false;
  clearTimers();
  setCountdown(0);
  setAdStatus('loading');
  setActiveAd(selected);
 }

 function failCurrentAd(){
  clearTimers();
  adStartedRef.current=false;
  setCountdown(0);
  setActiveAd(null);
  // Stay in the ad break and immediately try the next active in-system ad.
  window.setTimeout(selectNextAd,0);
 }

 function startBreak(key:string){
  if(activeRef.current||playedRef.current.has(key)||!adsRef.current.length)return;
  const program=contentRef.current;
  if(!program)return;
  breakKeyRef.current=key;
  attemptedAdsRef.current.clear();
  activeRef.current=true;
  resumeAtRef.current=program.currentTime;
  program.pause();
  selectNextAd();
 }

 useEffect(()=>{
  if(!activeAd)return;
  const adVideo=adRef.current;
  if(!adVideo){failCurrentAd();return}
  let disposed=false;
  clearTimers();
  startupTimerRef.current=setTimeout(()=>{
   if(!disposed&&!adStartedRef.current)failCurrentAd();
  },8000);
  try{adVideo.currentTime=0}catch{}
  try{adVideo.load()}catch{}
  const started=adVideo.play();
  if(started&&typeof started.catch==='function'){
   started.catch((error:any)=>{
    if(disposed)return;
    const name=String(error?.name||'');
    if(name==='NotAllowedError'||name==='AbortError'){
     clearTimers();
     setAdStatus('tap');
     return;
    }
    failCurrentAd();
   });
  }
  return()=>{disposed=true;clearTimers()};
 },[activeAd]);

 function checkBreak(){
  const program=contentRef.current;
  if(!program||activeRef.current||!ads.length||breakMode==='none')return;
  const t=program.currentTime;
  if(breakMode==='interval'){
   const breakNo=Math.floor(t/interval);
   if(breakNo>=1){
    const key=`i:${breakNo}`;
    if(!playedRef.current.has(key))startBreak(key);
   }
   return;
  }
  for(const at of customTimes){
   const key=`c:${at}`;
   if(t>=at&&!playedRef.current.has(key)){startBreak(key);break}
  }
 }

 function adTime(){
  const a=adRef.current;
  if(a&&Number.isFinite(a.duration))setCountdown(Math.max(0,Math.ceil(a.duration-a.currentTime)));
  if(adStartedRef.current&&stallTimerRef.current){clearTimeout(stallTimerRef.current);stallTimerRef.current=null}
 }

 function onAdPlaying(){
  adStartedRef.current=true;
  if(startupTimerRef.current){clearTimeout(startupTimerRef.current);startupTimerRef.current=null}
  if(stallTimerRef.current){clearTimeout(stallTimerRef.current);stallTimerRef.current=null}
  setAdStatus('playing');
 }

 function onAdWaiting(){
  if(!adStartedRef.current)return;
  if(stallTimerRef.current)clearTimeout(stallTimerRef.current);
  stallTimerRef.current=setTimeout(()=>{
   const a=adRef.current;
   if(a&&a.paused===false&&a.readyState<3)failCurrentAd();
  },12000);
 }

 async function tapToPlayAd(){
  const a=adRef.current;
  if(!a)return failCurrentAd();
  setAdStatus('loading');
  startupTimerRef.current=setTimeout(()=>{if(!adStartedRef.current)failCurrentAd()},8000);
  try{await a.play()}catch{failCurrentAd()}
 }

 async function toggleFullscreen(){
  const player=playerRef.current;if(!player)return;
  try{if(document.fullscreenElement)await document.exitFullscreen();else await player.requestFullscreen()}catch{}
 }

 const ctaLabel=activeAd?.cta_text?.trim()||'Learn More';
 return <div ref={playerRef} style={{position:'relative',width:'100%',height:fullscreen?'100vh':'auto',background:'#000',overflow:'hidden',display:'grid',placeItems:'center'}}>
  <video ref={contentRef} src={src} poster={poster} controls={!activeAd} controlsList="nofullscreen" disablePictureInPicture playsInline preload="metadata" onTimeUpdate={checkBreak} onSeeked={checkBreak} style={{width:'100%',height:fullscreen?'100%':'auto',aspectRatio:fullscreen?undefined:'16/9',maxHeight:fullscreen?'100vh':720,background:'#000',objectFit:'contain',display:'block'}}/>
  {!activeAd&&<button type="button" onClick={toggleFullscreen} aria-label={fullscreen?'Exit Indie Cut fullscreen':'Indie Cut fullscreen'} title={fullscreen?'Exit fullscreen':'Fullscreen'} style={{position:'absolute',right:12,bottom:fullscreen?18:48,zIndex:50,width:42,height:38,border:'1px solid rgba(255,255,255,.35)',borderRadius:4,background:'rgba(0,0,0,.78)',color:'#fff',fontSize:22,cursor:'pointer',display:'grid',placeItems:'center'}}>{fullscreen?'↙':'⛶'}</button>}
  {activeAd&&<div style={{position:'absolute',inset:0,zIndex:60,background:'#000',display:'grid',placeItems:'center'}}>
   <video ref={adRef} key={activeAd._id||activeAd.creative_url} src={activeAd.creative_url} preload="auto" playsInline onPlaying={onAdPlaying} onWaiting={onAdWaiting} onTimeUpdate={adTime} onEnded={()=>void resumeProgram(true)} onError={failCurrentAd} controls={false} style={{width:'100%',height:'100%',objectFit:'contain',background:'#000'}}/>
   <div style={{position:'absolute',left:14,top:12,padding:'6px 9px',background:'rgba(0,0,0,.72)',backdropFilter:'blur(8px)',color:'#fff',fontSize:12,fontWeight:800,letterSpacing:'.06em',borderRadius:999}}>ADVERTISEMENT{countdown>0?` · ${countdown}s`:adStatus==='loading'?' · LOADING…':''}</div>
   {adStatus==='loading'&&<div aria-live="polite" style={{position:'absolute',inset:0,display:'grid',placeItems:'center',pointerEvents:'none'}}><div style={{padding:'12px 16px',borderRadius:10,background:'rgba(0,0,0,.62)',color:'#fff',fontSize:14,fontWeight:800}}>Loading advertisement…</div></div>}
   {adStatus==='tap'&&<button type="button" onClick={()=>void tapToPlayAd()} style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',padding:'14px 20px',border:0,borderRadius:999,background:'#fff',color:'#111',fontWeight:900,fontSize:14,cursor:'pointer'}}>Tap to play advertisement</button>}
   {activeAd.destination_url&&<a href={activeAd.destination_url} target="_blank" rel="noopener noreferrer sponsored" aria-label={`${ctaLabel} — ${activeAd.advertiser||activeAd.title||'advertiser'}`} style={{position:'absolute',right:16,bottom:16,maxWidth:'calc(100% - 32px)',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:9,padding:'12px 20px',borderRadius:999,background:'rgba(255,255,255,.97)',color:'#111',fontSize:13,fontWeight:900,letterSpacing:'.01em',textDecoration:'none',boxShadow:'0 12px 34px rgba(0,0,0,.32)',border:'1px solid rgba(255,255,255,.65)',backdropFilter:'blur(10px)',whiteSpace:'nowrap'}}><span>{ctaLabel}</span><span aria-hidden="true" style={{fontSize:15,lineHeight:1}}>↗</span></a>}
  </div>}
 </div>
}
