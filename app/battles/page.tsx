import PublicHeader from '../PublicHeader';
import PublicFooter from '../PublicFooter';
import {battleDb} from '../../lib/battles';
import styles from './battles.module.css';

export const dynamic='force-dynamic';
export const revalidate=0;

const defaults={
 headline:'WHERE INDEPENDENT ARTISTS BATTLE FOR THE CROWN.',
 subheadline:'Two artists. One stage. The fans decide who moves forward.',
 primary_button:'SUBMIT YOUR MUSIC',
 artist_prompt:"Independent artist? Think you've got what it takes?",
 artist_copy:'Submit your music for a chance to compete in the next Indie Cut Battle.',
 secondary_button:'WATCH LIVE BATTLES',
 submission_open:true,
 images:[] as string[]
};

const STATUS_WEIGHT:Record<string,number>={live:3,qualifying:2,scheduled:1};

async function landingData(){
 const db=battleDb();
 const [{data:setting},{data:articles},{data:contests},{data:entries}]=await Promise.all([
  db.from('site_settings').select('setting_value').eq('setting_key','admin_battle_landing').maybeSingle(),
  db.from('articles').select('featured_media_url').not('featured_media_url','is',null).order('published_at',{ascending:false,nullsFirst:false}).limit(10),
  db.from('battle_contests').select('id,title,slug,genre,status,created_at,updated_at').in('status',['qualifying','scheduled','live']).order('updated_at',{ascending:false}),
  db.from('battle_entries').select('contest_id').eq('active',true)
 ]);
 let saved:any={};try{saved=JSON.parse(setting?.setting_value||'{}')}catch{}
 const articleImages=(articles||[]).map((x:any)=>x.featured_media_url).filter(Boolean);
 const configured=Array.isArray(saved.images)?saved.images:[];
 const images=Array.from({length:7},(_,i)=>configured[i]||articleImages[i]||'').filter(Boolean);
 const counts=new Map<string,number>();for(const entry of entries||[])counts.set(entry.contest_id,(counts.get(entry.contest_id)||0)+1);
 const ordered=(contests||[]).filter((c:any)=>c.genre&&counts.get(c.id)).sort((a:any,b:any)=>{
  const byStatus=(STATUS_WEIGHT[String(b.status||'')]||0)-(STATUS_WEIGHT[String(a.status||'')]||0);if(byStatus)return byStatus;
  return new Date(b.updated_at||b.created_at||0).getTime()-new Date(a.updated_at||a.created_at||0).getTime();
 });
 const seen=new Set<string>();const genrePools:any[]=[];
 for(const contest of ordered){const genre=String(contest.genre||'').trim();const key=genre.toLowerCase();if(!genre||seen.has(key))continue;seen.add(key);genrePools.push({genre,slug:contest.slug,title:contest.title,status:contest.status,artistCount:counts.get(contest.id)||0});}
 genrePools.sort((a:any,b:any)=>a.genre.localeCompare(b.genre));
 return {content:{...defaults,...saved,primary_button:'SUBMIT YOUR MUSIC',secondary_button:'WATCH LIVE BATTLES',images},currentBattleSlug:ordered[0]?.slug||'',genrePools};
}

export default async function BattlesLandingPage(){
 const {content,currentBattleSlug,genrePools}=await landingData();
 return <main className={styles.landingPage} style={{background:'#050606'}}><PublicHeader/><div className={`${styles.landingShell} battle-mobile-shell`} style={{width:'100%',maxWidth:'none',margin:0,padding:'0 32px 32px',boxSizing:'border-box'}}>
  <section className={`${styles.landingHero} battle-mobile-hero`} style={{minHeight:'calc(100vh - 160px)',width:'100%',boxShadow:'none'}}>
   <div className={styles.landingMediaLayer}>{content.images.slice(0,7).map((src:string,i:number)=><div key={`${src}-${i}`} className={`${styles.floatingImage} ${styles[`float${i+1}` as keyof typeof styles]||''} mobile-float-${i+1}`}><img src={src} alt=""/></div>)}</div>
   <div className={`${styles.landingCenter} battle-mobile-center`}>
    <div className={`${styles.landingKicker} battle-mobile-kicker`}>INDIE CUT LIVE BATTLES</div>
    <h1>{content.headline}</h1>
    {content.subheadline&&<p className={`${styles.landingSubhead} battle-mobile-subhead`}>{content.subheadline}</p>}
    {content.submission_open&&<div className={`${styles.landingButtonOrbit} battle-mobile-orbit`}><a className={`${styles.landingPrimary} battle-mobile-primary`} href="/battles/submit">{content.primary_button} →</a></div>}
    <a className="battle-watch-link" href="/battles/room">{content.secondary_button} →</a>
    <a className="battle-rankings-link" href="/battles/rankings"><span className="battle-rankings-dot"/>SEE WHERE YOUR FAVORITE ARTIST RANKS →</a>
    {currentBattleSlug&&<a className="battle-current-link" href={`/battles/${currentBattleSlug}`}>MEET THE ARTISTS & VOTE →</a>}
    {genrePools.length>0&&<div className="battle-genre-wrap">
      <div className="battle-genre-label">BROWSE APPROVED ARTISTS BY GENRE</div>
      <div className="battle-genre-list">{genrePools.map((pool:any)=><a key={pool.genre} className="battle-genre-pill" href={`/battles/${pool.slug}`}><strong>{pool.genre}</strong><span>{pool.artistCount} {pool.artistCount===1?'ARTIST':'ARTISTS'}</span></a>)}</div>
    </div>}
    {content.submission_open&&<div className={`${styles.artistInvite} battle-mobile-invite`}><strong>{content.artist_prompt}</strong><span>{content.artist_copy}</span></div>}
   </div>
  </section>
  <style>{`
   .battle-mobile-center{width:min(760px,68%)!important;max-width:760px!important;box-sizing:border-box!important;padding:84px 0 72px!important;}
   .battle-mobile-center h1{font-size:clamp(38px,3.6vw,52px)!important;line-height:1.02!important;letter-spacing:-.035em!important;max-width:720px!important;margin:0 auto 18px!important;text-wrap:balance;}
   .battle-mobile-subhead{font-size:16px!important;line-height:1.5!important;max-width:540px!important;margin:0 auto 24px!important;}
   .battle-watch-link,.battle-rankings-link,.battle-current-link{display:inline-flex;align-items:center;justify-content:center;gap:9px;margin-top:14px;padding:11px 18px;border:1px solid rgba(255,255,255,.25);border-radius:999px;color:#fff;text-decoration:none;font-size:11px;font-weight:900;letter-spacing:.08em;background:rgba(8,8,8,.6);backdrop-filter:blur(10px);transition:.2s ease;}
   .battle-watch-link{margin-right:8px;border-color:rgba(255,255,255,.4);}
   .battle-current-link{margin-left:8px;border-color:#e744bd;background:#e744bd;color:#fff;}
   .battle-watch-link:hover,.battle-rankings-link:hover,.battle-current-link:hover{border-color:#e744bd;color:#fff;transform:translateY(-2px);background:rgba(231,68,189,.12);}
   .battle-current-link:hover{background:#c72fa0;}
   .battle-rankings-dot{width:7px;height:7px;border-radius:50%;background:#e744bd;box-shadow:0 0 0 5px rgba(231,68,189,.14);}
   .battle-genre-wrap{width:min(680px,100%);margin:22px auto 0;padding-top:18px;border-top:1px solid rgba(255,255,255,.14);}
   .battle-genre-label{margin-bottom:10px;color:rgba(255,255,255,.62);font-size:9px;font-weight:900;letter-spacing:.16em;}
   .battle-genre-list{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;}
   .battle-genre-pill{display:inline-flex;align-items:center;gap:8px;padding:10px 13px;border:1px solid rgba(255,255,255,.24);border-radius:999px;background:rgba(8,8,8,.7);color:#fff;text-decoration:none;transition:.2s ease;backdrop-filter:blur(10px);}
   .battle-genre-pill strong{font-size:11px;letter-spacing:.02em;}
   .battle-genre-pill span{font-size:8px;font-weight:900;letter-spacing:.08em;color:rgba(255,255,255,.55);}
   .battle-genre-pill:hover{border-color:#e744bd;background:rgba(231,68,189,.13);transform:translateY(-2px);}
   .battle-genre-pill:hover span{color:#fff;}
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
    .battle-watch-link,.battle-current-link{margin-left:0;margin-right:0;}
   }
   @media (max-width:620px){
    .battle-mobile-shell{padding:0 14px 24px!important;}
    .battle-mobile-hero{min-height:900px!important;display:block!important;}
    .battle-mobile-center{width:100%!important;max-width:100%!important;box-sizing:border-box!important;padding:205px 18px 165px!important;}
    .battle-mobile-kicker{font-size:9px!important;letter-spacing:.19em!important;margin-bottom:13px!important;white-space:nowrap;}
    .battle-mobile-center h1{font-size:31px!important;line-height:1.02!important;letter-spacing:-.032em!important;max-width:315px!important;margin:0 auto 16px!important;text-wrap:balance;}
    .battle-mobile-subhead{font-size:14px!important;line-height:1.45!important;max-width:300px!important;margin:0 auto 22px!important;}
    .battle-mobile-orbit{display:block!important;width:min(100%,300px)!important;margin:0 auto!important;}
    .battle-mobile-primary{display:block!important;width:100%!important;box-sizing:border-box!important;padding:14px 16px!important;font-size:12px!important;}
    .battle-watch-link,.battle-rankings-link,.battle-current-link{display:flex;width:min(100%,300px);box-sizing:border-box;font-size:9px;padding:11px 10px;margin:10px auto 0;}
    .battle-genre-wrap{width:min(100%,320px);margin-top:18px;padding-top:14px;}
    .battle-genre-label{font-size:8px;line-height:1.4;}
    .battle-genre-list{gap:7px;}
    .battle-genre-pill{padding:9px 11px;gap:6px;}
    .battle-genre-pill strong{font-size:10px;}.battle-genre-pill span{font-size:7px;}
    .battle-mobile-invite{margin-top:18px!important;max-width:300px!important;font-size:12px!important;line-height:1.4!important;gap:6px!important;}
    .battle-mobile-invite strong{font-size:13px!important;}
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
