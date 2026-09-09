'use client';

import {useEffect,useMemo,useState} from 'react';

type Lead={
 id?:string;headline:string;summary:string;category:string;subject_name?:string;why_breaking?:string;
 first_seen_at?:string;source_published_at?:string;urgency_score?:number;verification_status?:string;
 verification_note?:string;sources?:string[];image_url?:string;
};

export default function BreakingNewsRadar(){
 const [focus,setFocus]=useState('Black entertainment, hip-hop, R&B, film, television, celebrities, creators and culture');
 const [hours,setHours]=useState(6);
 const [count,setCount]=useState(8);
 const [leads,setLeads]=useState<Lead[]>([]);
 const [lastScan,setLastScan]=useState('');
 const [busy,setBusy]=useState(false);
 const [drafting,setDrafting]=useState('');
 const [message,setMessage]=useState('');

 const verified=useMemo(()=>leads.filter(x=>x.verification_status==='verified'),[leads]);

 useEffect(()=>{loadLatest()},[]);
 async function loadLatest(){
  try{
   const r=await fetch('/api/breaking-news/scan');const j=await r.json().catch(()=>({}));
   if(r.ok&&j.scan){setLeads(j.scan.leads||[]);setLastScan(j.scan.scanned_at||'');if(j.scan.focus)setFocus(j.scan.focus);if(j.scan.hours)setHours(j.scan.hours)}
  }catch{}
 }

 async function scan(){
  setBusy(true);setMessage('Scanning live sources for newly reported entertainment news…');
  try{
   const r=await fetch('/api/breaking-news/scan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({focus,hours,count})});
   const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Breaking News scan failed');
   setLeads(j.leads||[]);setLastScan(j.scanned_at||'');
   setMessage(`${(j.leads||[]).filter((x:Lead)=>x.verification_status==='verified').length} verified breaking lead(s) found. Nothing was published automatically.`);
  }catch(e:any){setMessage(e.message)}finally{setBusy(false)}
 }

 async function createDraft(lead:Lead,index:number){
  const key=`${index}-${lead.headline}`;setDrafting(key);setMessage('Re-checking the sources and building a review-ready draft…');
  try{
   const r=await fetch('/api/breaking-news/draft',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({lead})});
   const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Unable to create draft');
   setMessage(`Draft created: ${j.headline}. Review it in Articles before publishing.`);
  }catch(e:any){setMessage(e.message)}finally{setDrafting('')}
 }

 function fmt(value?:string){if(!value)return 'Time not supplied';try{return new Date(value).toLocaleString()}catch{return value}}

 return <section className="ic-module-panel">
  <div className="ic-admin-eyebrow">LIVE NEWS DISCOVERY</div>
  <h2>Breaking News Radar</h2>
  <p>This radar searches current public sources for fresh entertainment developments, ranks them by urgency, and separates verified reporting from unconfirmed chatter. It never publishes a story by itself.</p>
  <div className="ic-two">
   <label>Coverage focus<input value={focus} onChange={e=>setFocus(e.target.value)}/></label>
   <label>Freshness window<select value={hours} onChange={e=>setHours(Number(e.target.value))}><option value={2}>Last 2 hours</option><option value={6}>Last 6 hours</option><option value={12}>Last 12 hours</option><option value={24}>Last 24 hours</option></select></label>
  </div>
  <label>Maximum leads<input type="number" min="3" max="12" value={count} onChange={e=>setCount(Math.min(12,Math.max(3,Number(e.target.value)||8)))}/></label>
  <div className="ic-actions"><button onClick={scan} disabled={busy}>{busy?'SCANNING LIVE SOURCES…':'SCAN FOR BREAKING NEWS NOW'}</button><a className="ic-link-button" href="/admin/articles">OPEN ARTICLES →</a></div>
  {lastScan&&<p><small>Latest radar scan: {fmt(lastScan)} · {verified.length} verified lead(s)</small></p>}
  {message&&<div className="ic-message">{message}</div>}

  {leads.length>0&&<div className="ic-agent-results" style={{display:'grid',gap:14,marginTop:18}}>
   {leads.map((lead,index)=>{const good=lead.verification_status==='verified';const key=`${index}-${lead.headline}`;return <article className="ic-agent-card" key={key} style={{alignItems:'flex-start'}}>
    {lead.image_url&&<img src={lead.image_url} alt="Breaking news candidate" className="ic-agent-thumb"/>}
    <div style={{flex:1}}>
     <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><span className="ic-status-pill">{good?'VERIFIED':'NEEDS VERIFICATION'}</span><strong>Urgency {Math.max(0,Math.min(100,Number(lead.urgency_score||0)))}/100</strong></div>
     <h3>{lead.headline}</h3>
     <p>{lead.summary}</p>
     {lead.why_breaking&&<p><strong>Why it matters now:</strong> {lead.why_breaking}</p>}
     <small>{lead.category||'entertainment'}{lead.subject_name?` · ${lead.subject_name}`:''} · Source time: {fmt(lead.source_published_at)}</small>
     {lead.verification_note&&<p><small>{lead.verification_note}</small></p>}
     {Array.isArray(lead.sources)&&lead.sources.length>0&&<div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:8}}>{lead.sources.slice(0,4).map((url,i)=><a key={url+i} href={url} target="_blank" rel="noreferrer">Source {i+1} ↗</a>)}</div>}
    </div>
    <div className="ic-row-actions">{good?<button disabled={drafting===key} onClick={()=>createDraft(lead,index)}>{drafting===key?'BUILDING DRAFT…':'CREATE VERIFIED DRAFT'}</button>:<button disabled title="The radar needs stronger corroboration before drafting">WAIT FOR VERIFICATION</button>}</div>
   </article>})}
  </div>}

  <div className="ic-agent-results" style={{marginTop:18}}><h3>Background monitoring</h3><p>Indie Cut is configured to run the Breaking News Radar automatically on a recurring schedule. New findings are saved here for review; they are not auto-published. This is meant to help you catch a story quickly after credible sources report it, not predict news before it happens.</p></div>
 </section>;
}
