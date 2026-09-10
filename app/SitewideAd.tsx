'use client';

import {useEffect,useMemo,useState} from 'react';
import {usePathname} from 'next/navigation';

type Ad={
  advertiser?:string;
  title?:string;
  creative_url?:string;
  destination_url?:string;
  placement?:string;
};

function isVideo(url?:string){return Boolean(url&&/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url))}

export default function SitewideAd(){
  const pathname=usePathname();
  const [ads,setAds]=useState<Ad[]>([]);
  const [index,setIndex]=useState(0);

  useEffect(()=>{
    if(pathname?.startsWith('/admin')||pathname==='/')return;
    let cancelled=false;
    fetch('/api/public/ads',{cache:'no-store'})
      .then(r=>r.json())
      .then(j=>{if(!cancelled)setAds(Array.isArray(j?.ads)?j.ads:[])})
      .catch(()=>{});
    return()=>{cancelled=true};
  },[pathname]);

  useEffect(()=>{
    if(ads.length<=1)return;
    const timer=window.setInterval(()=>setIndex(i=>(i+1)%ads.length),15000);
    return()=>window.clearInterval(timer);
  },[ads.length]);

  const ordered=useMemo(()=>{
    const priority=(p?:string)=>p==='right-rail'?0:p==='article-top'?1:p==='article-inline'?2:p==='homepage'?3:4;
    return [...ads].sort((a,b)=>priority(a.placement)-priority(b.placement));
  },[ads]);

  if(pathname?.startsWith('/admin')||pathname==='/'||!ordered.length)return null;
  const ad=ordered[index%ordered.length];
  if(!ad?.creative_url)return null;

  const creative=isVideo(ad.creative_url)
    ? <video src={ad.creative_url} autoPlay muted loop playsInline/>
    : <img src={ad.creative_url} alt={ad.advertiser||ad.title||'Advertisement'}/>;

  return <aside className="ic-sitewide-ad" aria-label="Advertisement">
    <span>ADVERTISEMENT</span>
    {ad.destination_url
      ? <a href={ad.destination_url} target="_blank" rel="noreferrer sponsored">{creative}</a>
      : creative}
  </aside>;
}
