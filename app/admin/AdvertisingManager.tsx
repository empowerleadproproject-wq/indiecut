'use client';

import {useEffect,useState} from 'react';
import {createClient as createBrowserClient} from '../../lib/supabase/browser';
import {compressVideoForUpload} from './VideoUploadGuard';

type Ad={_id?:string;advertiser:string;title:string;creative_url:string;creative_media_type:string;destination_url:string;placement:string;start_date:string;end_date:string;active:boolean;created_at?:string};
const empty:Ad={advertiser:'',title:'',creative_url:'',creative_media_type:'',destination_url:'',placement:'right-rail',start_date:'',end_date:'',active:true};

export default function AdvertisingManager(){
 const [rows,setRows]=useState<Ad[]>([]);const [form,setForm]=useState<Ad>({...empty});const [busy,setBusy]=useState(false);const [uploading,setUploading]=useState(false);const [message,setMessage]=useState('');const [preview,setPreview]=useState('');
 async function load(){const r=await fetch('/api/admin/data?section=advertising');const t=await r.text();let j:any={};try{j=JSON.parse(t)}catch{};if(r.ok)setRows(j.rows||[]);else setMessage(j.error||t||'Unable to load ads')}
 useEffect(()=>{load()},[]);
 async function upload(file?:File){if(!file)return;setUploading(true);setMessage('Preparing media…');setPreview(URL.createObjectURL(file));try{
   let prepared:File=file;
   if(file.type.startsWith('video/'))prepared=await compressVideoForUpload(file,setMessage);
   const mediaType=prepared.type||file.type||'application/octet-stream';
   const signRes=await fetch('/api/admin/upload-url',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({fileName:prepared.name||file.name,mime:mediaType,size:prepared.size})});
   const signText=await signRes.text();let signed:any={};try{signed=JSON.parse(signText)}catch{throw new Error(signText||'Unable to prepare upload')};if(!signRes.ok)throw new Error(signed.error||'Unable to prepare upload');
   setMessage('Uploading ad creative…');const supabase=createBrowserClient();const {error}=await supabase.storage.from(signed.bucket).uploadToSignedUrl(signed.path,signed.token,prepared,{contentType:mediaType});if(error)throw error;
   setForm(f=>({...f,creative_url:signed.publicUrl,creative_media_type:mediaType}));setPreview(signed.publicUrl);setMessage('Upload complete. Click SAVE AD.');
 }catch(e:any){setMessage(e?.message||'Upload failed');setForm(f=>({...f,creative_url:'',creative_media_type:''}))}finally{setUploading(false)}}
 async function save(e:React.FormEvent){e.preventDefault();if(uploading){setMessage('Wait for the video upload to finish before saving.');return}if(!form.creative_url){setMessage('Upload the ad image or video first.');return}setBusy(true);setMessage('Saving advertisement…');try{const r=await fetch('/api/admin/data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({section:'advertising',data:form})});const t=await r.text();let j:any={};try{j=JSON.parse(t)}catch{};if(!r.ok)throw new Error(j.error||t||'Save failed');setForm({...empty});setPreview('');setMessage('Advertisement saved and activated.');await load()}catch(e:any){setMessage(e?.message||'Save failed')}finally{setBusy(false)}}
 async function remove(id?:string){if(!id||!confirm('Delete this ad?'))return;const r=await fetch(`/api/admin/data?section=advertising&id=${encodeURIComponent(id)}`,{method:'DELETE'});if(!r.ok){setMessage('Delete failed');return}await load()}
 const isVideo=(form.creative_media_type||'').startsWith('video/');
 return <section className="ic-module-panel"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,marginBottom:18}}><div><h2 style={{margin:0}}>Advertising</h2><p style={{margin:'6px 0 0'}}>Same workflow as Hungry Plate: upload the creative, preview it, then save the ad.</p></div></div>
 <form onSubmit={save} style={{display:'grid',gap:14}}>
  <label>Advertiser<input value={form.advertiser} onChange={e=>setForm({...form,advertiser:e.target.value})} required/></label>
  <label>Campaign / Ad title<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
  <div><label>Ad creative — image or video</label>{preview&&<div style={{margin:'8px 0 12px',maxWidth:720}}>{isVideo||preview.startsWith('blob:')?<video src={preview} controls playsInline style={{width:'100%',maxHeight:420,background:'#000'}}/>:<img src={preview} alt="Ad preview" style={{maxWidth:'100%',maxHeight:420,objectFit:'contain'}}/>}</div>}<label style={{display:'inline-block',padding:'11px 15px',background:'#111',color:'#fff',fontWeight:800,cursor:'pointer'}}>{uploading?'UPLOADING…':'UPLOAD IMAGE / VIDEO'}<input type="file" accept="image/*,video/*" style={{display:'none'}} disabled={uploading} onChange={e=>upload(e.target.files?.[0])}/></label></div>
  <label>Destination URL<input type="url" value={form.destination_url} onChange={e=>setForm({...form,destination_url:e.target.value})}/></label>
  <label>Placement<select value={form.placement} onChange={e=>setForm({...form,placement:e.target.value})}><option value="right-rail">Right rail</option><option value="homepage">Homepage</option><option value="article-inline">Article inline</option><option value="article-top">Article top</option></select></label>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><label>Start date<input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label><label>End date<input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></label></div>
  <label><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Active campaign</label>
  <button type="submit" disabled={busy||uploading} style={{width:150}}>{busy?'SAVING…':'SAVE AD'}</button>
  {message&&<div className="ic-message">{message}</div>}
 </form>
 <div style={{marginTop:34,borderTop:'1px solid #ddd',paddingTop:20}}><h2>Existing Ad Units</h2>{rows.map(r=><article key={r._id} style={{display:'grid',gridTemplateColumns:'110px 1fr auto',gap:16,alignItems:'center',padding:'14px 0',borderBottom:'1px solid #eee'}}>{r.creative_url?<div>{String(r.creative_media_type||'').startsWith('video/')?<video src={r.creative_url} muted playsInline style={{width:100,height:70,objectFit:'cover',background:'#000'}}/>:<img src={r.creative_url} alt="" style={{width:100,height:70,objectFit:'cover'}}/>}</div>:<div/>}<div><strong>{r.title||r.advertiser||'Advertisement'}</strong><div style={{fontSize:12,color:'#666',marginTop:4}}>{r.placement} · {r.active?'Active':'Inactive'} · {r.creative_media_type||'media'}</div></div><button type="button" onClick={()=>remove(r._id)}>Delete</button></article>)}</div>
 </section>
}
