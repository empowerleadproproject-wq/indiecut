import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

async function adminDb(){
  const auth=createClient();
  const {data:{user}}=await auth.auth.getUser();
  if(!user||!isAdminEmail(user.email))return {error:NextResponse.json({error:'Unauthorized'},{status:401})};
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return {error:NextResponse.json({error:'Supabase service credentials missing'},{status:503})};
  return {db:createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})};
}

export async function POST(request:Request){
  const a=await adminDb();
  if(a.error)return a.error;
  const db=a.db!;
  const body=await request.json().catch(()=>({}));
  const entryId=String(body.entryId||'');
  const p=body.payload||{};
  if(!entryId)return NextResponse.json({error:'Artist entry is required.'},{status:400});

  const {data:existing,error:readError}=await db.from('battle_entries').select('*').eq('id',entryId).maybeSingle();
  if(readError)return NextResponse.json({error:readError.message},{status:400});
  if(!existing)return NextResponse.json({error:'Artist not found.'},{status:404});

  const artistName=String(p.artist_name??existing.artist_name??'').trim();
  if(!artistName)return NextResponse.json({error:'Artist name is required.'},{status:400});

  const update:any={
    artist_name:artistName,
    city:String(p.city??existing.city??'').trim()||null,
    bio:String(p.bio??existing.bio??'').trim()||null,
    image_url:String(p.image_url??existing.image_url??'').trim()||null,
    track_title:String(p.track_title??existing.track_title??'').trim()||null,
    track_url:String(p.track_url??existing.track_url??'').trim()||null,
    track_cover_url:String(p.track_cover_url??existing.track_cover_url??'').trim()||null,
    active:p.active===undefined?existing.active:Boolean(p.active),
    updated_at:new Date().toISOString()
  };

  const {data:entry,error}=await db.from('battle_entries').update(update).eq('id',entryId).select('*').single();
  if(error)return NextResponse.json({error:error.message},{status:400});

  // Keep already-built live rounds in sync when the artist changes their song.
  await db.from('battle_rounds').update({track_a_title:entry.track_title,track_a_url:entry.track_url,updated_at:new Date().toISOString()}).eq('entry_a_id',entryId);
  await db.from('battle_rounds').update({track_b_title:entry.track_title,track_b_url:entry.track_url,updated_at:new Date().toISOString()}).eq('entry_b_id',entryId);

  // Keep the approved submission history in sync with the live profile.
  const {data:settings}=await db.from('site_settings').select('setting_value').eq('setting_key','battle_submissions').maybeSingle();
  let rows:any[]=[];
  try{rows=JSON.parse(settings?.setting_value||'[]')}catch{}
  let changed=false;
  rows=rows.map((row:any)=>{
    if(String(row.battle_entry_id||'')!==entryId)return row;
    changed=true;
    return {...row,artist_name:entry.artist_name,city:entry.city,bio:entry.bio,image_url:entry.image_url,track_title:entry.track_title,track_url:entry.track_url,updated_at:new Date().toISOString()};
  });
  if(changed)await db.from('site_settings').upsert({setting_key:'battle_submissions',setting_value:JSON.stringify(rows),updated_at:new Date().toISOString()},{onConflict:'setting_key'});

  return NextResponse.json({ok:true,entry});
}
