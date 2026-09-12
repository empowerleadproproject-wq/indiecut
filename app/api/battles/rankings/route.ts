import {NextResponse} from 'next/server';
import {battleDb} from '../../../../lib/battles';

export const dynamic='force-dynamic';
export const revalidate=0;

const ACTIVE_STATUSES=new Set(['draft','qualifying','scheduled','live']);
const STATUS_WEIGHT:Record<string,number>={live:4,qualifying:3,scheduled:2,draft:1};

export async function GET(){
  try{
    const db=battleDb();
    const [{data:contests,error:contestError},{data:entries,error:entryError},{data:votes,error:voteError}]=await Promise.all([
      db.from('battle_contests').select('id,title,slug,genre,status,qualifying_starts_at,qualifying_ends_at,live_starts_at,created_at').order('created_at',{ascending:false}),
      db.from('battle_entries').select('id,contest_id,artist_name,slug,genre,city,image_url,track_title,active,created_at').eq('active',true).order('created_at',{ascending:true}),
      db.from('battle_votes').select('contest_id,entry_id,vote_scope').eq('vote_scope','qualifying')
    ]);
    if(contestError)throw contestError;if(entryError)throw entryError;if(voteError)throw voteError;

    const voteCounts=new Map<string,number>();
    for(const vote of votes||[])voteCounts.set(vote.entry_id,(voteCounts.get(vote.entry_id)||0)+1);

    const current=(contests||[])
      .filter((c:any)=>c.genre&&ACTIVE_STATUSES.has(String(c.status||'')))
      .sort((a:any,b:any)=>{
        const byStatus=(STATUS_WEIGHT[String(b.status||'')]||0)-(STATUS_WEIGHT[String(a.status||'')]||0);
        if(byStatus)return byStatus;
        return new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime();
      });

    const seen=new Set<string>();
    const genreBoards:any[]=[];
    for(const contest of current){
      const genre=String(contest.genre||'').trim();
      const key=genre.toLowerCase();
      if(!genre||seen.has(key))continue;
      const contestEntries=(entries||[]).filter((e:any)=>e.contest_id===contest.id);
      if(!contestEntries.length)continue;
      seen.add(key);
      const ranked=contestEntries
        .map((entry:any)=>({
          id:entry.id,
          artist_name:entry.artist_name,
          slug:entry.slug,
          genre:entry.genre||genre,
          city:entry.city,
          image_url:entry.image_url,
          track_title:entry.track_title,
          votes:voteCounts.get(entry.id)||0,
          fan_path:`/battles/${contest.slug}/artists/${entry.slug}`,
          created_at:entry.created_at
        }))
        .sort((a:any,b:any)=>b.votes-a.votes||new Date(a.created_at||0).getTime()-new Date(b.created_at||0).getTime())
        .map((entry:any,index:number)=>({...entry,rank:index+1}));
      genreBoards.push({
        genre,
        contest:{id:contest.id,title:contest.title,slug:contest.slug,status:contest.status,qualifying_ends_at:contest.qualifying_ends_at,live_starts_at:contest.live_starts_at},
        artists:ranked
      });
    }

    genreBoards.sort((a:any,b:any)=>a.genre.localeCompare(b.genre));
    return NextResponse.json({genres:genreBoards,updated_at:new Date().toISOString()},{headers:{'cache-control':'no-store, max-age=0'}});
  }catch(error:any){
    console.error('public rankings error',error);
    return NextResponse.json({error:error?.message||'Unable to load rankings.'},{status:500});
  }
}
