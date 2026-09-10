'use client';

import {useEffect,useMemo,useState} from 'react';
import {usePathname} from 'next/navigation';

type Ad={advertiser?:string;title?:string;creative_url?:string;destination_url?:string;placement?:string};
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

  return <>
    <aside className="ic-sitewide-ad" aria-label="Advertisement">
      <span>ADVERTISEMENT</span>
      {ad.destination_url
        ? <a href={ad.destination_url} target="_blank" rel="noreferrer sponsored">{creative}</a>
        : creative}
    </aside>
    <style jsx global>{`
      .ic-sitewide-ad{position:fixed;right:18px;top:155px;width:270px;z-index:8;background:#fff;border:1px solid #ddd;padding:10px;box-shadow:0 10px 30px rgba(0,0,0,.12);text-align:center}
      .ic-sitewide-ad>span{display:block;font-size:9px;letter-spacing:1.4px;color:#888;margin-bottom:7px;font-weight:700}
      .ic-sitewide-ad a{display:block}
      .ic-sitewide-ad img,.ic-sitewide-ad video{display:block;width:100%;height:auto;max-height:420px;object-fit:contain;background:#f7f7f7}
      @media(max-width:1350px){.ic-sitewide-ad{width:220px;right:10px}}
      @media(max-width:1100px){.ic-sitewide-ad{position:relative;right:auto;top:auto;width:min(92%,680px);margin:18px auto 26px;z-index:1;box-shadow:none}.ic-sitewide-ad img,.ic-sitewide-ad video{max-height:360px}}
    `}</style>
  </>;
}
