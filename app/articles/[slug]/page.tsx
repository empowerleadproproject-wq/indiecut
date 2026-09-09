import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import PublicHeader from '../../PublicHeader';
import ShareButtons from './ShareButtons';
import {createClient as createServiceClient} from '@supabase/supabase-js';

export const revalidate=0;
function video(url?:string|null){return Boolean(url&&/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url))}
function db(){return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}
const SITE_URL=(process.env.NEXT_PUBLIC_SITE_URL||'https://indiecut.vercel.app').replace(/\/$/,'');

export async function generateMetadata({params}:{params:{slug:string}}):Promise<Metadata>{
 const {data}=await db().from('articles').select('headline,subheadline,featured_media_url,slug').eq('slug',decodeURIComponent(params.slug)).eq('status','published').eq('verification_status','verified').maybeSingle();
 if(!data)return {title:'Indie Cut'};
 const url=`${SITE_URL}/articles/${encodeURIComponent(data.slug)}`;
 const description=data.subheadline||data.headline;
 const image=data.featured_media_url&&!video(data.featured_media_url)?data.featured_media_url:undefined;
 return {
  title:`${data.headline} | Indie Cut`,description,
  alternates:{canonical:url},
  openGraph:{type:'article',siteName:'Indie Cut',title:data.headline,description,url,images:image?[{url:image,alt:data.headline}]:undefined},
  twitter:{card:image?'summary_large_image':'summary',title:data.headline,description,images:image?[image]:undefined}
 };
}

export default async function ArticlePage({params}:{params:{slug:string}}){
 const client=db();
 const [{data},{data:adRow}]=await Promise.all([client.from('articles').select('*').eq('slug',decodeURIComponent(params.slug)).eq('status','published').eq('verification_status','verified').maybeSingle(),client.from('site_settings').select('setting_value').eq('setting_key','admin_advertising').maybeSingle()]);if(!data)notFound();
 let ads:any[]=[];try{ads=JSON.parse(adRow?.setting_value||'[]')}catch{}const now=new Date().toISOString().slice(0,10);const ad=ads.find(a=>a.active!==false&&a.placement==='article-inline'&&(!a.start_date||a.start_date<=now)&&(!a.end_date||a.end_date>=now));
 const paragraphs=String(data.body||'').split(/\n\n+/).filter(Boolean);
 return <main><PublicHeader/><article className="article"><div className="kicker">{data.category||'INDIE CUT'}</div><h1>{data.headline}</h1>{data.subheadline&&<p className="dek">{data.subheadline}</p>}<div className="meta">{data.author_name||'Indie Cut Editorial'}{data.published_at?` · ${new Date(data.published_at).toLocaleDateString()}`:''}</div><ShareButtons headline={data.headline}/>{data.featured_media_url&&(video(data.featured_media_url)?<video className="article-video" src={data.featured_media_url} controls playsInline/>:<img src={data.featured_media_url} alt={data.headline}/>)}{paragraphs.map((p:string,i:number)=><div key={i}>{i===2&&ad?<section className="ic-public-ad inline"><span>ADVERTISEMENT</span><a href={ad.destination_url||'#'}>{ad.creative_url&&(video(ad.creative_url)?<video src={ad.creative_url} autoPlay muted loop playsInline/>:<img src={ad.creative_url} alt={ad.advertiser||'Advertisement'}/>)}</a></section>:null}<p>{p}</p></div>)}{Array.isArray(data.sources)&&data.sources.length>0&&<section><div className="kicker">VERIFIED SOURCES</div><ul>{data.sources.map((s:string,i:number)=><li key={i}><a href={s} target="_blank" rel="noreferrer">{s}</a></li>)}</ul></section>}</article></main>
}
