'use client';

import {FormEvent,useMemo,useState} from 'react';
import {createClient} from '../../../lib/supabase/browser';

const roles=['Artist / Musician','Producer / Songwriter','Manager','Record Label','Filmmaker','Actor / Talent','Film Producer','Investor / Financier','Media / Press','Industry Professional','Fan / Supporter','Other'];

export default function CutProfileForm({initial}:{initial:any}){
  const [displayName,setDisplayName]=useState(initial?.display_name||'');
  const [headline,setHeadline]=useState(initial?.headline||'');
  const [industryRole,setIndustryRole]=useState(initial?.industry_role||'Artist / Musician');
  const [file,setFile]=useState<File|null>(null);
  const [savedAvatar,setSavedAvatar]=useState(initial?.avatar_url||'');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const preview=useMemo(()=>file?URL.createObjectURL(file):savedAvatar,[file,savedAvatar]);
  const initials=displayName.split(/\s+/).slice(0,2).map((v:string)=>v[0]).join('').toUpperCase()||'IC';

  async function submit(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');setMessage('');
    const form=new FormData();form.set('displayName',displayName);form.set('headline',headline);form.set('industryRole',industryRole);if(file)form.set('avatar',file);
    try{
      const res=await fetch('/api/the-cut/profile',{method:'POST',body:form});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Could not save your profile.');
      setSavedAvatar(data.profile?.avatar_url||savedAvatar);setFile(null);setMessage('Your Cut profile is ready.');
    }catch(err:any){setError(err.message||'Could not save your profile.')}finally{setBusy(false)}
  }

  async function signOut(){const supabase=createClient();await supabase.auth.signOut();window.location.href='/the-cut'}

  return <div className="cut-profile-grid">
    <aside className="cut-profile-preview"><div className="cut-avatar">{preview?<img src={preview} alt="Profile preview"/>:initials}</div><h3>{displayName||'Your name'}</h3><p>{industryRole||'Indie Cut Member'}</p>{headline&&<p style={{marginTop:8}}>{headline}</p>}</aside>
    <form className="cut-form-card" onSubmit={submit}>
      <h1>Your Cut Profile</h1><p>This is what hosts and listeners see when you request the mic or speak in a room.</p>
      {error&&<div className="cut-alert error">{error}</div>}{message&&<div className="cut-alert success">{message}</div>}
      <div className="cut-field"><label>Photo / avatar</label><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>setFile(e.target.files?.[0]||null)}/></div>
      <div className="cut-field"><label>Display name</label><input value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={80} required/></div>
      <div className="cut-field"><label>Industry role</label><select value={industryRole} onChange={e=>setIndustryRole(e.target.value)}>{roles.map(r=><option key={r}>{r}</option>)}</select></div>
      <div className="cut-field"><label>One-line bio</label><input value={headline} onChange={e=>setHeadline(e.target.value)} maxLength={160} placeholder="Independent artist · Atlanta, GA"/></div>
      <div className="cut-actions"><button className="cut-btn" disabled={busy}>{busy?'Saving…':'Save profile'}</button><a className="cut-btn secondary" href="/the-cut">Back to The Cut</a><button className="cut-btn ghost" type="button" onClick={signOut}>Sign out</button></div>
    </form>
  </div>;
}
