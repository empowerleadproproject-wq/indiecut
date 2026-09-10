import PublicHeader from '../PublicHeader';
import PublicFooter from '../PublicFooter';
import {createClient as createServiceClient} from '@supabase/supabase-js';

export const revalidate=0;
function db(){return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}

export default async function VideosPage(){
 const {data}=await db().from('media_items').select('*').in('media_type',['video','trailer','interview','clip']).order('created_at',{ascending:false});
 const videos=data||[];
 return <main><PublicHeader/><section style={{maxWidth:1180,margin:'0 auto',padding:'42px 22px 70px'}}>
  <div className="kicker">INDIE CUT WATCH</div><h1 style={{fontSize:'clamp(42px,7vw,82px)',lineHeight:.95,margin:'10px 0 14px'}}>WATCH</h1><p className="dek" style={{maxWidth:720}}>Interviews, performances, trailers, breaking clips and video stories from Indie Cut.</p>
  {videos.length===0?<div className="panel" style={{marginTop:30}}><strong>No videos published yet.</strong><p>New Indie Cut video stories will appear here.</p></div>:<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(290px,1fr))',gap:24,marginTop:34}}>{videos.map((v:any)=><article key={v.id} style={{borderTop:'4px solid #111',paddingTop:12}}><video src={v.media_url} poster={v.cover_url||undefined} controls playsInline preload="metadata" style={{width:'100%',aspectRatio:'9/16',maxHeight:620,background:'#000',objectFit:'cover'}}/><div className="kicker" style={{marginTop:12}}>{String(v.media_type||'video').toUpperCase()}</div><h2 style={{margin:'5px 0 6px'}}>{v.title}</h2>{v.artist_name&&<strong>{v.artist_name}</strong>}{v.description&&<p>{v.description}</p>}</article>)}</div>}
 </section><PublicFooter/></main>
}
