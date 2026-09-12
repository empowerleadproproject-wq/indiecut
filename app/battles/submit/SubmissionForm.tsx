'use client';

import {FormEvent,useState} from 'react';
import {createClient} from '../../../lib/supabase/browser';
import {trackMarketingEvent} from '../../../lib/marketing-tracking';
import * as tus from 'tus-js-client';
import styles from '../battles.module.css';

const GENRES=['Hip-Hop','R&B','Gospel','Southern Soul','Pop','Rock','Country','Afrobeats','Reggae / Dancehall','Latin','Electronic / Dance','Jazz','Soul','Alternative','Blues','Folk'] as const;
const RESUMABLE_THRESHOLD=6*1024*1024;

function resumableEndpoint(){
 const base=String(process.env.NEXT_PUBLIC_SUPABASE_URL||'');
 const match=base.match(/^https:\/\/([^.]+)\.supabase\.co/i);
 if(!match)throw new Error('Upload service URL is unavailable.');
 return `https://${match[1]}.storage.supabase.co/storage/v1/upload/resumable`;
}

async function resumableUpload(file:File,info:any,onProgress?:(percent:number)=>void){
 await new Promise<void>((resolve,reject)=>{
  const upload=new tus.Upload(file,{
   endpoint:resumableEndpoint(),
   retryDelays:[0,3000,5000,10000,20000],
   headers:{'x-signature':String(info.token||'')},
   uploadDataDuringCreation:true,
   removeFingerprintOnSuccess:true,
   chunkSize:6*1024*1024,
   metadata:{bucketName:String(info.bucket||''),objectName:String(info.path||''),contentType:file.type||'application/octet-stream',cacheControl:'3600'},
   onProgress(bytesUploaded,bytesTotal){if(bytesTotal>0)onProgress?.(Math.max(1,Math.min(100,Math.round((bytesUploaded/bytesTotal)*100))))},
   onError(error){reject(new Error(error?.message||'The file upload was interrupted. Please try again.'))},
   onSuccess(){resolve()}
  });
  upload.findPreviousUploads().then(previous=>{if(previous.length)upload.resumeFromPreviousUpload(previous[0]);upload.start()}).catch(reject);
 });
}

async function directUpload(file:File,kind:'image'|'audio',onProgress?:(percent:number)=>void){
 const meta=await fetch('/api/battle-submissions/upload-url',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({fileName:file.name,mime:file.type,size:file.size,kind})});const info=await meta.json().catch(()=>({}));if(!meta.ok)throw new Error(info.error||'Unable to prepare upload.');
 if(file.size>RESUMABLE_THRESHOLD){
  await resumableUpload(file,info,onProgress);
 }else{
  const supabase=createClient();const {error}=await supabase.storage.from(info.bucket).uploadToSignedUrl(info.path,info.token,file,{contentType:file.type});if(error)throw new Error(error.message);
 }
 return String(info.publicUrl||'');
}

export default function SubmissionForm({open=true}:{open?:boolean}){
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [success,setSuccess]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!open)return;setBusy(true);setMessage('');setSuccess(false);const target=e.currentTarget;
  try{
   const form=new FormData(target);const track=form.get('track_file');if(!(track instanceof File)||!track.size)throw new Error('Upload the song you want to enter.');const photo=form.get('artist_photo');setMessage('Uploading your music…');
   const track_url=await directUpload(track,'audio',percent=>setMessage(`Uploading your music… ${percent}%`));
   let image_url='';if(photo instanceof File&&photo.size){setMessage('Uploading your artist photo…');image_url=await directUpload(photo,'image',percent=>setMessage(`Uploading your artist photo… ${percent}%`))}
   setMessage('Sending your submission for review…');
   const payload={artist_name:String(form.get('artist_name')||''),email:String(form.get('email')||''),phone:String(form.get('phone')||''),track_title:String(form.get('track_title')||''),genre:String(form.get('genre')||''),city:String(form.get('city')||''),instagram:String(form.get('instagram')||''),tiktok:String(form.get('tiktok')||''),bio:String(form.get('bio')||''),website:String(form.get('website')||''),rights:String(form.get('rights')||'')==='yes',marketing_opt_in:String(form.get('marketing_opt_in')||'')==='yes',track_url,image_url};
   const r=await fetch('/api/battle-submissions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Unable to submit your music.');trackMarketingEvent('ArtistSubmissionCompleted',{genre:payload.genre,marketing_opt_in:payload.marketing_opt_in});setSuccess(true);setMessage('Submission received. Indie Cut will review your song inside your genre. If approved, we will activate your Phase One fan-voting profile and give you a shareable voting link. Your Instagram and TikTok links will appear on the artist page so fans can follow you.');target.reset();
  }catch(e:any){const raw=String(e?.message||'Upload failed.');setMessage(/gateway timeout|networkerror|failed to fetch/i.test(raw)?'The upload connection was interrupted. Please press Submit for Review again — large songs now resume automatically instead of restarting from zero.':raw)}finally{setBusy(false)}
 }
 if(!open)return <div className={styles.submissionClosed}><h2>Submissions are currently closed.</h2><p>Check back for the next Indie Cut Battle entry period.</p><a href="/battles">BACK TO LIVE BATTLES</a></div>;
 return <form className={styles.submissionForm} onSubmit={submit}>
  <div className={styles.formGrid}><label>Artist / stage name<input name="artist_name" required maxLength={120} placeholder="Your artist name"/></label><label>Email<input name="email" type="email" required maxLength={180} placeholder="you@example.com"/></label><label>Phone number<input name="phone" type="tel" required maxLength={40} placeholder="(555) 555-5555"/></label><label>Song title<input name="track_title" required maxLength={160} placeholder="Song you want to enter"/></label><label>Genre<select name="genre" required defaultValue=""><option value="" disabled>Choose your genre…</option>{GENRES.map(genre=><option key={genre} value={genre}>{genre}</option>)}</select></label><label>City<input name="city" maxLength={120} placeholder="City, State"/></label><label>Instagram<input name="instagram" maxLength={220} placeholder="@yourhandle or instagram.com/yourhandle"/></label><label>TikTok<input name="tiktok" maxLength={220} placeholder="@yourhandle or tiktok.com/@yourhandle"/></label></div>
  <div style={{fontSize:13,lineHeight:1.45,padding:'12px 14px',background:'#f5f5f3',border:'1px solid #ddd'}}><strong>Grow your following.</strong> Add your Instagram and TikTok above. If your song is approved, fans will be able to follow you directly from your voting page.</div>
  <div style={{fontSize:13,lineHeight:1.45,padding:'12px 14px',background:'#f5f5f3',border:'1px solid #ddd'}}><strong>Genre matters.</strong> Artists compete only against artists in the same genre. Hip-Hop competes with Hip-Hop, R&B with R&B, Gospel with Gospel, Southern Soul with Southern Soul, and so on.</div>
  <label>Short artist bio<textarea name="bio" rows={4} maxLength={1200} placeholder="Tell Indie Cut who you are."/></label>
  <div className={styles.formGrid}><label>Artist photo <span>optional</span><input name="artist_photo" type="file" accept="image/*"/></label><label>Upload your song<input name="track_file" type="file" accept="audio/*" required/></label></div>
  <input name="website" tabIndex={-1} autoComplete="off" className={styles.honeypot} aria-hidden="true"/>
  <label className={styles.rightsCheck}><input name="rights" value="yes" type="checkbox" required/> <span>I confirm that I own or control the rights needed to submit this recording for consideration and playback in Indie Cut Battles.</span></label>
  <label className={styles.rightsCheck}><input name="marketing_opt_in" value="yes" type="checkbox"/> <span>Yes, send me Indie Cut artist opportunities, battle announcements and other promotional updates by email. I can unsubscribe later.</span></label>
  <button className={styles.submitMusicButton} type="submit" disabled={busy}>{busy?'UPLOADING + SUBMITTING…':'SUBMIT FOR REVIEW'}</button>
  {message&&<div className={`${styles.submissionMessage} ${success?styles.submissionSuccess:''}`}>{message}</div>}
 </form>
}
