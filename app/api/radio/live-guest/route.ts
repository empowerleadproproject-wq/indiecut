import {NextResponse} from 'next/server';import {createClient} from '@supabase/supabase-js';
export async function POST(req:Request){
 const b=await req.json().catch(()=>({})),x=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const token=String(b.token||'').trim(),name=String(b.name||'').trim().slice(0,100);
 if(!token||!name)return NextResponse.json({error:'Valid invitation and name are required.'},{status:400});
 const {data:s}=await x.from('radio_live_sessions').select('id,status').eq('guest_token',token).neq('status','ended').maybeSingle();
 if(!s)return NextResponse.json({error:'This studio invitation is no longer active.'},{status:404});
 const {count}=await x.from('radio_live_guests').select('id',{count:'exact',head:true}).eq('session_id',s.id).neq('status','removed');
 if((count||0)>=8)return NextResponse.json({error:'This studio is full.'},{status:409});
 const {data,error}=await x.from('radio_live_guests').insert({session_id:s.id,name}).select('*').single();
 return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json({ok:true,guest:data});
}