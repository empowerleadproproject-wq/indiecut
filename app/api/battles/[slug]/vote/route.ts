import { createHmac,randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { battleDb,getBattleBySlug,isQualificationOpen } from '../../../../../lib/battles';

export const dynamic='force-dynamic';

function hash(value:string){
  const secret=process.env.VOTE_HASH_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY||'indiecut-vote-fallback';
  return createHmac('sha256',secret).update(value).digest('hex');
}

function clientIp(req:Request){
  const forwarded=req.headers.get('x-forwarded-for');
  if(forwarded)return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip')||req.headers.get('cf-connecting-ip')||'unknown';
}

export async function POST(req:Request,{params}:{params:{slug:string}}){
  const body=await req.json().catch(()=>({}));
  const entryId=String(body.entryId||'');
  if(!entryId)return NextResponse.json({error:'Choose an artist first.'},{status:400});

  const raw=await getBattleBySlug(params.slug);
  const contest=raw.contest;
  if(!contest||contest.status==='draft')return NextResponse.json({error:'Battle not found.'},{status:404});
  const entry=raw.entries.find((x:any)=>x.id===entryId);
  if(!entry)return NextResponse.json({error:'That artist is not in this contest.'},{status:400});

  let roundId:string|null=null;
  let voteScope='qualifying';
  if(contest.status==='qualifying'){
    if(!isQualificationOpen(contest))return NextResponse.json({error:'Qualifying voting is closed.'},{status:409});
  }else if(contest.status==='live'&&contest.current_segment==='voting'){
    const round=raw.rounds.find((x:any)=>x.id===contest.current_round_id);
    if(!round||round.status!=='voting')return NextResponse.json({error:'Voting is not open right now.'},{status:409});
    if(![round.entry_a_id,round.entry_b_id].includes(entryId))return NextResponse.json({error:'That artist is not in the current round.'},{status:400});
    const now=Date.now();
    if(round.vote_opens_at&&now<new Date(round.vote_opens_at).getTime())return NextResponse.json({error:'Voting has not opened yet.'},{status:409});
    if(round.vote_closes_at&&now>new Date(round.vote_closes_at).getTime())return NextResponse.json({error:'This round has closed.'},{status:409});
    roundId=round.id;
    voteScope=`round:${round.id}`;
  }else{
    return NextResponse.json({error:'Voting is not open right now.'},{status:409});
  }

  const cookieHeader=req.headers.get('cookie')||'';
  const deviceMatch=cookieHeader.match(/(?:^|;\s*)ic_vote_device=([^;]+)/);
  const deviceId=deviceMatch?.[1]||randomBytes(18).toString('hex');
  const ua=req.headers.get('user-agent')||'unknown';
  const ip=clientIp(req);
  const db=battleDb();
  const {error}=await db.from('battle_votes').insert({
    contest_id:contest.id,
    entry_id:entryId,
    round_id:roundId,
    vote_scope:voteScope,
    ip_hash:hash(ip),
    device_hash:hash(`${deviceId}|${ua}`),
    user_agent_hash:hash(ua)
  });

  if(error){
    if(error.code==='23505'){
      const res=NextResponse.json({error:'A vote from this device or internet connection has already been counted for this voting window.'},{status:409});
      if(!deviceMatch)res.cookies.set('ic_vote_device',deviceId,{httpOnly:true,sameSite:'lax',secure:true,maxAge:60*60*24*365,path:'/'});
      return res;
    }
    console.error('battle vote insert failed',error);
    return NextResponse.json({error:'Your vote could not be recorded. Please try again.'},{status:500});
  }

  const res=NextResponse.json({ok:true,message:'Vote counted.'});
  if(!deviceMatch)res.cookies.set('ic_vote_device',deviceId,{httpOnly:true,sameSite:'lax',secure:true,maxAge:60*60*24*365,path:'/'});
  return res;
}
