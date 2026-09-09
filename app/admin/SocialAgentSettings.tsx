'use client';

import {useEffect,useState} from 'react';

type Settings={enabled:boolean;auto_post_on_publish:boolean;facebook:boolean;instagram:boolean;tiktok:boolean;caption_style:string;include_link:boolean;include_hashtags:boolean};
const defaults:Settings={enabled:false,auto_post_on_publish:false,facebook:true,instagram:true,tiktok:false,caption_style:'Write a concise, energetic entertainment caption in Indie Cut voice. No clickbait, no rumors, no invented claims.',include_link:true,include_hashtags:true};

export default function SocialAgentSettings(){
 const [settings,setSettings]=useState<Settings>(defaults);const [status,setStatus]=useState<any>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 useEffect(()=>{(async()=>{const [s,c]=await Promise.all([fetch('/api/admin/data?section=social-agent'),fetch('/api/social-agent/status')]);const sj=await s.json();const cj=await c.json();if(s.ok&&sj.rows?.[0])setSettings({...defaults,...sj.rows[0]});if(c.ok)setStatus(cj);})()},[]);
 async function save(){setBusy(true);setMessage('');try{const r=await fetch('/api/admin/data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({section:'social-agent',data:settings})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to save social settings');setMessage('Social Media Agent settings saved.');}catch(e:any){setMessage(e.message)}finally{setBusy(false)}}
 return <section className="ic-module-panel"><h2>Social Media Agent</h2><p>Automatically turn published Indie Cut stories into platform-ready social posts. The article stays the source of truth; the agent only promotes published content.</p>
  <label className="ic-check"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings({...settings,enabled:e.target.checked})}/> Enable Social Media Agent</label>
  <label className="ic-check"><input type="checkbox" checked={settings.auto_post_on_publish} onChange={e=>setSettings({...settings,auto_post_on_publish:e.target.checked})}/> Automatically post when an article is published</label>
  <div className="ic-two"><label className="ic-check"><input type="checkbox" checked={settings.facebook} onChange={e=>setSettings({...settings,facebook:e.target.checked})}/> Facebook</label><label className="ic-check"><input type="checkbox" checked={settings.instagram} onChange={e=>setSettings({...settings,instagram:e.target.checked})}/> Instagram</label></div>
  <label className="ic-check"><input type="checkbox" checked={settings.tiktok} onChange={e=>setSettings({...settings,tiktok:e.target.checked})}/> TikTok</label>
  <label>Caption instructions<textarea rows={5} value={settings.caption_style} onChange={e=>setSettings({...settings,caption_style:e.target.value})}/></label>
  <div className="ic-two"><label className="ic-check"><input type="checkbox" checked={settings.include_link} onChange={e=>setSettings({...settings,include_link:e.target.checked})}/> Include article link</label><label className="ic-check"><input type="checkbox" checked={settings.include_hashtags} onChange={e=>setSettings({...settings,include_hashtags:e.target.checked})}/> Add relevant hashtags</label></div>
  <button onClick={save} disabled={busy}>{busy?'SAVING…':'SAVE SOCIAL AGENT'}</button>{message&&<div className="ic-message">{message}</div>}
  <div className="ic-agent-results"><h3>Platform connections</h3><p><strong>Facebook:</strong> {status?.facebook?'Connected':'Needs Meta Page credentials in Vercel'}</p><p><strong>Instagram:</strong> {status?.instagram?'Connected':'Needs Instagram Business/Creator credentials in Vercel'}</p><p><strong>TikTok:</strong> {status?.tiktok?'Connected':'Needs TikTok Content Posting authorization/app approval'}</p><small>Secrets are never stored in the Back Office. Connection credentials stay in Vercel environment variables.</small></div>
 </section>;
}
