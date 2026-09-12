'use client';

import {useEffect,useMemo,useState} from 'react';

type Ad={advertiser?:string;title?:string;creative_url?:string;destination_url?:string;creative_media_type?:string;placement?:string};
function isVideo(ad:Ad){return String(ad.creative_media_type||'').startsWith('video/')||/\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(ad.creative_url||''))}

export default function BattleProfileAds(){
 const [ads,setAds]=useState<Ad[]>([]);
 useEffect(()=>{let off=false;fetch('/api/public/ads',{cache:'no-store'}).then(r=>r.json()).then(j=>{if(!off)setAds(Array.isArray(j?.ads)?j.ads:[])}).catch(()=>{});return()=>{off=true}},[]);
 const visible=useMemo(()=>{
  const battle=ads.filter(a=>a.creative_url&&a.placement==='battle-artist');
  const fallback=ads.filter(a=>a.creative_url&&a.placement!=='battle-artist');
  return (battle.length?battle:fallback).slice(0,2);
 },[ads]);
 if(!visible.length)return null;
 return <section className="battle-profile-ads" aria-label="Advertisements">
  <div className="battle-profile-ad-label">ADVERTISEMENT</div>
  <div className="battle-profile-ad-grid">{visible.map((ad,i)=>{
   const media=isVideo(ad)?<video src={ad.creative_url} autoPlay muted loop playsInline/>:<img src={ad.creative_url} alt={ad.advertiser||ad.title||'Advertisement'}/>;
   return <div className="battle-profile-ad" key={`${ad.creative_url}-${i}`}>{ad.destination_url?<a href={ad.destination_url} target="_blank" rel="noreferrer sponsored">{media}</a>:media}</div>
  })}</div>
  <style jsx>{`
   .battle-profile-ads{margin:42px 0 8px;border-top:1px solid #242424;padding-top:18px}
   .battle-profile-ad-label{text-align:center;color:#777;font-size:9px;letter-spacing:.18em;font-weight:900;margin-bottom:12px}
   .battle-profile-ad-grid{display:grid;grid-template-columns:repeat(${visible.length>1?2:1},minmax(0,1fr));gap:16px;max-width:900px;margin:0 auto}
   .battle-profile-ad{background:#0d0d0d;min-height:90px;display:grid;place-items:center;overflow:hidden}
   .battle-profile-ad a{display:block;width:100%}
   .battle-profile-ad img,.battle-profile-ad video{display:block;width:100%;max-height:220px;object-fit:contain;background:#0d0d0d}
   @media(max-width:700px){.battle-profile-ad-grid{grid-template-columns:1fr}.battle-profile-ad img,.battle-profile-ad video{max-height:180px}}
  `}</style>
 </section>
}
