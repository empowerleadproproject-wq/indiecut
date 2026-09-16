'use client';

import {useEffect,useMemo,useState} from 'react';

type Ad={advertiser?:string;title?:string;creative_url?:string;destination_url?:string;placement?:string;_audience_scope?:'local'|'global'};
function isVideo(url?:string){return Boolean(url&&/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url))}
function rotated<T>(items:T[],offset:number){if(!items.length)return [];const start=((offset%items.length)+items.length)%items.length;return [...items.slice(start),...items.slice(0,start)]}

export default function SitewideAd(){
  const [ads,setAds]=useState<Ad[]>([]);
  const [rotation,setRotation]=useState(0);

  useEffect(()=>{
    let cancelled=false;
    fetch(`/api/public/ads?placement=right-rail&t=${Date.now()}`,{cache:'no-store'})
      .then(r=>r.json())
      .then(j=>{if(!cancelled)setAds(Array.isArray(j?.ads)?j.ads:[])})
      .catch(()=>{});
    return()=>{cancelled=true};
  },[]);

  useEffect(()=>{
    if(ads.length<2)return;
    const timer=window.setInterval(()=>setRotation(n=>n+1),15000);
    return()=>window.clearInterval(timer);
  },[ads.length]);

  const visibleAds=useMemo(()=>{
    const rows=ads.filter(ad=>Boolean(ad?.creative_url));
    const local=rows.filter(ad=>ad._audience_scope==='local');
    const global=rows.filter(ad=>ad._audience_scope!=='local');
    const localRotated=rotated(local,rotation);
    const globalRotated=rotated(global,rotation);
    // Preserve local priority, but rotate each audience pool independently so
    // the same advertiser is not permanently first. Global ads remain the fallback.
    return [...localRotated,...globalRotated].slice(0,4);
  },[ads,rotation]);
  if(!visibleAds.length)return null;

  return <aside className="ic-article-ad-rail" aria-label="Advertisements">
    {visibleAds.map((ad,index)=>{
      const creative=isVideo(ad.creative_url)
        ? <video src={ad.creative_url} autoPlay muted loop playsInline/>
        : <img src={ad.creative_url} alt={ad.advertiser||ad.title||'Advertisement'}/>;
      return <div className="ic-article-ad-slot" key={`${ad.creative_url}-${index}`}>
        <span>ADVERTISEMENT</span>
        {ad.destination_url
          ? <a href={ad.destination_url} target="_blank" rel="noreferrer sponsored">{creative}</a>
          : creative}
      </div>;
    })}
    <style jsx global>{`
      .ic-article-layout{max-width:1180px;margin:0 auto;padding:0 24px;display:grid;grid-template-columns:minmax(0,850px) 260px;gap:42px;align-items:start}
      .ic-article-layout .article{width:100%;max-width:none;margin:0;padding-left:0;padding-right:0}
      .ic-article-ad-rail{width:260px;display:flex;flex-direction:column;gap:20px;padding-top:50px}
      .ic-article-ad-slot{width:100%;background:#fff;border:1px solid #ddd;padding:8px}
      .ic-article-ad-slot>span{display:block;font-size:9px;line-height:1;letter-spacing:1.2px;color:#888;margin:0 0 7px;font-weight:700}
      .ic-article-ad-slot a{display:block;width:100%}
      .ic-article-ad-slot img,.ic-article-ad-slot video{display:block;width:100%;height:auto;max-height:360px;object-fit:contain;margin:0;background:#f7f7f7}
      @media(max-width:1100px){.ic-article-layout{grid-template-columns:minmax(0,1fr) 220px;gap:26px}.ic-article-ad-rail{width:220px}}
      @media(max-width:900px){.ic-article-layout{display:block}.ic-article-ad-rail{display:none}}
    `}</style>
  </aside>;
}
