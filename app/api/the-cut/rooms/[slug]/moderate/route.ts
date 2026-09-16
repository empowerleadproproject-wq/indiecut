import {NextResponse} from 'next/server';
import {RoomServiceClient} from 'livekit-server-sdk';
import {createClient} from '../../../../../../lib/supabase/server';
import {createAdminClient} from '../../../../../../lib/supabase/admin';
import {cutRoomName} from '../../../../../../lib/the-cut';

export const dynamic='force-dynamic';

function serviceUrl(url:string){return url.replace(/^wss:/,'https:').replace(/^ws:/,'http:')}
function roomService(){
  const url=process.env.LIVEKIT_URL, key=process.env.LIVEKIT_API_KEY, secret=process.env.LIVEKIT_API_SECRET;
  return url&&key&&secret?new RoomServiceClient(serviceUrl(url),key,secret):null;
}

async function hostContext(slug:string){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  const admin=createAdminClient();
  const {data:room}=await admin.from('cut_rooms').select('id,slug,title,host_id,status').eq('slug',slug).maybeSingle();
  if(!user||!room||room.host_id!==user.id)return {ok:false as const,user,admin,room};
  return {ok:true as const,user,admin,room};
}

export async function GET(_:Request,{params}:{params:{slug:string}}){
  const ctx=await hostContext(params.slug);
  if(!ctx.ok)return NextResponse.json({error:'Host access required.'},{status:403});
  const {data:members,error}=await ctx.admin.from('cut_room_members').select('user_id,role,request_status,requested_at,livekit_identity').eq('room_id',ctx.room.id).eq('request_status','requested').order('requested_at',{ascending:true});
  if(error)return NextResponse.json({error:error.message},{status:500});
  const ids=(members||[]).map((m:any)=>m.user_id);
  let profiles:any[]=[];
  if(ids.length){
    const result=await ctx.admin.from('cut_profiles').select('id,display_name,avatar_url,headline,industry_role').in('id',ids);
    profiles=result.data||[];
  }
  const byId=new Map(profiles.map((p:any)=>[p.id,p]));
  return NextResponse.json({requests:(members||[]).map((m:any)=>({...m,profile:byId.get(m.user_id)||null}))});
}

export async function POST(request:Request,{params}:{params:{slug:string}}){
  const ctx=await hostContext(params.slug);
  if(!ctx.ok)return NextResponse.json({error:'Host access required.'},{status:403});
  let body:any={};
  try{body=await request.json()}catch{}
  const action=String(body.action||'');

  if(action==='end'){
    await ctx.admin.from('cut_rooms').update({status:'ended',ended_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',ctx.room.id);
    const svc=roomService();
    if(svc){try{await svc.deleteRoom(cutRoomName(ctx.room.id))}catch{}}
    return NextResponse.json({ended:true});
  }

  const userId=String(body.userId||'');
  if(!userId)return NextResponse.json({error:'Missing participant.'},{status:400});
  const {data:member}=await ctx.admin.from('cut_room_members').select('user_id,livekit_identity').eq('room_id',ctx.room.id).eq('user_id',userId).maybeSingle();
  if(!member)return NextResponse.json({error:'Request not found.'},{status:404});

  const now=new Date().toISOString();
  const approve=action==='approve';
  if(!approve&&action!=='reject'&&action!=='remove')return NextResponse.json({error:'Unknown moderation action.'},{status:400});

  if(action==='remove'){
    const svc=roomService();
    if(svc){try{await svc.removeParticipant(cutRoomName(ctx.room.id),member.livekit_identity)}catch{}}
    await ctx.admin.from('cut_room_members').update({role:'listener',request_status:'rejected',updated_at:now}).eq('room_id',ctx.room.id).eq('user_id',userId);
    return NextResponse.json({ok:true,role:'listener',requestStatus:'rejected'});
  }

  const role=approve?'speaker':'listener';
  const requestStatus=approve?'approved':'rejected';
  await ctx.admin.from('cut_room_members').update({role,request_status:requestStatus,approved_at:approve?now:null,updated_at:now}).eq('room_id',ctx.room.id).eq('user_id',userId);

  const {data:profile}=await ctx.admin.from('cut_profiles').select('display_name,avatar_url,headline,industry_role').eq('id',userId).maybeSingle();
  const metadata=JSON.stringify({userId,displayName:profile?.display_name||'Indie Cut Member',avatarUrl:profile?.avatar_url||null,headline:profile?.headline||null,industryRole:profile?.industry_role||null,role,authenticated:true});
  const svc=roomService();
  if(svc){
    try{
      await svc.updateParticipant(cutRoomName(ctx.room.id),member.livekit_identity,{metadata,permission:{canSubscribe:true,canPublish:approve,canPublishData:true}});
    }catch{
      // If the participant left before approval, the DB role still controls the fresh token on rejoin.
    }
  }
  return NextResponse.json({ok:true,role,requestStatus});
}
