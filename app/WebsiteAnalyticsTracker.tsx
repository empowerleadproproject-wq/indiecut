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
  const payload={visitor_id:visitorId,session_id:sessionId,event_type:'page_view',path,page_title:document.title,referrer:document.referrer||'',article_slug:articleMatch?decodeURIComponent(articleMatch[1]):null};
  const body=JSON.stringify(payload);
  if(navigator.sendBeacon){navigator.sendBeacon('/api/analytics/track',new Blob([body],{type:'application/json'}))}
  else fetch('/api/analytics/track',{method:'POST',headers:{'content-type':'application/json'},body,keepalive:true}).catch(()=>{});
 },[pathname,search]);
 return null;
}
