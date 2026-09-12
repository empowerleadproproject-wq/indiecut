'use client';

import {useEffect,useState} from 'react';

type Ad={advertiser?:string;title?:string;creative_url?:string;destination_url?:string;creative_media_type?:string;placement?:string};
function isVideo(ad:Ad){return String(ad.creative_media_type||'').startsWith('video/')||/\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(ad.creative_url||''))}
function adKey(ad:Ad){return `${ad.creative_url||''}|${ad.destination_url||''}`}

export default function BattleProfileAds(){
 const [visible,setVisible]=useState<Ad|null>(null);
 useEffect(()=>{
  let off=false;
  fetch(`/api/public/ads?battleProfile=${Date.now()}`,{cache:'no-store'})
   .then(r=>r.json())
   .then(j=>{
    if(off)return;
    const rows:Array<Ad>=Array.isArray(j?.ads)?j.ads.filter((a:Ad)=>Boolean(a?.creative_url)):[];
    if(!rows.length){setVisible(null);return;}

    // Artist-profile ads get first priority, but the full active inventory remains
    // eligible so one campaign cannot permanently occupy this page.
    const battle=rows.filter(a=>a.placement==='battle-artist');
    const other=rows.filter(a=>a.placement!=='battle-artist');
    const seen=new Set<string>();
    const pool=[...battle,...other].filter(ad=>{const key=adKey(ad);if(seen.has(key))return false;seen.add(key);return true});
    if(!pool.length){setVisible(null);return;}

    // Cycle to a different ad on every reload/navigation in the same browser session.
    // The first visit starts at a random campaign so all visitors don't see the same ad.
    const storageKey='indiecut-battle-profile-ad-index-v1';
    let index=0;
    try{
      const saved=sessionStorage.getItem(storageKey);
      if(saved===null){index=Math.floor(Math.random()*pool.length)}
      else{index=(Number(saved)+1)%pool.length;if(!Number.isFinite(index))index=0}
      sessionStorage.setItem(storageKey,String(index));
    }catch{index=Math.floor(Math.random()*pool.length)}
    setVisible(pool[index]);
   })
   .catch(()=>{});
  return()=>{off=true};
 },[]);
 if(!visible)return null;
 const media=isVideo(visible)?<video src={visible.creative_url} autoPlay muted loop playsInline/>:<img src={visible.creative_url} alt={visible.advertiser||visible.title||'Advertisement'}/>;
 return <section className="battle-profile-ads" aria-label="Advertisement">
  <div className="battle-profile-ad-label">ADVERTISEMENT</div>
  <div className="battle-profile-ad">{visible.destination_url?<a href={visible.destination_url} target="_blank" rel="noreferrer sponsored">{media}</a>:media}</div>
  <style jsx>{`
   .battle-profile-ads{margin:42px 0 8px;border-top:1px solid #242424;padding-top:18px}
   .battle-profile-ad-label{text-align:center;color:#777;font-size:9px;letter-spacing:.18em;font-weight:900;margin-bottom:12px}
   .battle-profile-ad{background:#0d0d0d;min-height:90px;display:grid;place-items:center;overflow:hidden;max-width:900px;margin:0 auto}
   .battle-profile-ad a{display:block;width:100%}
   .battle-profile-ad img,.battle-profile-ad video{display:block;width:100%;max-height:220px;object-fit:contain;background:#0d0d0d}
   @media(max-width:700px){.battle-profile-ad img,.battle-profile-ad video{max-height:180px}}
  `}</style>
 </section>
}
