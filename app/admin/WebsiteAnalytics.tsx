'use client';

import {useEffect,useState} from 'react';

export default function WebsiteAnalytics(){
 const [data,setData]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [range,setRange]=useState('today'),[source,setSource]=useState('all'),[path,setPath]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState('');
 async function load(){setBusy(true);setError('');try{const q=new URLSearchParams({range,source});if(path)q.set('path',path);if(range==='custom'){if(start)q.set('start',start);if(end)q.set('end',end)}const r=await fetch(`/api/admin/website-analytics?${q}`,{cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Unable to load website analytics');setData(j)}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 useEffect(()=>{load()},[]);
 const metric=(v:any)=>v==null?'—':Number(v).toLocaleString();
 const cards=(p:any)=><div className="ic-grid"><article className="ic-stat-card"><strong>{metric(p?.visitors)}</strong><span>Unique Visitors</span></article><article className="ic-stat-card"><strong>{metric(p?.sessions)}</strong><span>Sessions</span></article><article className="ic-stat-card"><strong>{metric(p?.page_views)}</strong><span>Page Views</span></article></div>;
 const table=(title:string,rows:any[])=><div style={{marginTop:22}}><h3>{title}</h3><div style={{display:'grid',gap:8}}>{(rows||[]).map((r:any,i:number)=><div key={`${r.label}-${i}`} style={{display:'flex',justifyContent:'space-between',gap:20,borderBottom:'1px solid #eee',padding:'8px 0'}}><span style={{overflowWrap:'anywhere'}}>{r.label}</span><strong>{metric(r.count)}</strong></div>)}</div>{(!rows||!rows.length)&&<p><small>No data for this filter.</small></p>}</div>;
 return <section className="ic-module-panel" style={{marginBottom:24}}>
  <div className="ic-admin-eyebrow">WEBSITE AUDIENCE</div><h2>Indie Cut Website Traffic</h2><p>First-party traffic analytics for IndieCut itself. Today uses the calendar day in Eastern Time — not the previous 24 hours.</p>
  <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'end',margin:'18px 0'}}>
   <label><small>DATE RANGE</small><br/><select value={range} onChange={e=>setRange(e.target.value)}><option value="today">Today</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="custom">Custom</option></select></label>
   {range==='custom'&&<><label><small>FROM</small><br/><input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label><small>TO</small><br/><input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label></>}
   <label><small>TRAFFIC SOURCE</small><br/><select value={source} onChange={e=>setSource(e.target.value)}><option value="all">All Sources</option>{(data?.available_sources||[]).map((s:string)=><option key={s} value={s}>{s}</option>)}</select></label>
   <label><small>PAGE / ARTICLE</small><br/><input value={path} onChange={e=>setPath(e.target.value)} placeholder="Search page or slug"/></label>
   <button type="button" onClick={load} disabled={busy}>{busy?'LOADING…':'APPLY FILTER'}</button>
  </div>
  {error&&<div className="ic-message">{error}</div>}
  <h3>Today</h3>{cards(data?.today)}<h3 style={{marginTop:22}}>Last 7 Days</h3>{cards(data?.last_7_days)}<h3 style={{marginTop:22}}>Last 30 Days</h3>{cards(data?.last_30_days)}
  <h3 style={{marginTop:28}}>Filtered Results</h3>{cards(data?.selected)}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:28,marginTop:10}}><div>{table('Top Pages',data?.top_pages)}{table('Entry Pages',data?.entry_pages)}</div><div>{table('Traffic Sources',data?.traffic_sources)}{table('Source → Article',data?.article_sources)}{table('Where Visitors Go Next',data?.visitor_paths)}</div></div>
  <h3 style={{marginTop:28}}>Recent Visitor Activity</h3><div style={{display:'grid',gap:8}}>{(data?.recent_activity||[]).map((r:any,i:number)=><div key={i} style={{border:'1px solid #eee',borderRadius:8,padding:10}}><strong>{r.path}</strong><div><small>{r.source} · {new Date(r.created_at).toLocaleString()}</small></div></div>)}</div>
  {data?.generated_at&&<p style={{marginTop:18}}><small>Last refreshed {new Date(data.generated_at).toLocaleString()} · reporting timezone: Eastern Time</small></p>}
 </section>;
}
