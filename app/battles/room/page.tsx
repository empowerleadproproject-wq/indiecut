import PublicHeader from '../../PublicHeader';
import PublicFooter from '../../PublicFooter';
import {battleDb,getBattleBySlug,serializeBattle} from '../../../lib/battles';
import BattleLiveClient from '../[slug]/BattleLiveClient';
import styles from '../battles.module.css';

export const dynamic='force-dynamic';
export const revalidate=0;

function pickContest(rows:any[]){
 const now=Date.now();
 const live=rows.find(x=>x.status==='live');if(live)return live;
 const scheduled=rows.filter(x=>x.status==='scheduled').sort((a,b)=>Math.abs(new Date(a.live_starts_at||0).getTime()-now)-Math.abs(new Date(b.live_starts_at||0).getTime()-now))[0];if(scheduled)return scheduled;
 return rows.find(x=>x.status==='completed')||null;
}

export default async function BattleRoomPage(){
 const db=battleDb();const {data:rows}=await db.from('battle_contests').select('*').in('status',['live','scheduled','completed']).order('created_at',{ascending:false}).limit(25);const chosen=pickContest(rows||[]);
 let data:any=null;
 if(chosen){const raw=await getBattleBySlug(chosen.slug);if(raw.contest){const serialized=serializeBattle(raw);const contest={...serialized.contest};delete contest.host_code;delete contest.zoom_session_passcode;const entries=serialized.entries.map((e:any)=>{const x={...e};delete x.studio_code;return x});const rounds=serialized.rounds.map((r:any)=>r.status==='voting'?{...r,votes_a:null,votes_b:null}:r);data={contest,entries,rounds,currentRound:rounds.find((r:any)=>r.id===contest.current_round_id)||null,finalists:serialized.finalists.map((e:any)=>entries.find((x:any)=>x.id===e.id)).filter(Boolean),winner:serialized.winner?entries.find((x:any)=>x.id===serialized.winner.id)||null:null};}}
 return <main className={styles.page}><PublicHeader/><div className={styles.shell}>
  <header className={styles.roomHero}><div className={styles.roomKicker}>INDIE CUT PRESENTS</div><h1>INDIE BATTLE ROOM</h1><p>The live stage for independent artists. Artist A. DJ. Artist B. The fans decide every round.</p>{data?.contest?.sponsor_name&&<div className={styles.sponsor}>Presented by {data.contest.sponsor_logo_url&&<img src={data.contest.sponsor_logo_url} alt=""/>}<strong>{data.contest.sponsor_name}</strong></div>}</header>
  {data?<><div className={styles.roomNow}><div><span>{data.contest.status==='live'?'LIVE NOW':data.contest.status==='scheduled'?'NEXT BATTLE':'LATEST BATTLE'}</span><strong>{data.contest.title}</strong></div>{data.contest.live_starts_at&&<time>{new Date(data.contest.live_starts_at).toLocaleString('en-US',{month:'long',day:'numeric',hour:'numeric',minute:'2-digit'})}</time>}</div><BattleLiveClient slug={data.contest.slug} initialData={data}/></>:<section className={styles.roomEmpty}><div className={styles.roomStagePreview}><div>ARTIST A</div><div>DJ / HOST</div><div>ARTIST B</div></div><h2>The next Indie Cut battle is being scheduled.</h2><p>When the room goes live, the video stage, round voting, sponsor breaks and bracket will all appear here.</p><a href="/battles/submit" className={styles.enterButton}>SUBMIT YOUR MUSIC</a></section>}
 </div><PublicFooter/></main>
}
