'use client';

import {useEffect,useMemo,useState} from 'react';

type VideoLead={artist_name:string;song_title:string;video_title?:string;genre?:string;artist_tier?:'independent'|'major'|'unknown';official_video_url:string;channel_name?:string;release_date?:string;why_feature?:string;momentum_score?:number;thumbnail_url?:string;sources?:string[];discovered_at?:string};

function youtubeEmbed(url?:string){const s=String(url||'');let id='';try{const u=new URL(s);if(u.hostname.includes('youtu.be'))id=u.pathname.replace(/^\//,'').split('/')[0];else if(u.hostname.includes('youtube.com'))id=u.searchParams.get('v')||u.pathname.match(/\/shorts\/([^/?]+)/)?.[1]||''}catch{}return id?`https://www.youtube.com/embed/${id}`:''}

export default function MusicVideoRadar(){
 const [focus,setFocus]=useState('New official music videos across R&B, hip-hop, soul, pop, Afrobeats and adjacent genres, from independent and major artists');
 const [days,setDays]=useState(14);
 const [count,setCount]=useState(12);
 const [videos,setVideos]=useState<VideoLead[]>([]);
 const [busy,setBusy]=useState(false);
 const [actionBusy,setActionBusy]=useState('');
 const [message,setMessage]=useState('');
 const [lastScan,setLastScan]=useState('');
 const independentCount=useMemo(()=>videos.filter(v=>v.artist_tier==='independent').length,[videos]);

 useEffect(()=>{loadLatest()},[]);
 async function loadLatest(){try{const r=await fetch('/api/music-video-radar/scan');const j=await r.json().catch(()=>({}));if(r.ok&&j.scan){setVideos(j.scan.videos||[]);setLastScan(j.scan.scanned_at||'');if(j.scan.focus)setFocus(j.scan.focus);if(j.scan.days)setDays(j.scan.days)}}catch{}}
 async function scan(){setBusy(true);setMessage('Searching official music-video releases and verifying the source…');try{const r=await fetch('/api/music-video-radar/scan',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({focus,days,count})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Music-video scan failed');setVideos(j.videos||[]);setLastScan(j.scanned_at||'');setMessage(`${(j.videos||[]).length} verified music-video lead(s) found.`)}catch(e:any){setMessage(e.message)}finally{setBusy(false)}}
 async function publish(v:VideoLead,index:number){const key=`publish-${index}`;setActionBusy(key);setMessage(`Publishing ${v.artist_name} — ${v.song_title} to Watch…`);try{const r=await fetch('/api/music-video-radar/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'publish_to_watch',video:v})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Publish failed');setMessage(j.message||'Published to Watch.')}catch(e:any){setMessage(e.message)}finally{setActionBusy('')}}
 function fmt(v?:string){if(!v)return '';try{return new Date(v).toLocaleString()}catch{return v}}

 return <section className="ic-module-panel">
  <div className="ic-admin-eyebrow">VIDEO DISCOVERY</div>
  <h2>Music Video Radar</h2>
  <p>Find newly released official music videos from independent and major artists. Indie Cut embeds the artist, label or Vevo upload instead of downloading and re-uploading copyrighted video files.</p>
  <div className="ic-two"><label>Discovery focus<input value={focus} onChange={e=>setFocus(e.target.value)}/></label><label>Release window<select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={3}>Last 3 days</option><option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option></select></label></div>
  <label>Maximum videos<input type="number" min="5" max="20" value={count} onChange={e=>setCount(Math.min(20,Math.max(5,Number(e.target.value)||12)))}/></label>
  <div className="ic-actions"><button onClick={scan} disabled={busy}>{busy?'SCANNING MUSIC VIDEOS…':'FIND NEW MUSIC VIDEOS'}</button><a className="ic-link-button" href="/videos">OPEN WATCH →</a></div>
  {lastScan&&<p><small>Latest scan: {fmt(lastScan)} · {videos.length} leads · {independentCount} independent</small></p>}
  {message&&<div className="ic-message">{message}</div>}
  {videos.length>0&&<div className="ic-agent-results" style={{display:'grid',gap:16,marginTop:18}}>{videos.map((v,i)=>{const embed=youtubeEmbed(v.official_video_url);return <article className="ic-agent-card" key={`${v.official_video_url}-${i}`} style={{alignItems:'flex-start'}}>
   <div style={{flex:1,minWidth:0}}><div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><span className="ic-status-pill">{String(v.artist_tier||'unknown').toUpperCase()}</span><strong>Momentum {Math.max(0,Math.min(100,Number(v.momentum_score||0)))}/100</strong></div><h3>{v.artist_name} — {v.song_title}</h3><p><strong>{v.genre||'Music video'}</strong>{v.channel_name?` · Official source: ${v.channel_name}`:''}{v.release_date?` · ${v.release_date}`:''}</p>{v.why_feature&&<p>{v.why_feature}</p>}
   {embed&&<div style={{margin:'12px 0',maxWidth:760}}><div style={{position:'relative',paddingBottom:'56.25%',height:0,overflow:'hidden',borderRadius:10,background:'#000'}}><iframe src={embed} title={`${v.artist_name} ${v.song_title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen style={{position:'absolute',inset:0,width:'100%',height:'100%',border:0}}/></div></div>}
   <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:8}}><a href={v.official_video_url} target="_blank" rel="noreferrer">Open official video ↗</a>{Array.isArray(v.sources)&&v.sources.slice(0,4).map((u,n)=><a key={u+n} href={u} target="_blank" rel="noreferrer">Source {n+1} ↗</a>)}</div>
   <div className="ic-row-actions" style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}><button disabled={!!actionBusy} onClick={()=>publish(v,i)}>{actionBusy===`publish-${i}`?'PUBLISHING…':'PUBLISH TO WATCH'}</button></div>
   </div>
  </article>})}</div>}
 </section>
}
