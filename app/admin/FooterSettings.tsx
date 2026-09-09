'use client';

import {useEffect,useState} from 'react';

export default function FooterSettings(){
 const [settings,setSettings]=useState<any>({footer_color:'#111111',footer_copy:'Indie Cut'});const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 useEffect(()=>{(async()=>{const r=await fetch('/api/admin/data?section=settings');const j=await r.json();if(r.ok&&j.rows?.[0])setSettings((s:any)=>({...s,...j.rows[0]}));})()},[]);
 async function save(){setBusy(true);setMessage('');try{const r=await fetch('/api/admin/data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({section:'settings',data:settings})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to save footer settings');setMessage('Footer updated across the public site.');}catch(e:any){setMessage(e.message)}finally{setBusy(false)}}
 return <section className="ic-module-panel"><h2>Footer Appearance</h2><p>Control the footer shown across Indie Cut’s public pages.</p><label>Footer color<input type="color" value={settings.footer_color||'#111111'} onChange={e=>setSettings({...settings,footer_color:e.target.value})}/></label><label>Footer copyright / brand text<input type="text" value={settings.footer_copy||''} onChange={e=>setSettings({...settings,footer_copy:e.target.value})}/></label><button onClick={save} disabled={busy}>{busy?'SAVING…':'SAVE FOOTER'}</button>{message&&<div className="ic-message">{message}</div>}</section>
}
