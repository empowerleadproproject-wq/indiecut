import type {Metadata} from 'next';
import PublicHeader from '../PublicHeader';
import PublicFooter from '../PublicFooter';
import { createClient } from '../../lib/supabase/server';
export const revalidate=0;
export const metadata:Metadata={title:'Latest Stories',description:'The latest verified entertainment, culture, film, television, music and independent creator coverage from IndieCut.',alternates:{canonical:'/articles'}};
export default async function Articles(){const supabase=createClient();const {data}=await supabase.from('articles').select('*').eq('status','published').eq('verification_status','verified').order('published_at',{ascending:false});const stories=data||[];return <main><PublicHeader/><section className="section"><div className="kicker">LATEST COVERAGE</div><h1>Stories.</h1></section><section className="grid">{stories.map((s:any)=><article className="card" key={s.id}>{s.featured_media_url&&<a href={`/articles/${s.slug}`}><img src={s.featured_media_url} alt={s.headline}/></a>}<div className="kicker">{s.category||s.eyebrow||'INDIE CUT'}</div><a href={`/articles/${s.slug}`}><h2>{s.headline}</h2></a>{s.subheadline&&<p>{s.subheadline}</p>}<a href={`/articles/${s.slug}`}><strong>READ STORY →</strong></a></article>)}</section><PublicFooter/></main>}
