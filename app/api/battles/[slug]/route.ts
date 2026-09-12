import { NextResponse } from 'next/server';
import { getBattleBySlug,serializeBattle } from '../../../../lib/battles';

export const dynamic='force-dynamic';

export async function GET(_:Request,{params}:{params:{slug:string}}){
  const raw=await getBattleBySlug(params.slug);
  if(!raw.contest||raw.contest.status==='draft')return NextResponse.json({error:'Battle not found'},{status:404});
  const data=serializeBattle(raw);
  const contest={...data.contest};
  delete contest.host_code;
  delete contest.zoom_session_passcode;
  const entries=data.entries.map((entry:any)=>{const clean={...entry};delete clean.studio_code;return clean});
  const rounds=data.rounds.map((round:any)=>{
    if(round.status==='voting')return {...round,votes_a:null,votes_b:null};
    return round;
  });
  const currentRound=rounds.find((r:any)=>r.id===contest.current_round_id)||null;
  const finalists=data.finalists.map((entry:any)=>entries.find((x:any)=>x.id===entry.id)).filter(Boolean);
  const winner=data.winner?entries.find((x:any)=>x.id===data.winner.id)||null:null;
  return NextResponse.json({contest,entries,rounds,currentRound,finalists,winner},{headers:{'cache-control':'no-store'}});
}
