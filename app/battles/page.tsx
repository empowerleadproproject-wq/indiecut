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
    <a className="battle-rankings-link" href="/battles/rankings"><span className="battle-rankings-dot"/>SEE WHERE YOUR FAVORITE ARTIST RANKS →</a>
    {content.submission_open&&<div className={`${styles.artistInvite} battle-mobile-invite`}><strong>{content.artist_prompt}</strong><span>{content.artist_copy}</span><a href="/battles/submit">{content.secondary_button} →</a></div>}
   </div>
  </section>
  <style>{`
   .battle-mobile-center{width:min(760px,68%)!important;max-width:760px!important;box-sizing:border-box!important;padding:84px 0 72px!important;}
   .battle-mobile-center h1{font-size:clamp(38px,3.6vw,52px)!important;line-height:1.02!important;letter-spacing:-.035em!important;max-width:720px!important;margin:0 auto 18px!important;text-wrap:balance;}
   .battle-mobile-subhead{font-size:16px!important;line-height:1.5!important;max-width:540px!important;margin:0 auto 24px!important;}
   .battle-rankings-link{display:inline-flex;align-items:center;justify-content:center;gap:9px;margin-top:14px;padding:11px 18px;border:1px solid rgba(255,255,255,.25);border-radius:999px;color:#fff;text-decoration:none;font-size:11px;font-weight:900;letter-spacing:.08em;background:rgba(8,8,8,.6);backdrop-filter:blur(10px);transition:.2s ease;}
   .battle-rankings-link:hover{border-color:#e744bd;color:#fff;transform:translateY(-2px);background:rgba(231,68,189,.12);}
   .battle-rankings-dot{width:7px;height:7px;border-radius:50%;background:#e744bd;box-shadow:0 0 0 5px rgba(231,68,189,.14);}
   @media (max-width:1100px){
    .battle-mobile-center{width:min(700px,72%)!important;padding:82px 0 70px!important;}
    .battle-mobile-center h1{font-size:clamp(36px,4.4vw,48px)!important;max-width:660px!important;}
    .mobile-float-2{width:170px!important;}
    .mobile-float-4{width:175px!important;}
   }
   @media (max-width:820px){
    .battle-mobile-shell{padding:0 20px 28px!important;}
    .battle-mobile-center{width:min(620px,80%)!important;padding:90px 0 78px!important;}
    .battle-mobile-center h1{font-size:clamp(34px,5.2vw,43px)!important;max-width:560px!important;line-height:1.03!important;}
    .battle-mobile-subhead{font-size:15px!important;max-width:480px!important;}
    .mobile-float-2,.mobile-float-6{display:none!important;}
   }
   @media (max-width:620px){
    .battle-mobile-shell{padding:0 14px 24px!important;}
    .battle-mobile-hero{min-height:760px!important;display:block!important;}
    .battle-mobile-center{width:100%!important;max-width:100%!important;box-sizing:border-box!important;padding:205px 18px 165px!important;}
    .battle-mobile-kicker{font-size:9px!important;letter-spacing:.19em!important;margin-bottom:13px!important;white-space:nowrap;}
    .battle-mobile-center h1{font-size:31px!important;line-height:1.02!important;letter-spacing:-.032em!important;max-width:315px!important;margin:0 auto 16px!important;text-wrap:balance;}
    .battle-mobile-subhead{font-size:14px!important;line-height:1.45!important;max-width:300px!important;margin:0 auto 22px!important;}
    .battle-mobile-orbit{display:block!important;width:min(100%,300px)!important;margin:0 auto!important;}
    .battle-mobile-primary{display:block!important;width:100%!important;box-sizing:border-box!important;padding:14px 16px!important;font-size:12px!important;}
    .battle-rankings-link{display:flex;width:min(100%,300px);box-sizing:border-box;font-size:9px;padding:11px 10px;margin:10px auto 0;}
    .battle-mobile-invite{margin-top:18px!important;max-width:300px!important;font-size:12px!important;line-height:1.4!important;gap:6px!important;}
    .battle-mobile-invite strong{font-size:13px!important;}
    .battle-mobile-invite a{margin-top:5px!important;}
    .mobile-float-1{width:98px!important;height:130px!important;left:14px!important;top:34px!important;border-radius:13px!important;}
    .mobile-float-2{display:none!important;}
    .mobile-float-3{width:124px!important;height:86px!important;left:auto!important;right:14px!important;top:22px!important;border-radius:13px!important;}
    .mobile-float-4{display:none!important;}
    .mobile-float-5{width:112px!important;height:76px!important;left:14px!important;bottom:18px!important;border-radius:13px!important;}
    .mobile-float-6{display:none!important;}
    .mobile-float-7{width:126px!important;height:82px!important;right:14px!important;bottom:18px!important;border-radius:13px!important;}
   }
   @media (max-width:390px){
    .battle-mobile-center{padding:198px 12px 160px!important;}
    .battle-mobile-center h1{font-size:28px!important;max-width:286px!important;}
    .battle-mobile-kicker{font-size:8px!important;letter-spacing:.17em!important;}
    .battle-mobile-subhead{font-size:13px!important;max-width:280px!important;}
   }
  `}</style>
 </div><PublicFooter/></main>
}
