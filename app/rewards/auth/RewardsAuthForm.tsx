'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '../../../lib/supabase/browser';

type Mode='signin'|'signup';

export default function RewardsAuthForm(){
  const router=useRouter();
  const [mode,setMode]=useState<Mode>('signin');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');
  const [messageType,setMessageType]=useState<'error'|'success'|''>('');

  function show(text:string,type:'error'|'success'='error'){
    setMessage(text);setMessageType(type);
  }

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setMessage('');setMessageType('');
    const cleanEmail=email.trim().toLowerCase();
    if(!cleanEmail)return show('Enter your email address.');
    if(password.length<8)return show('Use a password with at least 8 characters.');
    setLoading(true);
    try{
      const supabase=createClient();
      if(mode==='signup'){
        const redirectTo=`${window.location.origin}/rewards/activate`;
        const {data,error}=await supabase.auth.signUp({
          email:cleanEmail,
          password,
          options:{emailRedirectTo:redirectTo,data:{account_type:'viewer',rewards_interest:true}}
        });
        if(error)throw error;
        if(data.session){router.push('/rewards/activate');router.refresh();return;}
        show('Account created. Check your email and confirm your address, then return here to sign in.','success');
      }else{
        const {error}=await supabase.auth.signInWithPassword({email:cleanEmail,password});
        if(error)throw error;
        router.push('/rewards/activate');router.refresh();
      }
    }catch(error:any){
      show(String(error?.message||'Unable to continue. Please try again.'));
    }finally{
      setLoading(false);
    }
  }

  async function forgotPassword(){
    const cleanEmail=email.trim().toLowerCase();
    if(!cleanEmail)return show('Enter your email address first, then choose Reset password.');
    setLoading(true);setMessage('');
    try{
      const supabase=createClient();
      const {error}=await supabase.auth.resetPasswordForEmail(cleanEmail,{redirectTo:`${window.location.origin}/rewards/auth`});
      if(error)throw error;
      show('Password reset email sent. Check your inbox.','success');
    }catch(error:any){show(String(error?.message||'Unable to send the reset email.'));}
    finally{setLoading(false);}
  }

  return <div className="rewards-auth-card">
    <a className="rewards-back" href="/rewards">← Watch & Earn overview</a>
    <div className="rewards-kicker">Indie Cut Rewards</div>
    <h1>{mode==='signup'?'CREATE YOUR REWARDS LOGIN':'SIGN IN TO REWARDS'}</h1>
    <p>{mode==='signup'?'Your normal Indie Cut viewing can remain free. This secure login is specifically used to protect Watch & Earn rewards.':'Use the account connected to your Watch & Earn identity.'}</p>

    <form className="rewards-form" onSubmit={submit}>
      <label>Email address<input className="rewards-input" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required/></label>
      <label>Password<input className="rewards-input" type="password" autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8}/></label>
      {message&&<div className={`rewards-message ${messageType}`}>{message}</div>}
      <button className="rewards-button" disabled={loading}>{loading?'PLEASE WAIT…':mode==='signup'?'CREATE ACCOUNT':'SIGN IN'}</button>
    </form>

    <div className="rewards-divider"/>
    <div className="rewards-inline">
      <span style={{color:'#9aa0a8',fontSize:13}}>{mode==='signup'?'Already have an account?':'New to Watch & Earn?'}</span>
      <button className="rewards-text-button" type="button" onClick={()=>{setMode(mode==='signup'?'signin':'signup');setMessage('');setPassword('')}}>{mode==='signup'?'Sign in':'Create account'}</button>
      {mode==='signin'&&<button className="rewards-text-button" type="button" onClick={forgotPassword} disabled={loading}>Reset password</button>}
    </div>
    <p className="rewards-fineprint">Creating an account does not itself create earnings. Cash rewards apply only to eligible Watch & Earn offers after activation and qualification.</p>
  </div>;
}
