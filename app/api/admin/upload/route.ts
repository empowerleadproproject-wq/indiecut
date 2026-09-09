import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export async function POST(request:Request){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return NextResponse.json({error:'Supabase service credentials missing'},{status:503});
 const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const bucket='indiecut-media';
 const {data:buckets}=await db.storage.listBuckets();if(!(buckets||[]).some(b=>b.name===bucket)){const {error:createError}=await db.storage.createBucket(bucket,{public:true,fileSizeLimit:524288000,allowedMimeTypes:['image/*','video/*','audio/*']});if(createError&&!String(createError.message).toLowerCase().includes('already'))return NextResponse.json({error:createError.message},{status:400});}
 const body=await request.json().catch(()=>({}));const original=String(body.name||'upload.bin');const ext=original.includes('.')?'.'+original.split('.').pop()!.replace(/[^a-z0-9]/gi,'').toLowerCase():'';const path=`admin/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}${ext}`;
 const {data,error}=await db.storage.from(bucket).createSignedUploadUrl(path);if(error)return NextResponse.json({error:error.message},{status:400});const {data:pub}=db.storage.from(bucket).getPublicUrl(path);
 return NextResponse.json({bucket,path,token:data.token,publicUrl:pub.publicUrl});
}
