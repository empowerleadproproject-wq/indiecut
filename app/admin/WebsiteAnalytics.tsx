'use client';

import {useEffect,useState} from 'react';

export default function WebsiteAnalytics(){
 const [data,setData]=useState<any>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function load(){setBusy(true);setError('');try{const r=await fetch('/api/admin/website-analytics',{cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Unable to load website analytics');setData(j)}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 useEffect(()=>{load()},[]);
 const metric=(v:any)=>v===null||v===undefined?'—':Number(v).toLocaleString();
 const cards=(period:any)=><div className="ic-grid">
  <article className="ic-stat-card"><strong>{metric(period?.visitors)}</strong><span>Unique Visitors</span></article>
  <article className="ic-stat-card"><strong>{metric(period?.sessions)}</strong><span>Sessions</span></article>
  <article className="ic-stat-card"><strong>{metric(period?.page_views)}</strong><span>Page Views</span></article>
 </div>;
 const table=(title:string,rows:any[],left:string,right:string)=><div style={{marginTop:22}}><h3>{title}</h3><div style={{display:'grid',gap:8}}>{(rows||[]).map((r:any,i:number)=><div key={`${r.label}-${i}`} style={{display:'flex',justifyContent:'space-between',gap:20,borderBottom:'1px solid #eee',padding:'8px 0'}}><span>{r.label}</span><strong>{metric(r.count)}</strong></div>)}</div>{(!rows||rows.length===0)&&<p><small>No data yet.</small></p>}</div>;
 return <section className="ic-module-panel" style={{marginBottom:24}}>
  <div className="ic-admin-eyebrow">WEBSITE AUDIENCE</div><h2>Indie Cut Website Traffic</h2>
  <p>First-party traffic analytics for IndieCut itself: how many people visit, where they came from, what they read, and where they go next.</p>
  <div className="ic-actions"><button type="button" onClick={load} disabled={busy}>{busy?'REFRESHING…':'REFRESH WEBSITE ANALYTICS'}</button></div>
  {error&&<div className="ic-message">{error}</div>}
  <h3>Today</h3>{cards(data?.today)}
  <h3 style={{marginTop:22}}>Last 7 Days</h3>{cards(data?.last_7_days)}
  <h3 style={{marginTop:22}}>Last 30 Days</h3>{cards(data?.last_30_days)}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:28,marginTop:10}}>
   <div>{table('Top Pages',data?.top_pages,'Page','Views')}{table('Entry Pages',data?.entry_pages,'Page','Sessions')}</div>
   <div>{table('Traffic Sources',data?.traffic_sources,'Source','Visits')}{table('Where Visitors Go Next',data?.visitor_paths,'Path','Times')}</div>
  </div>
  <h3 style={{marginTop:28}}>Recent Visitor Activity</h3>
  <div style={{display:'grid',gap:8}}>{(data?.recent_activity||[]).map((r:any,i:number)=><div key={i} style={{border:'1px solid #eee',borderRadius:8,padding:10}}><strong>{r.path}</strong><div><small>{r.source} · {new Date(r.created_at).toLocaleString()}</small></div></div>)}</div>
  {data?.generated_at&&<p style={{marginTop:18}}><small>Last refreshed {new Date(data.generated_at).toLocaleString()}</small></p>}
 </section>;
}
