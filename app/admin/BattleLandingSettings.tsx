'use client';

import {useEffect,useState} from 'react';

const defaults={
 headline:'WHERE INDEPENDENT ARTISTS BATTLE FOR THE CROWN.',
 subheadline:'Two artists. One stage. The fans decide who moves forward.',
 primary_button:'ENTER THE BATTLE ROOM',
 artist_prompt:"Independent artist? Think you've got what it takes?",
 artist_copy:'Submit your music for a chance to compete in the next Indie Cut Battle.',
 secondary_button:'SUBMIT YOUR MUSIC',
 submission_open:true,
 images:['','','','','','','']
};

async function upload(file?:File){
 if(!file)return'';
 const form=new FormData();form.append('file',file);
 const r=await fetch('/api/admin/upload',{method:'POST',body:form});
 const j=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(j.error||'Upload failed');
 return String(j.publicUrl||'');
}

export default function BattleLandingSettings(){
 const [form,setForm]=useState<any>(defaults);const [busy,setBusy]=useState('');const [message,setMessage]=useState('');
 useEffect(()=>{(async()=>{try{const r=await fetch('/api/admin/data?section=battle-landing',{cache:'no-store'});const j=await r.json();const saved=j.rows?.[0]||{};setForm({...defaults,...saved,images:Array.from({length:7},(_,i)=>saved.images?.[i]||'')})}catch{}})()},[]);
 async function save(){setBusy('save');setMessage('');try{const r=await fetch('/api/admin/data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({section:'battle-landing',data:form})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Unable to save');setMessage('Battle landing page updated.')}catch(e:any){setMessage(e.message)}finally{setBusy('')}}
 async function image(index:number,file?:File){if(!file)return;setBusy(`image-${index}`);setMessage('');try{const url=await upload(file);const images=[...form.images];images[index]=url;setForm({...form,images});setMessage(`Floating image ${index+1} uploaded. Click SAVE LANDING PAGE.`)}catch(e:any){setMessage(e.message)}finally{setBusy('')}}
 return <section className="ic-module-panel" style={{marginBottom:24}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'start',flexWrap:'wrap'}}><div><h2 style={{margin:'0 0 6px'}}>Live Battles Front Door</h2><p style={{margin:0,maxWidth:760}}>Control the first page fans see after clicking LIVE BATTLES: the headline, calls to action and the floating animated photography.</p></div><a href="/battles" target="_blank" style={{fontWeight:900}}>VIEW LANDING PAGE ↗</a></div>
  <div style={{display:'grid',gap:14,marginTop:20}}>
   <label>Headline<input value={form.headline||''} onChange={e=>setForm({...form,headline:e.target.value})}/></label>
   <label>Subheadline<input value={form.subheadline||''} onChange={e=>setForm({...form,subheadline:e.target.value})}/></label>
   <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><label>Main button text<input value={form.primary_button||''} onChange={e=>setForm({...form,primary_button:e.target.value})}/></label><label>Artist link text<input value={form.secondary_button||''} onChange={e=>setForm({...form,secondary_button:e.target.value})}/></label></div>
   <label>Artist prompt<input value={form.artist_prompt||''} onChange={e=>setForm({...form,artist_prompt:e.target.value})}/></label>
   <label>Artist submission copy<textarea rows={2} value={form.artist_copy||''} onChange={e=>setForm({...form,artist_copy:e.target.value})}/></label>
   <label style={{display:'flex',gap:10,alignItems:'center',fontWeight:800}}><input type="checkbox" checked={!!form.submission_open} onChange={e=>setForm({...form,submission_open:e.target.checked})} style={{width:'auto'}}/> Artist submissions are open</label>
   <div><strong style={{display:'block',marginBottom:8}}>Floating images</strong><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:10}}>{form.images.map((url:string,i:number)=><div key={i} style={{border:'1px solid #ddd',padding:10,background:'#fafafa'}}>{url?<img src={url} alt="" style={{width:'100%',height:110,objectFit:'cover',display:'block',marginBottom:8}}/>:<div style={{height:110,display:'grid',placeItems:'center',background:'#eee',color:'#777',marginBottom:8}}>Image {i+1}</div>}<input value={url} onChange={e=>{const images=[...form.images];images[i]=e.target.value;setForm({...form,images})}} placeholder="Image URL"/><input type="file" accept="image/*" onChange={e=>image(i,e.target.files?.[0])} disabled={!!busy}/></div>)}</div></div>
   <button onClick={save} disabled={!!busy}>{busy==='save'?'SAVING…':'SAVE LANDING PAGE'}</button>
   {message&&<div className="ic-message">{message}</div>}
  </div>
 </section>
}
