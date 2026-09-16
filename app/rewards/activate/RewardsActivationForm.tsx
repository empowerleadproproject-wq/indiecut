'use client';

import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '../../../lib/supabase/browser';

type ViewerProfile={
  id:string;
  status:'phone_pending'|'active'|'locked'|'suspended'|'closed';
  phone_last4:string|null;
  phone_verified_at:string|null;
  age_attested_at:string|null;
  terms_version:string|null;
  terms_accepted_at:string|null;
  privacy_version:string|null;
  privacy_accepted_at:string|null;
};

type ProfileResponse={
  user:{id:string;email:string;emailConfirmed:boolean};
  profile:ViewerProfile|null;
};

function getDeviceId(){
  const key='indiecut_rewards_device_id';
  let id='';
  try{
    id=localStorage.getItem(key)||'';
    if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}
  }catch{id=crypto.randomUUID();}
  return id;
}

export default function RewardsActivationForm(){
  const router=useRouter();
  const [data,setData]=useState<ProfileResponse|null>(null);
  const [deviceId,setDeviceId]=useState('');
  const [phone,setPhone]=useState('');
  const [code,setCode]=useState('');
  const [last4,setLast4]=useState('');
  const [ageConfirmed,setAgeConfirmed]=useState(false);
  const [termsAccepted,setTermsAccepted]=useState(false);
  const [privacyAccepted,setPrivacyAccepted]=useState(false);
  const [codeSent,setCodeSent]=useState(false);
  const [loading,setLoading]=useState(false);
  const [initialLoading,setInitialLoading]=useState(true);
  const [message,setMessage]=useState('');
  const [messageType,setMessageType]=useState<'error'|'success'|''>('');

  function show(text:string,type:'error'|'success'='error'){setMessage(text);setMessageType(type);}

  async function loadProfile(){
    setInitialLoading(true);
    try{
      const response=await fetch('/api/rewards/profile',{cache:'no-store'});
      if(response.status===401){router.replace('/rewards/auth');return;}
      const json=await response.json();
      if(!response.ok)throw new Error(json?.error||'Unable to load rewards profile.');
      setData(json);
      if(json?.profile?.phone_last4)setLast4(json.profile.phone_last4);
    }catch(error:any){show(String(error?.message||'Unable to load rewards profile.'));}
    finally{setInitialLoading(false);}
  }

  useEffect(()=>{setDeviceId(getDeviceId());loadProfile();},[]);

  async function requestCode(e?:React.FormEvent){
    e?.preventDefault();setMessage('');
    if(!data?.user?.emailConfirmed)return show('Confirm your email address before verifying a phone number.');
    if(!ageConfirmed||!termsAccepted||!privacyAccepted)return show('Confirm your age and accept the Watch & Earn program terms and privacy notice.');
    setLoading(true);
    try{
      const response=await fetch('/api/rewards/otp/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phone,ageConfirmed,termsAccepted,privacyAccepted,deviceId})});
      const json=await response.json();
      if(!response.ok)throw new Error(json?.error||'Unable to send verification code.');
      setLast4(String(json.last4||''));setCodeSent(true);setCode('');
      show(`Verification code sent to the phone ending in ${json.last4}. It expires in 10 minutes.`,'success');
    }catch(error:any){show(String(error?.message||'Unable to send verification code.'));}
    finally{setLoading(false);}
  }

  async function verifyCode(e:React.FormEvent){
    e.preventDefault();setMessage('');
    const cleanCode=code.replace(/\D/g,'');
    if(cleanCode.length!==6)return show('Enter the 6-digit verification code.');
    setLoading(true);
    try{
      const response=await fetch('/api/rewards/otp/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:cleanCode,deviceId})});
      const json=await response.json();
      if(!response.ok)throw new Error(json?.error||'Unable to verify code.');
      setLast4(String(json.phoneLast4||last4));
      await loadProfile();
      show('Your Watch & Earn rewards identity is active.','success');
    }catch(error:any){show(String(error?.message||'Unable to verify code.'));}
    finally{setLoading(false);}
  }

  async function signOut(){
    setLoading(true);
    try{const supabase=createClient();await supabase.auth.signOut();router.push('/rewards');router.refresh();}
    finally{setLoading(false);}
  }

  if(initialLoading)return <div className="rewards-auth-card"><div className="rewards-kicker">Indie Cut Rewards</div><h1>LOADING YOUR PROFILE…</h1></div>;
  if(!data)return <div className="rewards-auth-card"><div className="rewards-kicker">Indie Cut Rewards</div><h1>WE COULDN’T LOAD YOUR PROFILE</h1>{message&&<div className="rewards-message error">{message}</div>}<div className="rewards-actions"><button className="rewards-button" onClick={loadProfile}>Try again</button></div></div>;

  const active=data.profile?.status==='active';
  const restricted=data.profile&&['locked','suspended','closed'].includes(data.profile.status);

  return <div className="rewards-auth-card">
    <a className="rewards-back" href="/rewards">← Watch & Earn overview</a>
    <div className="rewards-kicker">Rewards identity activation</div>
    <h1>{active?'YOU’RE VERIFIED':'PROTECT YOUR REWARDS IDENTITY'}</h1>
    <p>Indie Cut separates normal viewing from cash rewards. Your rewards identity adds verification so duplicate accounts cannot simply collect the same sponsored reward again.</p>

    <div className="rewards-status"><span className={`rewards-status-dot ${data.user.emailConfirmed?'good':''}`}/><div><strong>Email {data.user.emailConfirmed?'confirmed':'confirmation required'}</strong><small>{data.user.email}</small></div></div>
    <div className="rewards-status"><span className={`rewards-status-dot ${active?'good':''}`}/><div><strong>Phone {active?'verified':'verification required'}</strong><small>{active&&last4?`Verified number ending in ${last4}`:'One verified phone number can be linked to each rewards identity.'}</small></div></div>

    {restricted&&<div className="rewards-message error">This rewards profile is currently {data.profile?.status}. It cannot be activated from this screen.</div>}

    {active?<div className="rewards-active"><h2>Watch & Earn identity active</h2><p>Your account now has a verified rewards identity. Eligible sponsored offers can use this identity to enforce one-person reward rules. Viewing qualification, reward processing and wallet balances are handled by the next rewards builds.</p><ul className="rewards-mini-rules"><li>Confirmed account email</li><li>Verified phone ending in {last4}</li><li>Age attestation and program acceptance recorded</li><li>This browser has been registered as a rewards device</li></ul></div>:
    !restricted&&<>
      {!data.user.emailConfirmed&&<div className="rewards-message">Check the inbox for <strong>{data.user.email}</strong> and use the confirmation link before continuing. After confirming, return here and refresh your status.<div className="rewards-actions"><button className="rewards-button secondary" type="button" onClick={loadProfile}>Refresh email status</button></div></div>}

      {!codeSent?<form className="rewards-form" onSubmit={requestCode}>
        <label>Mobile phone number<input className="rewards-input" type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(203) 555-0123" required disabled={!data.user.emailConfirmed}/></label>
        <label className="rewards-check"><input type="checkbox" checked={ageConfirmed} onChange={e=>setAgeConfirmed(e.target.checked)}/><span>I confirm that I am 18 years of age or older.</span></label>
        <label className="rewards-check"><input type="checkbox" checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)}/><span>I agree to the Indie Cut Watch & Earn program rules. I understand that a displayed reward requires a <strong>qualified watch</strong>, not merely opening or playing a video, and that eligibility may be reviewed for fraud or duplicate-reward activity. <a href="/rewards#program-rules" target="_blank" rel="noreferrer" style={{textDecoration:'underline'}}>Read the current rules.</a></span></label>
        <label className="rewards-check"><input type="checkbox" checked={privacyAccepted} onChange={e=>setPrivacyAccepted(e.target.checked)}/><span>I agree that Indie Cut may use account, verification, device and security signals to administer Watch & Earn, prevent duplicate rewards and investigate abuse. Raw phone numbers are used for verification; the rewards database stores a protected phone fingerprint and last four digits.</span></label>
        {message&&<div className={`rewards-message ${messageType}`}>{message}</div>}
        <button className="rewards-button" disabled={loading||!data.user.emailConfirmed}>{loading?'SENDING…':'SEND VERIFICATION CODE'}</button>
      </form>:
      <form className="rewards-form" onSubmit={verifyCode}>
        <div className="rewards-message success">A 6-digit code was sent to the number ending in {last4}.</div>
        <label>Verification code<input className="rewards-input rewards-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" required/></label>
        {message&&<div className={`rewards-message ${messageType}`}>{message}</div>}
        <button className="rewards-button" disabled={loading}>{loading?'VERIFYING…':'VERIFY & ACTIVATE'}</button>
        <div className="rewards-inline"><button className="rewards-text-button" type="button" onClick={()=>{setCodeSent(false);setCode('');setMessage('')}}>Use a different number</button><button className="rewards-text-button" type="button" onClick={()=>requestCode()} disabled={loading}>Send a new code</button></div>
      </form>}
    </>}

    <div className="rewards-divider"/><div className="rewards-inline"><button className="rewards-text-button" type="button" onClick={signOut} disabled={loading}>Sign out of rewards</button></div>
    <p className="rewards-fineprint">Indie Cut never needs your verification code after you submit it here. Do not share it with another person.</p>
  </div>;
}
