'use client';

import {useEffect,useState} from 'react';

type Ad={advertiser?:string;title?:string;creative_url?:string;destination_url?:string;creative_media_type?:string;placement?:string;_audience_scope?:'local'|'global'};
function isVideo(ad:Ad){return String(ad.creative_media_type||'').startsWith('video/')||/\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(ad.creative_url||''))}
function adKey(ad:Ad){return `${ad.creative_url||''}|${ad.destination_url||''}`}
function shuffled<T>(items:T[]){const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}

export default function BattleProfileAds(){
 const [visible,setVisible]=useState<Ad[]>([]);
 useEffect(()=>{
  let off=false;
  fetch(`/api/public/ads?placement=battle-artist&t=${Date.now()}`,{cache:'no-store'})
   .then(r=>r.json())
   .then(j=>{
    if(off)return;
    const rows:Array<Ad>=Array.isArray(j?.ads)?j.ads.filter((a:Ad)=>Boolean(a?.creative_url)):[];
    if(!rows.length){setVisible([]);return;}

    const local=rows.filter(a=>a._audience_scope==='local');
    const global=rows.filter(a=>a._audience_scope!=='local');
    const localBattle=shuffled(local.filter(a=>a.placement==='battle-artist'));
    const localSitewide=shuffled(local.filter(a=>a.placement!=='battle-artist'));
    const globalBattle=shuffled(global.filter(a=>a.placement==='battle-artist'));
    const globalSitewide=shuffled(global.filter(a=>a.placement!=='battle-artist'));
    const seen=new Set<string>();
    const pool=[...localBattle,...localSitewide,...globalBattle,...globalSitewide].filter(ad=>{const key=adKey(ad);if(seen.has(key))return false;seen.add(key);return true});
    if(!pool.length){setVisible([]);return;}

    const storageKey='indiecut-battle-profile-ad-pair-index-v3';
    let start=0;
    try{
      const saved=sessionStorage.getItem(storageKey);
      if(saved===null){start=0}
      else{start=(Number(saved)+2)%pool.length;if(!Number.isFinite(start))start=0}
      sessionStorage.setItem(storageKey,String(start));
    }catch{start=0}

    const pair:Ad[]=[];
    for(let i=0;i<Math.min(2,pool.length);i++)pair.push(pool[(start+i)%pool.length]);
    setVisible(pair);
   })
   .catch(()=>{});
  return()=>{off=true};
 },[]);
 if(!visible.length)return null;
 return <section className="battle-profile-ads" aria-label="Advertisements">
  <div className="battle-profile-ad-label">ADVERTISEMENT</div>
  <div className="battle-profile-ad-grid">{visible.map((ad,i)=>{
    const media=isVideo(ad)?<video src={ad.creative_url} autoPlay muted loop playsInline/>:<img src={ad.creative_url} alt={ad.advertiser||ad.title||'Advertisement'}/>;
    return <div className="battle-profile-ad" key={`${adKey(ad)}-${i}`}>{ad.destination_url?<a href={ad.destination_url} target="_blank" rel="noreferrer sponsored">{media}</a>:media}</div>;
  })}</div>
  <style jsx>{`
   .battle-profile-ads{margin:38px 0 8px;border-top:1px solid #242424;padding-top:18px}
   .battle-profile-ad-label{text-align:center;color:#777;font-size:9px;letter-spacing:.18em;font-weight:900;margin-bottom:12px}
   .battle-profile-ad-grid{display:grid;grid-template-columns:repeat(2,minmax(0,300px));justify-content:center;gap:18px;max-width:640px;margin:0 auto}
   .battle-profile-ad{width:100%;height:170px;background:#0d0d0d;display:grid;place-items:center;overflow:hidden}
   .battle-profile-ad a{display:grid;place-items:center;width:100%;height:100%}
   .battle-profile-ad img,.battle-profile-ad video{display:block;max-width:100%;width:auto;height:100%;max-height:170px;object-fit:contain;background:#0d0d0d}
   @media(max-width:700px){
     .battle-profile-ad-grid{grid-template-columns:1fr;max-width:320px;gap:12px}
     .battle-profile-ad{height:150px}
     .battle-profile-ad img,.battle-profile-ad video{max-height:150px}
   }
  `}</style>
 </section>
}
