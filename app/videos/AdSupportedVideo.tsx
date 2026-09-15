'use client';

import {useEffect,useMemo,useRef,useState} from 'react';

type Ad={_id:string;advertiser:string;title:string;creative_url:string;creative_media_type:string;destination_url:string};
type BreakMode='none'|'interval'|'custom';
function parseTimestamp(v:string){const parts=v.trim().split(':').map(Number);if(parts.some(n=>!Number.isFinite(n)))return null;if(parts.length===2)return parts[0]*60+parts[1];if(parts.length===3)return parts[0]*3600+parts[1]*60+parts[2];return null}

export default function AdSupportedVideo({src,poster,breakMode='interval',intervalMinutes=6,customBreaks=''}:{src:string;poster?:string;breakMode?:BreakMode;intervalMinutes?:number;customBreaks?:string}){
 const contentRef=useRef<HTMLVideoElement>(null);const adRef=useRef<HTMLVideoElement>(null);
 const [ads,setAds]=useState<Ad[]>([]);const [activeAd,setActiveAd]=useState<Ad|null>(null);const [adIndex,setAdIndex]=useState(0);const [playedBreaks,setPlayedBreaks]=useState<string[]>([]);const [resumeAt,setResumeAt]=useState(0);const [countdown,setCountdown]=useState(0);
 const interval=Math.max(1,intervalMinutes)*60;
 const customTimes=useMemo(()=>customBreaks.split(',').map(parseTimestamp).filter((n):n is number=>n!==null&&n>0).sort((a,b)=>a-b),[customBreaks]);
 useEffect(()=>{fetch('/api/public/ads?placement=video-midroll',{cache:'no-store'}).then(r=>r.json()).then(j=>setAds((j.ads||[]).filter((a:Ad)=>String(a.creative_media_type||'').startsWith('video/')))).catch(()=>{})},[]);
 function beginAd(key:string){if(!ads.length||activeAd)return;const video=contentRef.current;if(!video)return;const ad=ads[adIndex%ads.length];setPlayedBreaks(x=>x.includes(key)?x:[...x,key]);setResumeAt(video.currentTime);video.pause();setActiveAd(ad);setAdIndex(x=>x+1)}
 function onTime(){const video=contentRef.current;if(!video||!ads.length||activeAd||breakMode==='none')return;if(breakMode==='interval'){const breakNo=Math.floor(video.currentTime/interval);const key=`i:${breakNo}`;if(breakNo>=1&&!playedBreaks.includes(key))beginAd(key);return}for(const t of customTimes){const key=`c:${t}`;if(video.currentTime>=t&&!playedBreaks.includes(key)){beginAd(key);break}}}
 function finishAd(){const video=contentRef.current;setActiveAd(null);setCountdown(0);setTimeout(()=>{if(video){video.currentTime=resumeAt;video.play().catch(()=>{})}},0)}
 function adTime(){const a=adRef.current;if(a&&Number.isFinite(a.duration))setCountdown(Math.max(0,Math.ceil(a.duration-a.currentTime)))}
 const scheduleLabel=breakMode==='none'?'NO ADS':breakMode==='custom'?'CUSTOM AD BREAKS':`ADS EVERY ${Math.max(1,intervalMinutes)} MIN`;
 return <div style={{position:'relative',width:'100%',background:'#000'}}><video ref={contentRef} src={src} poster={poster} controls={!activeAd} playsInline preload="metadata" onTimeUpdate={onTime} style={{width:'100%',aspectRatio:'16/9',maxHeight:720,background:'#000',objectFit:'contain',display:'block'}}/>{activeAd&&<div style={{position:'absolute',inset:0,zIndex:10,background:'#000',display:'grid',placeItems:'center'}}><video ref={adRef} key={activeAd._id} src={activeAd.creative_url} autoPlay playsInline onTimeUpdate={adTime} onEnded={finishAd} onError={finishAd} controls={false} style={{width:'100%',height:'100%',objectFit:'contain'}}/><div style={{position:'absolute',left:14,top:12,padding:'6px 9px',background:'rgba(0,0,0,.72)',color:'#fff',fontSize:12,fontWeight:800,letterSpacing:'.06em'}}>ADVERTISEMENT{countdown>0?` · ${countdown}s`:''}</div>{activeAd.destination_url&&<a href={activeAd.destination_url} target="_blank" rel="noreferrer" style={{position:'absolute',right:14,bottom:14,padding:'9px 13px',background:'#fff',color:'#111',fontSize:12,fontWeight:900,textDecoration:'none'}}>LEARN MORE</a>}</div>}{breakMode!=='none'&&ads.length>0&&!activeAd&&<div style={{position:'absolute',right:10,top:10,padding:'5px 8px',background:'rgba(0,0,0,.6)',color:'#fff',fontSize:10,fontWeight:800}}>{scheduleLabel}</div>}</div>
}
