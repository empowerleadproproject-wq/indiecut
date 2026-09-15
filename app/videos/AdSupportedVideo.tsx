'use client';

import {useEffect,useMemo,useRef,useState} from 'react';

type Ad={_id:string;advertiser:string;title:string;creative_url:string;creative_media_type:string;destination_url:string};
type BreakMode='none'|'interval'|'custom';
type PendingBreak={key:string;ad:Ad};
function parseTimestamp(v:string){const parts=v.trim().split(':').map(Number);if(parts.some(n=>!Number.isFinite(n)))return null;if(parts.length===2)return parts[0]*60+parts[1];if(parts.length===3)return parts[0]*3600+parts[1]*60+parts[2];return null}

export default function AdSupportedVideo({src,poster,breakMode='interval',intervalMinutes=6,customBreaks=''}:{src:string;poster?:string;breakMode?:BreakMode;intervalMinutes?:number;customBreaks?:string}){
 const contentRef=useRef<HTMLVideoElement>(null);const adRef=useRef<HTMLVideoElement>(null);const pendingBreakRef=useRef<PendingBreak|null>(null);const resumeAtRef=useRef(0);
 const [ads,setAds]=useState<Ad[]>([]);const [activeAd,setActiveAd]=useState<Ad|null>(null);const [adIndex,setAdIndex]=useState(0);const [playedBreaks,setPlayedBreaks]=useState<string[]>([]);const [countdown,setCountdown]=useState(0);
 const interval=Math.max(1,intervalMinutes)*60;
 const customTimes=useMemo(()=>customBreaks.split(',').map(parseTimestamp).filter((n):n is number=>n!==null&&n>0).sort((a,b)=>a-b),[customBreaks]);
 const nextAd=ads.length?ads[adIndex%ads.length]:null;
 const adForElement=activeAd||nextAd;
 useEffect(()=>{fetch('/api/public/ads?placement=video-midroll',{cache:'no-store'}).then(r=>r.json()).then(j=>setAds((j.ads||[]).filter((a:Ad)=>String(a.creative_media_type||'').startsWith('video/')))).catch(()=>{})},[]);

 function recoverContent(){const video=contentRef.current;if(!video)return;try{video.currentTime=resumeAtRef.current}catch{}video.play().catch(()=>{})}
 function launchAd(key:string,ad:Ad){
  const video=contentRef.current,adVideo=adRef.current;if(!video||!adVideo||activeAd)return;
  pendingBreakRef.current=null;resumeAtRef.current=video.currentTime;setPlayedBreaks(x=>x.includes(key)?x:[...x,key]);
  video.pause();setActiveAd(ad);setAdIndex(x=>x+1);setCountdown(0);
  try{adVideo.currentTime=0}catch{}
  requestAnimationFrame(()=>{adVideo.play().catch(()=>{setActiveAd(null);recoverContent()})});
 }
 function beginAd(key:string){
  if(!ads.length||activeAd||pendingBreakRef.current)return;const ad=nextAd,adVideo=adRef.current;if(!ad||!adVideo)return;
  if(adVideo.readyState>=HTMLMediaElement.HAVE_FUTURE_DATA){launchAd(key,ad);return}
  pendingBreakRef.current={key,ad};
  try{adVideo.load()}catch{}
 }
 function onAdCanPlay(){const pending=pendingBreakRef.current;if(pending&&!activeAd)launchAd(pending.key,pending.ad)}
 function onTime(){const video=contentRef.current;if(!video||!ads.length||activeAd||pendingBreakRef.current||breakMode==='none')return;if(breakMode==='interval'){const breakNo=Math.floor(video.currentTime/interval);const key=`i:${breakNo}`;if(breakNo>=1&&!playedBreaks.includes(key))beginAd(key);return}for(const t of customTimes){const key=`c:${t}`;if(video.currentTime>=t&&!playedBreaks.includes(key)){beginAd(key);break}}}
 async function finishAd(){
  const video=contentRef.current;setCountdown(0);if(!video){setActiveAd(null);return}
  try{video.currentTime=resumeAtRef.current}catch{}
  try{await video.play();requestAnimationFrame(()=>setActiveAd(null))}catch{setActiveAd(null)}
 }
 function failAd(){
  const pending=pendingBreakRef.current;
  if(pending){pendingBreakRef.current=null;setPlayedBreaks(x=>x.includes(pending.key)?x:[...x,pending.key]);return}
  if(activeAd)void finishAd();
 }
 function adTime(){const a=adRef.current;if(a&&Number.isFinite(a.duration))setCountdown(Math.max(0,Math.ceil(a.duration-a.currentTime)))}
 const scheduleLabel=breakMode==='none'?'NO ADS':breakMode==='custom'?'CUSTOM AD BREAKS':`ADS EVERY ${Math.max(1,intervalMinutes)} MIN`;
 return <div style={{position:'relative',width:'100%',background:'#000',overflow:'hidden'}}>
  <video ref={contentRef} src={src} poster={poster} controls={!activeAd} playsInline preload="auto" onTimeUpdate={onTime} style={{width:'100%',aspectRatio:'16/9',maxHeight:720,background:'#000',objectFit:'contain',display:'block'}}/>
  {adForElement&&<div aria-hidden={!activeAd} style={{position:'absolute',inset:0,zIndex:10,background:'#000',display:'grid',placeItems:'center',opacity:activeAd?1:0,pointerEvents:activeAd?'auto':'none',transition:'opacity 90ms linear'}}>
   <video ref={adRef} key={adForElement._id} src={adForElement.creative_url} preload="auto" playsInline onCanPlay={onAdCanPlay} onCanPlayThrough={onAdCanPlay} onTimeUpdate={adTime} onEnded={()=>void finishAd()} onError={failAd} controls={false} style={{width:'100%',height:'100%',objectFit:'contain'}}/>
   {activeAd&&<><div style={{position:'absolute',left:14,top:12,padding:'6px 9px',background:'rgba(0,0,0,.72)',color:'#fff',fontSize:12,fontWeight:800,letterSpacing:'.06em'}}>ADVERTISEMENT{countdown>0?` · ${countdown}s`:''}</div>{activeAd.destination_url&&<a href={activeAd.destination_url} target="_blank" rel="noreferrer" style={{position:'absolute',right:14,bottom:14,padding:'9px 13px',background:'#fff',color:'#111',fontSize:12,fontWeight:900,textDecoration:'none'}}>LEARN MORE</a>}</>}
  </div>}
  {breakMode!=='none'&&ads.length>0&&!activeAd&&<div style={{position:'absolute',right:10,top:10,padding:'5px 8px',background:'rgba(0,0,0,.6)',color:'#fff',fontSize:10,fontWeight:800}}>{scheduleLabel}</div>}
 </div>
}
