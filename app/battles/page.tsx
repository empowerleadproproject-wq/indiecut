import PublicHeader from '../PublicHeader';
import PublicFooter from '../PublicFooter';
import { battleDb } from '../../lib/battles';
import styles from './battles.module.css';

export const dynamic='force-dynamic';
export const revalidate=0;

function label(status:string){return status==='qualifying'?'Fan voting open':status==='scheduled'?'Battle scheduled':status==='live'?'Live now':status==='completed'?'Battle complete':'Coming soon'}

export default async function BattlesPage(){
 const db=battleDb();
 const [{data:contests},{data:entries},{data:votes}]=await Promise.all([
  db.from('battle_contests').select('*').neq('status','draft').order('created_at',{ascending:false}),
  db.from('battle_entries').select('id,contest_id,artist_name,slug,image_url,genre,city').eq('active',true),
  db.from('battle_votes').select('contest_id,entry_id,vote_scope').eq('vote_scope','qualifying')
 ]);
 const rows=(contests||[]).map((contest:any)=>{
  const people=(entries||[]).filter((e:any)=>e.contest_id===contest.id).map((entry:any)=>({...entry,vote_count:(votes||[]).filter((v:any)=>v.entry_id===entry.id).length})).sort((a:any,b:any)=>b.vote_count-a.vote_count);
  return {...contest,people};
 });
 return <main className={styles.page}><PublicHeader/><div className={styles.shell}>
  <section className={styles.hero}><div><div className={styles.eyebrow}>INDIE CUT LIVE</div><h1>Fans decide who moves forward.</h1><p>Discover independent artists, hear their music, vote once per competition, then come back for the live head-to-head battle. The top artists earn the spotlight — not an algorithm or a label gatekeeper.</p></div><aside className={styles.heroCard}><span className={styles.status}>LIVE BATTLES</span><strong>{rows.length}</strong><p>Active and completed Indie Cut competitions. Share an artist page, bring your people, and watch the bracket move.</p></aside></section>
  {rows.length?<section className={styles.grid}>{rows.map((contest:any)=>{const cover=contest.people[0]?.image_url;return <a className={styles.card} href={`/battles/${contest.slug}`} key={contest.id}><div className={styles.cardMedia}>{cover?<img src={cover} alt=""/>:<strong>INDIE CUT<br/>LIVE</strong>}</div><div className={styles.cardBody}><span className={styles.status}>{label(contest.status)}</span><h2>{contest.title}</h2><div className={styles.meta}><span>{contest.people.length} artists</span>{contest.live_starts_at&&<span>{new Date(contest.live_starts_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span>}</div></div></a>})}</section>:<div className={styles.empty} style={{marginTop:28}}>The first Indie Cut artist competition is being set up.</div>}
  {rows.some((x:any)=>x.status==='qualifying')&&<section className={styles.section}><div className={styles.sectionHead}><div><div className={styles.eyebrow}>CURRENT LEADERS</div><h2>Fan vote leaderboard</h2></div></div><div className={styles.leaderboard}>{rows.filter((x:any)=>x.status==='qualifying').flatMap((contest:any)=>contest.people.slice(0,5).map((entry:any,index:number)=><a href={`/battles/${contest.slug}/artists/${entry.slug}`} className={styles.rankRow} key={`${contest.id}-${entry.id}`}><div className={styles.rank}>#{index+1}</div>{entry.image_url?<img className={styles.avatar} src={entry.image_url} alt=""/>:<div className={styles.avatar}/>}<div><div className={styles.artistName}>{entry.artist_name}</div><div className={styles.small}>{contest.title}{entry.genre?` · ${entry.genre}`:''}</div></div><div className={styles.votes}>{entry.vote_count} votes</div></a>))}</div></section>}
 </div><PublicFooter/></main>
}
