import {NextResponse} from 'next/server';
import {createClient} from '../../../../../../lib/supabase/server';
import {createAdminClient} from '../../../../../../lib/supabase/admin';
import {cutIdentity} from '../../../../../../lib/the-cut';

export const dynamic='force-dynamic';

async function context(slug:string){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  const admin=createAdminClient();
  const {data:room}=await admin.from('cut_rooms').select('id,host_id,status').eq('slug',slug).maybeSingle();
  return {user,admin,room};
}

export async function GET(_:Request,{params}:{params:{slug:string}}){
  const {user,admin,room}=await context(params.slug);
  if(!user)return NextResponse.json({authenticated:false,requestStatus:'none',role:'listener'});
  if(!room)return NextResponse.json({error:'Cut not found.'},{status:404});
  if(room.host_id===user.id)return NextResponse.json({authenticated:true,requestStatus:'approved',role:'host'});
  const {data}=await admin.from('cut_room_members').select('role,request_status').eq('room_id',room.id).eq('user_id',user.id).maybeSingle();
  return NextResponse.json({authenticated:true,requestStatus:data?.request_status||'none',role:data?.role||'listener'});
}

export async function POST(_:Request,{params}:{params:{slug:string}}){
  const {user,admin,room}=await context(params.slug);
  if(!user)return NextResponse.json({error:'Create or sign in to your Indie Cut account to participate.'},{status:401});
  if(!room||room.status!=='live')return NextResponse.json({error:'This Cut is not currently live.'},{status:404});
  if(room.host_id===user.id)return NextResponse.json({requestStatus:'approved',role:'host'});

  const now=new Date().toISOString();
  const {error}=await admin.from('cut_room_members').upsert({
    room_id:room.id,user_id:user.id,role:'listener',request_status:'requested',livekit_identity:cutIdentity(user.id),requested_at:now,approved_at:null,updated_at:now
  },{onConflict:'room_id,user_id'});
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({requestStatus:'requested',role:'listener'});
}
