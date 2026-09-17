'use client';

import {useEffect,useState} from 'react';
import {createClient} from '../../lib/supabase/browser';

type Person={id:string;name:string;avatar:string;role:'host'|'speaker'|'listener';handle?:string;bio?:string;own?:boolean;avatarIsUrl?:boolean;accountId?:string;profileId?:string};
type PublicProfile={account_id:string;profile_id?:string|null;name:string;username?:string|null;bio?:string|null;avatar?:string|null;website?:string|null;instagram?:string|null;x?:string|null;tiktok?:string|null;youtube?:string|null;followers:number;following:number;is_following:boolean;is_own:boolean;profile_complete:boolean};

function socialUrl(kind:'instagram'|'x'|'tiktok'|'youtube',value:string){if(/^https?:\/\//i.test(value))return value;const handle=value.replace(/^@/,'').trim();if(!handle)return '#';if(kind==='instagram')return `https://instagram.com/${handle}`;if(kind==='x')return `https://x.com/${handle}`;if(kind==='tiktok')return `https://tiktok.com/@${handle}`;return `https://youtube.com/@${handle}`}
function websiteUrl(value:string){return /^https?:\/\//i.test(value)?value:`https://${value}`}

export default function MemberProfileSheet({person,clientId,close,promote}:{person:Person;clientId:string;close:()=>void;promote:()=>void}){
  const[profile,setProfile]=useState<PublicProfile|null>(null);
  const[loading,setLoading]=useState(true);
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');

  useEffect(()=>{let alive=true;(async()=>{if(!person.accountId){setLoading(false);return}try{const supabase=createClient();const{data,error}=await supabase.rpc('cut_public_account_profile',{p_account_id:person.accountId,p_client_id:clientId||''});if(error)throw error;if(alive)setProfile(data as PublicProfile)}catch(e:any){if(alive)setError(e?.message||'Could not load this profile.')}finally{if(alive)setLoading(false)}})();return()=>{alive=false}},[person.accountId,clientId]);

  async function toggleFollow(){if(!person.accountId||busy)return;setBusy(true);setError('');try{const supabase=createClient();const{data,error}=await supabase.rpc('cut_toggle_account_follow',{p_account_id:person.accountId,p_client_id:clientId||''});if(error)throw error;setProfile(data as PublicProfile)}catch(e:any){setError(e?.message||'Could not update follow.')}finally{setBusy(false)}}

  const name=profile?.name||person.name;
  const avatar=profile?.avatar||person.avatar;
  const avatarIsUrl=!!profile?.avatar||person.avatarIsUrl;
  const username=profile?.username?`@${profile.username}`:person.handle;
  const bio=profile?.bio||person.bio;
  const own=profile?.is_own??person.own;
  const socials=[
    profile?.website&&['Website',websiteUrl(profile.website)],
    profile?.instagram&&['Instagram',socialUrl('instagram',profile.instagram)],
    profile?.x&&['X',socialUrl('x',profile.x)],
    profile?.tiktok&&['TikTok',socialUrl('tiktok',profile.tiktok)],
    profile?.youtube&&['YouTube',socialUrl('youtube',profile.youtube)],
  ].filter(Boolean) as [string,string][];

  return <div style={{position:'fixed',inset:0,zIndex:110,background:'rgba(0,0,0,.7)',backdropFilter:'blur(7px)',display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={close}>
    <section onClick={e=>e.stopPropagation()} style={{width:'min(820px,100%)',maxHeight:'82dvh',overflowY:'auto',background:'linear-gradient(145deg,#111419,#07090b)',border:'1px solid #30343b',borderRadius:'38px 38px 0 0',padding:'12px 24px calc(28px + env(safe-area-inset-bottom))',boxSizing:'border-box',color:'#fff',fontFamily:'Arial,sans-serif'}}>
      <div style={{width:62,height:6,background:'#626771',borderRadius:99,margin:'0 auto 22px'}}/>
      <div style={{display:'flex',gap:18,alignItems:'center'}}>
        <div style={{width:112,height:112,borderRadius:'50%',background:'#202228',border:'1px solid #4d515a',display:'grid',placeItems:'center',fontSize:28,fontWeight:900,overflow:'hidden',flex:'0 0 auto'}}>{avatarIsUrl?<img src={avatar} alt={name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:avatar}</div>
        <div style={{minWidth:0,flex:1}}><h2 style={{font:'700 31px/1 Georgia,serif',margin:'0 0 6px'}}>{name}</h2>{username&&<div style={{color:'#aaa',fontWeight:700}}>{username}</div>}<div style={{color:'#8f95a0',fontSize:13,marginTop:5,textTransform:'capitalize'}}>{person.role}</div></div>
      </div>

      {loading?<p style={{color:'#8f95a0',marginTop:22}}>Loading profile…</p>:<>
        <div style={{display:'flex',gap:26,margin:'22px 0 18px'}}><div><strong style={{fontSize:20}}>{profile?.followers??0}</strong><span style={{display:'block',fontSize:12,color:'#8f95a0'}}>Followers</span></div><div><strong style={{fontSize:20}}>{profile?.following??0}</strong><span style={{display:'block',fontSize:12,color:'#8f95a0'}}>Following</span></div></div>
        {bio?<p style={{fontSize:15,lineHeight:1.5,color:'#d2d5da',margin:'0 0 18px'}}>{bio}</p>:<p style={{fontSize:14,lineHeight:1.45,color:'#858b95',margin:'0 0 18px'}}>This member hasn&apos;t added a bio or social links yet.</p>}
        {socials.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:18}}>{socials.map(([label,url])=><a key={label} href={url} target="_blank" rel="noreferrer" style={{border:'1px solid #373c46',background:'#12151a',color:'#fff',textDecoration:'none',borderRadius:999,padding:'9px 13px',fontSize:12,fontWeight:900}}>{label}</a>)}</div>}
        {!own&&person.accountId&&<button onClick={toggleFollow} disabled={busy} style={{width:'100%',border:profile?.is_following?'1px solid #4a4f58':'0',background:profile?.is_following?'#15181d':'#795cff',color:'#fff',borderRadius:999,padding:14,fontWeight:900,fontSize:14}}>{busy?'Updating…':profile?.is_following?'Following ✓':'Follow'}</button>}
        {own&&<><button onClick={promote} style={{width:'100%',border:0,background:'#ffd84d',color:'#111',borderRadius:999,padding:14,fontWeight:900,marginBottom:10}}>Promote in this room</button><a href="/the-cut/profile" style={{display:'block',width:'100%',boxSizing:'border-box',textAlign:'center',border:'1px solid #4a4f58',background:'#15181d',color:'#fff',borderRadius:999,padding:14,fontWeight:900,textDecoration:'none'}}>Edit My Profile</a></>}
      </>}
      {error&&<p style={{color:'#ff7892',fontSize:12,fontWeight:800,marginTop:12}}>{error}</p>}
    </section>
  </div>
}
