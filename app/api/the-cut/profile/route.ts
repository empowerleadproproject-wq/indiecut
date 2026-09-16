import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {createAdminClient} from '../../../../lib/supabase/admin';

export const dynamic='force-dynamic';

export async function GET(){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({authenticated:false},{status:401});
  const admin=createAdminClient();
  const {data:profile}=await admin.from('cut_profiles').select('*').eq('id',user.id).maybeSingle();
  return NextResponse.json({authenticated:true,profile:profile||{id:user.id,display_name:user.user_metadata?.display_name||user.email?.split('@')[0]||'',avatar_url:null,headline:'',industry_role:''}});
}

export async function POST(request:Request){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Sign in to update your profile.'},{status:401});
  const form=await request.formData();
  const displayName=String(form.get('displayName')||'').trim().slice(0,80);
  const headline=String(form.get('headline')||'').trim().slice(0,160);
  const industryRole=String(form.get('industryRole')||'').trim().slice(0,80);
  if(displayName.length<2)return NextResponse.json({error:'Please enter your display name.'},{status:400});

  const admin=createAdminClient();
  const {data:existing}=await admin.from('cut_profiles').select('avatar_url').eq('id',user.id).maybeSingle();
  let avatarUrl=existing?.avatar_url||null;
  const avatar=form.get('avatar');
  if(avatar instanceof File&&avatar.size>0){
    if(avatar.size>5*1024*1024)return NextResponse.json({error:'Avatar must be 5 MB or smaller.'},{status:400});
    if(!['image/jpeg','image/png','image/webp','image/gif'].includes(avatar.type))return NextResponse.json({error:'Use a JPG, PNG, WEBP, or GIF image.'},{status:400});
    const ext=(avatar.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase();
    const path=`${user.id}/${Date.now()}.${ext}`;
    const bytes=Buffer.from(await avatar.arrayBuffer());
    const {error:uploadError}=await admin.storage.from('cut-avatars').upload(path,bytes,{contentType:avatar.type,upsert:false,cacheControl:'3600'});
    if(uploadError)return NextResponse.json({error:uploadError.message},{status:500});
    avatarUrl=admin.storage.from('cut-avatars').getPublicUrl(path).data.publicUrl;
  }

  const now=new Date().toISOString();
  const {data:profile,error}=await admin.from('cut_profiles').upsert({id:user.id,display_name:displayName,avatar_url:avatarUrl,headline:headline||null,industry_role:industryRole||null,updated_at:now},{onConflict:'id'}).select('*').single();
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({profile});
}
