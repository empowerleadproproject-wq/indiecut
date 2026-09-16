'use client';

import {useEffect,useState} from 'react';
import {createClient as createBrowserClient} from '../../lib/supabase/browser';
import {compressVideoForUpload} from './VideoUploadGuard';

type TargetMode='global'|'local'|'both';
type Ad={
 _id?:string;
 advertiser:string;
 title:string;
 creative_url:string;
 creative_media_type:string;
 destination_url:string;
 placement:string;
 start_date:string;
 end_date:string;
 active:boolean;
 created_at?:string;
 target_mode:TargetMode;
 target_zip:string;
 target_city:string;
 target_region:string;
 radius_miles:number;
 target_latitude:string;
 target_longitude:string;
};

const empty:Ad={
 advertiser:'',title:'',creative_url:'',creative_media_type:'',destination_url:'',placement:'video-midroll',
 start_date:'',end_date:'',active:true,target_mode:'global',target_zip:'',target_city:'',target_region:'',
 radius_miles:20,target_latitude:'',target_longitude:''
};

function normalizeMode(value:any):TargetMode{
 return value==='local'||value==='both'?value:'global';
}

function audienceSummary(ad:Ad){
 if(ad.target_mode==='global')return 'Global';
 const place=[ad.target_city,ad.target_region,ad.target_zip].filter(Boolean).join(' · ')||'Local area';
 const radius=`${Math.max(1,Number(ad.radius_miles)||20)} mi`;
 return ad.target_mode==='both'?`Both — global + ${place} ${radius} priority`:`Local — ${place} ${radius}`;
}

export default function AdvertisingManager(){
 const [rows,setRows]=useState<Ad[]>([]);
 const [form,setForm]=useState<Ad>({...empty});
 const [busy,setBusy]=useState(false);
 const [uploading,setUploading]=useState(false);
 const [message,setMessage]=useState('');
 const [preview,setPreview]=useState('');

 async function load(){
  const r=await fetch('/api/admin/data?section=advertising');
  const t=await r.text();
  let j:any={};try{j=JSON.parse(t)}catch{}
  if(r.ok)setRows((j.rows||[]).map((x:any)=>({...empty,...x,target_mode:normalizeMode(x.target_mode)})));
  else setMessage(j.error||t||'Unable to load ads');
 }
 useEffect(()=>{load()},[]);

 async function upload(file?:File){
  if(!file)return;
  setUploading(true);setMessage('Preparing media…');setPreview(URL.createObjectURL(file));
  try{
   let prepared=file;
   if(file.type.startsWith('video/'))prepared=await compressVideoForUpload(file,setMessage);
   const mediaType=prepared.type||file.type||'application/octet-stream';
   const signRes=await fetch('/api/admin/upload-url',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({fileName:prepared.name||file.name,mime:mediaType,size:prepared.size})});
   const signText=await signRes.text();let signed:any={};
   try{signed=JSON.parse(signText)}catch{throw new Error(signText||'Unable to prepare upload')}
   if(!signRes.ok)throw new Error(signed.error||'Unable to prepare upload');
   setMessage(signed.provider==='r2'?'Uploading directly to Cloudflare R2…':'Uploading media…');
   if(signed.provider==='r2'){
    const put=await fetch(signed.signedUrl,{method:'PUT',headers:{'Content-Type':mediaType},body:prepared});
    if(!put.ok)throw new Error(`R2 upload failed (${put.status}). Check the R2 bucket CORS settings.`);
   }else{
    const supabase=createBrowserClient();
    const {error}=await supabase.storage.from(signed.bucket).uploadToSignedUrl(signed.path,signed.token,prepared,{contentType:mediaType});
    if(error)throw error;
   }
   setForm(f=>({...f,creative_url:signed.publicUrl,creative_media_type:mediaType}));
   setPreview(signed.publicUrl);
   setMessage(`Upload complete${signed.provider==='r2'?' — stored in Cloudflare R2':''}. Click SAVE AD.`);
  }catch(e:any){
   setMessage(e?.message||'Upload failed');
   setForm(f=>({...f,creative_url:'',creative_media_type:''}));
  }finally{setUploading(false)}
 }

 async function lookupZip(){
  if(!form.target_zip.trim())return setMessage('Enter the ZIP code you want to target.');
  setBusy(true);
  try{
   const r=await fetch(`/api/admin/geocode?zip=${encodeURIComponent(form.target_zip.trim())}`);
   const j=await r.json();
   if(!r.ok)throw new Error(j.error||'ZIP lookup failed');
   setForm(f=>({...f,target_zip:j.zip||f.target_zip,target_city:j.city||'',target_region:j.region||'',target_latitude:String(j.latitude),target_longitude:String(j.longitude)}));
   setMessage(`Local target set to ${j.city}, ${j.region} ${j.zip} with a ${form.radius_miles}-mile radius.`);
  }catch(e:any){setMessage(e.message)}finally{setBusy(false)}
 }

 async function save(e:React.FormEvent){
  e.preventDefault();
  if(uploading)return setMessage('Wait for upload to finish.');
  if(!form.creative_url)return setMessage('Upload the ad first.');
  if(form.placement==='video-midroll'&&!form.creative_media_type.startsWith('video/'))return setMessage('Streaming mid-roll ads must use video.');
  if(form.target_mode!=='global'){
   if(!form.target_zip.trim()||!form.target_latitude.trim()||!form.target_longitude.trim())return setMessage('For Local or Both, enter a ZIP code and click LOOK UP ZIP before saving.');
   if(!Number.isFinite(Number(form.radius_miles))||form.radius_miles<1||form.radius_miles>250)return setMessage('Radius must be between 1 and 250 miles.');
  }
  setBusy(true);
  try{
   const data=form.target_mode==='global'?{...form,target_zip:'',target_city:'',target_region:'',target_latitude:'',target_longitude:''}:form;
   const r=await fetch('/api/admin/data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({section:'advertising',data})});
   const j=await r.json();
   if(!r.ok)throw new Error(j.error||'Save failed');
   setForm({...empty});setPreview('');setMessage('Advertisement saved and activated.');await load();
  }catch(e:any){setMessage(e.message)}finally{setBusy(false)}
 }

 async function remove(id?:string){
  if(!id||!confirm('Delete this ad?'))return;
  await fetch(`/api/admin/data?section=advertising&id=${encodeURIComponent(id)}`,{method:'DELETE'});
  await load();
 }

 const localTarget=form.target_mode==='local'||form.target_mode==='both';
 return <section className="ic-module-panel">
  <h2>Advertising</h2>
  <p>Upload commercials for Indie Cut Watch and choose whether each campaign runs globally, locally, or both.</p>
  <form onSubmit={save} style={{display:'grid',gap:14}}>
   <label>Advertiser<input value={form.advertiser} onChange={e=>setForm({...form,advertiser:e.target.value})} required/></label>
   <label>Campaign / Ad title<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
   <div>
    {preview&&(form.creative_media_type.startsWith('video/')||preview.startsWith('blob:')?<video src={preview} controls style={{width:'100%',maxWidth:720,maxHeight:420,background:'#000'}}/>:<img src={preview} alt="Preview" style={{maxWidth:720,maxHeight:420}}/>)}
    <br/>
    <label style={{display:'inline-block',padding:'11px 15px',background:'#111',color:'#fff',fontWeight:800,cursor:'pointer'}}>{uploading?'UPLOADING…':'UPLOAD IMAGE / VIDEO'}<input type="file" accept="image/*,video/*" hidden disabled={uploading} onChange={e=>upload(e.target.files?.[0])}/></label>
   </div>
   <label>Destination URL<input type="url" value={form.destination_url} onChange={e=>setForm({...form,destination_url:e.target.value})}/></label>
   <label>Placement<select value={form.placement} onChange={e=>setForm({...form,placement:e.target.value})}><option value="video-midroll">Indie Cut Watch — streaming commercial</option><option value="sitewide">Sitewide</option><option value="right-rail">Right rail</option><option value="homepage">Homepage</option><option value="article-inline">Article inline</option><option value="article-top">Article top</option><option value="battle-artist">Battle artist voting page</option><option value="battle-room">Live Battle Room sponsor</option></select></label>
   <div style={{padding:12,background:'#fafafa',border:'1px solid #ddd'}}>Streaming commercials currently run every 6 minutes and resume the program automatically.</div>
   <label>Audience
    <select value={form.target_mode} onChange={e=>setForm({...form,target_mode:e.target.value as TargetMode})}>
     <option value="global">Global — show everywhere</option>
     <option value="local">Local — only inside a ZIP radius</option>
     <option value="both">Both — global + local priority</option>
    </select>
   </label>
   {localTarget&&<div style={{padding:14,border:'1px solid #ddd',background:'#fafafa',display:'grid',gap:10}}>
    <strong>{form.target_mode==='both'?'Global + Local Target':'Local Target'}</strong>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
     <label style={{flex:'1 1 180px'}}>Center ZIP<input placeholder="06450" value={form.target_zip} onChange={e=>setForm({...form,target_zip:e.target.value,target_city:'',target_region:'',target_latitude:'',target_longitude:''})}/></label>
     <label style={{flex:'1 1 180px'}}>Radius (miles)<input type="number" min="1" max="250" value={form.radius_miles} onChange={e=>setForm({...form,radius_miles:Number(e.target.value)||20})}/></label>
     <button type="button" onClick={lookupZip} disabled={busy} style={{alignSelf:'end'}}>{busy?'LOOKING UP…':'LOOK UP ZIP'}</button>
    </div>
    {form.target_city&&<div><strong>Target:</strong> {form.target_city}, {form.target_region} {form.target_zip} · {form.radius_miles} mile radius</div>}
    <small>{form.target_mode==='both'?'This ad stays eligible everywhere, but viewers inside the local radius get local priority.':'This ad is eligible only for viewers whose approximate IP location falls inside the selected radius.'}</small>
   </div>}
   <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><label>Start<input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label><label>End<input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></label></div>
   <label><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Active campaign</label>
   <button disabled={busy||uploading}>{busy?'SAVING…':'SAVE AD'}</button>
   {message&&<div className="ic-message">{message}</div>}
  </form>
  <div style={{marginTop:30}}><h2>Existing Ad Units</h2>{rows.map(r=><div key={r._id} style={{padding:'12px 0',borderBottom:'1px solid #ddd'}}><strong>{r.title||r.advertiser}</strong> · {r.placement} · {audienceSummary(r)} · {r.active?'Active':'Inactive'} <button type="button" onClick={()=>remove(r._id)}>Delete</button></div>)}</div>
 </section>;
}
