import {NextResponse} from 'next/server';
import {createClient} from '../../../../../../lib/supabase/server';
import {createAdminClient} from '../../../../../../lib/supabase/admin';

export const dynamic='force-dynamic';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request:Request,{params}:{params:{slug:string}}){
  let body:any={};
  try{body=await request.json()}catch{}
  const sessionId=String(body.sessionId||'');
  const participantIdentity=String(body.participantIdentity||'').slice(0,160);
  const action=String(body.action||'');
  if(!UUID.test(sessionId)||!participantIdentity||!['join','heartbeat','leave'].includes(action))return NextResponse.json({error:'Invalid presence event.'},{status:400});

  const admin=createAdminClient();
  const {data:room}=await admin.from('cut_rooms').select('id,peak_listeners').eq('slug',params.slug).maybeSingle();
  if(!room)return NextResponse.json({error:'Cut not found.'},{status:404});
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  const now=new Date().toISOString();

  if(action==='join'){
    await admin.from('cut_listener_sessions').upsert({id:sessionId,room_id:room.id,user_id:user?.id||null,participant_identity:participantIdentity,is_guest:!user,joined_at:now,last_seen_at:now,left_at:null},{onConflict:'id'});
  }else if(action==='heartbeat'){
    await admin.from('cut_listener_sessions').update({last_seen_at:now}).eq('id',sessionId).eq('room_id',room.id);
  }else{
    await admin.from('cut_listener_sessions').update({last_seen_at:now,left_at:now}).eq('id',sessionId).eq('room_id',room.id);
  }

  if(action!=='leave'){
    const cutoff=new Date(Date.now()-90_000).toISOString();
    const {count}=await admin.from('cut_listener_sessions').select('id',{count:'exact',head:true}).eq('room_id',room.id).is('left_at',null).gte('last_seen_at',cutoff);
    const active=count||0;
    if(active>(room.peak_listeners||0))await admin.from('cut_rooms').update({peak_listeners:active,updated_at:now}).eq('id',room.id);
    return NextResponse.json({ok:true,active});
  }
  return NextResponse.json({ok:true});
}
