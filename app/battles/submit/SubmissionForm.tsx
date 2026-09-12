'use client';

import {FormEvent,useState} from 'react';
import {createClient} from '../../../lib/supabase/browser';
import styles from '../battles.module.css';

async function directUpload(file:File,kind:'image'|'audio'){
 const meta=await fetch('/api/battle-submissions/upload-url',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({fileName:file.name,mime:file.type,size:file.size,kind})});const info=await meta.json().catch(()=>({}));if(!meta.ok)throw new Error(info.error||'Unable to prepare upload.');
 const supabase=createClient();const {error}=await supabase.storage.from(info.bucket).uploadToSignedUrl(info.path,info.token,file,{contentType:file.type});if(error)throw new Error(error.message);return String(info.publicUrl||'');
}

export default function SubmissionForm({open=true}:{open?:boolean}){
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [success,setSuccess]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!open)return;setBusy(true);setMessage('');setSuccess(false);const target=e.currentTarget;
  try{
   const form=new FormData(target);const track=form.get('track_file');if(!(track instanceof File)||!track.size)throw new Error('Upload the song you want to enter.');const photo=form.get('artist_photo');setMessage('Uploading your music…');
   const track_url=await directUpload(track,'audio');const image_url=photo instanceof File&&photo.size?await directUpload(photo,'image'):'';setMessage('Sending your submission for review…');
   const payload={artist_name:String(form.get('artist_name')||''),email:String(form.get('email')||''),phone:String(form.get('phone')||''),track_title:String(form.get('track_title')||''),genre:String(form.get('genre')||''),city:String(form.get('city')||''),social_handle:String(form.get('social_handle')||''),bio:String(form.get('bio')||''),website:String(form.get('website')||''),rights:String(form.get('rights')||'')==='yes',track_url,image_url};
   const r=await fetch('/api/battle-submissions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Unable to submit your music.');setSuccess(true);setMessage('Submission received. Indie Cut will review your song. If approved, we will activate your Phase One fan-voting profile and give you a shareable voting link.');target.reset();
  }catch(e:any){setMessage(e.message)}finally{setBusy(false)}
 }
 if(!open)return <div className={styles.submissionClosed}><h2>Submissions are currently closed.</h2><p>Check back for the next Indie Cut Battle entry period.</p><a href="/battles">BACK TO LIVE BATTLES</a></div>;
 return <form className={styles.submissionForm} onSubmit={submit}>
  <div className={styles.formGrid}><label>Artist / stage name<input name="artist_name" required maxLength={120} placeholder="Your artist name"/></label><label>Email<input name="email" type="email" required maxLength={180} placeholder="you@example.com"/></label><label>Phone number<input name="phone" type="tel" required maxLength={40} placeholder="(555) 555-5555"/></label><label>Song title<input name="track_title" required maxLength={160} placeholder="Song you want to enter"/></label><label>Genre<input name="genre" maxLength={80} placeholder="R&B, hip-hop, soul…"/></label><label>City<input name="city" maxLength={120} placeholder="City, State"/></label><label>Instagram / social handle<input name="social_handle" maxLength={180} placeholder="@yourhandle"/></label></div>
  <label>Short artist bio<textarea name="bio" rows={4} maxLength={1200} placeholder="Tell Indie Cut who you are."/></label>
  <div className={styles.formGrid}><label>Artist photo <span>optional</span><input name="artist_photo" type="file" accept="image/*"/></label><label>Upload your song<input name="track_file" type="file" accept="audio/*" required/></label></div>
  <input name="website" tabIndex={-1} autoComplete="off" className={styles.honeypot} aria-hidden="true"/>
  <label className={styles.rightsCheck}><input name="rights" value="yes" type="checkbox" required/> <span>I confirm that I own or control the rights needed to submit this recording for consideration and playback in Indie Cut Battles.</span></label>
  <button className={styles.submitMusicButton} type="submit" disabled={busy}>{busy?'UPLOADING + SUBMITTING…':'SUBMIT FOR REVIEW'}</button>
  {message&&<div className={`${styles.submissionMessage} ${success?styles.submissionSuccess:''}`}>{message}</div>}
 </form>
}
