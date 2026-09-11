'use client';

import {useEffect,useMemo,useState} from 'react';

type Lead={
 id?:string;headline:string;summary:string;category:string;subject_name?:string;why_breaking?:string;
 first_seen_at?:string;source_published_at?:string;urgency_score?:number;verification_status?:string;
 verification_note?:string;sources?:string[];image_url?:string;
};

export default function BreakingNewsRadar(){
 const [focus,setFocus]=useState('Black entertainment, hip-hop, R&B, film, television, celebrities, creators and culture');
 const [hours,setHours]=useState(12);
 const [count,setCount]=useState(8);
 const [leads,setLeads]=useState<Lead[]>([]);
 const [lastScan,setLastScan]=useState('');
 const [busy,setBusy]=useState(false);
 const [working,setWorking]=useState('');
 const [message,setMessage]=useState('');

 const verified=useMemo(()=>leads.filter(x=>x.verification_status==='verified'),[leads]);

 useEffect(()=>{loadLatest()},[]);
 async function loadLatest(){
  try{
   const r=await fetch('/api/breaking-news/scan');const j=await r.json().catch(()=>({}));
   if(r.ok&&j.scan){setLeads(j.scan.leads||[]);setLastScan(j.scan.scanned_at||'');if(j.scan.focus)setFocus(j.scan.focus);if(j.scan.hours)setHours(j.scan.hours);if(j.scan.count)setCount(j.scan.count)}
  }catch{}
 }

 async function scan(){
  setBusy(true);setMessage('Scanning live sources for current entertainment news…');
  try{
   const r=await fetch('/api/breaking-news/scan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({focus,hours,count})});
   const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Breaking News scan failed');
   setLeads(j.leads||[]);setLastScan(j.scanned_at||'');
   setMessage(`${j.new_leads||0} new lead(s) added. ${(j.leads||[]).length} story lead(s) are now waiting for review.`);
  }catch(e:any){setMessage(e.message)}finally{setBusy(false)}
 }

 async function removeLead(lead:Lead){
  const key=`delete-${lead.id||lead.headline}`;setWorking(key);setMessage('Removing story from the breaking-news queue…');
  try{
   const r=await fetch('/api/breaking-news/scan',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({id:lead.id,headline:lead.headline})});
   const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Unable to delete lead');
   setLeads(j.leads||[]);setMessage('Story removed. The radar will not add the same headline back again.');
  }catch(e:any){setMessage(e.message)}finally{setWorking('')}
 }

 async function createDraft(lead:Lead){
  const key=`draft-${lead.id||lead.headline}`;setWorking(key);setMessage('Re-checking the sources and building a review-ready draft…');
  try{
   const r=await fetch('/api/breaking-news/draft',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lead,publish:false})});
   const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Unable to create draft');
   await removeLeadAfterAction(lead);
   setMessage(`Draft created: ${j.headline}. Open Articles to edit or publish it.`);
  }catch(e:any){setMessage(e.message)}finally{setWorking('')}
 }

 async function publishLead(lead:Lead){
  const key=`publish-${lead.id||lead.headline}`;setWorking(key);setMessage('Re-verifying this story and preparing it for publication…');
  try{
   const r=await fetch('/api/breaking-news/draft',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lead,publish:true})});
   const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Unable to publish story');
   let socialText='';
   try{
    const sr=await fetch('/api/social-agent/publish',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({article_id:j.id})});
    const sj=await sr.json().catch(()=>({}));
    if(sr.ok){const fb=sj?.results?.facebook,ig=sj?.results?.instagram;socialText=` Facebook: ${fb?.ok?'POSTED':fb?.reason||'SKIPPED'}. Instagram: ${ig?.ok?'POSTED':ig?.reason||'SKIPPED'}.`}
   }catch{}
   await removeLeadAfterAction(lead);
   setMessage(`Published: ${j.headline}.${socialText}`);
  }catch(e:any){setMessage(e.message)}finally{setWorking('')}
 }

 async function removeLeadAfterAction(lead:Lead){
  const r=await fetch('/api/breaking-news/scan',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({id:lead.id,headline:lead.headline})});
  const j=await r.json().catch(()=>({}));if(r.ok)setLeads(j.leads||[]);
 }

 function fmt(value?:string){if(!value)return 'Time not supplied';try{return new Date(value).toLocaleString()}catch{return value}}

 return <section className="ic-module-panel">
  <div className="ic-admin-eyebrow">LIVE NEWS DISCOVERY</div>
  <h2>Breaking News Queue</h2>
  <p>Indie Cut automatically searches current entertainment sources and keeps a rolling queue of stories for you. Review each lead, then publish it, create a draft for editing, or delete it.</p>
  <div className="ic-two">
   <label>Coverage focus<input value={focus} onChange={e=>setFocus(e.target.value)}/></label>
   <label>Freshness window<select value={hours} onChange={e=>setHours(Number(e.target.value))}><option value={2}>Last 2 hours</option><option value={6}>Last 6 hours</option><option value={12}>Last 12 hours</option><option value={24}>Last 24 hours</option></select></label>
  </div>
  <label>Maximum new leads per scan<input type="number" min="5" max="10" value={count} onChange={e=>setCount(Math.min(10,Math.max(5,Number(e.target.value)||8)))}/></label>
  <div className="ic-actions"><button onClick={scan} disabled={busy}>{busy?'SCANNING LIVE SOURCES…':'SCAN FOR BREAKING NEWS NOW'}</button><a className="ic-link-button" href="/admin/articles">OPEN ARTICLES →</a></div>
  {lastScan&&<p><small>Latest radar scan: {fmt(lastScan)} · {leads.length} waiting · {verified.length} already verified</small></p>}
  {message&&<div className="ic-message">{message}</div>}

  {leads.length===0&&<div className="ic-agent-results" style={{marginTop:18}}><strong>No leads are waiting right now.</strong><p>The next automatic scan will add current entertainment stories here, or use “Scan for Breaking News Now” for an immediate search.</p></div>}

  {leads.length>0&&<div className="ic-agent-results" style={{display:'grid',gap:14,marginTop:18}}>
   {leads.map((lead,index)=>{const good=lead.verification_status==='verified';const id=lead.id||`${index}-${lead.headline}`;const publishing=working===`publish-${id}`,drafting=working===`draft-${id}`,deleting=working===`delete-${id}`;return <article className="ic-agent-card" key={id} style={{alignItems:'flex-start'}}>
    {lead.image_url&&<img src={lead.image_url} alt="Breaking news candidate" className="ic-agent-thumb"/>}
    <div style={{flex:1}}>
     <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><span className="ic-status-pill">{good?'VERIFIED':'NEEDS RE-CHECK'}</span><strong>Urgency {Math.max(0,Math.min(100,Number(lead.urgency_score||0)))}/100</strong></div>
     <h3>{lead.headline}</h3>
     <p>{lead.summary}</p>
     {lead.why_breaking&&<p><strong>Why it matters now:</strong> {lead.why_breaking}</p>}
     <small>{lead.category||'entertainment'}{lead.subject_name?` · ${lead.subject_name}`:''} · Source time: {fmt(lead.source_published_at)}</small>
     {lead.verification_note&&<p><small>{lead.verification_note}</small></p>}
     {Array.isArray(lead.sources)&&lead.sources.length>0&&<div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:8}}>{lead.sources.slice(0,4).map((url,i)=><a key={url+i} href={url} target="_blank" rel="noreferrer">Source {i+1} ↗</a>)}</div>}
    </div>
    <div className="ic-row-actions" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
     <button disabled={Boolean(working)} onClick={()=>publishLead(lead)}>{publishing?'VERIFYING & PUBLISHING…':'PUBLISH NOW'}</button>
     <button disabled={Boolean(working)} onClick={()=>createDraft(lead)}>{drafting?'BUILDING DRAFT…':'CREATE DRAFT'}</button>
     <button disabled={Boolean(working)} onClick={()=>removeLead(lead)}>{deleting?'DELETING…':'DELETE'}</button>
    </div>
   </article>})}
  </div>}

  <div className="ic-agent-results" style={{marginTop:18}}><h3>Background monitoring</h3><p>The radar now runs on a controlled schedule instead of continuously. Each automatic scan adds new stories to this queue without erasing the stories already waiting for your decision. Deleted or published leads are removed from the queue.</p></div>
 </section>;
}
