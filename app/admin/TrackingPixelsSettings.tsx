'use client';

import {useEffect,useState} from 'react';

type Settings={
 meta_enabled:boolean;meta_pixel_id:string;
 ga4_enabled:boolean;ga4_measurement_id:string;
 google_ads_enabled:boolean;google_ads_id:string;google_ads_conversion_label:string;
 tiktok_enabled:boolean;tiktok_pixel_id:string;
 gtm_enabled:boolean;gtm_container_id:string;
};
const EMPTY:Settings={meta_enabled:false,meta_pixel_id:'',ga4_enabled:false,ga4_measurement_id:'',google_ads_enabled:false,google_ads_id:'',google_ads_conversion_label:'',tiktok_enabled:false,tiktok_pixel_id:'',gtm_enabled:false,gtm_container_id:''};

export default function TrackingPixelsSettings(){
 const [settings,setSettings]=useState<Settings>(EMPTY);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 useEffect(()=>{fetch('/api/admin/tracking-pixels',{cache:'no-store'}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to load settings');setSettings({...EMPTY,...j})}).catch(e=>setMessage(e.message))},[]);
 function patch(key:keyof Settings,value:any){setSettings(s=>({...s,[key]:value}))}
 async function save(){setBusy(true);setMessage('');try{const r=await fetch('/api/admin/tracking-pixels',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(settings)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Unable to save tracking settings');setSettings(j.settings);setMessage('Tracking settings saved. New public visits will use these pixels immediately.')}catch(e:any){setMessage(e.message)}finally{setBusy(false)}}
 function testPixels(){window.open('/battles/rankings?pixel_test=1','_blank','noopener,noreferrer')}
 const provider=(title:string,description:string,enabledKey:keyof Settings,idKey:keyof Settings,placeholder:string,extra?:React.ReactNode)=><article className="ic-module-panel" style={{marginBottom:16}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:20,alignItems:'start',flexWrap:'wrap'}}><div><h2 style={{margin:'0 0 6px'}}>{title}</h2><p style={{margin:0,maxWidth:760}}>{description}</p></div><label style={{display:'flex',alignItems:'center',gap:8,fontWeight:900}}><input style={{width:'auto'}} type="checkbox" checked={Boolean(settings[enabledKey])} onChange={e=>patch(enabledKey,e.target.checked)}/> ENABLED</label></div>
  <label style={{display:'block',marginTop:18}}>Tracking ID<input value={String(settings[idKey]||'')} onChange={e=>patch(idKey,e.target.value)} placeholder={placeholder}/></label>{extra}
 </article>;
 const anyEnabled=settings.meta_enabled||settings.ga4_enabled||settings.google_ads_enabled||settings.tiktok_enabled||settings.gtm_enabled;
 return <>
  <section className="ic-module-panel" style={{marginBottom:18}}><div className="ic-admin-eyebrow">RETARGETING + ATTRIBUTION</div><h2>Tracking & Pixels</h2><p>Add your platform IDs here — no code required. Indie Cut loads enabled pixel libraries sitewide. While you are signed into the admin account, normal marketing events are suppressed so your own browsing does not build retargeting audiences.</p><p><strong>Built-in events:</strong> page views, battle views, artist profile views, rankings views, votes, shares, submission-page visits and completed artist submissions.</p><p style={{marginBottom:0}}><strong>Need to verify a pixel?</strong> Save your settings, then use Test Enabled Pixels below. That opens a one-time admin test page so Meta Pixel Helper, GA DebugView, TikTok Pixel Helper and similar tools can see a real test event.</p></section>
  {provider('Meta Pixel','Build Facebook and Instagram retargeting audiences from Indie Cut visitors.','meta_enabled','meta_pixel_id','123456789012345')}
  {provider('Google Analytics 4','Send page views and Indie Cut engagement events into GA4.','ga4_enabled','ga4_measurement_id','G-XXXXXXXXXX')}
  {provider('Google Ads','Use the Google Ads tag for remarketing and submission conversions.','google_ads_enabled','google_ads_id','AW-123456789',<label style={{display:'block',marginTop:12}}>Submission conversion label <span style={{fontWeight:400,color:'#666'}}>(optional)</span><input value={settings.google_ads_conversion_label} onChange={e=>patch('google_ads_conversion_label',e.target.value)} placeholder="AbCdEfGhIjKlMnOp"/></label>)}
  {provider('TikTok Pixel','Build TikTok audiences and track visitor activity on battles and artist pages.','tiktok_enabled','tiktok_pixel_id','C1234567890ABCDEF')}
  {provider('Google Tag Manager','Use GTM if you want to manage additional tags and marketing scripts from Google Tag Manager.','gtm_enabled','gtm_container_id','GTM-XXXXXXX')}
  {message&&<div className="ic-message" style={{marginBottom:16}}>{message}</div>}
  <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:28}}><button type="button" onClick={save} disabled={busy}>{busy?'SAVING…':'SAVE TRACKING SETTINGS'}</button><button type="button" onClick={testPixels} disabled={!anyEnabled||busy} style={{background:'#fff',color:'#111',border:'1px solid #111'}}>TEST ENABLED PIXELS ↗</button></div>
 </>;
}
