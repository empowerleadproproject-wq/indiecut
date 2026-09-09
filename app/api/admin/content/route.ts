import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '../../../../lib/supabase/server';
import { isAdminEmail } from '../../../../lib/admin';

export const dynamic='force-dynamic';

async function getAdmin(){
 const auth=createClient();
 const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return null;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Supabase admin environment variables are missing.');
 return createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function slugify(v:string){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
function tableFor(kind:string){if(kind==='article')return 'articles';if(kind==='artist')return 'artists';if(kind==='media')return 'media_items';throw new Error('Unsupported content type');}

export async function GET(){
 try{const db=await getAdmin();if(!db)return NextResponse.json({error:'Unauthorized'},{status:401});
  const [a,b,c]=await Promise.all([
   db.from('articles').select('*').order('created_at',{ascending:false}).limit(250),
   db.from('artists').select('*').order('created_at',{ascending:false}).limit(250),
   db.from('media_items').select('*').order('created_at',{ascending:false}).limit(250)
  ]);
  return NextResponse.json({articles:a.data||[],artists:b.data||[],media:c.data||[],errors:[a.error?.message,b.error?.message,c.error?.message].filter(Boolean)});
 }catch(e:any){return NextResponse.json({error:e.message},{status:500})}
}

export async function POST(request:Request){
 try{const db=await getAdmin();if(!db)return NextResponse.json({error:'Unauthorized'},{status:401});const {kind,payload}=await request.json();const table=tableFor(kind);let row={...payload};
  if(kind==='article'){row.slug=slugify(payload.slug||payload.headline);row.sources=Array.isArray(payload.sources)?payload.sources:String(payload.sources||'').split(/\r?\n/).map((x:string)=>x.trim()).filter(Boolean);row.verification_status=payload.verification_status||'verified';row.published_at=payload.status==='published'?new Date().toISOString():null;}
  const {data,error}=await db.from(table).insert(row).select('*').single();if(error)throw error;return NextResponse.json({data});
 }catch(e:any){return NextResponse.json({error:e.message},{status:400})}
}

export async function PATCH(request:Request){
 try{const db=await getAdmin();if(!db)return NextResponse.json({error:'Unauthorized'},{status:401});const {kind,id,payload}=await request.json();const table=tableFor(kind);const row={...payload,updated_at:new Date().toISOString()};const {data,error}=await db.from(table).update(row).eq('id',id).select('*').single();if(error)throw error;return NextResponse.json({data});
 }catch(e:any){return NextResponse.json({error:e.message},{status:400})}
}

export async function DELETE(request:Request){
 try{const db=await getAdmin();if(!db)return NextResponse.json({error:'Unauthorized'},{status:401});const {kind,id}=await request.json();const table=tableFor(kind);const {error}=await db.from(table).delete().eq('id',id);if(error)throw error;return NextResponse.json({ok:true});
 }catch(e:any){return NextResponse.json({error:e.message},{status:400})}
}
