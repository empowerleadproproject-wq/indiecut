'use client';

import {FormEvent,useState} from 'react';
import {createClient} from '../../../lib/supabase/browser';

export default function CutAuthForm({next='/the-cut/profile',confirmationError=false}:{next?:string;confirmationError?:boolean}){
  const [mode,setMode]=useState<'signin'|'signup'>('signin');
  const [displayName,setDisplayName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState(confirmationError?'That confirmation link could not be completed. Please sign in or request a new account confirmation.':'');
  const [error,setError]=useState('');

  async function submit(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');setMessage('');
    const supabase=createClient();
    try{
      if(mode==='signin'){
        const {error}=await supabase.auth.signInWithPassword({email,password});
        if(error)throw error;
        window.location.href=next;
        return;
      }
      if(displayName.trim().length<2)throw new Error('Enter the name you want people to see in The Cut.');
      const callback=`${window.location.origin}/the-cut/auth/callback?next=${encodeURIComponent(next)}`;
      const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:displayName.trim()},emailRedirectTo:callback}});
      if(error)throw error;
      if(data.session){window.location.href=next;return}
      setMessage('Account created. Check your email to confirm your account, then come back to The Cut.');
    }catch(err:any){setError(err.message||'Could not continue.')}finally{setBusy(false)}
  }

  return <div className="cut-form-card">
    <div className="cut-auth-tabs"><button type="button" className={mode==='signin'?'active':''} onClick={()=>{setMode('signin');setError('');setMessage('')}}>Sign in</button><button type="button" className={mode==='signup'?'active':''} onClick={()=>{setMode('signup');setError('');setMessage('')}}>Create account</button></div>
    <h1>{mode==='signin'?'Welcome back':'Join The Cut'}</h1>
    <p>{mode==='signin'?'Sign in to request the mic, host rooms, and build your Indie Cut profile.':'Create your Indie Cut account. You can listen without one, but participation requires a real profile.'}</p>
    {error&&<div className="cut-alert error">{error}</div>}{message&&<div className="cut-alert success">{message}</div>}
    <form onSubmit={submit}>
      {mode==='signup'&&<div className="cut-field"><label>Display name</label><input value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={80} autoComplete="name" required/></div>}
      <div className="cut-field"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/></div>
      <div className="cut-field"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} autoComplete={mode==='signin'?'current-password':'new-password'} required/></div>
      <button className="cut-btn" style={{width:'100%'}} disabled={busy}>{busy?'Please wait…':mode==='signin'?'Sign in to The Cut':'Create my account'}</button>
    </form>
    <div className="cut-disclaimer">Shared room links remain open for listening without signing in. Your account is only required when you want to host, request the mic, or participate.</div>
  </div>;
}
