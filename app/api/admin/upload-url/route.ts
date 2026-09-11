import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const runtime='nodejs';

export async function POST(request:Request){
 const auth=createClient();
 const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:'Supabase service credentials missing'},{status:503});
 const body=await request.json().catch(()=>null);
 const fileName=String(body?.fileName||'upload.bin');
 const mime=String(body?.mime||'application/octet-stream');
 const size=Number(body?.size||0);
 const isImage=mime.startsWith('image/'),isVideo=mime.startsWith('video/'),isAudio=mime.startsWith('audio/');
 if(!isImage&&!isVideo&&!isAudio)return NextResponse.json({error:'Only image, video, and audio files can be uploaded.'},{status:400});
 if(size<=0)return NextResponse.json({error:'Invalid file size.'},{status:400});
 const max=isImage?8*1024*1024:100*1024*1024;
 if(size>max)return NextResponse.json({error:isVideo?'Video uploads must be 100 MB or smaller.':'This upload is too large.'},{status:413});
 const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const bucket='indiecut-media';
 const {data:buckets}=await db.storage.listBuckets();
 if(!(buckets||[]).some(b=>b.name===bucket)){
  const {error:createError}=await db.storage.createBucket(bucket,{public:true,fileSizeLimit:104857600});
  if(createError&&!String(createError.message).toLowerCase().includes('already'))return NextResponse.json({error:createError.message},{status:400});
 }
 const ext=fileName.includes('.')?'.'+fileName.split('.').pop()!.replace(/[^a-z0-9]/gi,'').toLowerCase():'';
 const path=`admin/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}${ext}`;
 const {data:signed,error}=await db.storage.from(bucket).createSignedUploadUrl(path);
 if(error||!signed)return NextResponse.json({error:error?.message||'Unable to create upload URL'},{status:400});
 const {data:pub}=db.storage.from(bucket).getPublicUrl(path);
 return NextResponse.json({bucket,path,token:signed.token,signedUrl:signed.signedUrl,publicUrl:pub.publicUrl,mediaType:isVideo?'video':isAudio?'audio':'image'});
}
