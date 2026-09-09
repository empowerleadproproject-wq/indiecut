import PublicHeader from './PublicHeader';
import {createClient as createServiceClient} from '@supabase/supabase-js';

export const revalidate=0;
function video(url?:string|null){return Boolean(url&&/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url))}
function Media({url,alt}:{url:string,alt:string}){return video(url)?<video src={url} autoPlay muted loop playsInline controls={false}/>:<img src={url} alt={alt}/>}
export default async function Home(){
 const db=createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const [{data:stories},{data:homeRow},{data:adRow}]=await Promise.all([
  db.from('articles').select('*').eq('status','published').eq('verification_status','verified').order('published_at',{ascending:false}).limit(12),
  db.from('site_settings').select('setting_value').eq('setting_key','admin_homepage').maybeSingle(),
  db.from('site_settings').select('setting_value').eq('setting_key','admin_advertising').maybeSingle()
 ]);
 let home:any={};let ads:any[]=[];try{home=JSON.parse(homeRow?.setting_value||'{}')}catch{}try{ads=JSON.parse(adRow?.setting_value||'[]')}catch{}
 const now=new Date().toISOString().slice(0,10);const liveAds=ads.filter(a=>a.active!==false&&(!a.start_date||a.start_date<=now)&&(!a.end_date||a.end_date>=now));const homeAd=liveAds.find(a=>a.placement==='homepage');
 return <main className="site-shell"><PublicHeader/><section className="hero">{home.hero_media_url&&<div className="hero-media"><Media url={home.hero_media_url} alt="Indie Cut"/></div>}<div className="kicker">{home.hero_eyebrow||'ENTERTAINMENT · CULTURE · INDEPENDENT VOICES'}</div><h1>{home.hero_headline||'The stories moving film, television, music and culture.'}</h1><p>{home.hero_subheadline||'Indie Cut covers verified entertainment news, emerging creators, independent projects and the people shaping culture — without rumor-driven reporting.'}</p></section>{homeAd&&<section className="ic-public-ad"><span>ADVERTISEMENT</span><a href={homeAd.destination_url||'#'}>{homeAd.creative_url&&(video(homeAd.creative_url)?<video src={homeAd.creative_url} autoPlay muted loop playsInline/>:<img src={homeAd.creative_url} alt={homeAd.advertiser||'Advertisement'}/>)}</a></section>}<section className="grid">{stories?.length?stories.map((s:any)=><article className="card" key={s.id}>{s.featured_media_url&&<a href={`/articles/${s.slug}`}><Media url={s.featured_media_url} alt={s.headline}/></a>}<div className="kicker">{s.category||'INDIE CUT'}</div><a href={`/articles/${s.slug}`}><h2>{s.headline}</h2></a>{s.subheadline&&<p>{s.subheadline}</p>}<a href={`/articles/${s.slug}`}><strong>READ STORY →</strong></a></article>):<article className="card"><div className="kicker">INDIE CUT</div><h2>No published stories yet.</h2><p>Once stories are published from the Back Office, they will appear here.</p></article>}</section><footer className="footer">© {new Date().getFullYear()} Indie Cut · Entertainment · Culture · Independent Voices</footer></main>
}
