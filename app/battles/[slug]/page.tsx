import { notFound } from 'next/navigation';
import PublicHeader from '../../PublicHeader';
import PublicFooter from '../../PublicFooter';
import SitewideAd from '../../SitewideAd';
import { getBattleBySlug,serializeBattle } from '../../../lib/battles';
import BattleLiveClient from './BattleLiveClient';
import styles from '../battles.module.css';

export const dynamic='force-dynamic';
export const revalidate=0;

export async function generateMetadata({params}:{params:{slug:string}}){
 const raw=await getBattleBySlug(params.slug);if(!raw.contest)return {title:'Indie Cut Live'};
 return {title:`${raw.contest.title} | Indie Cut Live`,description:raw.contest.description||'Independent artists go head-to-head and the fans decide.'};
}

export default async function BattlePage({params}:{params:{slug:string}}){
 const raw=await getBattleBySlug(params.slug);if(!raw.contest||raw.contest.status==='draft')notFound();
 const serialized=serializeBattle(raw);const contest={...serialized.contest};delete contest.host_code;delete contest.zoom_session_passcode;
 const entries=serialized.entries.map((e:any)=>{const x={...e};delete x.studio_code;return x});
 const rounds=serialized.rounds.map((r:any)=>r.status==='voting'?{...r,votes_a:null,votes_b:null}:r);
 const data={contest,entries,rounds,currentRound:rounds.find((r:any)=>r.id===contest.current_round_id)||null,finalists:serialized.finalists.map((e:any)=>entries.find((x:any)=>x.id===e.id)).filter(Boolean),winner:serialized.winner?entries.find((x:any)=>x.id===serialized.winner.id)||null:null};
 return <main className={`${styles.page} battle-detail-page`}>
  <PublicHeader/>
  <div className="battle-detail-layout">
   <div className="battle-detail-main">
    <a href="/battles" className={styles.back}>← BACK TO LIVE BATTLES</a>
    <header className={styles.battleHero}>
     <div className={styles.eyebrow}>INDIE CUT LIVE BATTLE</div>
     <h1>{contest.title}</h1>
     {contest.description&&<p>{contest.description}</p>}
     {contest.sponsor_name&&<a href={contest.sponsor_destination_url||'#'} className={styles.sponsor} target={contest.sponsor_destination_url?'_blank':undefined} rel="noreferrer sponsored">Presented by {contest.sponsor_logo_url&&<img src={contest.sponsor_logo_url} alt=""/>}<strong>{contest.sponsor_name}</strong></a>}
    </header>
    <BattleLiveClient slug={params.slug} initialData={data}/>
   </div>
   <div className="battle-detail-ad"><SitewideAd/></div>
  </div>
  <PublicFooter/>
  <style>{`
   .battle-detail-page{background:#fff!important;color:#111!important;}
   .battle-detail-layout{width:min(1240px,calc(100% - 48px));margin:0 auto;padding:34px 0 72px;display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:46px;align-items:start;}
   .battle-detail-main{min-width:0;}
   .battle-detail-ad{position:sticky;top:18px;align-self:start;}
   .battle-detail-ad .ic-article-ad-rail{width:260px!important;padding-top:0!important;}
   .battle-detail-main .${styles.back}{color:#111!important;font-size:11px;letter-spacing:.04em;}
   .battle-detail-main .${styles.battleHero}{text-align:left!important;padding:28px 0 32px!important;border-bottom:3px solid #111;}
   .battle-detail-main .${styles.battleHero} h1{font-size:clamp(44px,5.7vw,72px)!important;line-height:.95!important;letter-spacing:-.045em!important;margin:10px 0 12px!important;text-transform:none!important;max-width:860px;}
   .battle-detail-main .${styles.battleHero} p{color:#555!important;margin:10px 0 0!important;max-width:680px!important;font-size:16px!important;}
   .battle-detail-main .${styles.eyebrow}{color:#e744bd!important;font-size:10px!important;letter-spacing:.17em!important;}
   .battle-detail-main .${styles.sponsor}{justify-content:flex-start!important;margin:16px 0 0!important;color:#666!important;}
   .battle-detail-main .${styles.liveBar}{background:transparent!important;border:0!important;border-bottom:1px solid #d8d8d8!important;border-radius:0!important;padding:16px 0!important;margin:0!important;}
   .battle-detail-main .${styles.liveBar} strong{color:#111!important;font-size:13px!important;}
   .battle-detail-main .${styles.shareButton},.battle-detail-main .${styles.enterButton}{background:#111!important;color:#fff!important;border-radius:0!important;padding:11px 15px!important;font-size:11px!important;letter-spacing:.04em;}
   .battle-detail-main .${styles.section}{margin-top:38px!important;padding-bottom:38px;border-bottom:1px solid #d8d8d8;}
   .battle-detail-main .${styles.sectionHead}{margin-bottom:16px!important;}
   .battle-detail-main .${styles.sectionHead} h2{font-size:clamp(27px,3.3vw,38px)!important;line-height:1.02!important;letter-spacing:-.035em!important;color:#111!important;}
   .battle-detail-main .${styles.leaderboard}{display:block!important;border-top:2px solid #111;}
   .battle-detail-main .${styles.rankRow}{grid-template-columns:44px 72px minmax(0,1fr) auto!important;gap:14px!important;background:transparent!important;border:0!important;border-bottom:1px solid #ddd!important;border-radius:0!important;padding:14px 0!important;color:#111!important;}
   .battle-detail-main .${styles.rank}{font-size:15px!important;color:#777!important;}
   .battle-detail-main .${styles.avatar}{width:72px!important;height:72px!important;border-radius:0!important;background:#eee!important;}
   .battle-detail-main .${styles.artistName}{color:#111!important;font-size:20px!important;letter-spacing:-.02em;}
   .battle-detail-main .${styles.small}{color:#666!important;}
   .battle-detail-main .${styles.votes}{color:#111!important;font-size:16px!important;margin-bottom:5px;}
   .battle-detail-main .${styles.rankRow} .${styles.voteButton}{width:auto!important;min-width:76px!important;margin-top:0!important;border-radius:0!important;background:#111!important;color:#fff!important;padding:10px 14px!important;font-size:11px!important;}
   .battle-detail-main .${styles.rankRow} .${styles.voteButton}:hover{background:#e744bd!important;}
   .battle-detail-main .${styles.notice}{background:#f4f4f2!important;color:#333!important;border-radius:0!important;border-left:3px solid #e744bd!important;text-align:left!important;}
   .battle-detail-main .${styles.bracket}{grid-template-columns:1fr 36px 1fr 36px 1fr!important;gap:16px!important;margin-top:14px!important;}
   .battle-detail-main .${styles.bracketTitle}{color:#777!important;font-size:10px!important;}
   .battle-detail-main .${styles.bracketNode}{background:transparent!important;border:0!important;border-top:1px solid #bfbfbf!important;border-radius:0!important;padding:12px 0!important;color:#111!important;}
   .battle-detail-main .${styles.bracketNode}.${styles.champion}{border-top-color:#e744bd!important;background:transparent!important;}
   .battle-detail-main .${styles.bracketArrow}{color:#aaa!important;font-size:20px!important;}
   .battle-detail-main .${styles.votePanel}{gap:24px!important;}
   .battle-detail-main .${styles.voteChoice}{background:transparent!important;border:0!important;border-top:2px solid #111!important;border-radius:0!important;padding:20px 0!important;color:#111!important;text-align:left!important;}
   .battle-detail-main .${styles.voteChoice} p{color:#666!important;}
   .battle-detail-main .${styles.voteButton}{border-radius:0!important;background:#111!important;}
   .battle-detail-main .${styles.roundCard}{background:transparent!important;border:0!important;border-top:1px solid #cfcfcf!important;border-radius:0!important;padding:18px 0!important;color:#111!important;}
   .battle-detail-main .${styles.score}>div{background:#f5f5f3!important;border-radius:0!important;color:#111!important;}
   .battle-detail-main .${styles.stage}{border-radius:0!important;border-color:#222!important;}
   @media(max-width:1050px){
    .battle-detail-layout{grid-template-columns:minmax(0,1fr) 220px;gap:28px;}
    .battle-detail-ad .ic-article-ad-rail{width:220px!important;}
   }
   @media(max-width:900px){
    .battle-detail-layout{display:block;width:min(100% - 32px,860px);padding-top:24px;}
    .battle-detail-ad{display:none;}
    .battle-detail-main .${styles.battleHero} h1{font-size:clamp(40px,9vw,62px)!important;}
   }
   @media(max-width:620px){
    .battle-detail-layout{width:calc(100% - 28px);padding:18px 0 50px;}
    .battle-detail-main .${styles.battleHero}{padding:22px 0 26px!important;}
    .battle-detail-main .${styles.battleHero} h1{font-size:40px!important;max-width:360px;}
    .battle-detail-main .${styles.rankRow}{grid-template-columns:30px 58px minmax(0,1fr) auto!important;gap:9px!important;}
    .battle-detail-main .${styles.avatar}{width:58px!important;height:58px!important;}
    .battle-detail-main .${styles.artistName}{font-size:17px!important;}
    .battle-detail-main .${styles.rankRow} .${styles.voteButton}{min-width:62px!important;padding:9px 10px!important;}
    .battle-detail-main .${styles.bracket}{display:grid!important;grid-template-columns:1fr!important;gap:12px!important;}
    .battle-detail-main .${styles.bracketArrow}{display:none!important;}
    .battle-detail-main .${styles.votePanel}{grid-template-columns:1fr!important;}
   }
  `}</style>
 </main>
}
