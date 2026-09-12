import { notFound } from 'next/navigation';
import PublicHeader from '../../PublicHeader';
import PublicFooter from '../../PublicFooter';
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
 return <main className={styles.page}><PublicHeader/><div className={styles.shell}>
  <a href="/battles" className={styles.back}>← All Live Battles</a>
  <header className={styles.battleHero}><div className={styles.eyebrow}>INDIE CUT LIVE BATTLE</div><h1>{contest.title}</h1>{contest.description&&<p>{contest.description}</p>}{contest.sponsor_name&&<a href={contest.sponsor_destination_url||'#'} className={styles.sponsor} target={contest.sponsor_destination_url?'_blank':undefined} rel="noreferrer sponsored">Presented by {contest.sponsor_logo_url&&<img src={contest.sponsor_logo_url} alt=""/>}<strong>{contest.sponsor_name}</strong></a>}</header>
  <BattleLiveClient slug={params.slug} initialData={data}/>
 </div><PublicFooter/></main>
}
