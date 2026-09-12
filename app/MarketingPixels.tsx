'use client';

import {useEffect,useRef,useState} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {trackMarketingEvent,trackMarketingPageView} from '../lib/marketing-tracking';

type Settings={
 meta_enabled:boolean;meta_pixel_id:string;
 ga4_enabled:boolean;ga4_measurement_id:string;
 google_ads_enabled:boolean;google_ads_id:string;google_ads_conversion_label:string;
 tiktok_enabled:boolean;tiktok_pixel_id:string;
 gtm_enabled:boolean;gtm_container_id:string;
 disabled_for_admin?:boolean;
};
const EMPTY:Settings={meta_enabled:false,meta_pixel_id:'',ga4_enabled:false,ga4_measurement_id:'',google_ads_enabled:false,google_ads_id:'',google_ads_conversion_label:'',tiktok_enabled:false,tiktok_pixel_id:'',gtm_enabled:false,gtm_container_id:''};

function inject(src:string,id:string){
 if(document.getElementById(id))return;
 const s=document.createElement('script');s.id=id;s.async=true;s.src=src;document.head.appendChild(s);
}
function initMeta(pixelId:string){
 const w=window as any;
 if(!w.fbq){const n:any=function(this:any,...args:any[]){n.callMethod?n.callMethod.apply(n,args):n.queue.push(args)};n.queue=[];n.loaded=true;n.version='2.0';w.fbq=n;inject('https://connect.facebook.net/en_US/fbevents.js','indiecut-meta-pixel')}
 w.fbq('init',pixelId);
}
function initGoogle(settings:Settings){
 const primary=settings.ga4_enabled&&settings.ga4_measurement_id?settings.ga4_measurement_id:settings.google_ads_enabled&&settings.google_ads_id?settings.google_ads_id:'';
 if(!primary)return;
 inject(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primary)}`,'indiecut-google-tag');
 const w=window as any;w.dataLayer=w.dataLayer||[];w.gtag=w.gtag||function(){w.dataLayer.push(arguments)};w.gtag('js',new Date());
 if(settings.ga4_enabled&&settings.ga4_measurement_id)w.gtag('config',settings.ga4_measurement_id,{send_page_view:false});
 if(settings.google_ads_enabled&&settings.google_ads_id)w.gtag('config',settings.google_ads_id,{send_page_view:false});
}
function initTikTok(pixelId:string){
 const w=window as any;
 if(w.ttq?.load){w.ttq.load(pixelId);return}
 const ttq=w.ttq=w.ttq||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie','holdConsent','revokeConsent','grantConsent'];
 ttq.setAndDefer=function(t:any,e:string){t[e]=function(...args:any[]){t.push([e,...args])}};for(const m of ttq.methods)ttq.setAndDefer(ttq,m);
 ttq.instance=function(t:string){const e=ttq._i[t]||[];for(const m of ttq.methods)ttq.setAndDefer(e,m);return e};ttq.load=function(id:string){const u='https://analytics.tiktok.com/i18n/pixel/events.js';ttq._i=ttq._i||{};ttq._i[id]=[];ttq._i[id]._u=u;ttq._t=ttq._t||{};ttq._t[id]=+new Date();ttq._o=ttq._o||{};ttq._o[id]={};inject(`${u}?sdkid=${encodeURIComponent(id)}&lib=ttq`,'indiecut-tiktok-pixel')};ttq.load(pixelId);
}
function initGtm(containerId:string){
 const w=window as any;w.dataLayer=w.dataLayer||[];w.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});inject(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`,'indiecut-gtm');
}

export default function MarketingPixels(){
 const pathname=usePathname();const search=useSearchParams();const [settings,setSettings]=useState<Settings|null>(null);const initialized=useRef(false);
 useEffect(()=>{fetch('/api/public/tracking-pixels',{cache:'no-store'}).then(r=>r.json()).then(j=>setSettings({...EMPTY,...j})).catch(()=>setSettings(EMPTY))},[]);
 useEffect(()=>{
  if(!settings||settings.disabled_for_admin||initialized.current)return;
  window.__indiecutTrackingSettings=settings;
  if(settings.meta_enabled&&settings.meta_pixel_id)initMeta(settings.meta_pixel_id);
  initGoogle(settings);
  if(settings.tiktok_enabled&&settings.tiktok_pixel_id)initTikTok(settings.tiktok_pixel_id);
  if(settings.gtm_enabled&&settings.gtm_container_id)initGtm(settings.gtm_container_id);
  initialized.current=true;
 },[settings]);
 useEffect(()=>{
  if(!settings||settings.disabled_for_admin||!initialized.current||!pathname||pathname.startsWith('/admin')||pathname.startsWith('/api'))return;
  const q=search?.toString();const path=q?`${pathname}?${q}`:pathname;
  const timer=window.setTimeout(()=>{
   trackMarketingPageView(path);
   if(pathname==='/battles/rankings')trackMarketingEvent('RankingsView',{path:pathname});
   else if(/^\/battles\/[^/]+\/artists\/[^/]+/.test(pathname))trackMarketingEvent('ArtistProfileView',{path:pathname});
   else if(pathname==='/battles/submit')trackMarketingEvent('ArtistSubmissionPageView',{path:pathname});
   else if(/^\/battles\/[^/]+$/.test(pathname))trackMarketingEvent('BattleView',{path:pathname});
  },250);
  return()=>window.clearTimeout(timer);
 },[pathname,search,settings]);
 return null;
}
