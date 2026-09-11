import {NextRequest,NextResponse} from 'next/server';
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

function easternDateParts(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const get=(type:string)=>parts.find(p=>p.type===type)?.value||'';
 return {year:Number(get('year')),month:Number(get('month')),day:Number(get('day'))};
}
function easternMidnightUtc(daysBack=0){
 const p=easternDateParts();
 const noon=new Date(Date.UTC(p.year,p.month-1,p.day-daysBack,12));
 const q=easternDateParts(noon);
 const probe=new Date(Date.UTC(q.year,q.month-1,q.day,5));
 const hour=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hour12:false}).format(probe);
 const offsetHours=Number(hour)===1?4:5;
 return new Date(Date.UTC(q.year,q.month-1,q.day,offsetHours));
}

export async function GET(req:NextRequest){
 const auth=createClient();
 const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:'Supabase admin credentials missing'},{status:503});
 const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const params=req.nextUrl.searchParams;
 const range=params.get('range')||'30d';
 const sourceFilter=params.get('source')||'all';
 const pathFilter=params.get('path')||'';
 const startParam=params.get('start'),endParam=params.get('end');
 let start:Date,end=new Date();
 if(range==='today')start=easternMidnightUtc(0);
 else if(range==='7d')start=easternMidnightUtc(6);
 else if(range==='custom'&&startParam){start=new Date(`${startParam}T00:00:00-04:00`);if(endParam)end=new Date(`${endParam}T23:59:59.999-04:00`)}
 else start=easternMidnightUtc(29);
 const queryStart=easternMidnightUtc(29);
 const {data,error}=await db.from('website_analytics_events').select('visitor_id,session_id,path,page_title,referrer,article_slug,created_at').gte('created_at',queryStart.toISOString()).lte('created_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(10000);
 if(error)return NextResponse.json({error:error.message},{status:500});
 const all=data||[];
 const between=(a:Date,b:Date)=>all.filter((r:any)=>{const t=new Date(r.created_at).getTime();return t>=a.getTime()&&t<=b.getTime()});
 const today=between(easternMidnightUtc(0),new Date());
 const week=between(easternMidnightUtc(6),new Date());
 const month=between(easternMidnightUtc(29),new Date());
 let rows=between(start,end);
 if(sourceFilter!=='all')rows=rows.filter((r:any)=>source(r.referrer)===sourceFilter);
 if(pathFilter)rows=rows.filter((r:any)=>String(r.path||'').toLowerCase().includes(pathFilter.toLowerCase()));
 const uniq=(arr:any[],k:string)=>new Set(arr.map(x=>x[k]).filter(Boolean)).size;
 const countBy=(arr:any[],getter:(x:any)=>string)=>{const m=new Map<string,number>();for(const x of arr){const k=getter(x)||'Unknown';m.set(k,(m.get(k)||0)+1)}return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).map(([label,count])=>({label,count}))};
 const topPages=countBy(rows,r=>String(r.path||'/').split('?')[0]).slice(0,15);
 const sources=countBy(rows,r=>source(r.referrer)).filter(x=>x.label!=='Internal').slice(0,12);
 const sessions=new Map<string,any[]>();for(const r of Array.from(rows).reverse()){if(!sessions.has(r.session_id))sessions.set(r.session_id,[]);sessions.get(r.session_id)!.push(r)}
 const sessionValues=Array.from(sessions.values());
 const entries=countBy(sessionValues,s=>String(s[0]?.path||'/').split('?')[0]).slice(0,10);
 const transitions=new Map<string,number>();for(const s of sessionValues){for(let i=1;i<s.length;i++){const a=String(s[i-1].path||'/').split('?')[0],b=String(s[i].path||'/').split('?')[0];if(a===b)continue;const k=`${a} → ${b}`;transitions.set(k,(transitions.get(k)||0)+1)}}
 const paths=Array.from(transitions.entries()).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([label,count])=>({label,count}));
 const recent=rows.slice(0,30).map((r:any)=>({path:r.path,page_title:r.page_title,source:source(r.referrer),created_at:r.created_at,article_slug:r.article_slug}));
 const articleSources=countBy(rows.filter((r:any)=>r.article_slug),r=>`${source(r.referrer)} → ${String(r.path||'/').split('?')[0]}`).filter(x=>!x.label.startsWith('Internal →')).slice(0,20);
 const availableSources=Array.from(new Set(month.map((r:any)=>source(r.referrer)).filter(x=>x!=='Internal'))).sort();
 return NextResponse.json({generated_at:new Date().toISOString(),timezone:'America/New_York',today:{page_views:today.length,visitors:uniq(today,'visitor_id'),sessions:uniq(today,'session_id')},last_7_days:{page_views:week.length,visitors:uniq(week,'visitor_id'),sessions:uniq(week,'session_id')},last_30_days:{page_views:month.length,visitors:uniq(month,'visitor_id'),sessions:uniq(month,'session_id')},selected:{range,start:start.toISOString(),end:end.toISOString(),page_views:rows.length,visitors:uniq(rows,'visitor_id'),sessions:uniq(rows,'session_id')},top_pages:topPages,traffic_sources:sources,article_sources:articleSources,entry_pages:entries,visitor_paths:paths,recent_activity:recent,available_sources:availableSources});
}
