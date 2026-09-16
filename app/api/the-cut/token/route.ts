import {NextResponse} from 'next/server';
import {AccessToken} from 'livekit-server-sdk';
import {createClient} from '../../../../lib/supabase/server';
import {createAdminClient} from '../../../../lib/supabase/admin';
import {cutIdentity,cutRoomName,CutRole} from '../../../../lib/the-cut';

export const dynamic='force-dynamic';

export async function POST(request:Request){
  const livekitUrl=process.env.LIVEKIT_URL;
  const apiKey=process.env.LIVEKIT_API_KEY;
  const apiSecret=process.env.LIVEKIT_API_SECRET;
  if(!livekitUrl||!apiKey||!apiSecret){
    return NextResponse.json({error:'The Cut audio service is not configured yet.',configured:false},{status:503});
  }

  let body:any={};
  try{body=await request.json()}catch{}
  const slug=String(body.slug||'').trim();
  if(!slug)return NextResponse.json({error:'Missing room.'},{status:400});

  const admin=createAdminClient();
  const {data:room}=await admin.from('cut_rooms').select('id,slug,title,host_id,status').eq('slug',slug).maybeSingle();
  if(!room||room.status==='ended'||room.status==='cancelled')return NextResponse.json({error:'This Cut is no longer live.'},{status:404});

  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  let role:CutRole='listener';
  let authenticated=false;
  let identity=`guest-${crypto.randomUUID()}`;
  let displayName=`Guest ${Math.floor(100+Math.random()*900)}`;
  let avatarUrl:string|null=null;
  let headline:string|null=null;
  let industryRole:string|null=null;
  let userId:string|undefined;

  if(user){
    authenticated=true;
    userId=user.id;
    identity=cutIdentity(user.id);
    const [{data:profile},{data:membership}]=await Promise.all([
      admin.from('cut_profiles').select('display_name,avatar_url,headline,industry_role').eq('id',user.id).maybeSingle(),
      admin.from('cut_room_members').select('role,request_status').eq('room_id',room.id).eq('user_id',user.id).maybeSingle()
    ]);
    displayName=profile?.display_name||String(user.user_metadata?.display_name||user.email?.split('@')[0]||'Indie Cut Member');
    avatarUrl=profile?.avatar_url||null;
    headline=profile?.headline||null;
    industryRole=profile?.industry_role||null;
    if(room.host_id===user.id)role='host';
    else if(membership?.request_status==='approved'&&['cohost','speaker'].includes(membership.role))role=membership.role as CutRole;
  }

  const canPublish=['host','cohost','speaker'].includes(role);
  const metadata=JSON.stringify({userId,displayName,avatarUrl,headline,industryRole,role,authenticated});
  const token=new AccessToken(apiKey,apiSecret,{identity,name:displayName,metadata,ttl:6*60*60});
  token.addGrant({roomJoin:true,room:cutRoomName(room.id),canSubscribe:true,canPublish,canPublishData:true});

  return NextResponse.json({
    token:await token.toJwt(),
    url:livekitUrl,
    identity,
    role,
    authenticated,
    profile:{displayName,avatarUrl,headline,industryRole}
  });
}
