import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import PublicHeader from '../../PublicHeader';
import PublicFooter from '../../PublicFooter';
import ShareButtons from './ShareButtons';
import {createClient as createServiceClient} from '@supabase/supabase-js';

export const revalidate=0;
function video(url?:string|null){return Boolean(url&&/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url))}
function audio(url?:string|null){return Boolean(url&&/\.(mp3|wav|m4a|aac|ogg)(\?|$)/i.test(url))}
function spotifyEmbed(url?:string|null){const s=String(url||'');const m=s.match(/open\.spotify\.com\/(track|album|artist|playlist)\/([A-Za-z0-9]+)/i);return m?`https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`:''}
function youtubeEmbed(url?:string|null){const s=String(url||'');let id='';try{const u=new URL(s);if(u.hostname.includes('youtu.be'))id=u.pathname.replace(/^\//,'').split('/')[0];else if(u.hostname.includes('youtube.com'))id=u.searchParams.get('v')||u.pathname.match(/\/shorts\/([^/?]+)/)?.[1]||u.pathname.match(/\/embed\/([^/?]+)/)?.[1]||''}catch{}return id?`https://www.youtube.com/embed/${id}`:''}
function soundcloudEmbed(url?:string|null){const s=String(url||'');return /soundcloud\.com\//i.test(s)?`https://w.soundcloud.com/player/?url=${encodeURIComponent(s)}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false`:''}
function isPlayableEmbed(url?:string|null){return Boolean(video(url)||audio(url)||spotifyEmbed(url)||youtubeEmbed(url)||soundcloudEmbed(url))}
function db(){return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}
function categoryPath(category?:string|null){const value=String(category||'').toLowerCase();return ['movies','tv','music','culture','independent'].includes(value)?`/${value}`:'/articles'}
const SITE_URL=(process.env.NEXT_PUBLIC_SITE_URL||'https://indiecut.vercel.app').replace(/\/$/,'');

function FeaturedMedia({url,headline}:{url:string;headline:string}){
 const sp=spotifyEmbed(url);const yt=youtubeEmbed(url);const sc=soundcloudEmbed(url);
 if(sp)return <section style={{margin:'26px 0'}}><iframe src={sp} width="100%" height="352" style={{border:0,borderRadius:12}} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title={`${headline} Spotify player`}/></section>;
 if(yt)return <section style={{margin:'26px 0'}}><div style={{position:'relative',paddingBottom:'56.25%',height:0,overflow:'hidden',borderRadius:12}}><iframe src={yt} title={`${headline} video`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{position:'absolute',inset:0,width:'100%',height:'100%',border:0}}/></div></section>;
 if(sc)return <section style={{margin:'26px 0'}}><iframe width="100%" height="166" scrolling="no" frameBorder="no" allow="autoplay" src={sc} title={`${headline} SoundCloud player`}/></section>;
 if(video(url))return <video className="article-video" src={url} controls playsInline/>;
 if(audio(url))return <section style={{margin:'26px 0'}}><audio src={url} controls preload="metadata" style={{width:'100%'}}/></section>;
 return <img src={url} alt={headline}/>;
}

export async function generateMetadata({params}:{params:{slug:string}}):Promise<Metadata>{
 const {data}=await db().from('articles').select('headline,subheadline,featured_media_url,slug').eq('slug',decodeURIComponent(params.slug)).eq('status','published').eq('verification_status','verified').maybeSingle();
 if(!data)return {title:'Indie Cut'};
 const url=`${SITE_URL}/articles/${encodeURIComponent(data.slug)}`;const description=data.subheadline||data.headline;const image=data.featured_media_url&&!isPlayableEmbed(data.featured_media_url)?data.featured_media_url:undefined;
 return {title:`${data.headline} | Indie Cut`,description,alternates:{canonical:url},openGraph:{type:'article',siteName:'Indie Cut',title:data.headline,description,url,images:image?[{url:image,alt:data.headline}]:undefined},twitter:{card:image?'summary_large_image':'summary',title:data.headline,description,images:image?[image]:undefined}};
}

export default async function ArticlePage({params}:{params:{slug:string}}){
 const client=db();const [{data},{data:adRow}]=await Promise.all([client.from('articles').select('*').eq('slug',decodeURIComponent(params.slug)).eq('status','published').eq('verification_status','verified').maybeSingle(),client.from('site_settings').select('setting_value').eq('setting_key','admin_advertising').maybeSingle()]);if(!data)notFound();
 let ads:any[]=[];try{ads=JSON.parse(adRow?.setting_value||'[]')}catch{}const now=new Date().toISOString().slice(0,10);const ad=ads.find(a=>a.active!==false&&a.placement==='article-inline'&&(!a.start_date||a.start_date<=now)&&(!a.end_date||a.end_date>=now));const paragraphs=String(data.body||'').split(/\n\n+/).filter(Boolean);
 return <main><PublicHeader/><article className="article"><a className="kicker ic-category-link" href={categoryPath(data.category)}>{String(data.category||'INDIE CUT').toUpperCase()} →</a><h1>{data.headline}</h1>{data.subheadline&&<p className="dek">{data.subheadline}</p>}<div className="meta">{data.author_name||'Indie Cut Editorial'}{data.published_at?` · ${new Date(data.published_at).toLocaleDateString()}`:''}</div><ShareButtons headline={data.headline}/>{data.featured_media_url&&<FeaturedMedia url={data.featured_media_url} headline={data.headline}/>} {paragraphs.map((p:string,i:number)=><div key={i}>{i===2&&ad?<section className="ic-public-ad inline"><span>ADVERTISEMENT</span><a href={ad.destination_url||'#'}>{ad.creative_url&&(video(ad.creative_url)?<video src={ad.creative_url} autoPlay muted loop playsInline/>:<img src={ad.creative_url} alt={ad.advertiser||'Advertisement'}/>)}</a></section>:null}<p>{p}</p></div>)}{Array.isArray(data.sources)&&data.sources.length>0&&<section><div className="kicker">VERIFIED SOURCES</div><ul>{data.sources.map((s:string,i:number)=><li key={i}><a href={s} target="_blank" rel="noreferrer">{s}</a></li>)}</ul></section>}</article><PublicFooter/></main>
}
