import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {createAdminClient} from '../../../../lib/supabase/admin';
import {cutIdentity,makeCutSlug} from '../../../../lib/the-cut';

export const dynamic='force-dynamic';

export async function GET(){
  const admin=createAdminClient();
  const {data,error}=await admin.from('cut_rooms').select('id,slug,title,description,category,status,scheduled_for,started_at,peak_listeners,host_id,cut_profiles!cut_rooms_host_id_fkey(display_name,avatar_url,headline,industry_role)').in('status',['live','scheduled']).order('created_at',{ascending:false}).limit(50);
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({rooms:data||[]});
}

export async function POST(request:Request){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Sign in to start a Cut.'},{status:401});

  let body:any={};
  try{body=await request.json()}catch{}
  const title=String(body.title||'').trim();
  const description=String(body.description||'').trim().slice(0,600);
  const category=String(body.category||'Open Networking').trim().slice(0,80);
  if(title.length<3||title.length>120)return NextResponse.json({error:'Room title must be between 3 and 120 characters.'},{status:400});

  const admin=createAdminClient();
  const fallbackName=String(user.user_metadata?.display_name||user.email?.split('@')[0]||'Indie Cut Member').slice(0,80);
  await admin.from('cut_profiles').upsert({id:user.id,display_name:fallbackName,updated_at:new Date().toISOString()},{onConflict:'id',ignoreDuplicates:true});

  const slug=makeCutSlug(title);
  const {data:room,error}=await admin.from('cut_rooms').insert({
    slug,title,description:description||null,category,host_id:user.id,status:'live',started_at:new Date().toISOString()
  }).select('id,slug,title,status').single();
  if(error)return NextResponse.json({error:error.message},{status:500});

  await admin.from('cut_room_members').upsert({
    room_id:room.id,user_id:user.id,role:'host',request_status:'approved',livekit_identity:cutIdentity(user.id),approved_at:new Date().toISOString(),updated_at:new Date().toISOString()
  },{onConflict:'room_id,user_id'});

  return NextResponse.json({room},{status:201});
}
