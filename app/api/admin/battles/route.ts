import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { isAdminEmail } from '../../../../lib/admin';
import { battleDb,slugify } from '../../../../lib/battles';

export const dynamic='force-dynamic';

const GENRES=['Hip-Hop','R&B','Gospel','Southern Soul','Pop','Rock','Country','Afrobeats','Reggae / Dancehall','Latin','Electronic / Dance','Jazz','Soul','Alternative','Blues','Folk'] as const;
function normalizeGenre(value:any){const raw=String(value||'').trim().toLowerCase();return GENRES.find(g=>g.toLowerCase()===raw)||''}

async function adminUser(){
  const auth=createClient();
  const {data:{user}}=await auth.auth.getUser();
  return user&&isAdminEmail(user.email)?user:null;
}

async function snapshot(){
  const db=battleDb();
  const [{data:contests},{data:entries},{data:rounds},{data:votes}]=await Promise.all([
    db.from('battle_contests').select('*').order('created_at',{ascending:false}),
    db.from('battle_entries').select('*').order('created_at',{ascending:true}),
    db.from('battle_rounds').select('*').order('round_number',{ascending:true}),
    db.from('battle_votes').select('contest_id,entry_id,round_id,vote_scope')
  ]);
  const voteRows=votes||[];
  return {
    contests:(contests||[]).map((contest:any)=>{
      const contestEntries=(entries||[]).filter((x:any)=>x.contest_id===contest.id).map((entry:any)=>({
        ...entry,
        qualifying_votes:voteRows.filter((v:any)=>v.contest_id===contest.id&&v.entry_id===entry.id&&v.vote_scope==='qualifying').length
      }));
      const contestRounds=(rounds||[]).filter((x:any)=>x.contest_id===contest.id).map((round:any)=>({
        ...round,
        votes_a:voteRows.filter((v:any)=>v.round_id===round.id&&v.entry_id===round.entry_a_id).length,
        votes_b:voteRows.filter((v:any)=>v.round_id===round.id&&v.entry_id===round.entry_b_id).length
      }));
      return {...contest,entries:contestEntries,rounds:contestRounds};
    })
  };
}

export async function GET(){
  if(!await adminUser())return NextResponse.json({error:'Unauthorized'},{status:401});
  return NextResponse.json(await snapshot(),{headers:{'cache-control':'no-store'}});
}

export async function POST(req:Request){
  if(!await adminUser())return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await req.json().catch(()=>({}));
  const action=String(body.action||'');
  const db=battleDb();

  try{
    if(action==='create_contest'){
      const p=body.payload||{};
      const title=String(p.title||'').trim();
      const genre=normalizeGenre(p.genre);
      if(!title)return NextResponse.json({error:'Battle title is required.'},{status:400});
      if(!genre)return NextResponse.json({error:'Choose the competition genre.'},{status:400});
      const slug=slugify(p.slug||title);
      const {error}=await db.from('battle_contests').insert({
        title,slug,genre,description:p.description||null,status:p.status||'draft',
        qualifying_starts_at:p.qualifying_starts_at||null,qualifying_ends_at:p.qualifying_ends_at||null,
        live_starts_at:p.live_starts_at||null,vote_window_seconds:Number(p.vote_window_seconds)||30,
        zoom_session_name:p.zoom_session_name||`indiecut-${slug}`,
        zoom_session_passcode:p.zoom_session_passcode||null,
        sponsor_name:p.sponsor_name||null,sponsor_logo_url:p.sponsor_logo_url||null,
        sponsor_destination_url:p.sponsor_destination_url||null,commercial_url:p.commercial_url||null
      });
      if(error)throw error;
    }else if(action==='update_contest'){
      const id=String(body.contestId||'');const p=body.payload||{};
      if(Object.prototype.hasOwnProperty.call(p,'genre')){
        const genre=normalizeGenre(p.genre);if(!genre)return NextResponse.json({error:'Choose a valid competition genre.'},{status:400});
        const {data:entries}=await db.from('battle_entries').select('id,artist_name,genre').eq('contest_id',id);
        const mismatch=(entries||[]).find((e:any)=>String(e.genre||'').toLowerCase()!==genre.toLowerCase());
        if(mismatch)return NextResponse.json({error:`Cannot change this battle to ${genre} because ${mismatch.artist_name} is already entered as ${mismatch.genre||'another genre'}.`},{status:409});
        p.genre=genre;
      }
      const allowed=['title','slug','genre','description','status','qualifying_starts_at','qualifying_ends_at','live_starts_at','vote_window_seconds','zoom_session_name','zoom_session_passcode','sponsor_name','sponsor_logo_url','sponsor_destination_url','commercial_url'];
      const update:any={updated_at:new Date().toISOString()};
      for(const key of allowed)if(Object.prototype.hasOwnProperty.call(p,key))update[key]=key==='slug'?slugify(p[key]):p[key]||null;
      if(Object.prototype.hasOwnProperty.call(p,'vote_window_seconds'))update.vote_window_seconds=Number(p.vote_window_seconds)||30;
      const {error}=await db.from('battle_contests').update(update).eq('id',id);if(error)throw error;
    }else if(action==='add_entry'){
      const contestId=String(body.contestId||'');const p=body.payload||{};const artistName=String(p.artist_name||'').trim();
      if(!artistName)return NextResponse.json({error:'Artist name is required.'},{status:400});
      const {data:contest}=await db.from('battle_contests').select('id,genre').eq('id',contestId).maybeSingle();
      if(!contest)return NextResponse.json({error:'Competition not found.'},{status:404});
      if(!contest.genre)return NextResponse.json({error:'Set the competition genre first.'},{status:400});
      const {error}=await db.from('battle_entries').insert({
        contest_id:contestId,artist_id:p.artist_id||null,artist_name:artistName,slug:slugify(p.slug||artistName),
        genre:contest.genre,city:p.city||null,bio:p.bio||null,image_url:p.image_url||null,
        track_title:p.track_title||null,track_url:p.track_url||null,track_cover_url:p.track_cover_url||null,
        seed:p.seed?Number(p.seed):null,active:p.active!==false
      });if(error)throw error;
    }else if(action==='add_round'){
      const contestId=String(body.contestId||'');const p=body.payload||{};
      const [{data:contest},{data:a},{data:b},{data:existing}]=await Promise.all([
        db.from('battle_contests').select('id,genre').eq('id',contestId).maybeSingle(),
        db.from('battle_entries').select('*').eq('id',p.entry_a_id).eq('contest_id',contestId).maybeSingle(),
        db.from('battle_entries').select('*').eq('id',p.entry_b_id).eq('contest_id',contestId).maybeSingle(),
        db.from('battle_rounds').select('round_number').eq('contest_id',contestId).order('round_number',{ascending:false}).limit(1)
      ]);
      if(!a||!b||a.id===b.id)return NextResponse.json({error:'Choose two different artists from this contest.'},{status:400});
      if(!contest?.genre)return NextResponse.json({error:'Set the competition genre first.'},{status:400});
      if(String(a.genre||'').toLowerCase()!==String(contest.genre).toLowerCase()||String(b.genre||'').toLowerCase()!==String(contest.genre).toLowerCase())return NextResponse.json({error:`Both artists must be ${contest.genre} artists.`},{status:400});
      const roundNumber=Number(p.round_number)||((existing?.[0]?.round_number||0)+1);
      const {data:round,error}=await db.from('battle_rounds').insert({
        contest_id:contestId,round_number:roundNumber,title:p.title||`Round ${roundNumber}`,
        entry_a_id:a.id,entry_b_id:b.id,
        track_a_title:p.track_a_title||a.track_title,track_a_url:p.track_a_url||a.track_url,
        track_b_title:p.track_b_title||b.track_title,track_b_url:p.track_b_url||b.track_url
      }).select('*').single();if(error)throw error;
      if(!body.skipActivate)await db.from('battle_contests').update({current_round_id:round.id,updated_at:new Date().toISOString()}).eq('id',contestId);
    }else if(action==='set_segment'){
      const contestId=String(body.contestId||'');const segment=String(body.segment||'lobby');const roundId=body.roundId?String(body.roundId):null;
      const {data:contest}=await db.from('battle_contests').select('*').eq('id',contestId).single();
      if(!contest)return NextResponse.json({error:'Battle not found.'},{status:404});
      const activeRoundId=roundId||contest.current_round_id;
      let round:any=null;
      if(activeRoundId){const r=await db.from('battle_rounds').select('*').eq('id',activeRoundId).eq('contest_id',contestId).maybeSingle();round=r.data;}
      const now=new Date();const update:any={current_segment:segment,segment_started_at:now.toISOString(),updated_at:now.toISOString()};
      if(activeRoundId)update.current_round_id=activeRoundId;
      if(['artist_a','artist_b','voting','results','commercial'].includes(segment))update.status='live';
      if(segment==='complete')update.status='completed';
      if(segment==='voting'){
        if(!round)return NextResponse.json({error:'Select an active round before opening voting.'},{status:400});
        const closes=new Date(now.getTime()+(Number(contest.vote_window_seconds)||30)*1000).toISOString();
        const {error}=await db.from('battle_rounds').update({status:'voting',vote_opens_at:now.toISOString(),vote_closes_at:closes,updated_at:now.toISOString()}).eq('id',round.id);if(error)throw error;
      }else if(round&&segment==='artist_a'){
        const {error}=await db.from('battle_rounds').update({status:'artist_a',updated_at:now.toISOString()}).eq('id',round.id);if(error)throw error;
      }else if(round&&segment==='artist_b'){
        const {error}=await db.from('battle_rounds').update({status:'artist_b',updated_at:now.toISOString()}).eq('id',round.id);if(error)throw error;
      }
      const {error}=await db.from('battle_contests').update(update).eq('id',contestId);if(error)throw error;
    }else if(action==='close_round'){
      const contestId=String(body.contestId||'');const roundId=String(body.roundId||'');
      const {data:round}=await db.from('battle_rounds').select('*').eq('id',roundId).eq('contest_id',contestId).single();
      if(!round)return NextResponse.json({error:'Round not found.'},{status:404});
      const {data:votes}=await db.from('battle_votes').select('entry_id').eq('round_id',roundId);
      const a=(votes||[]).filter((v:any)=>v.entry_id===round.entry_a_id).length;
      const b=(votes||[]).filter((v:any)=>v.entry_id===round.entry_b_id).length;
      const winner=a===b?null:(a>b?round.entry_a_id:round.entry_b_id);
      const now=new Date().toISOString();
      const {error}=await db.from('battle_rounds').update({status:'closed',vote_closes_at:now,winner_entry_id:winner,updated_at:now}).eq('id',roundId);if(error)throw error;
      await db.from('battle_contests').update({current_segment:'results',segment_started_at:now,current_round_id:roundId,status:'live',updated_at:now}).eq('id',contestId);
      if(!winner){
        const state=await snapshot();
        return NextResponse.json({ok:true,tie:true,votes_a:a,votes_b:b,...state});
      }
    }else if(action==='finalize_contest'){
      const contestId=String(body.contestId||'');
      const [{data:rounds},{data:votes}]=await Promise.all([
        db.from('battle_rounds').select('*').eq('contest_id',contestId).eq('status','closed'),
        db.from('battle_votes').select('entry_id,round_id').eq('contest_id',contestId).not('round_id','is',null)
      ]);
      const wins=new Map<string,number>();const totals=new Map<string,number>();
      for(const round of rounds||[])if(round.winner_entry_id)wins.set(round.winner_entry_id,(wins.get(round.winner_entry_id)||0)+1);
      for(const vote of votes||[])totals.set(vote.entry_id,(totals.get(vote.entry_id)||0)+1);
      const ids=Array.from(new Set(Array.from(wins.keys()).concat(Array.from(totals.keys()))));
      ids.sort((a,b)=>(wins.get(b)||0)-(wins.get(a)||0)||(totals.get(b)||0)-(totals.get(a)||0));
      if(!ids.length)return NextResponse.json({error:'There are no completed round votes to finalize.'},{status:409});
      if(ids.length>1&&(wins.get(ids[0])||0)===(wins.get(ids[1])||0)&&(totals.get(ids[0])||0)===(totals.get(ids[1])||0))return NextResponse.json({error:'The battle is tied. Add a tiebreak round before finalizing.'},{status:409});
      const winner=ids[0];const now=new Date().toISOString();
      const {error}=await db.from('battle_contests').update({winner_entry_id:winner,status:'completed',current_segment:'complete',segment_started_at:now,updated_at:now}).eq('id',contestId);if(error)throw error;
    }else if(action==='delete_entry'){
      const {error}=await db.from('battle_entries').delete().eq('id',String(body.entryId||''));if(error)throw error;
    }else if(action==='delete_round'){
      const {error}=await db.from('battle_rounds').delete().eq('id',String(body.roundId||''));if(error)throw error;
    }else if(action==='delete_contest'){
      const {error}=await db.from('battle_contests').delete().eq('id',String(body.contestId||''));if(error)throw error;
    }else{
      return NextResponse.json({error:'Unknown battle action.'},{status:400});
    }
    return NextResponse.json({ok:true,...await snapshot()});
  }catch(error:any){
    console.error('battle admin error',error);
    const msg=error?.code==='23505'?'That slug or round number is already in use.':error?.message||'Battle update failed.';
    return NextResponse.json({error:msg},{status:500});
  }
}