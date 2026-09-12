import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';
import {slugify} from '../../../../lib/battles';

async function adminDb(){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();if(!user||!isAdminEmail(user.email))return {error:NextResponse.json({error:'Unauthorized'},{status:401})};
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return {error:NextResponse.json({error:'Supabase service credentials missing'},{status:503})};
 return {db:createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})};
}
async function readSubmissions(db:any){const {data}=await db.from('site_settings').select('setting_value').eq('setting_key','battle_submissions').maybeSingle();try{return JSON.parse(data?.setting_value||'[]')}catch{return[]}}
async function writeSubmissions(db:any,rows:any[]){return db.from('site_settings').upsert({setting_key:'battle_submissions',setting_value:JSON.stringify(rows),updated_at:new Date().toISOString()},{onConflict:'setting_key'})}
async function publicRows(db:any){const rows:any[]=await readSubmissions(db);return rows.map(({ip_hash,...rest}:any)=>rest)}
async function contests(db:any){const {data}=await db.from('battle_contests').select('id,title,slug,status,genre,qualifying_starts_at,qualifying_ends_at').neq('status','completed').order('created_at',{ascending:false});return data||[]}

export async function GET(){const a=await adminDb();if(a.error)return a.error;const db=a.db!;return NextResponse.json({submissions:await publicRows(db),contests:await contests(db)})}

export async function POST(request:Request){
 const a=await adminDb();if(a.error)return a.error;const db=a.db!;const body=await request.json().catch(()=>({}));const action=String(body.action||'');const id=String(body.submissionId||'');
 const rows:any[]=await readSubmissions(db);const index=rows.findIndex((x:any)=>x.id===id);if(index<0)return NextResponse.json({error:'Submission not found'},{status:404});const item=rows[index];
 if(action==='approve'){
  const contestId=String(body.contestId||'');if(!contestId)return NextResponse.json({error:'Choose a competition first.'},{status:400});if(item.status==='approved')return NextResponse.json({error:'This submission is already approved.'},{status:400});
  const {data:contest}=await db.from('battle_contests').select('id,title,slug,genre').eq('id',contestId).maybeSingle();if(!contest)return NextResponse.json({error:'Competition not found.'},{status:404});
  if(!contest.genre)return NextResponse.json({error:'Set the competition genre before approving artists.'},{status:400});
  if(String(contest.genre).trim().toLowerCase()!==String(item.genre||'').trim().toLowerCase())return NextResponse.json({error:`Genre mismatch: ${item.artist_name} submitted as ${item.genre}, but this competition is ${contest.genre}.`},{status:400});
  let base=slugify(item.artist_name)||'artist';let slug=base;let n=2;while(true){const {data}=await db.from('battle_entries').select('id').eq('contest_id',contestId).eq('slug',slug).maybeSingle();if(!data)break;slug=`${base}-${n++}`}
  const {data:entry,error}=await db.from('battle_entries').insert({contest_id:contestId,artist_name:item.artist_name,slug,genre:item.genre,city:item.city||null,bio:item.bio||null,image_url:item.image_url||null,track_title:item.track_title||null,track_url:item.track_url||null,track_cover_url:item.image_url||null,instagram_url:item.instagram_url||null,tiktok_url:item.tiktok_url||null,active:true}).select('id,slug').single();if(error)return NextResponse.json({error:error.message},{status:400});
  const fan_path=`/battles/${contest.slug}/artists/${entry.slug}`;
  rows[index]={...item,status:'approved',approved_to_contest_id:contestId,approved_to_contest_title:contest.title,battle_entry_id:entry.id,fan_path,updated_at:new Date().toISOString()};const {error:saveError}=await writeSubmissions(db,rows);if(saveError)return NextResponse.json({error:saveError.message},{status:400});return NextResponse.json({ok:true,submissions:await publicRows(db),contests:await contests(db),entry:{...entry,fan_path}});
 }
 if(action==='update_photo'){
  const imageUrl=String(body.image_url||'').trim();if(item.status!=='approved'||!item.battle_entry_id)return NextResponse.json({error:'Approve this artist before editing the live profile.'},{status:400});if(!imageUrl)return NextResponse.json({error:'Upload a profile image first.'},{status:400});
  const {error:entryError}=await db.from('battle_entries').update({image_url:imageUrl,updated_at:new Date().toISOString()}).eq('id',item.battle_entry_id);if(entryError)return NextResponse.json({error:entryError.message},{status:400});
  rows[index]={...item,image_url:imageUrl,updated_at:new Date().toISOString()};const {error:saveError}=await writeSubmissions(db,rows);if(saveError)return NextResponse.json({error:saveError.message},{status:400});return NextResponse.json({ok:true,submissions:await publicRows(db),contests:await contests(db)});
 }
 if(action==='reject'||action==='reopen'){rows[index]={...item,status:action==='reject'?'rejected':'pending',updated_at:new Date().toISOString()};const {error}=await writeSubmissions(db,rows);if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({ok:true,submissions:await publicRows(db),contests:await contests(db)})}
 if(action==='delete'){rows.splice(index,1);const {error}=await writeSubmissions(db,rows);if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({ok:true,submissions:await publicRows(db),contests:await contests(db)})}
 return NextResponse.json({error:'Unknown action'},{status:400});
}
