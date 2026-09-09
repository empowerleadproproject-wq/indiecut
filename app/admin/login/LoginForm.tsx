'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase/browser';

export default function LoginForm(){
 const router=useRouter();
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 async function handleSubmit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setLoading(true);setError('');
  try{
   const supabase=createClient();
   const {error:signInError}=await supabase.auth.signInWithPassword({email,password});
   if(signInError){setError(signInError.message);return}
   router.replace('/admin');router.refresh();
  }catch(err){setError(err instanceof Error?err.message:'Unable to sign in.')}finally{setLoading(false)}
 }
 return <form onSubmit={handleSubmit} className="panel" style={{maxWidth:520,margin:'48px auto'}}><h1>Indie Cut Admin</h1><p>Sign in to the editorial control room.</p><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/>{error&&<div style={{marginTop:12}}>{error}</div>}<button type="submit" disabled={loading} style={{marginTop:16}}>{loading?'SIGNING IN…':'SIGN IN'}</button></form>
}
