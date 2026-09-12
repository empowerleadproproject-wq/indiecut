import { createHmac } from 'crypto';
import { NextResponse } from 'next/server';
import { battleDb } from '../../../../../lib/battles';

export const dynamic='force-dynamic';

function base64url(value:string){return Buffer.from(value).toString('base64url')}
function signJwt(payload:any,secret:string){
  const header=base64url(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const body=base64url(JSON.stringify(payload));
  const signature=createHmac('sha256',secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export async function POST(req:Request,{params}:{params:{slug:string}}){
  const key=process.env.ZOOM_VIDEO_SDK_KEY;
  const secret=process.env.ZOOM_VIDEO_SDK_SECRET;
  if(!key||!secret)return NextResponse.json({error:'Live video is not configured yet.'},{status:503});
  const body=await req.json().catch(()=>({}));
  const mode=String(body.mode||'viewer');
  const db=battleDb();
  const {data:contest}=await db.from('battle_contests').select('*').eq('slug',params.slug).maybeSingle();
  if(!contest||contest.status==='draft')return NextResponse.json({error:'Battle not found.'},{status:404});
  if(!contest.zoom_session_name)return NextResponse.json({error:'This battle does not have a video session configured.'},{status:409});

  let roleType=0;
  let displayName=`[VIEWER] ${String(body.userName||'Fan').slice(0,40)}`;
  let userKey=`viewer-${Math.random().toString(36).slice(2,10)}`;

  if(mode==='studio'){
    const slot=String(body.slot||'');
    const accessCode=String(body.accessCode||'');
    const userName=String(body.userName||'Guest').trim().slice(0,40)||'Guest';
    if(slot==='dj'){
      if(!accessCode||accessCode!==contest.host_code)return NextResponse.json({error:'Invalid studio link.'},{status:403});
      roleType=1;displayName=`[DJ] ${userName}`;userKey=`dj-${contest.id.slice(0,8)}`;
    }else if(slot==='a'||slot==='b'){
      if(!contest.current_round_id)return NextResponse.json({error:'No active round is selected.'},{status:409});
      const {data:round}=await db.from('battle_rounds').select('*').eq('id',contest.current_round_id).maybeSingle();
      if(!round)return NextResponse.json({error:'Active round not found.'},{status:409});
      const entryId=slot==='a'?round.entry_a_id:round.entry_b_id;
      const {data:entry}=await db.from('battle_entries').select('id,artist_name,studio_code').eq('id',entryId).maybeSingle();
      if(!entry||!accessCode||accessCode!==entry.studio_code)return NextResponse.json({error:'Invalid artist studio link.'},{status:403});
      displayName=`[${slot.toUpperCase()}] ${userName||entry.artist_name}`;userKey=`${slot}-${entry.id.slice(0,8)}`;
    }else return NextResponse.json({error:'Invalid studio slot.'},{status:400});
  }

  const iat=Math.floor(Date.now()/1000)-30;
  const exp=iat+60*60*2;
  const token=signJwt({
    app_key:key,tpc:contest.zoom_session_name,role_type:roleType,version:1,iat,exp,
    user_key:userKey,video_webrtc_mode:1,audio_webrtc_mode:1
  },secret);
  return NextResponse.json({token,sessionName:contest.zoom_session_name,passcode:contest.zoom_session_passcode||'',displayName,roleType});
}
