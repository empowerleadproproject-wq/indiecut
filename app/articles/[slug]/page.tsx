import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {headers} from 'next/headers';
import PublicHeader from '../../PublicHeader';
import PublicFooter from '../../PublicFooter';
import ShareButtons from './ShareButtons';
import AdCreative from './AdCreative';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {audienceMatches,isLocalTarget,visitorGeoFromHeaders} from '../../../lib/ad-targeting';

export const revalidate=0;
function video(url?:string|null){return Boolean(url&&/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url))}
function audio(url?:string|null){return Boolean(url&&/\.(mp3|wav|m4a|aac|ogg)(\?|$)/i.test(url))}
function spotifyEmbed(url?:string|null){const s=String(url||'');const m=s.match(/open\.spotify\.com\/(track|album|artist|playlist)\/([A-Za-z0-9]+)/i);return m?`https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`:''}
function youtubeEmbed(url?:string|null){const s=String(url||'');let id='';try{const u=new URL(s);if(u.hostname.includes('youtu.be'))id=u.pathname.replace(/^\//,'').split('/')[0];else if(u.hostname.includes('youtube.com'))id=u.searchParams.get('v')||u.pathname.match(/\/shorts\/([^/?]+)/)?.[1]||u.pathname.match(/\/embed\/([^/?]+)/)?.[1]||''}catch{}return id?`https://www.youtube.com/embed/${id}`:''}
function soundcloudEmbed(url?:string|null){const s=String(url||'');return /soundcloud\.com\//i.test(s)?`https://w.soundcloud.com/player/?url=${encodeURIComponent(s)}&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false`:''}
function isPlayableEmbed(url?:string|null){return Boolean(video(url)||audio(url)||spotifyEmbed(url)||youtubeEmbed(url)||soundcloudEmbed(url))}
function isLeadVideo(url?:string|null){return Boolean(video(url)||youtubeEmbed(url))}
function shuffled<T>(items:T[]){const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}return copy}
function priorityShuffle(items:any[]){return [...shuffled(items.filter(isLocalTarget)),...shuffled(items.filter(a=>!isLocalTarget(a)))]}
function adIsVideo(a:any){return Boolean(a?._isVideo)||String(a?.creative_media_type||'').startsWith('video/')||String(a?.creative_media_type||'')==='video'||video(a?.creative_url)}
async function classifyAd(a:any){if(adIsVideo(a))return {...a,_isVideo:true};const url=String(a?.creative_url||'');if(!url)return {...a,_isVideo:false};try{const r=await fetch(url,{method:'HEAD',cache:'no-store'});const type=String(r.headers.get('content-type')||'').toLowerCase();return {...a,_isVideo:type.startsWith('video/')};}catch{return {...a,_isVideo:false}}}
function pickRailAds(items:any[],limit=4){const pool=priorityShuffle(items);const vid=pool.find(adIsVideo);const rest=pool.filter(a=>a!==vid);return (vid?[vid,...rest]:rest).slice(0,limit)}
async function spotifyCover(url?:string|null){if(!spotifyEmbed(url))return '';try{const response=await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(String(url))}`,{cache:'no-store'});if(!response.ok)return '';const data=await response.json();return typeof data?.thumbnail_url==='string'?data.thumbnail_url:''}catch{return ''}}
function db(){return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}
function categoryPath(category?:string|null){const value=String(category||'').toLowerCase();return ['movies','tv','music','culture','independent'].includes(value)?`/${value}`:'/articles'}
const SITE_URL='https://indiecut.info';

async function FeaturedMedia({url,headline,showSpotifyArtwork=true}:{url:string;headline:string;showSpotifyArtwork?:boolean}){const sp=spotifyEmbed(url);const yt=youtubeEmbed(url);const sc=soundcloudEmbed(url);if(sp){const cover=showSpotifyArtwork?await spotifyCover(url):'';return <section style={{margin:'26px 0'}}>{cover&&<img src={cover} alt={headline} style={{display:'block',width:'100%',maxWidth:760,margin:'0 auto 20px',objectFit:'cover'}}/>}<iframe src={sp} width="100%" height="352" style={{border:0,borderRadius:12}} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title={`${headline} Spotify player`}/></section>}if(yt)return <section style={{margin:'26px 0'}}><div style={{position:'relative',paddingBottom:'56.25%',height:0,overflow:'hidden',borderRadius:12,background:'#000'}}><iframe src={yt} title={`${headline} video`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{position:'absolute',inset:0,width:'100%',height:'100%',border:0}}/></div></section>;if(sc)return <section style={{margin:'26px 0'}}><iframe width="100%" height="166" scrolling="no" frameBorder="no" allow="autoplay" src={sc} title={`${headline} SoundCloud player`}/></section>;if(video(url))return <video className="article-video" src={url} controls playsInline preload="metadata"/>;if(audio(url))return <section style={{margin:'26px 0'}}><audio src={url} controls preload="metadata" style={{width:'100%'}}/></section>;return <img src={url} alt={headline}/>}

function AdUnit({ad,className='ic-article-ad-slot'}:{ad:any;className?:string}){const creative=ad?.creative_url;if(!creative)return null;const media=<AdCreative src={creative} alt={ad.advertiser||ad.title||'Advertisement'} mediaType={ad.creative_media_type||''} isVideo={Boolean(ad._isVideo)}/>;return <div className={className}><span>ADVERTISEMENT</span>{ad.destination_url?<a href={ad.destination_url} target="_blank" rel="noreferrer sponsored">{media}</a>:media}</div>}

export async function generateMetadata({params}:{params:{slug:string}}):Promise<Metadata>{const {data}=await db().from('articles').select('headline,subheadline,featured_media_url,slug,published_at,updated_at,author_name,category').eq('slug',decodeURIComponent(params.slug)).eq('status','published').eq('verification_status','verified').maybeSingle();if(!data)return {title:'IndieCut'};const url=`${SITE_URL}/articles/${encodeURIComponent(data.slug)}`;const description=data.subheadline||data.headline;const spotifyImage=data.featured_media_url?await spotifyCover(data.featured_media_url):'';const image=spotifyImage||(data.featured_media_url&&!isPlayableEmbed(data.featured_media_url)?data.featured_media_url:undefined);return {title:data.headline,description,alternates:{canonical:url},robots:{index:true,follow:true,googleBot:{index:true,follow:true,'max-image-preview':'large','max-snippet':-1,'max-video-preview':-1}},openGraph:{type:'article',siteName:'IndieCut',title:data.headline,description,url,images:image?[{url:image,alt:data.headline}]:undefined,publishedTime:data.published_at||undefined,modifiedTime:data.updated_at||undefined,authors:[data.author_name||'IndieCut Editorial'],section:data.category||undefined},twitter:{card:image?'summary_large_image':'summary',title:data.headline,description,images:image?[image]:undefined}}}

export default async function ArticlePage({params}:{params:{slug:string}}){
 const client=db();const {data}=await client.from('articles').select('*').eq('slug',decodeURIComponent(params.slug)).eq('status','published').eq('verification_status','verified').maybeSingle();if(!data)notFound();
 const [{data:adRow},{data:musicRow},{data:relatedRows}]=await Promise.all([client.from('site_settings').select('setting_value').eq('setting_key','admin_advertising').maybeSingle(),client.from('site_settings').select('setting_value').eq('setting_key',`article_media_${data.id}`).maybeSingle(),client.from('articles').select('headline,slug,subheadline,category,published_at').eq('status','published').eq('verification_status','verified').eq('category',data.category).neq('id',data.id).order('published_at',{ascending:false}).limit(4)]);
 let ads:any[]=[];try{ads=JSON.parse(adRow?.setting_value||'[]')}catch{}let music:any=null;try{music=musicRow?.setting_value?JSON.parse(musicRow.setting_value):null}catch{}
 const supplementalMedia=String(music?.spotify||music?.media_url||'').trim();const showSupplementalMedia=Boolean(supplementalMedia&&supplementalMedia!==data.featured_media_url&&isPlayableEmbed(supplementalMedia));
 const leadVideo=String(data.lead_video_url||'').trim();const showLeadVideo=Boolean(leadVideo&&isLeadVideo(leadVideo));
 const geo=visitorGeoFromHeaders(headers());const now=new Date().toISOString().slice(0,10);const liveAds=ads.filter(a=>a?.creative_url&&a.active!==false&&(!a.start_date||a.start_date<=now)&&(!a.end_date||a.end_date>=now)&&audienceMatches(a,geo));const typedAds=await Promise.all(liveAds.map(classifyAd));
 const railAds=pickRailAds(typedAds.filter(a=>!a.placement||a.placement==='right-rail'||a.placement==='homepage'||a.placement==='sitewide'),4);
 const topAds=priorityShuffle(typedAds.filter(a=>a.placement==='article-top'||a.placement==='sitewide')).slice(0,1);
 const inlineAds=priorityShuffle(typedAds.filter(a=>a.placement==='article-inline'||a.placement==='sitewide')).slice(0,2);
 const paragraphs=String(data.body||'').split(/\n\n+/).filter(Boolean);
 const canonicalUrl=`${SITE_URL}/articles/${encodeURIComponent(data.slug)}`;
 const sources=Array.isArray(data.sources)?data.sources.filter((s:any)=>/^https?:\/\//i.test(String(s||''))):[];
 const authorName=String(data.author_name||'IndieCut Editorial');
 const articleSchema={
  '@context':'https://schema.org',
  '@type':'NewsArticle',
  '@id':`${canonicalUrl}#article`,
  mainEntityOfPage:{'@type':'WebPage','@id':canonicalUrl},
  headline:data.headline,
  description:data.subheadline||data.headline,
  datePublished:data.published_at||data.created_at||undefined,
  dateModified:data.updated_at||data.published_at||data.created_at||undefined,
  articleSection:data.category||undefined,
  keywords:[data.subject_name,data.category].filter(Boolean).join(', ')||undefined,
  image:data.featured_media_url&&!isPlayableEmbed(data.featured_media_url)?[data.featured_media_url]:undefined,
  author:{'@type':/^indiecut/i.test(authorName)?'Organization':'Person',name:authorName},
  publisher:{'@type':'Organization','@id':`${SITE_URL}/#organization`,name:'IndieCut',url:SITE_URL},
  isAccessibleForFree:true,
  citation:sources.length?sources:undefined,
  inLanguage:'en-US'
 };
 const sectionUrl=`${SITE_URL}${categoryPath(data.category)}`;
 const breadcrumbSchema={
  '@context':'https://schema.org',
  '@type':'BreadcrumbList',
  itemListElement:[
   {'@type':'ListItem',position:1,name:'IndieCut',item:SITE_URL},
   {'@type':'ListItem',position:2,name:String(data.category||'Articles').replace(/^./,(m:string)=>m.toUpperCase()),item:sectionUrl},
   {'@type':'ListItem',position:3,name:data.headline,item:canonicalUrl}
  ]
 };
 return <main><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify([articleSchema,breadcrumbSchema]).replace(/</g,'\\u003c')}}/><PublicHeader/><div className="ic-article-page-grid"><article className="article"><a className="kicker ic-category-link" href={categoryPath(data.category)}>{String(data.category||'INDIECUT').toUpperCase()} →</a><h1>{data.headline}</h1>{data.subheadline&&<p className="dek">{data.subheadline}</p>}<div className="meta">{authorName}{data.published_at?` · ${new Date(data.published_at).toLocaleDateString()}`:''}</div><ShareButtons headline={data.headline}/>
   {topAds.map((ad:any,i:number)=><AdUnit key={ad._id||ad.id||`top-${i}`} ad={ad} className="ic-article-top-ad"/>)}
   {showLeadVideo&&<section className="ic-lead-video"><div className="kicker">WATCH</div><FeaturedMedia url={leadVideo} headline={data.headline} showSpotifyArtwork={false}/>{data.lead_video_source_url&&<div className="ic-video-source"><a href={data.lead_video_source_url} target="_blank" rel="noreferrer">View original video source ↗</a></div>}</section>}
   {data.featured_media_url&&<FeaturedMedia url={data.featured_media_url} headline={data.headline}/>} 
   {showSupplementalMedia&&<section style={{margin:'24px 0'}}><div className="kicker">LISTEN / WATCH</div>{music.title&&<h3>{music.title}</h3>}<FeaturedMedia url={supplementalMedia} headline={music.title||data.headline} showSpotifyArtwork={false}/></section>}
   {paragraphs.map((p:string,i:number)=><div key={i}><p>{p}</p>{i===1&&inlineAds[0]&&<AdUnit ad={inlineAds[0]} className="ic-article-inline-ad"/>}{i===4&&inlineAds[1]&&<AdUnit ad={inlineAds[1]} className="ic-article-inline-ad"/>}</div>)}
   {sources.length>0&&<section><div className="kicker">VERIFIED SOURCES</div><ul>{sources.map((s:string,i:number)=><li key={i}><a href={s} target="_blank" rel="noreferrer">{s}</a></li>)}</ul></section>}
   {Array.isArray(relatedRows)&&relatedRows.length>0&&<section className="ic-related-stories" aria-label="Related stories"><div className="kicker">MORE FROM INDIECUT</div><div className="ic-related-grid">{relatedRows.map((row:any)=><a key={row.slug} href={`/articles/${encodeURIComponent(row.slug)}`}><strong>{row.headline}</strong>{row.subheadline&&<span>{row.subheadline}</span>}</a>)}</div></section>}
  </article>{railAds.length>0&&<aside className="ic-article-ad-rail" aria-label="Advertisements">{railAds.map((ad:any,i:number)=><AdUnit key={ad._id||ad.id||`${ad.creative_url}-${i}`} ad={ad}/>)}</aside>}</div>
  <style>{`
   .ic-article-page-grid{width:min(1240px,calc(100% - 40px));margin:0 auto;display:grid;grid-template-columns:minmax(0,850px) 320px;gap:36px;align-items:start}
   .ic-article-page-grid .article{width:auto;max-width:none;margin:0;padding-left:0;padding-right:0}.ic-article-ad-rail{padding-top:50px;display:flex;flex-direction:column;gap:24px;position:sticky;top:76px;align-self:start}.ic-article-ad-slot{width:100%;border-top:1px solid #ccc;border-bottom:1px solid #ddd;background:#fff;padding:10px 0 16px}.ic-article-ad-slot>span,.ic-article-top-ad>span,.ic-article-inline-ad>span{display:block;text-align:center;font-size:9px;line-height:1;letter-spacing:1.2px;color:#888;margin-bottom:9px;font-weight:700}.ic-article-ad-slot a,.ic-article-top-ad a,.ic-article-inline-ad a{display:block}.ic-article-ad-slot img,.ic-article-ad-slot video{display:block;width:100%;height:auto;min-height:180px;max-height:500px;object-fit:contain;margin:0;background:#000}.ic-article-top-ad,.ic-article-inline-ad{width:100%;margin:24px 0;padding:10px 0 16px;border-top:1px solid #ddd;border-bottom:1px solid #ddd}.ic-article-top-ad img,.ic-article-top-ad video,.ic-article-inline-ad img,.ic-article-inline-ad video{display:block;width:100%;height:auto;min-height:220px;max-height:520px;object-fit:contain;margin:0 auto;background:#000}.ic-lead-video{margin:28px 0 30px}.ic-lead-video>.kicker{margin-bottom:8px}.ic-video-source{margin-top:-14px;font-size:12px}.ic-video-source a{color:#666;text-decoration:underline}.ic-related-stories{margin-top:42px;padding-top:24px;border-top:1px solid #ddd}.ic-related-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.ic-related-grid>a{display:flex;flex-direction:column;gap:6px;padding:16px;border:1px solid #e2e2e2;text-decoration:none;color:inherit}.ic-related-grid>a:hover{border-color:#111}.ic-related-grid strong{font-size:17px;line-height:1.25}.ic-related-grid span{font-size:13px;line-height:1.4;color:#666}
   @media(max-width:1100px){.ic-article-page-grid{display:block;width:min(850px,calc(100% - 32px))}.ic-article-page-grid .article{padding-left:0;padding-right:0}.ic-article-ad-rail{position:static;padding-top:28px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}}
   @media(max-width:640px){.ic-article-ad-rail,.ic-related-grid{grid-template-columns:1fr}}
  `}</style><PublicFooter/></main>
}
