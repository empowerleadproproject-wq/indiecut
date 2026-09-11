import './home.css';
import type {Metadata} from 'next';
import PublicHeader from './PublicHeader';
import PublicFooter from './PublicFooter';
import AdCreative from './AdCreative';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {unstable_noStore as noStore} from 'next/cache';

export const dynamic='force-dynamic';
export const revalidate=0;
const SITE_URL=(process.env.NEXT_PUBLIC_SITE_URL||'https://indiecut.vercel.app').replace(/\/$/,'');
function db(){return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}
function video(url?:string|null){return Boolean(url&&/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url))}
function Media({url,alt,className}:{url:string,alt:string,className?:string}){return video(url)?<video className={className} src={url} autoPlay muted loop playsInline controls={false}/>:<img className={className} src={url} alt={alt}/>}
function shuffled<T>(items:T[]){const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
function isLiveAd(a:any,now:string){return a?.active!==false&&(!a.start_date||a.start_date<=now)&&(!a.end_date||a.end_date>=now)}
function adIsVideo(a:any){return String(a?.creative_media_type||'').startsWith('video/')||video(a?.creative_url)}
function pickRailAds(items:any[],limit=4){const pool=shuffled(items);const vid=pool.find(adIsVideo);const rest=pool.filter(a=>a!==vid);return (vid?[vid,...rest]:rest).slice(0,limit)}

export async function generateMetadata():Promise<Metadata>{
 const client=db();
 const {data}=await client.from('articles').select('headline,subheadline,featured_media_url').eq('status','published').eq('verification_status','verified').not('featured_media_url','is',null).order('published_at',{ascending:false}).limit(1).maybeSingle();
 const image=data?.featured_media_url&&!video(data.featured_media_url)?data.featured_media_url:undefined;
 const title='Indie Cut | Entertainment, Culture & Independent Voices';
 const description='Verified entertainment news, movies, TV, music, culture and independent voices.';
 return {title,description,alternates:{canonical:SITE_URL},openGraph:{type:'website',siteName:'Indie Cut',title,description,url:SITE_URL,images:image?[{url:image,alt:data?.headline||'Indie Cut'}]:undefined},twitter:{card:image?'summary_large_image':'summary',title,description,images:image?[image]:undefined}};
}

export default async function Home(){
 noStore();const client=db();
 const [{data:storiesData},{data:adRow},{data:homeRow}]=await Promise.all([
  client.from('articles').select('*').eq('status','published').eq('verification_status','verified').order('published_at',{ascending:false}).limit(24),
  client.from('site_settings').select('setting_value').eq('setting_key','admin_advertising').maybeSingle(),
  client.from('site_settings').select('setting_value').eq('setting_key','admin_homepage').maybeSingle()
 ]);
 const stories=storiesData||[];let ads:any[]=[];let home:any={};try{ads=JSON.parse(adRow?.setting_value||'[]')}catch{}try{home=JSON.parse(homeRow?.setting_value||'{}')}catch{}
 const accent=String(home.accent_color||'#d71920');const now=new Date().toISOString().slice(0,10);const liveAds=ads.filter(a=>isLiveAd(a,now));const rightRailAds=pickRailAds(liveAds.filter(a=>['right-rail','homepage'].includes(a.placement)),4);const trendingPool=stories.slice(0,Math.min(6,stories.length));const lead=trendingPool.length?trendingPool[Math.floor(Math.random()*trendingPool.length)]:null;const secondary=stories.filter(s=>s.id!==lead?.id);const latest=secondary.slice(0,7);const below=secondary.slice(0,12);
 return <main className="site-shell ic-homepage" style={{'--ic-accent':accent} as any}><PublicHeader/>
  <div className="ic-breaking-bar"><span>INDIE CUT TRENDING</span><strong>{lead?.headline||'Entertainment, culture and independent voices'}</strong></div>
  <section className="ic-home-main"><div className="ic-home-lead-column">{lead?<article className="ic-lead-story"><div className="ic-trending-badge">TRENDING</div>{lead.featured_media_url&&<a href={`/articles/${lead.slug}`} className="ic-lead-media"><Media url={lead.featured_media_url} alt={lead.headline}/></a>}<div className="ic-lead-category">{String(lead.category||'ENTERTAINMENT').toUpperCase()}</div><a href={`/articles/${lead.slug}`}><h1>{lead.headline}</h1></a>{lead.subheadline&&<p>{lead.subheadline}</p>}<div className="ic-lead-byline">{lead.author_name?`BY ${String(lead.author_name).toUpperCase()}`:'INDIE CUT EDITORIAL'}</div></article>:<article className="ic-lead-story"><div className="ic-trending-badge">TRENDING</div><h1>Indie Cut</h1><p>Published stories will appear here.</p></article>}</div><aside className="ic-latest-rail"><h2>LATEST NEWS</h2><div className="ic-latest-list">{latest.map((s:any)=><a href={`/articles/${s.slug}`} key={s.id} className="ic-latest-item"><div><span>{String(s.category||'NEWS').toUpperCase()}</span>{s.published_at&&<time>{new Date(s.published_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</time>}</div><strong>{s.headline}</strong></a>)}</div>{rightRailAds.map((ad:any,i:number)=><div className="ic-rail-ad" key={ad._id||ad.id||i}><span>ADVERTISEMENT</span>{ad.creative_url&&<a href={ad.destination_url||'#'} target="_blank" rel="noreferrer sponsored"><AdCreative src={ad.creative_url} alt={ad.advertiser||'Advertisement'} mediaType={ad.creative_media_type||''}/></a>}</div>)}</aside></section>
  {below.length>0&&<section className="ic-home-sections"><div className="ic-section-title"><span>MORE FROM INDIE CUT</span></div><div className="ic-story-grid">{below.map((s:any)=><article key={s.id}><a href={`/articles/${s.slug}`}>{s.featured_media_url&&<Media url={s.featured_media_url} alt={s.headline}/>}<span>{String(s.category||'NEWS').toUpperCase()}</span><h3>{s.headline}</h3>{s.subheadline&&<p>{s.subheadline}</p>}</a></article>)}</div></section>}
  <PublicFooter/>
 </main>
}
