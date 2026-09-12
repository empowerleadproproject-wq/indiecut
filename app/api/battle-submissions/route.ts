import {NextResponse} from 'next/server';
import {createHash} from 'crypto';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {enrollMatchingWorkflows} from '../../../lib/crm-workflows';

export const runtime='nodejs';

const GENRES=['Hip-Hop','R&B','Gospel','Southern Soul','Pop','Rock','Country','Afrobeats','Reggae / Dancehall','Latin','Electronic / Dance','Jazz','Soul','Alternative','Blues','Folk'] as const;
function normalizeGenre(value:any){const raw=String(value||'').trim().toLowerCase();return GENRES.find(g=>g.toLowerCase()===raw)||''}
function serviceDb(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return null;return createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function hash(value:string){return createHash('sha256').update(value).digest('hex')}
function ipFor(request:Request){return String(request.headers.get('x-forwarded-for')||request.headers.get('x-real-ip')||'unknown').split(',')[0].trim()}
async function readJsonSetting(db:any,key:string,fallback:any){const {data}=await db.from('site_settings').select('setting_value').eq('setting_key',key).maybeSingle();try{return JSON.parse(data?.setting_value||JSON.stringify(fallback))}catch{return fallback}}
async function writeJsonSetting(db:any,key:string,value:any){return db.from('site_settings').upsert({setting_key:key,setting_value:JSON.stringify(value),updated_at:new Date().toISOString()},{onConflict:'setting_key'})}
function normalizeSocial(value:any,network:'instagram'|'tiktok'){
 const raw=String(value||'').trim().slice(0,220);if(!raw)return'';const handle=raw.replace(/^@/,'').trim();
 if(!/^https?:\/\//i.test(raw)&&/^[A-Za-z0-9._-]+$/.test(handle))return network==='instagram'?`https://www.instagram.com/${handle}/`:`https://www.tiktok.com/@${handle}`;
 try{const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);const host=u.hostname.toLowerCase().replace(/^www\./,'');if(network==='instagram'&&host==='instagram.com')return u.toString();if(network==='tiktok'&&host==='tiktok.com')return u.toString()}catch{}
 return'';
}

export async function POST(request:Request){
 const db=serviceDb();if(!db)return NextResponse.json({error:'Submission service is not configured.'},{status:503});const body=await request.json().catch(()=>null);if(!body)return NextResponse.json({error:'Invalid submission.'},{status:400});if(String(body.website||'').trim())return NextResponse.json({ok:true});
 const artist_name=String(body.artist_name||'').trim().slice(0,120),email=String(body.email||'').trim().toLowerCase().slice(0,180),phone=String(body.phone||'').trim().slice(0,40),track_title=String(body.track_title||'').trim().slice(0,160),genre=normalizeGenre(body.genre),city=String(body.city||'').trim().slice(0,120),bio=String(body.bio||'').trim().slice(0,1200),instagram_url=normalizeSocial(body.instagram,'instagram'),tiktok_url=normalizeSocial(body.tiktok,'tiktok'),track_url=String(body.track_url||'').trim(),image_url=String(body.image_url||'').trim(),marketing_opt_in=body.marketing_opt_in===true;
 if(!artist_name||!email||!phone||!track_title||!genre||!track_url)return NextResponse.json({error:'Artist name, email, phone number, song title, genre and song upload are required.'},{status:400});if(!/^\S+@\S+\.\S+$/.test(email))return NextResponse.json({error:'Enter a valid email address.'},{status:400});if(phone.replace(/\D/g,'').length<7)return NextResponse.json({error:'Enter a valid phone number.'},{status:400});if(body.instagram&&!instagram_url)return NextResponse.json({error:'Enter a valid Instagram handle or Instagram URL.'},{status:400});if(body.tiktok&&!tiktok_url)return NextResponse.json({error:'Enter a valid TikTok handle or TikTok URL.'},{status:400});if(body.rights!==true)return NextResponse.json({error:'Please confirm you have the rights to submit this recording.'},{status:400});
 const landing=await readJsonSetting(db,'admin_battle_landing',{});if(landing?.submission_open===false)return NextResponse.json({error:'Artist submissions are currently closed.'},{status:403});
 const submissions:any[]=await readJsonSetting(db,'battle_submissions',[]);const ip_hash=hash(ipFor(request));const cutoff=Date.now()-24*60*60*1000;if(submissions.filter((x:any)=>x.ip_hash===ip_hash&&new Date(x.created_at||0).getTime()>cutoff).length>=3)return NextResponse.json({error:'Too many submissions from this connection today. Please try again tomorrow.'},{status:429});
 const now=new Date().toISOString();const row={id:crypto.randomUUID(),artist_name,email,phone,track_title,genre,city,bio,instagram_url,tiktok_url,track_url,image_url,status:'pending',marketing_opt_in,ip_hash,created_at:now,updated_at:now};const {error}=await writeJsonSetting(db,'battle_submissions',[row,...submissions].slice(0,500));if(error)return NextResponse.json({error:error.message},{status:400});
 try{
  const {data:existing}=await db.from('crm_contacts').select('*').eq('email',email).maybeSingle();const social_handle=instagram_url||tiktok_url||null;
  const contactPayload:any={artist_name,email,phone,genre,city:city||null,social_handle,source:'phase_one_submission',status:'pending',tags:Array.from(new Set([...(existing?.tags||[]),'artist','live-battles','phase-one'])),notes:`Submitted track: ${track_title}`,email_opt_in:Boolean(existing?.email_opt_in)||marketing_opt_in,updated_at:now};
  let contactId=existing?.id;if(existing){await db.from('crm_contacts').update(contactPayload).eq('id',existing.id)}else{const inserted=await db.from('crm_contacts').insert(contactPayload).select('id').single();contactId=inserted.data?.id}
  if(contactId){await db.from('crm_activity').insert({contact_id:contactId,activity_type:'phase_one_submission',detail:`Submitted ${track_title} for ${genre} review.`});await enrollMatchingWorkflows(db,contactId,'battle_submission_received',{submissionId:row.id,track_title,genre,artist_name})}
 }catch(e){console.error('CRM capture/workflow trigger failed',e)}
 return NextResponse.json({ok:true,id:row.id,message:'Submission received and pending Indie Cut review.'});
}
