'use client';

import {useEffect,useMemo,useRef,useState} from 'react';

type Ad={_id:string;advertiser:string;title:string;creative_url:string;creative_media_type:string;destination_url:string;cta_text?:string};
type BreakMode='none'|'interval'|'custom';
type Mode='program'|'ad';

function parseTimestamp(v:string){
 const parts=v.trim().split(':').map(Number);
 if(parts.some(n=>!Number.isFinite(n)))return null;
 if(parts.length===2)return parts[0]*60+parts[1];
 if(parts.length===3)return parts[0]*3600+parts[1]*60+parts[2];
 return null;
}

export default function AdSupportedVideo({src,poster,breakMode='interval',intervalMinutes=6,customBreaks=''}:{src:string;poster?:string;breakMode?:BreakMode;intervalMinutes?:number;customBreaks?:string}){
 const playerRef=useRef<HTMLDivElement>(null);
 const videoRef=useRef<HTMLVideoElement>(null);
 const adsRef=useRef<Ad[]>([]);
 const adCursorRef=useRef(0);
 const activeRef=useRef(false);
 const modeRef=useRef<Mode>('program');
 const resumeAtRef=useRef(0);
 const breakKeyRef=useRef<string|null>(null);
 const playedRef=useRef<Set<string>>(new Set());
 const attemptedAdsRef=useRef<Set<string>>(new Set());
 const preRollPlayedRef=useRef(false);
 const adStartedRef=useRef(false);
 const startupTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
 const stallTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);

 const [ads,setAds]=useState<Ad[]>([]);
 const [activeAd,setActiveAd]=useState<Ad|null>(null);
 const [mode,setMode]=useState<Mode>('program');
 const [countdown,setCountdown]=useState(0);
 const [fullscreen,setFullscreen]=useState(false);
 const [loadingAd,setLoadingAd]=useState(false);

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
    // Warm the browser cache for the first commercial before the viewer presses play.
    rows.slice(0,2).forEach(ad=>{
     try{
      const link=document.createElement('link');
      link.rel='preload';link.as='video';link.href=ad.creative_url;
      document.head.appendChild(link);
      window.setTimeout(()=>link.remove(),30000);
     }catch{}
    });
   })
   .catch(()=>{if(!cancelled){adsRef.current=[];setAds([])}});
  return()=>{cancelled=true};
 },[]);

 useEffect(()=>{
  const v=videoRef.current;
  if(v&&modeRef.current==='program'&&v.currentSrc!==src){
   v.src=src;
   if(poster)v.poster=poster;
   v.load();
  }
 },[src,poster]);

 useEffect(()=>{
  const onFs=()=>setFullscreen(document.fullscreenElement===playerRef.current);
  document.addEventListener('fullscreenchange',onFs);
  return()=>document.removeEventListener('fullscreenchange',onFs);
 },[]);

 function clearTimers(){
  if(startupTimerRef.current){clearTimeout(startupTimerRef.current);startupTimerRef.current=null}
  if(stallTimerRef.current){clearTimeout(stallTimerRef.current);stallTimerRef.current=null}
 }

 function nextAd(){
  const rows=adsRef.current;
  if(!rows.length)return null;
  for(let offset=0;offset<rows.length;offset++){
   const idx=(adCursorRef.current+offset)%rows.length;
   const candidate=rows[idx];
   const id=candidate?._id||candidate?.creative_url;
   if(candidate&&id&&!attemptedAdsRef.current.has(id)){
    attemptedAdsRef.current.add(id);
    adCursorRef.current=(idx+1)%rows.length;
    return candidate;
   }
  }
  return null;
 }

 function playAdOnCurrentElement(ad:Ad){
  const v=videoRef.current;
  if(!v)return;
  clearTimers();
  adStartedRef.current=false;
  setCountdown(0);
  setLoadingAd(true);
  setActiveAd(ad);
  modeRef.current='ad';
  setMode('ad');
  try{v.pause()}catch{}
  try{v.removeAttribute('poster')}catch{}
  v.controls=false;
  v.src=ad.creative_url;
  v.preload='auto';
  try{v.load()}catch{}
  startupTimerRef.current=setTimeout(()=>{
   if(!adStartedRef.current)failCurrentAd();
  },10000);
  const p=v.play();
  if(p&&typeof p.catch==='function')p.catch(()=>failCurrentAd());
 }

 function failCurrentAd(){
  clearTimers();
  adStartedRef.current=false;
  const replacement=nextAd();
  if(replacement){
   playAdOnCurrentElement(replacement);
   return;
  }
  void resumeProgram(true);
 }

 function startBreak(key:string,fromUserGesture=false){
  if(activeRef.current||playedRef.current.has(key)||!adsRef.current.length)return false;
  const v=videoRef.current;
  if(!v)return false;
  breakKeyRef.current=key;
  attemptedAdsRef.current.clear();
  activeRef.current=true;
  resumeAtRef.current=key==='pre:0'?0:v.currentTime;
  if(fromUserGesture&&key==='pre:0')preRollPlayedRef.current=true;
  try{v.pause()}catch{}
  const ad=nextAd();
  if(!ad){void resumeProgram(true);return false}
  // This call runs synchronously inside the viewer's Play gesture for pre-roll,
  // so iPhone Chrome/Safari treats the commercial as part of the same gesture.
  playAdOnCurrentElement(ad);
  return true;
 }

 async function resumeProgram(markBreak=true){
  clearTimers();
  const v=videoRef.current;
  const key=breakKeyRef.current;
  if(markBreak&&key)playedRef.current.add(key);
  breakKeyRef.current=null;
  attemptedAdsRef.current.clear();
  adStartedRef.current=false;
  activeRef.current=false;
  modeRef.current='program';
  setMode('program');
  setActiveAd(null);
  setLoadingAd(false);
  setCountdown(0);
  if(!v)return;
  try{v.pause()}catch{}
  v.controls=true;
  v.src=src;
  if(poster)v.poster=poster;else v.removeAttribute('poster');
  v.preload='metadata';
  v.load();
  const resume=()=>{
   try{v.currentTime=resumeAtRef.current}catch{}
   const p=v.play();
   if(p&&typeof p.catch==='function')p.catch(()=>{});
  };
  if(v.readyState>=1)resume();
  else v.addEventListener('loadedmetadata',resume,{once:true});
 }

 function onProgramPlay(){
  if(modeRef.current!=='program'||activeRef.current)return;
  // Pre-roll is launched from the exact same user gesture as the viewer's Play tap.
  if(!preRollPlayedRef.current&&adsRef.current.length){
   preRollPlayedRef.current=true;
   startBreak('pre:0',true);
  }
 }

 function checkBreak(){
  const v=videoRef.current;
  if(!v||modeRef.current!=='program'||activeRef.current||!ads.length||breakMode==='none')return;
  const t=v.currentTime;
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

 function onTimeUpdate(){
  const v=videoRef.current;
  if(!v)return;
  if(modeRef.current==='program'){
   checkBreak();
   return;
  }
  if(Number.isFinite(v.duration))setCountdown(Math.max(0,Math.ceil(v.duration-v.currentTime)));
  if(adStartedRef.current&&stallTimerRef.current){clearTimeout(stallTimerRef.current);stallTimerRef.current=null}
 }

 function onPlaying(){
  if(modeRef.current!=='ad')return;
  adStartedRef.current=true;
  setLoadingAd(false);
  if(startupTimerRef.current){clearTimeout(startupTimerRef.current);startupTimerRef.current=null}
  if(stallTimerRef.current){clearTimeout(stallTimerRef.current);stallTimerRef.current=null}
 }

 function onWaiting(){
  if(modeRef.current!=='ad'||!adStartedRef.current)return;
  if(stallTimerRef.current)clearTimeout(stallTimerRef.current);
  stallTimerRef.current=setTimeout(()=>{
   const v=videoRef.current;
   if(v&&modeRef.current==='ad'&&v.readyState<3)failCurrentAd();
  },12000);
 }

 function onEnded(){
  if(modeRef.current==='ad')void resumeProgram(true);
 }

 function onError(){
  if(modeRef.current==='ad')failCurrentAd();
 }

 async function toggleFullscreen(){
  const player=playerRef.current;if(!player)return;
  try{if(document.fullscreenElement)await document.exitFullscreen();else await player.requestFullscreen()}catch{}
 }

 const ctaLabel=activeAd?.cta_text?.trim()||'Learn More';
 return <div ref={playerRef} style={{position:'relative',width:'100%',height:fullscreen?'100vh':'auto',background:'#000',overflow:'hidden',display:'grid',placeItems:'center'}}>
  <video
   ref={videoRef}
   src={src}
   poster={poster}
   controls={mode==='program'}
   controlsList="nofullscreen"
   disablePictureInPicture
   playsInline
   preload="metadata"
   onPlay={onProgramPlay}
   onPlaying={onPlaying}
   onWaiting={onWaiting}
   onTimeUpdate={onTimeUpdate}
   onSeeked={checkBreak}
   onEnded={onEnded}
   onError={onError}
   style={{width:'100%',height:fullscreen?'100%':'auto',aspectRatio:fullscreen?undefined:'16/9',maxHeight:fullscreen?'100vh':720,background:'#000',objectFit:'contain',display:'block'}}
  />
  {mode==='program'&&<button type="button" onClick={toggleFullscreen} aria-label={fullscreen?'Exit Indie Cut fullscreen':'Indie Cut fullscreen'} title={fullscreen?'Exit fullscreen':'Fullscreen'} style={{position:'absolute',right:12,bottom:fullscreen?18:48,zIndex:50,width:42,height:38,border:'1px solid rgba(255,255,255,.35)',borderRadius:4,background:'rgba(0,0,0,.78)',color:'#fff',fontSize:22,cursor:'pointer',display:'grid',placeItems:'center'}}>{fullscreen?'↙':'⛶'}</button>}
  {mode==='ad'&&activeAd&&<div style={{position:'absolute',inset:0,zIndex:60,pointerEvents:'none'}}>
   <div style={{position:'absolute',left:14,top:12,padding:'6px 9px',background:'rgba(0,0,0,.72)',backdropFilter:'blur(8px)',color:'#fff',fontSize:12,fontWeight:800,letterSpacing:'.06em',borderRadius:999}}>ADVERTISEMENT{countdown>0?` · ${countdown}s`:loadingAd?' · LOADING…':''}</div>
   {loadingAd&&<div aria-live="polite" style={{position:'absolute',inset:0,display:'grid',placeItems:'center'}}><div style={{padding:'12px 16px',borderRadius:10,background:'rgba(0,0,0,.62)',color:'#fff',fontSize:14,fontWeight:800}}>Loading advertisement…</div></div>}
   {activeAd.destination_url&&<a href={activeAd.destination_url} target="_blank" rel="noopener noreferrer sponsored" aria-label={`${ctaLabel} — ${activeAd.advertiser||activeAd.title||'advertiser'}`} style={{pointerEvents:'auto',position:'absolute',right:16,bottom:16,maxWidth:'calc(100% - 32px)',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:9,padding:'12px 20px',borderRadius:999,background:'rgba(255,255,255,.97)',color:'#111',fontSize:13,fontWeight:900,letterSpacing:'.01em',textDecoration:'none',boxShadow:'0 12px 34px rgba(0,0,0,.32)',border:'1px solid rgba(255,255,255,.65)',backdropFilter:'blur(10px)',whiteSpace:'nowrap'}}><span>{ctaLabel}</span><span aria-hidden="true" style={{fontSize:15,lineHeight:1}}>↗</span></a>}
  </div>}
 </div>
}
