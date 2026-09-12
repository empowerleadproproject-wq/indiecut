import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';

export async function POST(request:Request){
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return NextResponse.json({ok:false},{status:503});
  const input=await request.json().catch(()=>({}));
  const visitorId=String(input.visitor_id||'').slice(0,200);
  const sessionId=String(input.session_id||'').slice(0,200);
  const path=String(input.path||'').slice(0,1000);
  if(!visitorId||!sessionId||!path||!path.startsWith('/'))return NextResponse.json({ok:false},{status:400});
  if(path.startsWith('/admin')||path.startsWith('/api'))return NextResponse.json({ok:true,ignored:true});

  // Never count authenticated Indie Cut admins as audience traffic, even when they
  // are previewing public pages. This keeps owner/testing activity out of visitors,
  // sessions, page views, sources and page rankings.
  try{
   const auth=createClient();
   const {data:{user}}=await auth.auth.getUser();
   if(user&&isAdminEmail(user.email))return NextResponse.json({ok:true,ignored:true,reason:'admin'});
  }catch{}

  const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await db.from('website_analytics_events').insert({
   visitor_id:visitorId,
   session_id:sessionId,
   event_type:'page_view',
   path,
   page_title:String(input.page_title||'').slice(0,500)||null,
   referrer:String(input.referrer||'').slice(0,2000)||null,
   article_slug:input.article_slug?String(input.article_slug).slice(0,300):null,
   user_agent:String(request.headers.get('user-agent')||'').slice(0,1000)||null
  });
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({ok:false},{status:500})}
}
