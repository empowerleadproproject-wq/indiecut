'use client';

import {useEffect,useState} from 'react';
import {compressImage} from '../../lib/compressImage';
import {createClient as createBrowserClient} from '../../lib/supabase/browser';

type Article=Record<string,any>;
const blank:Article={
 headline:'',subheadline:'',category:'culture',subject_name:'',body:'',featured_media_url:'',
 lead_video_url:'',lead_video_source_url:'',author_name:'Indie Cut Editorial',sources:'',
 verification_status:'verified',status:'draft'
};

function videoLike(url:string){return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url||'')}
function youtubeId(url:string){try{const u=new URL(url);if(u.hostname.includes('youtu.be'))return u.pathname.replace(/^\//,'').split('/')[0];if(u.hostname.includes('youtube.com'))return u.searchParams.get('v')||u.pathname.match(/\/shorts\/([^/?]+)/)?.[1]||u.pathname.match(/\/embed\/([^/?]+)/)?.[1]||''}catch{}return ''}

export default function ArticleManager(){
 const [rows,setRows]=useState<Article[]>([]);
 const [form,setForm]=useState<Article>({...blank});
 const [editingId,setEditingId]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [previews,setPreviews]=useState<Record<string,{url:string;type:string}>>({});

 useEffect(()=>{load()},[]);
 async function load(){
  const r=await fetch('/api/admin/data?section=articles',{cache:'no-store'});const j=await r.json().catch(()=>({}));
  if(r.ok)setRows(j.rows||[]);else setMessage(j.error||'Unable to load articles.');
 }
 function edit(row:Article){
  setEditingId(row.id);setForm({...blank,...row,sources:Array.isArray(row.sources)?row.sources.join('\n'):String(row.sources||'')});setPreviews({});setMessage('Editing article.');window.scrollTo({top:0,behavior:'smooth'});
 }
 function reset(){setEditingId(null);setForm({...blank});setPreviews({});setMessage('')}
 async function upload(field:'featured_media_url'|'lead_video_url',file?:File){
  if(!file)return;setBusy(true);setMessage('Preparing media…');const local=URL.createObjectURL(file);setPreviews(p=>({...p,[field]:{url:local,type:file.type}}));
  try{
   const prepared=file.type.startsWith('image/')?await compressImage(file):file;const mediaType=String(prepared.type||file.type||'application/octet-stream');
   const signRes=await fetch('/api/admin/upload-url',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({fileName:prepared.name||file.name,mime:mediaType,size:prepared.size})});
   const signed=await signRes.json().catch(()=>({}));if(!signRes.ok)throw new Error(signed.error||'Unable to prepare upload');
   setMessage('Uploading media…');const supabase=createBrowserClient();const {error}=await supabase.storage.from(signed.bucket).uploadToSignedUrl(signed.path,signed.token,prepared,{contentType:mediaType});if(error)throw error;
   setForm(f=>({...f,[field]:signed.publicUrl}));setPreviews(p=>({...p,[field]:{url:signed.publicUrl,type:mediaType}}));setMessage(field==='lead_video_url'?'Video uploaded. Click UPDATE ARTICLE to save it.':'Featured image uploaded. Click UPDATE ARTICLE to save it.');
  }catch(e:any){setMessage(e?.message||'Upload failed.')}finally{setBusy(false)}
 }
 async function save(){
  if(!String(form.headline||'').trim())return setMessage('Headline is required.');setBusy(true);setMessage('');
  try{
   const payload={...form,sources:String(form.sources||'').split('\n').map((x:string)=>x.trim()).filter(Boolean)};
   const method=editingId?'PUT':'POST';const body=editingId?{section:'articles',id:editingId,data:payload}:{section:'articles',data:payload};
   const r=await fetch('/api/admin/data',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Save failed');
   setMessage(editingId?'Article updated.':'Article saved.');reset();await load();
  }catch(e:any){setMessage(e?.message||'Save failed.')}finally{setBusy(false)}
 }
 async function publish(row:Article){
  setBusy(true);setMessage('');try{const data={...row,status:'published',verification_status:'verified'};const r=await fetch('/api/admin/data',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({section:'articles',id:row.id,data})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Publish failed');setMessage('Published to Indie Cut.');await load()}catch(e:any){setMessage(e.message)}finally{setBusy(false)}
 }
 async function remove(id:string){if(!confirm('Delete this article?'))return;const r=await fetch(`/api/admin/data?section=articles&id=${encodeURIComponent(id)}`,{method:'DELETE'});const j=await r.json().catch(()=>({}));if(!r.ok)return setMessage(j.error||'Delete failed');if(editingId===id)reset();await load()}

 const featured=previews.featured_media_url?.url||form.featured_media_url||'';
 const leadVideo=previews.lead_video_url?.url||form.lead_video_url||'';
 const yt=youtubeId(leadVideo);
 return <section className="ic-module-panel">
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><div><h2 style={{marginBottom:4}}>{editingId?'Edit Article':'Create Article'}</h2><p style={{marginTop:0}}>Featured image and article video are separate. You can keep the story image and add a video above it.</p></div>{editingId&&<button onClick={reset}>NEW ARTICLE</button>}</div>
  {message&&<div style={{padding:'10px 12px',background:'#f5f5f5',border:'1px solid #ddd',marginBottom:14}}>{message}</div>}
  <label>Headline<input value={form.headline||''} onChange={e=>setForm({...form,headline:e.target.value})}/></label>
  <label>Subheadline<input value={form.subheadline||''} onChange={e=>setForm({...form,subheadline:e.target.value})}/></label>
  <div className="ic-two"><label>Category<select value={form.category||'culture'} onChange={e=>setForm({...form,category:e.target.value})}><option>movies</option><option>tv</option><option>music</option><option>culture</option><option>independent</option><option>celebrity</option></select></label><label>Subject / Person<input value={form.subject_name||''} onChange={e=>setForm({...form,subject_name:e.target.value})}/></label></div>

  <div style={{border:'1px solid #ddd',padding:14,margin:'14px 0'}}><h3 style={{margin:'0 0 8px'}}>Featured Image</h3><p style={{marginTop:0,color:'#666'}}>This stays as the article thumbnail/social image.</p><input type="file" accept="image/*" onChange={e=>upload('featured_media_url',e.target.files?.[0])}/>{featured&&<div className="ic-current-media" style={{marginTop:10}}><strong>Image preview</strong><img src={featured} alt="Featured preview"/></div>}</div>

  <div style={{border:'2px solid #111',padding:14,margin:'14px 0'}}><h3 style={{margin:'0 0 8px'}}>Article Video</h3><p style={{marginTop:0,color:'#555'}}>Upload a video file or paste a YouTube/video URL. This video appears in the article above the featured image.</p><label>Upload video<input type="file" accept="video/*" onChange={e=>upload('lead_video_url',e.target.files?.[0])}/></label><label>Or paste video / YouTube URL<input type="url" value={form.lead_video_url||''} onChange={e=>setForm({...form,lead_video_url:e.target.value})} placeholder="https://youtube.com/watch?v=..."/></label><label>Original video source URL <span style={{fontWeight:400,color:'#777'}}>(optional)</span><input type="url" value={form.lead_video_source_url||''} onChange={e=>setForm({...form,lead_video_source_url:e.target.value})} placeholder="Source/credit link"/></label>{leadVideo&&<div className="ic-current-media" style={{marginTop:10}}><strong>Video preview</strong>{yt?<div style={{position:'relative',paddingBottom:'56.25%',height:0,overflow:'hidden',background:'#000'}}><iframe src={`https://www.youtube.com/embed/${yt}`} title="Video preview" allowFullScreen style={{position:'absolute',inset:0,width:'100%',height:'100%',border:0}}/></div>:videoLike(leadVideo)||previews.lead_video_url?.type?.startsWith('video/')?<video src={leadVideo} controls playsInline style={{width:'100%',maxHeight:500,background:'#000'}}/>:<a href={leadVideo} target="_blank" rel="noreferrer">Open video URL ↗</a>}</div>}</div>

  <label>Article body<textarea rows={12} value={form.body||''} onChange={e=>setForm({...form,body:e.target.value})}/></label>
  <label>Source URLs — one per line<textarea rows={4} value={form.sources||''} onChange={e=>setForm({...form,sources:e.target.value})}/></label>
  <div className="ic-two"><label>Verification<select value={form.verification_status||'pending'} onChange={e=>setForm({...form,verification_status:e.target.value})}><option value="pending">Pending verification</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select></label><label>Status<select value={form.status||'draft'} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label></div>
  <label>Author / Byline<input value={form.author_name||''} onChange={e=>setForm({...form,author_name:e.target.value})}/></label>
  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={save} disabled={busy}>{busy?'SAVING…':editingId?'UPDATE ARTICLE':'SAVE ARTICLE'}</button>{editingId&&<button onClick={reset} disabled={busy}>CANCEL EDIT</button>}</div>

  <hr style={{margin:'32px 0 20px'}}/><h2>Articles</h2>
  <div style={{display:'grid',gap:12}}>{rows.map(row=><article key={row.id} style={{border:'1px solid #ddd',padding:14,display:'grid',gridTemplateColumns:'100px minmax(0,1fr) auto',gap:14,alignItems:'start'}}>{row.featured_media_url?<img src={row.featured_media_url} alt="" style={{width:100,height:78,objectFit:'cover'}}/>:<div style={{width:100,height:78,background:'#eee'}}/>}<div><div style={{fontSize:11,fontWeight:800,letterSpacing:'.08em'}}>{String(row.category||'').toUpperCase()} · {String(row.status||'draft').toUpperCase()}</div><h3 style={{margin:'5px 0'}}>{row.headline}</h3><div style={{fontSize:12,color:'#666'}}>{row.lead_video_url?'🎬 VIDEO ATTACHED':'No article video'} · {row.verification_status||'pending'}</div></div><div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}><button onClick={()=>edit(row)}>EDIT</button>{row.status!=='published'&&<button onClick={()=>publish(row)} disabled={busy}>PUBLISH</button>}<button onClick={()=>remove(row.id)}>DELETE</button></div></article>)}</div>
 </section>
}
