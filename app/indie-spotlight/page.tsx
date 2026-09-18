import '../home.css';
import './spotlight.css';
import type {Metadata} from 'next';
import PublicHeader from '../PublicHeader';
import PublicFooter from '../PublicFooter';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {unstable_noStore as noStore} from 'next/cache';

export const dynamic='force-dynamic'; export const revalidate=0;
export const metadata:Metadata={title:'Indie Spotlight | Indie Cut',description:'Discover verified independent music artists, filmmakers and creators featured by Indie Cut.'};
function db(){return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}
function video(url?:string|null){return Boolean(url&&/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url))}
function Media({url,alt}:{url:string,alt:string}){return video(url)?<video src={url} autoPlay muted loop playsInline/>:<img src={url} alt={alt}/>}
function label(category:string){const c=String(category||'');if(c==='indie-music-spotlight')return 'MUSIC SPOTLIGHT';if(c==='indie-film-spotlight')return 'FILMMAKER SPOTLIGHT';return 'CREATOR SPOTLIGHT'}
export default async function IndieSpotlightPage(){noStore();const client=db();const {data}=await client.from('articles').select('*').eq('status','published').eq('verification_status','verified').in('category',['indie-music-spotlight','indie-film-spotlight','indie-creator-spotlight']).order('published_at',{ascending:false}).limit(60);const stories=data||[];return <main className="site-shell ic-homepage"><PublicHeader/><section className="ic-home-sections ic-spotlight-page"><div className="ic-spotlight-hero"><span>INDIE CUT PRESENTS</span><h1>INDIE SPOTLIGHT</h1><p>Independent artists, filmmakers and creators worth knowing — researched and verified by Indie Cut.</p></div><div className="ic-spotlight-filters"><a href="#all">ALL</a><a href="#music">MUSIC</a><a href="#film">FILMMAKERS</a><a href="#creators">CREATORS</a></div><div id="all" className="ic-story-grid">{stories.map((s:any)=><article key={s.id} data-spotlight={s.category}><a href={`/articles/${s.slug}`}>{s.featured_media_url&&<Media url={s.featured_media_url} alt={s.headline}/>}<span>{label(s.category)}</span><h3>{s.headline}</h3>{s.subheadline&&<p>{s.subheadline}</p>}</a></article>)}</div>{stories.length===0&&<div className="ic-spotlight-empty"><h2>Spotlights are coming.</h2><p>New independent creator profiles will appear here as they are verified and published.</p></div>}</section><PublicFooter/></main>}