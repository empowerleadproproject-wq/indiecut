import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';
const allowedEvents=new Set(['page_view','page_engagement','ad_impression','ad_click']);
const text=(value:any,max:number)=>String(value||'').slice(0,max)||null;

export async function POST(request:Request){
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return NextResponse.json({ok:false},{status:503});
  const input=await request.json().catch(()=>({}));
  const visitorId=String(input.visitor_id||'').slice(0,200);
  const sessionId=String(input.session_id||'').slice(0,200);
  const path=String(input.path||'').slice(0,1000);
  const eventType=allowedEvents.has(String(input.event_type||''))?String(input.event_type):'page_view';
  if(!visitorId||!sessionId||!path||!path.startsWith('/'))return NextResponse.json({ok:false},{status:400});
  if(path.startsWith('/admin')||path.startsWith('/api'))return NextResponse.json({ok:true,ignored:true});

  try{
   const auth=createClient();
   const {data:{user}}=await auth.auth.getUser();
   if(user&&isAdminEmail(user.email))return NextResponse.json({ok:true,ignored:true,reason:'admin'});
  }catch{}

  const durationRaw=Number(input.duration_ms);
  const scrollRaw=Number(input.scroll_depth);
  const durationMs=Number.isFinite(durationRaw)?Math.max(0,Math.min(86400000,Math.round(durationRaw))):null;
  const scrollDepth=Number.isFinite(scrollRaw)?Math.max(0,Math.min(100,Math.round(scrollRaw))):null;
  const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await db.from('website_analytics_events').insert({
   visitor_id:visitorId,
   session_id:sessionId,
   event_type:eventType,
   path,
   page_title:text(input.page_title,500),
   referrer:text(input.referrer,2000),
   article_slug:text(input.article_slug,300),
   user_agent:text(request.headers.get('user-agent'),1000),
   duration_ms:eventType==='page_engagement'?durationMs:null,
   scroll_depth:eventType==='page_engagement'?scrollDepth:null,
   ad_id:eventType.startsWith('ad_')?text(input.ad_id,300):null,
   ad_name:eventType.startsWith('ad_')?text(input.ad_name,500):null,
   ad_placement:eventType.startsWith('ad_')?text(input.ad_placement,200):null,
   target_url:eventType==='ad_click'?text(input.target_url,2000):null
  });
  if(error)return NextResponse.json({ok:false,error:error.message},{status:500});
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({ok:false},{status:500})}
}
