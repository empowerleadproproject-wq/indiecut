import {NextResponse} from 'next/server';
import {createHash} from 'crypto';
import {createClient as createServiceClient} from '@supabase/supabase-js';

export const runtime='nodejs';

function ipFor(request:Request){return String(request.headers.get('x-forwarded-for')||request.headers.get('x-real-ip')||'unknown').split(',')[0].trim()}
function hash(value:string){return createHash('sha256').update(value).digest('hex')}

export async function POST(request:Request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return NextResponse.json({error:'Upload service is not configured.'},{status:503});
 const body=await request.json().catch(()=>null);const fileName=String(body?.fileName||'upload.bin');const mime=String(body?.mime||'application/octet-stream');const size=Number(body?.size||0);const kind=String(body?.kind||'');
 const isImage=mime.startsWith('image/'),isAudio=mime.startsWith('audio/');if((kind==='image'&&!isImage)||(kind==='audio'&&!isAudio)||(!isImage&&!isAudio))return NextResponse.json({error:'Only artist images and audio files can be uploaded.'},{status:400});
 const max=isImage?8*1024*1024:100*1024*1024;if(size<=0||size>max)return NextResponse.json({error:isImage?'Artist photo must be 8 MB or smaller.':'Song upload must be 100 MB or smaller.'},{status:413});
 const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const ipHash=hash(ipFor(request));const now=Date.now();
 const {data:rateRow}=await db.from('site_settings').select('setting_value').eq('setting_key','battle_upload_issuances').maybeSingle();let rates:any[]=[];try{rates=JSON.parse(rateRow?.setting_value||'[]')}catch{}rates=rates.filter(x=>new Date(x.at||0).getTime()>now-24*60*60*1000);if(rates.filter(x=>x.ip_hash===ipHash).length>=8)return NextResponse.json({error:'Upload limit reached for today.'},{status:429});
 const bucket='indiecut-media';const {data:buckets}=await db.storage.listBuckets();if(!(buckets||[]).some((b:any)=>b.name===bucket)){const {error:createError}=await db.storage.createBucket(bucket,{public:true,fileSizeLimit:104857600});if(createError&&!String(createError.message).toLowerCase().includes('already'))return NextResponse.json({error:createError.message},{status:400})}
 const ext=fileName.includes('.')?'.'+fileName.split('.').pop()!.replace(/[^a-z0-9]/gi,'').toLowerCase():'';const path=`battle-submissions/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}${ext}`;const {data:signed,error}=await db.storage.from(bucket).createSignedUploadUrl(path);if(error||!signed)return NextResponse.json({error:error?.message||'Unable to create upload URL'},{status:400});
 rates.push({ip_hash:ipHash,at:new Date().toISOString()});await db.from('site_settings').upsert({setting_key:'battle_upload_issuances',setting_value:JSON.stringify(rates.slice(-1000)),updated_at:new Date().toISOString()},{onConflict:'setting_key'});const {data:pub}=db.storage.from(bucket).getPublicUrl(path);return NextResponse.json({bucket,path,token:signed.token,publicUrl:pub.publicUrl});
}
