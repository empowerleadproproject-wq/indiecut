'use client';
import {useEffect,useState} from 'react';

const ACCESS_KEY='indiecut_watch_access';
const VIEWER_KEY='indiecut_watch_viewer';
const COOKIE='indiecut_watch_access';

function hasCookie(){return typeof document!=='undefined'&&document.cookie.split(';').some(v=>v.trim().startsWith(`${COOKIE}=1`))}
function rememberViewer(name:string,email:string){
 const viewer={name,email,created_at:new Date().toISOString()};
 try{localStorage.setItem(ACCESS_KEY,'1');localStorage.setItem(VIEWER_KEY,JSON.stringify(viewer))}catch{}
 try{document.cookie=`${COOKIE}=1; Max-Age=31536000; Path=/; SameSite=Lax; Secure`}catch{}
}
function remembered(){
 try{if(localStorage.getItem(ACCESS_KEY)==='1')return true}catch{}
 return hasCookie();
}

export default function WatchGate(){
 const [ready,setReady]=useState(false),[open,setOpen]=useState(false),[name,setName]=useState(''),[email,setEmail]=useState('');
 useEffect(()=>{
  const known=remembered();
  if(known){
   // Repair whichever persistence layer is missing so mobile browsers have a fallback.
   try{localStorage.setItem(ACCESS_KEY,'1')}catch{}
   try{document.cookie=`${COOKIE}=1; Max-Age=31536000; Path=/; SameSite=Lax; Secure`}catch{}
  }
  setOpen(!known);setReady(true);
 },[]);
 async function submit(e:React.FormEvent){
  e.preventDefault();const n=name.trim(),m=email.trim().toLowerCase();if(!n||!m)return;
  // Save access before the network request. Watching never depends on the API succeeding.
  rememberViewer(n,m);setOpen(false);
  fetch('/api/watch/viewer',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:n,email:m}),keepalive:true}).catch(()=>{});
 }
 if(!ready||!open)return null;
 return <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(5,5,8,.94)',display:'grid',placeItems:'center',padding:22,backdropFilter:'blur(10px)'}}><form onSubmit={submit} style={{width:'min(520px,100%)',background:'#111218',color:'#fff',padding:'clamp(26px,5vw,46px)',border:'1px solid #292b33',boxShadow:'0 30px 90px rgba(0,0,0,.55)'}}><div style={{fontSize:12,fontWeight:900,letterSpacing:'.18em',color:'#aaa'}}>INDIE CUT WATCH</div><h2 style={{fontSize:'clamp(32px,6vw,52px)',lineHeight:.95,margin:'12px 0'}}>WATCH FREE.</h2><p style={{color:'#bbb',lineHeight:1.6}}>Enter your name and email once to unlock Indie Cut shows, films, interviews and original programming. No password required.</p><div style={{display:'grid',gap:12,marginTop:24}}><input aria-label="Name" autoComplete="name" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} required style={{padding:'15px 16px',fontSize:16,border:'1px solid #343640',background:'#191a20',color:'#fff'}}/><input aria-label="Email" autoComplete="email" inputMode="email" type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} required style={{padding:'15px 16px',fontSize:16,border:'1px solid #343640',background:'#191a20',color:'#fff'}}/><button style={{padding:'15px 18px',border:0,background:'#fff',color:'#080808',fontWeight:900,fontSize:14,letterSpacing:'.08em'}}>START WATCHING</button></div><p style={{fontSize:11,color:'#777',marginTop:14}}>Free access. Your information helps Indie Cut understand and grow its audience.</p></form></div>
}
