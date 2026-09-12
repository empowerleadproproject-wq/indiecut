import PublicHeader from '../PublicHeader';
import PublicFooter from '../PublicFooter';
import {battleDb} from '../../lib/battles';
import styles from './battles.module.css';

export const dynamic='force-dynamic';
export const revalidate=0;

const defaults={
 headline:'WHERE INDEPENDENT ARTISTS BATTLE FOR THE CROWN.',
 subheadline:'Two artists. One stage. The fans decide who moves forward.',
 primary_button:'ENTER THE BATTLE ROOM',
 artist_prompt:"Independent artist? Think you've got what it takes?",
 artist_copy:'Submit your music for a chance to compete in the next Indie Cut Battle.',
 secondary_button:'SUBMIT YOUR MUSIC',
 submission_open:true,
 images:[] as string[]
};

async function landingData(){
 const db=battleDb();
 const [{data:setting},{data:articles}]=await Promise.all([
  db.from('site_settings').select('setting_value').eq('setting_key','admin_battle_landing').maybeSingle(),
  db.from('articles').select('featured_media_url').not('featured_media_url','is',null).order('published_at',{ascending:false,nullsFirst:false}).limit(10)
 ]);
 let saved:any={};try{saved=JSON.parse(setting?.setting_value||'{}')}catch{}
 const articleImages=(articles||[]).map((x:any)=>x.featured_media_url).filter(Boolean);
 const configured=Array.isArray(saved.images)?saved.images:[];
 const images=Array.from({length:7},(_,i)=>configured[i]||articleImages[i]||'').filter(Boolean);
 return {...defaults,...saved,images};
}

export default async function BattlesLandingPage(){
 const content=await landingData();
 return <main className={styles.landingPage} style={{background:'#050606'}}><PublicHeader/><div className={styles.landingShell} style={{width:'100%',maxWidth:'none',margin:0,padding:0}}>
  <section className={styles.landingHero} style={{minHeight:'calc(100vh - 160px)',width:'100%',boxShadow:'none'}}>
   <div className={styles.landingMediaLayer}>{content.images.slice(0,7).map((src:string,i:number)=><div key={`${src}-${i}`} className={`${styles.floatingImage} ${styles[`float${i+1}` as keyof typeof styles]||''}`}><img src={src} alt=""/></div>)}</div>
   <div className={styles.landingCenter}>
    <div className={styles.landingKicker}>INDIE CUT LIVE BATTLES</div>
    <h1>{content.headline}</h1>
    {content.subheadline&&<p className={styles.landingSubhead}>{content.subheadline}</p>}
    <div className={styles.landingButtonOrbit}><a className={styles.landingPrimary} href="/battles/room">{content.primary_button}</a></div>
    {content.submission_open&&<div className={styles.artistInvite}><strong>{content.artist_prompt}</strong><span>{content.artist_copy}</span><a href="/battles/submit">{content.secondary_button} →</a></div>}
   </div>
  </section>
 </div><PublicFooter/></main>
}
