'use client';

import {useEffect,useState} from 'react';

export default function SocialAnalytics(){
 const [data,setData]=useState<any>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');

 async function load(){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/social-agent/analytics',{cache:'no-store'});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(j.error||'Unable to load analytics');
   setData(j);
  }catch(e:any){setError(e.message)}finally{setBusy(false)}
 }

 useEffect(()=>{load()},[]);
 const ig=data?.instagram;
 const fb=data?.facebook;
 const metric=(v:any)=>v===null||v===undefined?'—':Number(v).toLocaleString();

 return <section className="ic-module-panel">
  <div className="ic-admin-eyebrow">LIVE SOCIAL PERFORMANCE</div>
  <h2>Indie Cut Analytics</h2>
  <p>Live Meta data from the connected Indie Cut Facebook Page and Instagram professional account. Refresh anytime to pull the latest numbers.</p>
  <div className="ic-actions"><button type="button" onClick={load} disabled={busy}>{busy?'REFRESHING…':'REFRESH ANALYTICS'}</button></div>
  {error&&<div className="ic-message">{error}</div>}
  {data?.schema_missing&&<div className="ic-message"><strong>One Supabase table is still missing.</strong> Paste the analytics schema I provided into Supabase SQL Editor. Live numbers can still load, but history will not be saved until that table exists.</div>}
  {Array.isArray(data?.warnings)&&data.warnings.map((w:string,i:number)=><div className="ic-message" key={i}>{w}</div>)}

  {ig&&<>
   <h3>Instagram {ig.username?`— @${ig.username}`:''}</h3>
   <div className="ic-grid">
    <article className="ic-stat-card"><strong>{metric(ig.followers)}</strong><span>Followers</span></article>
    <article className="ic-stat-card"><strong>{metric(ig.following)}</strong><span>Following</span></article>
    <article className="ic-stat-card"><strong>{metric(ig.media_count)}</strong><span>Total Posts</span></article>
    <article className="ic-stat-card"><strong>{metric(ig.insights?.reach)}</strong><span>Reach</span></article>
    <article className="ic-stat-card"><strong>{metric(ig.insights?.profile_views)}</strong><span>Profile Views</span></article>
    <article className="ic-stat-card"><strong>{metric(ig.recent_25?.engagements)}</strong><span>Likes + Comments on Recent 25</span></article>
   </div>
   <h3 style={{marginTop:24}}>Recent Instagram Posts</h3>
   <div style={{display:'grid',gap:12}}>{(ig.recent_media||[]).map((m:any)=><article key={m.id} style={{border:'1px solid #ddd',borderRadius:8,padding:14}}>
    <strong>{m.media_type||'POST'}</strong> · {m.timestamp?new Date(m.timestamp).toLocaleString():''}
    <p style={{margin:'8px 0'}}>{String(m.caption||'').slice(0,180)}{String(m.caption||'').length>180?'…':''}</p>
    <small>Likes {metric(m.like_count)} · Comments {metric(m.comments_count)} · Reach {metric(m.insights?.reach)} · Saves {metric(m.insights?.saved)} · Shares {metric(m.insights?.shares)} · Views {metric(m.insights?.views)}</small>
    {m.permalink&&<p><a href={m.permalink} target="_blank" rel="noreferrer">Open post ↗</a></p>}
   </article>)}</div>
  </>}

  {fb&&<><h3 style={{marginTop:28}}>Facebook {fb.name?`— ${fb.name}`:''}</h3><div className="ic-grid"><article className="ic-stat-card"><strong>{metric(fb.followers)}</strong><span>Followers</span></article></div></>}
  {data?.generated_at&&<p style={{marginTop:18}}><small>Last refreshed {new Date(data.generated_at).toLocaleString()}</small></p>}
 </section>;
}
