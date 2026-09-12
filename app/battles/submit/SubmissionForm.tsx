'use client';

import {FormEvent,useState} from 'react';
import styles from '../battles.module.css';

export default function SubmissionForm({open=true}:{open?:boolean}){
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [success,setSuccess]=useState(false);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!open)return;setBusy(true);setMessage('');setSuccess(false);try{const form=new FormData(e.currentTarget);const r=await fetch('/api/battle-submissions',{method:'POST',body:form});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Unable to submit your music.');setSuccess(true);setMessage('Submission received for Phase One. Indie Cut will review it and activate your fan-voting profile if selected.');e.currentTarget.reset()}catch(e:any){setMessage(e.message)}finally{setBusy(false)}}
 if(!open)return <div className={styles.submissionClosed}><h2>Submissions are currently closed.</h2><p>Check back for the next Indie Cut Battle entry period.</p><a href="/battles">BACK TO LIVE BATTLES</a></div>;
 return <form className={styles.submissionForm} onSubmit={submit}>
  <div className={styles.formGrid}><label>Artist / stage name<input name="artist_name" required maxLength={120} placeholder="Your artist name"/></label><label>Email<input name="email" type="email" required maxLength={180} placeholder="you@example.com"/></label><label>Song title<input name="track_title" required maxLength={160} placeholder="Song you want to enter"/></label><label>Genre<input name="genre" maxLength={80} placeholder="R&B, hip-hop, soul…"/></label><label>City<input name="city" maxLength={120} placeholder="City, State"/></label><label>Instagram / social handle<input name="social_handle" maxLength={180} placeholder="@yourhandle"/></label></div>
  <label>Short artist bio<textarea name="bio" rows={4} maxLength={1200} placeholder="Tell Indie Cut who you are."/></label>
  <div className={styles.formGrid}><label>Artist photo <span>optional</span><input name="artist_photo" type="file" accept="image/*"/></label><label>Upload your song<input name="track_file" type="file" accept="audio/*" required/></label></div>
  <input name="website" tabIndex={-1} autoComplete="off" className={styles.honeypot} aria-hidden="true"/>
  <label className={styles.rightsCheck}><input name="rights" value="yes" type="checkbox" required/> <span>I confirm that I own or control the rights needed to submit this recording for consideration and playback in Indie Cut Battles.</span></label>
  <button className={styles.submitMusicButton} type="submit" disabled={busy}>{busy?'UPLOADING + SUBMITTING…':'ENTER PHASE ONE'}</button>
  {message&&<div className={`${styles.submissionMessage} ${success?styles.submissionSuccess:''}`}>{message}</div>}
 </form>
}
