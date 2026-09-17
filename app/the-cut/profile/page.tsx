'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {createClient} from '../../../lib/supabase/browser';

type Profile={name:string;username:string;bio:string;website:string;instagram:string;x:string;tiktok:string;youtube:string;avatar:string};
const blank:Profile={name:'',username:'',bio:'',website:'',instagram:'',x:'',tiktok:'',youtube:'',avatar:''};
function getClientId(){const key='indiecut_cut_client_id';let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id)}return id}

export default function CutProfile(){
  const[p,setP]=useState<Profile>(blank);
  const[saved,setSaved]=useState(false);
  const[loading,setLoading]=useState(true);
  const[email,setEmail]=useState('');
  const[error,setError]=useState('');
  const[notice,setNotice]=useState('');
  const[uploading,setUploading]=useState(false);
  const[saving,setSaving]=useState(false);
  const[hasAccount,setHasAccount]=useState(false);
  const file=useRef<HTMLInputElement>(null);
  const clientId=useRef('');

  async function load(){
    setLoading(true);setError('');
    try{
      clientId.current=getClientId();
      const supabase=createClient();
      const{data,error:e}=await supabase.rpc('cut_profile_for_client',{p_client_id:clientId.current});
      if(e)throw e;
      if(!data){setHasAccount(false);setLoading(false);return}
      setHasAccount(true);setEmail(String(data.email||''));
      setP({name:String(data.name||''),username:String(data.username||''),bio:String(data.bio||''),website:String(data.website||''),instagram:String(data.instagram||''),x:String(data.x||''),tiktok:String(data.tiktok||''),youtube:String(data.youtube||''),avatar:String(data.avatar||'')});
    }catch(err:any){setError(err?.message||'Could not load your profile.');}
    finally{setLoading(false)}
  }

  useEffect(()=>{load()},[]);
  function set<K extends keyof Profile>(k:K,v:Profile[K]){setP(x=>({...x,[k]:v}));setSaved(false)}

  async function photo(f?:File){
    if(!f)return;setError('');setNotice('');
    if(!['image/jpeg','image/png','image/webp'].includes(f.type)){setError('Choose a JPG, PNG or WEBP image.');return}
    if(f.size>5*1024*1024){setError('Please choose an image under 5MB.');return}
    if(!hasAccount){setError('Join The Cut first, then come back to build your profile.');return}
    setUploading(true);
    try{
      const supabase=createClient();
      const ext=f.type==='image/png'?'png':f.type==='image/webp'?'webp':'jpg';
      const path=`${clientId.current}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const{error:up}=await supabase.storage.from('cut-avatars').upload(path,f,{upsert:false,contentType:f.type});
      if(up)throw up;
      const{data}=supabase.storage.from('cut-avatars').getPublicUrl(path);
      const url=`${data.publicUrl}?v=${Date.now()}`;
      const{error:saveAvatar}=await supabase.rpc('cut_set_profile_avatar',{p_client_id:clientId.current,p_avatar:url});
      if(saveAvatar)throw saveAvatar;
      set('avatar',url);setNotice('✓ Profile photo saved.');
    }catch(err:any){setError(err?.message||'Profile photo could not be saved.');}
    finally{setUploading(false);if(file.current)file.current.value=''}
  }

  async function save(){
    setError('');setNotice('');
    if(!hasAccount){setError('Join The Cut first, then come back to build your profile.');return}
    if(p.name.trim().length<2){setError('Add your name before saving.');return}
    setSaving(true);
    try{
      const supabase=createClient();
      const username=p.username.trim().replace(/^@/,'').toLowerCase();
      const{data,error:e}=await supabase.rpc('cut_save_profile_for_client',{
        p_client_id:clientId.current,p_name:p.name.trim(),p_username:username,p_bio:p.bio.trim(),p_avatar:p.avatar||'',
        p_website:p.website.trim(),p_instagram:p.instagram.trim(),p_x:p.x.trim(),p_tiktok:p.tiktok.trim(),p_youtube:p.youtube.trim()
      });
      if(e)throw e;
      setP({name:String(data?.name||p.name),username:String(data?.username||username),bio:String(data?.bio||''),website:String(data?.website||''),instagram:String(data?.instagram||''),x:String(data?.x||''),tiktok:String(data?.tiktok||''),youtube:String(data?.youtube||''),avatar:String(data?.avatar||p.avatar)});
      try{localStorage.setItem('indiecut_profile_saved','1');localStorage.removeItem('indiecut_profile_reminder_snooze_until')}catch{}
      setSaved(true);setNotice('✓ Everything saved to your profile.');
    }catch(err:any){setError(err?.message||'Your profile could not be saved.');}
    finally{setSaving(false)}
  }

  if(loading)return <main style={{minHeight:'100vh',background:'#050506',color:'#fff',display:'grid',placeItems:'center'}}>Loading profile…</main>;
  if(!hasAccount)return <main style={{minHeight:'100vh',background:'#050506',color:'#fff',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',padding:'24px 16px'}}><section style={{maxWidth:560,margin:'12vh auto',textAlign:'center',background:'#111217',border:'1px solid #292b31',borderRadius:24,padding:30}}><h1 style={{fontSize:34,margin:'0 0 10px'}}>Create your Cut account first</h1><p style={{color:'#999',lineHeight:1.5}}>Enter a room and tap <b>Join this Space</b>. Once your name and email are connected, your profile photo, bio and links can all be saved here.</p><Link href="/the-cut" style={{display:'inline-block',marginTop:12,background:'#fff',color:'#111',padding:'12px 18px',borderRadius:999,textDecoration:'none',fontWeight:900}}>Go to The Cut</Link></section></main>;

  return <main style={{minHeight:'100vh',background:'#050506',color:'#fff',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif',padding:'24px 16px 60px'}}><section style={{maxWidth:650,margin:'0 auto'}}><Link href="/the-cut" style={{color:'#aaa',textDecoration:'none',fontWeight:700}}>← The Cut</Link><h1 style={{fontSize:44,margin:'28px 0 6px'}}>Your Profile</h1><p style={{color:'#999',marginTop:0}}>{email?`Connected as ${email}`:'Your Cut profile'}</p><div style={{background:'#111217',border:'1px solid #292b31',borderRadius:24,padding:22,marginTop:26}}><div style={{display:'flex',gap:18,alignItems:'center',marginBottom:26}}><button onClick={()=>file.current?.click()} disabled={uploading} style={{width:104,height:104,borderRadius:'50%',border:'2px solid #6f50ff',overflow:'hidden',background:'#24252c',color:'#fff',fontSize:26,fontWeight:900,flex:'0 0 auto'}}>{p.avatar?<img src={p.avatar} alt="Profile" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:(p.name||'YOU').slice(0,2).toUpperCase()}</button><div><button onClick={()=>file.current?.click()} disabled={uploading} style={{border:0,borderRadius:999,padding:'11px 16px',fontWeight:900}}>{uploading?'Uploading & saving…':'Upload profile photo'}</button><p style={{fontSize:12,color:'#888'}}>JPG, PNG or WEBP, max 5MB. Your photo saves immediately.</p><input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>photo(e.target.files?.[0])}/></div></div><Fields p={p} set={set}/>{error&&<p style={{color:'#ff5578',fontWeight:700}}>{error}</p>}{notice&&<p style={{color:'#78e29a',fontWeight:800}}>{notice}</p>}<button disabled={saving} onClick={save} style={{width:'100%',marginTop:24,border:0,borderRadius:999,background:'#6f50ff',color:'#fff',fontWeight:900,fontSize:16,padding:15,opacity:saving?.65:1}}>{saving?'Saving…':saved?'✓ Profile saved':'Save Profile'}</button></div></section></main>
}

function Fields({p,set}:{p:Profile;set:<K extends keyof Profile>(k:K,v:Profile[K])=>void}){const rows:[keyof Profile,string,string][]=[['name','Name','Your name'],['username','Username','username'],['website','Website','https://yourwebsite.com'],['instagram','Instagram','@username or profile URL'],['x','X / Twitter','@username or profile URL'],['tiktok','TikTok','@username or profile URL'],['youtube','YouTube','Channel or URL']];return <>{rows.map(([k,l,ph])=><label key={k} style={{display:'block',fontWeight:800,fontSize:13,marginTop:15}}>{l}<input value={String(p[k])} placeholder={ph} onChange={e=>set(k,e.target.value)} style={{display:'block',width:'100%',boxSizing:'border-box',marginTop:7,border:'1px solid #333741',borderRadius:11,background:'#0b0c10',color:'#fff',padding:'13px 14px',fontSize:16}}/></label>)}<label style={{display:'block',fontWeight:800,fontSize:13,marginTop:15}}>Bio<textarea value={p.bio} placeholder="Tell people who you are and what you do." maxLength={300} onChange={e=>set('bio',e.target.value)} style={{display:'block',width:'100%',minHeight:110,resize:'vertical',boxSizing:'border-box',marginTop:7,border:'1px solid #333741',borderRadius:11,background:'#0b0c10',color:'#fff',padding:'13px 14px',fontSize:16}}/></label></>}
