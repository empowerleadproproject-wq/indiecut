import { createClient as createServiceClient } from '@supabase/supabase-js';

export function battleDb(){
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {auth:{persistSession:false,autoRefreshToken:false}}
  );
}

export function slugify(value:string){
  return String(value||'')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,80);
}

export function isQualificationOpen(contest:any){
  if(contest?.status!=='qualifying') return false;
  const now=Date.now();
  const start=contest.qualifying_starts_at?new Date(contest.qualifying_starts_at).getTime():0;
  const end=contest.qualifying_ends_at?new Date(contest.qualifying_ends_at).getTime():Number.POSITIVE_INFINITY;
  return now>=start&&now<=end;
}

export function withVoteCounts(entries:any[],votes:any[],scope='qualifying'){
  const counts=new Map<string,number>();
  for(const vote of votes||[]){
    if(vote.vote_scope!==scope)continue;
    counts.set(vote.entry_id,(counts.get(vote.entry_id)||0)+1);
  }
  return (entries||[]).map(entry=>({...entry,vote_count:counts.get(entry.id)||0}));
}

export async function getBattleBySlug(slug:string){
  const db=battleDb();
  const {data:contest,error}=await db.from('battle_contests').select('*').eq('slug',slug).maybeSingle();
  if(error||!contest)return {contest:null,entries:[],rounds:[],votes:[]};
  const [{data:entries},{data:rounds},{data:votes}]=await Promise.all([
    db.from('battle_entries').select('*').eq('contest_id',contest.id).eq('active',true).order('seed',{ascending:true,nullsFirst:false}).order('created_at',{ascending:true}),
    db.from('battle_rounds').select('*').eq('contest_id',contest.id).order('round_number',{ascending:true}),
    db.from('battle_votes').select('entry_id,round_id,vote_scope,created_at').eq('contest_id',contest.id)
  ]);
  return {contest,entries:entries||[],rounds:rounds||[],votes:votes||[]};
}

export function serializeBattle(data:{contest:any,entries:any[],rounds:any[],votes:any[]}){
  const qualifying=withVoteCounts(data.entries,data.votes,'qualifying').sort((a,b)=>b.vote_count-a.vote_count);
  const roundCounts:Record<string,Record<string,number>>={};
  for(const vote of data.votes){
    if(!vote.round_id)continue;
    roundCounts[vote.round_id] ||= {};
    roundCounts[vote.round_id][vote.entry_id]=(roundCounts[vote.round_id][vote.entry_id]||0)+1;
  }
  const rounds=data.rounds.map(round=>({
    ...round,
    votes_a:roundCounts[round.id]?.[round.entry_a_id]||0,
    votes_b:roundCounts[round.id]?.[round.entry_b_id]||0
  }));
  const currentRound=rounds.find(r=>r.id===data.contest.current_round_id)||null;
  const finalists=qualifying.slice(0,2);
  const winner=qualifying.find(e=>e.id===data.contest.winner_entry_id)||null;
  return {contest:data.contest,entries:qualifying,rounds,currentRound,finalists,winner};
}
