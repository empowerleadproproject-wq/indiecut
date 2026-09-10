'use client';

import {useEffect,useMemo,useState} from 'react';

type ArtistLead={artist_name:string;genre?:string;city?:string;independence_status?:string;independence_note?:string;why_trending?:string;momentum_score?:number;latest_release?:string;latest_release_url?:string;instagram?:string;tiktok?:string;spotify?:string;youtube?:string;bandcamp?:string;soundcloud?:string;sources?:string[];story_angle?:string;image_url?:string;discovered_at?:string};

export default function IndependentMusicRadar(){
 const [focus,setFocus]=useState('Independent R&B, hip-hop, soul, alternative R&B, Afrobeats and adjacent urban music');
 const [count,setCount]=useState(10);
 const [days,setDays]=useState(30);
 const [artists,setArtists]=useState<ArtistLead[]>([]);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [lastScan,setLastScan]=useState('');
 const confirmed=useMemo(()=>artists.filter(a=>a.independence_status==='confirmed_independent').length,[artists]);

 useEffect(()=>{loadLatest()},[]);
 async function loadLatest(){
  try{const r=await fetch('/api/independent-music/scan');const j=await r.json().catch(()=>({}));if(r.ok&&j.scan){setArtists(j.scan.artists||[]);setLastScan(j.scan.scanned_at||'');if(j.scan.focus)setFocus(j.scan.focus);if(j.scan.days)setDays(j.scan.days)}}catch{}
 }
 async function scan(){
  setBusy(true);setMessage('Searching live music, press, artist and platform signals…');
  try{const r=await fetch('/api/independent-music/scan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({focus,count,days})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Music discovery scan failed');setArtists(j.artists||[]);setLastScan(j.scanned_at||'');setMessage(`${(j.artists||[]).length} artist lead(s) found. ${((j.artists||[]) as ArtistLead[]).filter(a=>a.independence_status==='confirmed_independent').length} confirmed independent.`)}catch(e:any){setMessage(e.message)}finally{setBusy(false)}
 }
 function fmt(v?:string){if(!v)return '';try{return new Date(v).toLocaleString()}catch{return v}}
 function label(v?:string){return v==='confirmed_independent'?'CONFIRMED INDEPENDENT':v==='likely_independent'?'LIKELY INDEPENDENT':v==='label_affiliated'?'LABEL AFFILIATED':'STATUS UNCLEAR'}

 return <section className="ic-module-panel">
  <div className="ic-admin-eyebrow">ARTIST DISCOVERY</div>
  <h2>Independent Music Radar</h2>
  <p>Find rising independent artists with a priority on R&B, hip-hop, soul, alternative R&B, Afrobeats and related urban music. The radar looks for recent momentum and separates confirmed independent artists from uncertain or label-affiliated acts.</p>
  <div className="ic-two"><label>Discovery focus<input value={focus} onChange={e=>setFocus(e.target.value)}/></label><label>Momentum window<select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option><option value={60}>Last 60 days</option></select></label></div>
  <label>Maximum artists<input type="number" min="5" max="20" value={count} onChange={e=>setCount(Math.min(20,Math.max(5,Number(e.target.value)||10)))}/></label>
  <div className="ic-actions"><button onClick={scan} disabled={busy}>{busy?'SCANNING MUSIC SIGNALS…':'FIND TRENDING INDEPENDENT ARTISTS'}</button><a className="ic-link-button" href="/admin/artists">OPEN ARTISTS & PEOPLE →</a></div>
  {lastScan&&<p><small>Latest scan: {fmt(lastScan)} · {artists.length} leads · {confirmed} confirmed independent</small></p>}
  {message&&<div className="ic-message">{message}</div>}
  {artists.length>0&&<div className="ic-agent-results" style={{display:'grid',gap:14,marginTop:18}}>{artists.map((a,i)=><article className="ic-agent-card" key={`${a.artist_name}-${i}`} style={{alignItems:'flex-start'}}>
   {a.image_url&&<img src={a.image_url} alt={a.artist_name} className="ic-agent-thumb"/>}
   <div style={{flex:1}}><div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><span className="ic-status-pill">{label(a.independence_status)}</span><strong>Momentum {Math.max(0,Math.min(100,Number(a.momentum_score||0)))}/100</strong></div><h3>{a.artist_name}</h3><p><strong>{a.genre||'Independent music'}</strong>{a.city?` · ${a.city}`:''}</p>{a.why_trending&&<p>{a.why_trending}</p>}{a.independence_note&&<p><small><strong>Independence check:</strong> {a.independence_note}</small></p>}{a.latest_release&&<p><strong>Latest release:</strong> {a.latest_release}{a.latest_release_url?<> · <a href={a.latest_release_url} target="_blank" rel="noreferrer">Listen ↗</a></>:null}</p>}{a.story_angle&&<p><strong>Indie Cut angle:</strong> {a.story_angle}</p>}<div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:8}}>{a.instagram&&<a href={a.instagram} target="_blank" rel="noreferrer">Instagram ↗</a>}{a.tiktok&&<a href={a.tiktok} target="_blank" rel="noreferrer">TikTok ↗</a>}{a.spotify&&<a href={a.spotify} target="_blank" rel="noreferrer">Spotify ↗</a>}{a.youtube&&<a href={a.youtube} target="_blank" rel="noreferrer">YouTube ↗</a>}{a.bandcamp&&<a href={a.bandcamp} target="_blank" rel="noreferrer">Bandcamp ↗</a>}{a.soundcloud&&<a href={a.soundcloud} target="_blank" rel="noreferrer">SoundCloud ↗</a>}</div>{Array.isArray(a.sources)&&a.sources.length>0&&<div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:8}}>{a.sources.slice(0,5).map((u,n)=><a key={u+n} href={u} target="_blank" rel="noreferrer">Source {n+1} ↗</a>)}</div>}</div>
  </article>)}</div>}
 </section>
}
