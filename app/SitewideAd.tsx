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
      .ic-sitewide-ad{position:fixed!important;right:24px!important;top:150px!important;width:260px!important;max-width:260px!important;z-index:8;background:#fff;border:1px solid #ddd;padding:8px;box-shadow:0 6px 20px rgba(0,0,0,.10);text-align:center;overflow:hidden}
      .ic-sitewide-ad>span{display:block;font-size:9px;line-height:1;letter-spacing:1.2px;color:#888;margin:0 0 7px;font-weight:700;text-align:left}
      .ic-sitewide-ad a{display:block;width:100%}
      .ic-sitewide-ad img,.ic-sitewide-ad video{display:block!important;width:100%!important;max-width:244px!important;height:auto!important;max-height:430px!important;object-fit:contain!important;margin:0!important;background:#f7f7f7}
      @media(max-width:1180px){.ic-sitewide-ad{right:12px!important;width:220px!important;max-width:220px!important}.ic-sitewide-ad img,.ic-sitewide-ad video{max-width:204px!important}}
      @media(max-width:900px){.ic-sitewide-ad{position:relative!important;right:auto!important;top:auto!important;width:300px!important;max-width:calc(100vw - 32px)!important;margin:18px auto 26px!important;box-shadow:none;z-index:1}.ic-sitewide-ad img,.ic-sitewide-ad video{max-width:100%!important;max-height:420px!important}}
    `}</style>
  </>;
}
