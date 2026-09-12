import {NextResponse} from 'next/server';
import {createHash} from 'crypto';
import {createClient as createServiceClient} from '@supabase/supabase-js';

export const runtime='nodejs';

const GENRES=['Hip-Hop','R&B','Gospel','Pop','Rock','Country','Afrobeats','Reggae / Dancehall','Latin','Electronic / Dance','Jazz','Soul','Alternative','Blues','Folk'] as const;
function normalizeGenre(value:any){const raw=String(value||'').trim().toLowerCase();return GENRES.find(g=>g.toLowerCase()===raw)||''}
function serviceDb(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return null;return createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function hash(value:string){return createHash('sha256').update(value).digest('hex')}
function ipFor(request:Request){return String(request.headers.get('x-forwarded-for')||request.headers.get('x-real-ip')||'unknown').split(',')[0].trim()}
async function readJsonSetting(db:any,key:string,fallback:any){const {data}=await db.from('site_settings').select('setting_value').eq('setting_key',key).maybeSingle();try{return JSON.parse(data?.setting_value||JSON.stringify(fallback))}catch{return fallback}}
async function writeJsonSetting(db:any,key:string,value:any){return db.from('site_settings').upsert({setting_key:key,setting_value:JSON.stringify(value),updated_at:new Date().toISOString()},{onConflict:'setting_key'})}

export async function POST(request:Request){
 const db=serviceDb();if(!db)return NextResponse.json({error:'Submission service is not configured.'},{status:503});const body=await request.json().catch(()=>null);if(!body)return NextResponse.json({error:'Invalid submission.'},{status:400});if(String(body.website||'').trim())return NextResponse.json({ok:true});
 const artist_name=String(body.artist_name||'').trim().slice(0,120),email=String(body.email||'').trim().slice(0,180),phone=String(body.phone||'').trim().slice(0,40),track_title=String(body.track_title||'').trim().slice(0,160),genre=normalizeGenre(body.genre),city=String(body.city||'').trim().slice(0,120),bio=String(body.bio||'').trim().slice(0,1200),social_handle=String(body.social_handle||'').trim().slice(0,180),track_url=String(body.track_url||'').trim(),image_url=String(body.image_url||'').trim();
 if(!artist_name||!email||!phone||!track_title||!genre||!track_url)return NextResponse.json({error:'Artist name, email, phone number, song title, genre and song upload are required.'},{status:400});if(!/^\S+@\S+\.\S+$/.test(email))return NextResponse.json({error:'Enter a valid email address.'},{status:400});if(phone.replace(/\D/g,'').length<7)return NextResponse.json({error:'Enter a valid phone number.'},{status:400});if(body.rights!==true)return NextResponse.json({error:'Please confirm you have the rights to submit this recording.'},{status:400});
 const landing=await readJsonSetting(db,'admin_battle_landing',{});if(landing?.submission_open===false)return NextResponse.json({error:'Artist submissions are currently closed.'},{status:403});
 const submissions:any[]=await readJsonSetting(db,'battle_submissions',[]);const ip_hash=hash(ipFor(request));const cutoff=Date.now()-24*60*60*1000;if(submissions.filter((x:any)=>x.ip_hash===ip_hash&&new Date(x.created_at||0).getTime()>cutoff).length>=3)return NextResponse.json({error:'Too many submissions from this connection today. Please try again tomorrow.'},{status:429});
 const row={id:crypto.randomUUID(),artist_name,email,phone,track_title,genre,city,bio,social_handle,track_url,image_url,status:'pending',ip_hash,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};const {error}=await writeJsonSetting(db,'battle_submissions',[row,...submissions].slice(0,500));if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({ok:true,id:row.id,message:'Submission received and pending Indie Cut review.'});
}
