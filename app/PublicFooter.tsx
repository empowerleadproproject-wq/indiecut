import './footer.css';
import {createClient as createServiceClient} from '@supabase/supabase-js';

export const dynamic='force-dynamic';

export default async function PublicFooter(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 let settings:any={publication_name:'Indie Cut',tagline:'Entertainment · Culture · Independent Voices',footer_copy:'Indie Cut',footer_color:'#111111',instagram:'',youtube:'',tiktok:''};
 if(url&&key){
  try{
   const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data}=await db.from('site_settings').select('setting_value').eq('setting_key','admin_settings').maybeSingle();
   if(data?.setting_value)settings={...settings,...JSON.parse(data.setting_value)};
  }catch{}
 }
 const color=String(settings.footer_color||'#111111');
 const year=new Date().getFullYear();
 return <footer className="ic-site-footer" style={{backgroundColor:color}}>
  <div className="ic-footer-inner">
   <div className="ic-footer-brand-block"><a href="/" className="ic-footer-brand">{settings.publication_name||'Indie Cut'}</a><p>{settings.tagline||'Entertainment · Culture · Independent Voices'}</p></div>
   <nav className="ic-footer-nav"><a href="/">Home</a><a href="/movies">Movies</a><a href="/tv">TV</a><a href="/music">Music</a><a href="/culture">Culture</a><a href="/independent">Independent</a><a href="/articles">Latest</a></nav>
   <div className="ic-footer-bottom"><span>© {year} {settings.footer_copy||settings.publication_name||'Indie Cut'}</span><div className="ic-footer-social">{settings.instagram&&<a href={settings.instagram} target="_blank" rel="noreferrer">Instagram</a>}{settings.youtube&&<a href={settings.youtube} target="_blank" rel="noreferrer">YouTube</a>}{settings.tiktok&&<a href={settings.tiktok} target="_blank" rel="noreferrer">TikTok</a>}</div></div>
  </div>
 </footer>
}
