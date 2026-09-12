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
 return <main className={styles.landingPage} style={{background:'#050606'}}><PublicHeader/><div className={`${styles.landingShell} battle-mobile-shell`} style={{width:'100%',maxWidth:'none',margin:0,padding:'0 32px 32px',boxSizing:'border-box'}}>
  <section className={`${styles.landingHero} battle-mobile-hero`} style={{minHeight:'calc(100vh - 160px)',width:'100%',boxShadow:'none'}}>
   <div className={styles.landingMediaLayer}>{content.images.slice(0,7).map((src:string,i:number)=><div key={`${src}-${i}`} className={`${styles.floatingImage} ${styles[`float${i+1}` as keyof typeof styles]||''} mobile-float-${i+1}`}><img src={src} alt=""/></div>)}</div>
   <div className={`${styles.landingCenter} battle-mobile-center`}>
    <div className={`${styles.landingKicker} battle-mobile-kicker`}>INDIE CUT LIVE BATTLES</div>
    <h1>{content.headline}</h1>
    {content.subheadline&&<p className={`${styles.landingSubhead} battle-mobile-subhead`}>{content.subheadline}</p>}
    <div className={`${styles.landingButtonOrbit} battle-mobile-orbit`}><a className={`${styles.landingPrimary} battle-mobile-primary`} href="/battles/room">{content.primary_button}</a></div>
    {content.submission_open&&<div className={`${styles.artistInvite} battle-mobile-invite`}><strong>{content.artist_prompt}</strong><span>{content.artist_copy}</span><a href="/battles/submit">{content.secondary_button} →</a></div>}
   </div>
  </section>
  <style>{`
   @media (max-width:620px){
    .battle-mobile-shell{padding:0 14px 24px!important;}
    .battle-mobile-hero{min-height:760px!important;display:block!important;}
    .battle-mobile-center{width:100%!important;max-width:100%!important;box-sizing:border-box!important;padding:230px 20px 180px!important;}
    .battle-mobile-kicker{font-size:10px!important;letter-spacing:.2em!important;margin-bottom:14px!important;white-space:nowrap;}
    .battle-mobile-center h1{font-size:36px!important;line-height:.96!important;letter-spacing:-.04em!important;max-width:340px!important;margin:0 auto 18px!important;}
    .battle-mobile-subhead{font-size:16px!important;line-height:1.45!important;max-width:320px!important;margin:0 auto 24px!important;}
    .battle-mobile-orbit{width:min(100%,320px)!important;}
    .battle-mobile-primary{display:block!important;width:100%!important;box-sizing:border-box!important;padding:16px 18px!important;font-size:13px!important;}
    .battle-mobile-invite{margin-top:22px!important;max-width:320px!important;font-size:14px!important;line-height:1.4!important;gap:7px!important;}
    .battle-mobile-invite strong{font-size:14px!important;}
    .battle-mobile-invite a{margin-top:6px!important;}
    .mobile-float-1{width:108px!important;height:144px!important;left:18px!important;top:38px!important;border-radius:14px!important;}
    .mobile-float-2{display:none!important;}
    .mobile-float-3{width:138px!important;height:96px!important;left:auto!important;right:18px!important;top:22px!important;border-radius:14px!important;}
    .mobile-float-4{display:none!important;}
    .mobile-float-5{width:122px!important;height:82px!important;left:18px!important;bottom:20px!important;border-radius:14px!important;}
    .mobile-float-6{display:none!important;}
    .mobile-float-7{width:138px!important;height:88px!important;right:18px!important;bottom:20px!important;border-radius:14px!important;}
   }
   @media (max-width:390px){
    .battle-mobile-center{padding-left:14px!important;padding-right:14px!important;}
    .battle-mobile-center h1{font-size:33px!important;max-width:320px!important;}
    .battle-mobile-kicker{font-size:9px!important;letter-spacing:.18em!important;}
   }
  `}</style>
 </div><PublicFooter/></main>
}
