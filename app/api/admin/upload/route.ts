import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const runtime='nodejs';

export async function POST(request:Request){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return NextResponse.json({error:'Supabase service credentials missing'},{status:503});
 const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const bucket='indiecut-media';
 const form=await request.formData().catch(()=>null);if(!form)return NextResponse.json({error:'Invalid upload request'},{status:400});
 const file=form.get('file');if(!(file instanceof File))return NextResponse.json({error:'No file received'},{status:400});
 const mime=file.type||'application/octet-stream';const isImage=mime.startsWith('image/'),isVideo=mime.startsWith('video/'),isAudio=mime.startsWith('audio/');
 if(!isImage&&!isVideo&&!isAudio)return NextResponse.json({error:'Only image, video, and audio files can be uploaded.'},{status:400});
 const max=isImage?4*1024*1024:isVideo?4*1024*1024:4*1024*1024;
 if(file.size>max)return NextResponse.json({error:'This browser upload must be under 4 MB after optimization.'},{status:413});
 const {data:buckets}=await db.storage.listBuckets();if(!(buckets||[]).some(b=>b.name===bucket)){const {error:createError}=await db.storage.createBucket(bucket,{public:true,fileSizeLimit:52428800});if(createError&&!String(createError.message).toLowerCase().includes('already'))return NextResponse.json({error:createError.message},{status:400});}
 const original=String(file.name||'upload.bin');const ext=original.includes('.')?'.'+original.split('.').pop()!.replace(/[^a-z0-9]/gi,'').toLowerCase():'';const path=`admin/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}${ext}`;
 const bytes=Buffer.from(await file.arrayBuffer());
 const {error}=await db.storage.from(bucket).upload(path,bytes,{contentType:mime,upsert:false});if(error)return NextResponse.json({error:error.message},{status:400});
 const {data:pub}=db.storage.from(bucket).getPublicUrl(path);return NextResponse.json({publicUrl:pub.publicUrl,path,bucket});
}
