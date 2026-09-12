export type MarketingEventParams=Record<string,string|number|boolean|null|undefined>;

declare global {
  interface Window {
    fbq?:any;
    gtag?:any;
    ttq?:any;
    dataLayer?:any[];
    __indiecutTrackingSettings?:any;
  }
}

function suppressed(){
  return Boolean(typeof window!=='undefined'&&window.__indiecutTrackingSettings?.suppress_events);
}

export function trackMarketingEvent(name:string,params:MarketingEventParams={}){
  if(typeof window==='undefined'||suppressed())return;
  const clean=Object.fromEntries(Object.entries(params).filter(([,v])=>v!==undefined&&v!==null));
  try{if(typeof window.fbq==='function')window.fbq('trackCustom',name,clean)}catch{}
  try{if(typeof window.gtag==='function')window.gtag('event',name,clean)}catch{}
  try{if(window.ttq?.track)window.ttq.track(name,clean)}catch{}
  try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:name,...clean})}catch{}
  try{
    const s=window.__indiecutTrackingSettings;
    if(name==='ArtistSubmissionCompleted'&&s?.google_ads_enabled&&s?.google_ads_id&&s?.google_ads_conversion_label&&typeof window.gtag==='function'){
      window.gtag('event','conversion',{send_to:`${s.google_ads_id}/${s.google_ads_conversion_label}`});
    }
  }catch{}
}

export function trackMarketingPageView(path:string){
  if(typeof window==='undefined'||suppressed())return;
  try{if(typeof window.fbq==='function')window.fbq('track','PageView')}catch{}
  try{if(typeof window.gtag==='function')window.gtag('event','page_view',{page_path:path,page_location:window.location.href,page_title:document.title})}catch{}
  try{if(window.ttq?.page)window.ttq.page()}catch{}
  try{window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'page_view',page_path:path,page_title:document.title})}catch{}
}
