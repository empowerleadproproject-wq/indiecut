import PublicHeader from './PublicHeader';
import PublicFooter from './PublicFooter';
import styles from './CategoryPage.module.css';
import {createClient as createServiceClient} from '@supabase/supabase-js';

export const revalidate=0;
function video(url?:string|null){return Boolean(url&&/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url))}
function spotify(url?:string|null){return Boolean(url&&/open\.spotify\.com\/(track|album|artist|playlist)\//i.test(url))}
async function spotifyCover(url?:string|null){
 if(!spotify(url))return '';
 try{
  const response=await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(String(url))}`,{cache:'no-store'});
  if(!response.ok)return '';
  const data=await response.json();
  return typeof data?.thumbnail_url==='string'?data.thumbnail_url:'';
 }catch{return ''}
}

export default async function CategoryPage({category,title,description}:{category:string;title:string;description:string}){
 const db=createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data}=await db.from('articles').select('*').eq('status','published').eq('verification_status','verified').eq('category',category).order('published_at',{ascending:false});
 const stories=data||[];const lead=stories[0];const rest=stories.slice(1);
 const leadCover=lead?.featured_media_url?await spotifyCover(lead.featured_media_url):'';
 const restCovers=await Promise.all(rest.map((s:any)=>spotifyCover(s.featured_media_url)));
 return <main className="site-shell"><PublicHeader/>
  <section className={`section ${styles.heading}`}><div className="kicker">INDIE CUT</div><h1>{title}</h1><p>{description}</p></section>
  {lead&&<section className={styles.lead}><a href={`/articles/${lead.slug}`} className={styles.leadMedia}>{lead.featured_media_url&&(video(lead.featured_media_url)?<video src={lead.featured_media_url} autoPlay muted loop playsInline/>:<img src={leadCover||lead.featured_media_url} alt={lead.headline}/>)}</a><div><div className="kicker">{title.toUpperCase()}</div><a href={`/articles/${lead.slug}`}><h2>{lead.headline}</h2></a>{lead.subheadline&&<p>{lead.subheadline}</p>}<a className={styles.read} href={`/articles/${lead.slug}`}>READ STORY →</a></div></section>}
  <section className={`grid ${styles.grid}`}>{rest.map((s:any,i:number)=><article className="card" key={s.id}>{s.featured_media_url&&<a href={`/articles/${s.slug}`}>{video(s.featured_media_url)?<video src={s.featured_media_url} autoPlay muted loop playsInline/>:<img src={restCovers[i]||s.featured_media_url} alt={s.headline}/>}</a>}<div className="kicker">{String(s.category||category).toUpperCase()}</div><a href={`/articles/${s.slug}`}><h2>{s.headline}</h2></a>{s.subheadline&&<p>{s.subheadline}</p>}<a href={`/articles/${s.slug}`}><strong>READ STORY →</strong></a></article>)}</section>
  {!stories.length&&<section className="section"><p>No published {title.toLowerCase()} stories yet.</p></section>}
  <PublicFooter/>
 </main>
}
