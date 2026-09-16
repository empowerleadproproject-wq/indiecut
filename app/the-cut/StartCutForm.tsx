'use client';

import {FormEvent,useState} from 'react';

const categories=['Music','Film & TV','Artists & Creators','Labels & Managers','Investors & Funding','Open Networking'];

export default function StartCutForm({authenticated,displayName}:{authenticated:boolean;displayName?:string|null}){
  const [title,setTitle]=useState('');
  const [category,setCategory]=useState('Music');
  const [description,setDescription]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  async function submit(e:FormEvent){
    e.preventDefault();
    setError('');setBusy(true);
    try{
      const res=await fetch('/api/the-cut/rooms',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,category,description})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Could not start the room.');
      window.location.href=`/the-cut/${data.room.slug}`;
    }catch(err:any){setError(err.message||'Could not start the room.');setBusy(false)}
  }

  if(!authenticated){
    return <div className="cut-form-card cut-create-inline">
      <h2>Start your own Cut</h2>
      <p>Artists, filmmakers, managers, labels and investors can host live conversations. Listening is open; hosting and speaking require an Indie Cut account.</p>
      <div className="cut-actions"><a className="cut-btn" href="/the-cut/sign-in?next=/the-cut">Create account / Sign in</a></div>
    </div>;
  }

  return <form className="cut-form-card cut-create-inline" onSubmit={submit}>
    <div className="cut-section-head" style={{margin:'0 0 18px'}}><div><h2>Start a Cut</h2><p>{displayName?`Hosting as ${displayName}`:'Go live with the Indie Cut community.'}</p></div><a className="cut-btn ghost" href="/the-cut/profile">Edit profile</a></div>
    {error&&<div className="cut-alert error">{error}</div>}
    <div className="cut-create-form">
      <div className="cut-field"><label>Room title</label><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} placeholder="What are we talking about?" required/></div>
      <div className="cut-field"><label>Category</label><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></div>
      <div className="cut-field"><label>Description</label><textarea value={description} onChange={e=>setDescription(e.target.value)} maxLength={600} placeholder="Give people a reason to pull up..."/></div>
      <button className="cut-btn dark" disabled={busy}>{busy?'Starting…':'Go Live'}</button>
    </div>
    <div className="cut-disclaimer">You control the stage. Listeners can request to participate, and you decide who gets a microphone.</div>
  </form>;
}
