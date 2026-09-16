import Link from 'next/link';
import {notFound} from 'next/navigation';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import AdSupportedVideo from '../AdSupportedVideo';
import WatchGate from '../WatchGate';

export const revalidate=0;
function db(){return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}
function youtubeEmbed(url?:string){const s=String(url||'');let id='';try{const u=new URL(s);if(u.hostname.includes('youtu.be'))id=u.pathname.replace(/^\//,'').split('/')[0];else if(u.hostname.includes('youtube.com'))id=u.searchParams.get('v')||u.pathname.match(/\/shorts\/([^/?]+)/)?.[1]||''}catch{}return id?`https://www.youtube.com/embed/${id}?autoplay=1`:''}
export default async function WatchPlaybackPage({params}:{params:{id:string}}){
 const {data:v}=await db().from('media_items').select('*').eq('id',params.id).maybeSingle();if(!v)notFound();const yt=youtubeEmbed(v.media_url);
 return <main style={{minHeight:'100vh',background:'#000',color:'#fff',display:'flex',flexDirection:'column'}}>
  <WatchGate/>
  <header style={{height:64,display:'flex',alignItems:'center',padding:'0 clamp(16px,3vw,38px)',position:'relative',zIndex:30,background:'linear-gradient(#090909,transparent)'}}><Link href="/videos" style={{color:'#fff',textDecoration:'none',fontSize:15,fontWeight:900}}>← BACK TO WATCH</Link></header>
  <section style={{flex:1,display:'grid',placeItems:'center',width:'100%',background:'#000'}}>
   <div style={{width:'100%',maxWidth:1600}}>{yt?<div style={{position:'relative',paddingBottom:'56.25%',height:0,overflow:'hidden',background:'#000'}}><iframe src={yt} title={v.title||'Video'} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen style={{position:'absolute',inset:0,width:'100%',height:'100%',border:0}}/></div>:<AdSupportedVideo src={v.media_url} poster={v.cover_url||undefined} breakMode={(v.ad_break_mode||'none') as any} intervalMinutes={Number(v.ad_break_interval_minutes||6)} customBreaks={String(v.custom_ad_breaks||'')}/>}</div>
  </section>
  <section style={{padding:'22px clamp(18px,4vw,54px) 34px',background:'#080808'}}><h1 style={{fontSize:'clamp(24px,3vw,42px)',margin:'0 0 8px'}}>{v.title}</h1>{v.artist_name&&<div style={{color:'#bbb',marginBottom:10}}>{v.artist_name}</div>}{v.description&&<p style={{maxWidth:900,color:'#c9c9c9',lineHeight:1.6,margin:0}}>{v.description}</p>}</section>
 </main>
}
