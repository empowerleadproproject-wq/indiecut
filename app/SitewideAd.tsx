'use client';

import {useEffect,useMemo,useState} from 'react';
import {usePathname} from 'next/navigation';

type Ad={advertiser?:string;title?:string;creative_url?:string;destination_url?:string;placement?:string};
function isVideo(url?:string){return Boolean(url&&/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url))}
function shuffled<T>(items:T[]){const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}

export default function SitewideAd(){
  const pathname=usePathname();
  const [ads,setAds]=useState<Ad[]>([]);

  useEffect(()=>{
    if(pathname?.startsWith('/admin')||pathname==='/')return;
    let cancelled=false;
    fetch('/api/public/ads',{cache:'no-store'})
      .then(r=>r.json())
      .then(j=>{if(!cancelled)setAds(Array.isArray(j?.ads)?j.ads:[])})
      .catch(()=>{});
    return()=>{cancelled=true};
  },[pathname]);

  const visibleAds=useMemo(()=>{
    const eligible=ads.filter(ad=>Boolean(ad?.creative_url));
    return shuffled(eligible).slice(0,4);
  },[ads,pathname]);

  if(pathname?.startsWith('/admin')||pathname==='/'||!visibleAds.length)return null;

  return <>
    <aside className="ic-sitewide-ad-rail" aria-label="Advertisements">
      {visibleAds.map((ad,index)=>{
        const creative=isVideo(ad.creative_url)
          ? <video src={ad.creative_url} autoPlay muted loop playsInline/>
          : <img src={ad.creative_url} alt={ad.advertiser||ad.title||'Advertisement'}/>;
        return <div className="ic-sitewide-ad-slot" key={`${ad.creative_url}-${index}`}>
          <span>ADVERTISEMENT</span>
          {ad.destination_url
            ? <a href={ad.destination_url} target="_blank" rel="noreferrer sponsored">{creative}</a>
            : creative}
        </div>;
      })}
    </aside>
    <style jsx global>{`
      .ic-sitewide-ad-rail{position:absolute;left:calc(50% + 445px);top:190px;width:260px;z-index:2;display:flex;flex-direction:column;gap:20px}
      .ic-sitewide-ad-slot{width:100%;background:#fff;border:1px solid #ddd;padding:8px;text-align:center}
      .ic-sitewide-ad-slot>span{display:block;font-size:9px;line-height:1;letter-spacing:1.2px;color:#888;margin:0 0 7px;font-weight:700;text-align:left}
      .ic-sitewide-ad-slot a{display:block;width:100%}
      .ic-sitewide-ad-slot img,.ic-sitewide-ad-slot video{display:block;width:100%;height:auto;max-height:360px;object-fit:contain;margin:0;background:#f7f7f7}
      @media(max-width:1320px){.ic-sitewide-ad-rail{left:auto;right:18px;width:220px}}
      @media(max-width:1050px){.ic-sitewide-ad-rail{position:relative;left:auto;right:auto;top:auto;width:300px;max-width:calc(100vw - 32px);margin:22px auto 30px;z-index:1}.ic-sitewide-ad-slot img,.ic-sitewide-ad-slot video{max-height:420px}}
    `}</style>
  </>;
}
