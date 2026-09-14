'use client';

import {useEffect,useMemo,useState} from 'react';
import {compressImage} from '../../lib/compressImage';
import {createClient as createBrowserClient} from '../../lib/supabase/browser';

type MusicRow=Record<string,any>;
const empty={title:'',artist_name:'',description:'',media_url:'',cover_url:'',featured:false,media_type:'music'};

export default function MusicManager(){
 const [rows,setRows]=useState<MusicRow[]>([]);
 const [artistNames,setArtistNames]=useState<string[]>([]);
 const [form,setForm]=useState<MusicRow>(empty);
 const [editingId,setEditingId]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');

 async function load(){
  try{
   const [musicRes,battleRes,profileRes]=await Promise.all([
    fetch('/api/admin/data?section=music',{cache:'no-store'}),
    fetch('/api/admin/battles',{cache:'no-store'}),
    fetch('/api/admin/data?section=artists',{cache:'no-store'})
   ]);
   const music=await musicRes.json().catch(()=>({}));
   const battles=await battleRes.json().catch(()=>({}));
   const profiles=await profileRes.json().catch(()=>({}));
   if(!musicRes.ok)throw new Error(music.error||'Unable to load music.');
   setRows(music.rows||[]);
   const approved=(battles.contests||[]).flatMap((contest:any)=>(contest.entries||[]).filter((entry:any)=>entry.active!==false).map((entry:any)=>String(entry.artist_name||'').trim()));
   const legacy=(profiles.rows||[]).map((artist:any)=>String(artist.name||artist.artist_name||'').trim());
   const names=Array.from(new Set([...approved,...legacy].filter(Boolean))).sort((a,b)=>a.localeCompare(b));
   setArtistNames(names);
  }catch(e:any){setMessage(e?.message||'Unable to load music.')}
 }
 useEffect(()=>{load()},[]);

 async function upload(field:'media_url'|'cover_url',file?:File){
  if(!file)return;
  setBusy(true);setMessage('Preparing upload…');
  try{
   const prepared=file.type.startsWith('image/')?await compressImage(file):file;
   const mediaType=String(prepared.type||file.type||'application/octet-stream');
   const signRes=await fetch('/api/admin/upload-url',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({fileName:prepared.name||file.name,mime:mediaType,size:prepared.size})});
   const signed=await signRes.json().catch(()=>({}));
   if(!signRes.ok)throw new Error(signed.error||'Unable to prepare upload.');
   setMessage('Uploading…');
   const supabase=createBrowserClient();
   const {error}=await supabase.storage.from(signed.bucket).uploadToSignedUrl(signed.path,signed.token,prepared,{contentType:mediaType});
   if(error)throw new Error(error.message||'Upload failed.');
   setForm(current=>({...current,[field]:signed.publicUrl}));
   setMessage('Upload complete.');
  }catch(e:any){setMessage(e?.message||'Upload failed.')}finally{setBusy(false)}
 }

 async function save(){
  if(!String(form.artist_name||'').trim()){setMessage('Select an artist first.');return}
  if(!String(form.title||'').trim()){setMessage('Enter the song title.');return}
  if(!String(form.media_url||'').trim()){setMessage('Upload the music file first.');return}
  setBusy(true);setMessage('Saving music…');
  try{
   const method=editingId?'PUT':'POST';
   const body=editingId?{section:'music',id:editingId,data:{...form,media_type:'music'}}:{section:'music',data:{...form,media_type:'music'}};
   const r=await fetch('/api/admin/data',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(j.error||'Unable to save music.');
   setMessage(editingId?'Music updated.':'Music added.');
   setEditingId(null);setForm(empty);await load();
  }catch(e:any){setMessage(e?.message||'Unable to save music.')}finally{setBusy(false)}
 }

 async function remove(id:string){
  if(!confirm('Delete this music item?'))return;
  const r=await fetch(`/api/admin/data?section=music&id=${encodeURIComponent(id)}`,{method:'DELETE'});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){setMessage(j.error||'Delete failed.');return}
  await load();
 }

 const options=useMemo(()=>{
  const current=String(form.artist_name||'').trim();
  return current&&!artistNames.includes(current)?[current,...artistNames]:artistNames;
 },[artistNames,form.artist_name]);

 return <>
  <section className="ic-module-panel">
   <h2>{editingId?'Edit Music':'Add Music'}</h2>
   <label>Title<input value={form.title||''} onChange={e=>setForm({...form,title:e.target.value})}/></label>
   <label>Artist
    <select value={form.artist_name||''} onChange={e=>setForm({...form,artist_name:e.target.value})}>
     <option value="">Select an artist…</option>
     {options.map(name=><option key={name} value={name}>{name}</option>)}
    </select>
    {!artistNames.length&&<small style={{display:'block',marginTop:6,color:'#777'}}>No artist profiles are available yet. Approve an artist in the Artists section first.</small>}
   </label>
   <div><label>Upload audio or music video</label><input type="file" accept="audio/*,video/*" onChange={e=>upload('media_url',e.target.files?.[0])}/>{form.media_url&&<audio controls preload="none" src={form.media_url} style={{display:'block',width:'100%',marginTop:10}}/>}</div>
   <div><label>Upload cover artwork</label><input type="file" accept="image/*" onChange={e=>upload('cover_url',e.target.files?.[0])}/>{form.cover_url&&<img src={form.cover_url} alt="Cover preview" style={{display:'block',width:180,height:180,objectFit:'cover',marginTop:10}}/>}</div>
   <label>Description<textarea rows={5} value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/></label>
   <div className="ic-actions"><button onClick={save} disabled={busy}>{busy?'SAVING…':editingId?'UPDATE MUSIC':'SAVE MUSIC'}</button>{editingId&&<button className="ic-secondary" onClick={()=>{setEditingId(null);setForm(empty);setMessage('')}}>CANCEL EDIT</button>}</div>
   {message&&<div className="ic-message">{message}</div>}
  </section>
  {rows.length>0&&<section className="ic-module-panel"><h2>Existing Music</h2><div className="ic-admin-list">{rows.map(row=><article key={row.id}><div><strong>{row.title||'Untitled'}</strong><small>{row.artist_name||'No artist selected'}</small></div><div className="ic-row-actions"><button onClick={()=>{setEditingId(row.id);setForm({...empty,...row});window.scrollTo({top:0,behavior:'smooth'})}}>Edit</button><button onClick={()=>remove(row.id)}>Delete</button></div></article>)}</div></section>}
 </>;
}
