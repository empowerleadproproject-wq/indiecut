import {NextResponse} from 'next/server';
import {createHash} from 'crypto';
import {createClient as createServiceClient} from '@supabase/supabase-js';

export const runtime='nodejs';
export const maxDuration=60;

function serviceDb(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return null;
 return createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function hash(value:string){return createHash('sha256').update(value).digest('hex')}
function ipFor(request:Request){return String(request.headers.get('x-forwarded-for')||request.headers.get('x-real-ip')||'unknown').split(',')[0].trim()}
async function readJsonSetting(db:any,key:string,fallback:any){const {data}=await db.from('site_settings').select('setting_value').eq('setting_key',key).maybeSingle();try{return JSON.parse(data?.setting_value||JSON.stringify(fallback))}catch{return fallback}}
async function writeJsonSetting(db:any,key:string,value:any){return db.from('site_settings').upsert({setting_key:key,setting_value:JSON.stringify(value),updated_at:new Date().toISOString()},{onConflict:'setting_key'})}
async function ensureBucket(db:any){const bucket='indiecut-media';const {data:buckets}=await db.storage.listBuckets();if(!(buckets||[]).some((b:any)=>b.name===bucket)){const {error}=await db.storage.createBucket(bucket,{public:true,fileSizeLimit:52428800});if(error&&!String(error.message).toLowerCase().includes('already'))throw error}return bucket}
async function storeFile(db:any,bucket:string,file:File,kind:'image'|'audio'){
 const mime=file.type||'';if(kind==='image'&&!mime.startsWith('image/'))throw new Error('Artist photo must be an image.');if(kind==='audio'&&!mime.startsWith('audio/'))throw new Error('Song upload must be an audio file.');
 const max=kind==='image'?8*1024*1024:50*1024*1024;if(file.size>max)throw new Error(kind==='image'?'Artist photo must be 8 MB or smaller.':'Song upload must be 50 MB or smaller.');
 const original=String(file.name||'upload');const ext=original.includes('.')?'.'+original.split('.').pop()!.replace(/[^a-z0-9]/gi,'').toLowerCase():'';const path=`battle-submissions/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}${ext}`;
 const bytes=Buffer.from(await file.arrayBuffer());const {error}=await db.storage.from(bucket).upload(path,bytes,{contentType:mime||undefined,upsert:false});if(error)throw error;return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function POST(request:Request){
 const db=serviceDb();if(!db)return NextResponse.json({error:'Submission service is not configured.'},{status:503});
 const form=await request.formData().catch(()=>null);if(!form)return NextResponse.json({error:'Invalid submission.'},{status:400});
 if(String(form.get('website')||'').trim())return NextResponse.json({ok:true});
 const artist_name=String(form.get('artist_name')||'').trim().slice(0,120);const email=String(form.get('email')||'').trim().slice(0,180);const track_title=String(form.get('track_title')||'').trim().slice(0,160);const genre=String(form.get('genre')||'').trim().slice(0,80);const city=String(form.get('city')||'').trim().slice(0,120);const bio=String(form.get('bio')||'').trim().slice(0,1200);const social_handle=String(form.get('social_handle')||'').trim().slice(0,180);const rights=String(form.get('rights')||'')==='yes';
 if(!artist_name||!email||!track_title)return NextResponse.json({error:'Artist name, email and song title are required.'},{status:400});if(!/^\S+@\S+\.\S+$/.test(email))return NextResponse.json({error:'Enter a valid email address.'},{status:400});if(!rights)return NextResponse.json({error:'Please confirm you have the rights to submit this recording.'},{status:400});
 const landing=await readJsonSetting(db,'admin_battle_landing',{});if(landing?.submission_open===false)return NextResponse.json({error:'Artist submissions are currently closed.'},{status:403});
 const submissions:any[]=await readJsonSetting(db,'battle_submissions',[]);const ip_hash=hash(ipFor(request));const cutoff=Date.now()-24*60*60*1000;const recent=submissions.filter((x:any)=>x.ip_hash===ip_hash&&new Date(x.created_at||0).getTime()>cutoff);if(recent.length>=3)return NextResponse.json({error:'Too many submissions from this connection today. Please try again tomorrow.'},{status:429});
 const song=form.get('track_file');if(!(song instanceof File)||!song.size)return NextResponse.json({error:'Upload the song you want to enter.'},{status:400});const photo=form.get('artist_photo');
 try{
  const bucket=await ensureBucket(db);const track_url=await storeFile(db,bucket,song,'audio');const image_url=photo instanceof File&&photo.size?await storeFile(db,bucket,photo,'image'):'';
  const row={id:crypto.randomUUID(),artist_name,email,track_title,genre,city,bio,social_handle,track_url,image_url,status:'pending',ip_hash,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  const {error}=await writeJsonSetting(db,'battle_submissions',[row,...submissions].slice(0,500));if(error)throw error;
  return NextResponse.json({ok:true,id:row.id,message:'Submission received for Phase One.'});
 }catch(e:any){return NextResponse.json({error:e?.message||'Unable to submit your music.'},{status:400})}
}
