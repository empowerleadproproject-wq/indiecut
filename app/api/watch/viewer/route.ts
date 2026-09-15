import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
export async function POST(request:Request){
 const body=await request.json().catch(()=>null);const name=String(body?.name||'').trim(),email=String(body?.email||'').trim().toLowerCase();if(!name||!/^\S+@\S+\.\S+$/.test(email))return NextResponse.json({error:'Name and valid email required'},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return NextResponse.json({ok:true,stored:false});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {error}=await db.from('watch_viewers').upsert({email,name,last_seen_at:new Date().toISOString()},{onConflict:'email'});if(error)return NextResponse.json({ok:true,stored:false});return NextResponse.json({ok:true,stored:true});
}
