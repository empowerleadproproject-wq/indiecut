'use client';

import {useEffect} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';

function id(){return typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`}

export default function WebsiteAnalyticsTracker(){
 const pathname=usePathname();
 const search=useSearchParams();
 useEffect(()=>{
  if(!pathname||pathname.startsWith('/admin')||pathname.startsWith('/api'))return;
  let visitorId=localStorage.getItem('ic_visitor_id');
  if(!visitorId){visitorId=id();localStorage.setItem('ic_visitor_id',visitorId)}
  const now=Date.now();
  const last=Number(sessionStorage.getItem('ic_session_last')||'0');
  let sessionId=sessionStorage.getItem('ic_session_id');
  if(!sessionId||now-last>30*60*1000){sessionId=id();sessionStorage.setItem('ic_session_id',sessionId)}
  sessionStorage.setItem('ic_session_last',String(now));

  const query=search?.toString();
  const path=query?`${pathname}?${query}`:pathname;
  const articleMatch=pathname.match(/^\/articles\/([^/?#]+)/);
  const articleSlug=articleMatch?decodeURIComponent(articleMatch[1]):null;
  const base={visitor_id:visitorId,session_id:sessionId,path,page_title:document.title,referrer:document.referrer||'',article_slug:articleSlug};
  const send=(extra:Record<string,any>)=>{
   const body=JSON.stringify({...base,...extra});
   if(navigator.sendBeacon){const ok=navigator.sendBeacon('/api/analytics/track',new Blob([body],{type:'application/json'}));if(ok)return}
   fetch('/api/analytics/track',{method:'POST',headers:{'content-type':'application/json'},body,keepalive:true}).catch(()=>{});
  };
  send({event_type:'page_view'});

  let activeMs=0;
  let activeStarted=document.visibilityState==='visible'?performance.now():null as number|null;
  let maxScroll=0;
  let finalized=false;
  const updateScroll=()=>{
   const doc=document.documentElement;
   const total=Math.max(1,doc.scrollHeight-window.innerHeight);
   const depth=total<=1?100:Math.min(100,Math.max(0,Math.round((window.scrollY/total)*100)));
   if(depth>maxScroll)maxScroll=depth;
  };
  updateScroll();
  const onVisibility=()=>{
   if(document.visibilityState==='hidden'&&activeStarted!=null){activeMs+=performance.now()-activeStarted;activeStarted=null}
   else if(document.visibilityState==='visible'&&activeStarted==null&&!finalized)activeStarted=performance.now();
  };
  const finalize=()=>{
   if(finalized)return;
   finalized=true;
   if(activeStarted!=null){activeMs+=performance.now()-activeStarted;activeStarted=null}
   updateScroll();
   send({event_type:'page_engagement',duration_ms:Math.max(0,Math.round(activeMs)),scroll_depth:maxScroll});
  };

  const seenAds=new Set<string>();
  const observed=new WeakSet<Element>();
  const adPayload=(el:Element)=>({
   ad_id:el.getAttribute('data-ic-ad-id')||'',
   ad_name:el.getAttribute('data-ic-ad-name')||'',
   ad_placement:el.getAttribute('data-ic-ad-placement')||'',
   target_url:el.getAttribute('data-ic-ad-destination')||''
  });
  const impressionObserver=new IntersectionObserver(entries=>{
   for(const entry of entries){
    if(!entry.isIntersecting||entry.intersectionRatio<0.5)continue;
    const el=entry.target;
    const info=adPayload(el);
    const key=`${info.ad_id}|${info.ad_placement}`;
    if(!info.ad_id||seenAds.has(key))continue;
    seenAds.add(key);
    send({event_type:'ad_impression',...info});
    impressionObserver.unobserve(el);
   }
  },{threshold:[0.5]});
  const scanAds=()=>document.querySelectorAll('[data-ic-ad-id]').forEach(el=>{if(!observed.has(el)){observed.add(el);impressionObserver.observe(el)}});
  scanAds();
  const mutations=new MutationObserver(scanAds);
  mutations.observe(document.body,{childList:true,subtree:true});
  const onClick=(event:MouseEvent)=>{
   const target=event.target instanceof Element?event.target.closest('[data-ic-ad-id]'):null;
   if(!target)return;
   const info=adPayload(target);
   if(info.ad_id)send({event_type:'ad_click',...info});
  };

  window.addEventListener('scroll',updateScroll,{passive:true});
  document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('pagehide',finalize);
  document.addEventListener('click',onClick,true);
  return()=>{
   finalize();
   window.removeEventListener('scroll',updateScroll);
   document.removeEventListener('visibilitychange',onVisibility);
   window.removeEventListener('pagehide',finalize);
   document.removeEventListener('click',onClick,true);
   mutations.disconnect();
   impressionObserver.disconnect();
  };
 },[pathname,search]);
 return null;
}
