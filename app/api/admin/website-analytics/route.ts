import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';

function source(referrer:string|null){
 if(!referrer)return 'Direct / Unknown';
 try{
  const host=new URL(referrer).hostname.replace(/^www\./,'');
  if(host.includes('instagram.com'))return 'Instagram';
  if(host.includes('facebook.com')||host.includes('fb.com'))return 'Facebook';
  if(host.includes('google.'))return 'Google';
  if(host.includes('bing.com'))return 'Bing';
  if(host.includes('tiktok.com'))return 'TikTok';
  if(host.includes('x.com')||host.includes('twitter.com'))return 'X';
  if(host.includes('indiecut.vercel.app')||host.includes('indiecut.info'))return 'Internal';
  return host;
 }catch{return 'Direct / Unknown'}
}

export async function GET(){
 const auth=createClient();
 const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:'Supabase admin credentials missing'},{status:503});
 const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const since30=new Date(Date.now()-30*24*60*60*1000).toISOString();
 const {data,error}=await db.from('website_analytics_events').select('visitor_id,session_id,path,page_title,referrer,article_slug,created_at').gte('created_at',since30).order('created_at',{ascending:false}).limit(10000);
 if(error)return NextResponse.json({error:error.message},{status:500});
 const rows=data||[];
 const now=Date.now(),day=24*60*60*1000;
 const within=(days:number)=>rows.filter((r:any)=>now-new Date(r.created_at).getTime()<=days*day);
 const today=within(1),week=within(7),month=rows;
 const uniq=(arr:any[],key:string)=>new Set(arr.map(x=>x[key]).filter(Boolean)).size;
 const countBy=(arr:any[],getter:(x:any)=>string)=>{
  const m=new Map<string,number>();for(const x of arr){const k=getter(x)||'Unknown';m.set(k,(m.get(k)||0)+1)}
  return [...m.entries()].sort((a,b)=>b[1]-a[1]).map(([label,count])=>({label,count}));
 };
 const topPages=countBy(month,r=>String(r.path||'/').split('?')[0]).slice(0,15);
 const sources=countBy(month,r=>source(r.referrer)).filter(x=>x.label!=='Internal').slice(0,12);
 const sessions=new Map<string,any[]>();
 for(const r of [...month].reverse()){if(!sessions.has(r.session_id))sessions.set(r.session_id,[]);sessions.get(r.session_id)!.push(r)}
 const entries=countBy([...sessions.values()],s=>String(s[0]?.path||'/').split('?')[0]).slice(0,10);
 const transitions=new Map<string,number>();
 for(const s of sessions.values())for(let i=1;i<s.length;i++){
  const a=String(s[i-1].path||'/').split('?')[0],b=String(s[i].path||'/').split('?')[0];if(a===b)continue;
  const key=`${a} → ${b}`;transitions.set(key,(transitions.get(key)||0)+1);
 }
 const paths=[...transitions.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([label,count])=>({label,count}));
 const recent=month.slice(0,30).map((r:any)=>({path:r.path,page_title:r.page_title,source:source(r.referrer),created_at:r.created_at,article_slug:r.article_slug}));
 return NextResponse.json({
  generated_at:new Date().toISOString(),
  today:{page_views:today.length,visitors:uniq(today,'visitor_id'),sessions:uniq(today,'session_id')},
  last_7_days:{page_views:week.length,visitors:uniq(week,'visitor_id'),sessions:uniq(week,'session_id')},
  last_30_days:{page_views:month.length,visitors:uniq(month,'visitor_id'),sessions:uniq(month,'session_id')},
  top_pages:topPages,traffic_sources:sources,entry_pages:entries,visitor_paths:paths,recent_activity:recent
 });
}
