import PublicHeader from './PublicHeader';
import { createClient } from '../lib/supabase/server';

export const revalidate=0;

export default async function Home(){
 const supabase=createClient();
 const {data}=await supabase.from('articles').select('*').eq('status','published').order('published_at',{ascending:false}).limit(12);
 const stories=data||[];
 return <main className="site-shell"><PublicHeader/><section className="hero"><div className="kicker">ENTERTAINMENT · CULTURE · INDEPENDENT VOICES</div><h1>The stories moving film, television, music and culture.</h1><p>Indie Cut covers verified entertainment news, emerging creators, independent projects and the people shaping culture — without rumor-driven reporting.</p></section><section className="grid">{stories.length?stories.map((s:any)=><article className="card" key={s.id}>{s.featured_media_url&&<a href={`/articles/${s.slug}`}><img src={s.featured_media_url} alt={s.headline}/></a>}<div className="kicker">{s.category||s.eyebrow||'INDIE CUT'}</div><a href={`/articles/${s.slug}`}><h2>{s.headline}</h2></a>{s.subheadline&&<p>{s.subheadline}</p>}<a href={`/articles/${s.slug}`}><strong>READ STORY →</strong></a></article>):<article className="card"><div className="kicker">INDIE CUT</div><h2>No published stories yet.</h2><p>Once stories are published from the Back Office, they will appear here.</p></article>}</section><footer className="footer">© {new Date().getFullYear()} Indie Cut · Entertainment · Culture · Independent Voices</footer></main>
}
