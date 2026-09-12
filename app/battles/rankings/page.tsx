import PublicHeader from '../../PublicHeader';
import PublicFooter from '../../PublicFooter';
import {battleDb} from '../../../lib/battles';
import LeaderboardClient from './LeaderboardClient';
import styles from './rankings.module.css';

export const dynamic='force-dynamic';
export const revalidate=0;

const ACTIVE_STATUSES=new Set(['draft','qualifying','scheduled','live']);
const STATUS_WEIGHT:Record<string,number>={live:4,qualifying:3,scheduled:2,draft:1};

async function loadBoards(){
  try{
    const db=battleDb();
    const [{data:contests},{data:entries},{data:votes}]=await Promise.all([
      db.from('battle_contests').select('id,title,slug,genre,status,qualifying_starts_at,qualifying_ends_at,live_starts_at,created_at').order('created_at',{ascending:false}),
      db.from('battle_entries').select('id,contest_id,artist_name,slug,genre,city,image_url,track_title,active,created_at').eq('active',true).order('created_at',{ascending:true}),
      db.from('battle_votes').select('contest_id,entry_id,vote_scope').eq('vote_scope','qualifying')
    ]);
    const counts=new Map<string,number>();for(const vote of votes||[])counts.set(vote.entry_id,(counts.get(vote.entry_id)||0)+1);
    const current=(contests||[]).filter((c:any)=>c.genre&&ACTIVE_STATUSES.has(String(c.status||''))).sort((a:any,b:any)=>((STATUS_WEIGHT[String(b.status||'')]||0)-(STATUS_WEIGHT[String(a.status||'')]||0))||(new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime()));
    const seen=new Set<string>();const boards:any[]=[];
    for(const contest of current){const genre=String(contest.genre||'').trim();const key=genre.toLowerCase();if(!genre||seen.has(key))continue;const rows=(entries||[]).filter((e:any)=>e.contest_id===contest.id);if(!rows.length)continue;seen.add(key);const artists=rows.map((entry:any)=>({id:entry.id,artist_name:entry.artist_name,slug:entry.slug,genre:entry.genre||genre,city:entry.city,image_url:entry.image_url,track_title:entry.track_title,votes:counts.get(entry.id)||0,fan_path:`/battles/${contest.slug}/artists/${entry.slug}`,created_at:entry.created_at})).sort((a:any,b:any)=>b.votes-a.votes||new Date(a.created_at||0).getTime()-new Date(b.created_at||0).getTime()).map((entry:any,index:number)=>({...entry,rank:index+1}));boards.push({genre,contest:{id:contest.id,title:contest.title,slug:contest.slug,status:contest.status,qualifying_ends_at:contest.qualifying_ends_at,live_starts_at:contest.live_starts_at},artists});}
    return boards.sort((a:any,b:any)=>a.genre.localeCompare(b.genre));
  }catch{return []}
}

export default async function RankingsPage(){
  const boards=await loadBoards();
  return <main className={styles.page}>
    <PublicHeader/>
    <section className={styles.hero}>
      <div className={styles.eyebrow}>INDIE CUT LIVE BATTLES</div>
      <h1>SEE WHERE YOUR FAVORITE ARTIST RANKS.</h1>
      <p>Choose a genre, follow the live fan standings, and tap an artist to listen, vote, and share their page to help move them up.</p>
    </section>
    <div className={styles.shell}>
      <a className={styles.backLink} href="/battles">← BACK TO LIVE BATTLES</a>
      <LeaderboardClient initialBoards={boards}/>
    </div>
    <PublicFooter/>
  </main>;
}
