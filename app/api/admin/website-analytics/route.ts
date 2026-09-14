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
const uniq=(arr:any[],k:string)=>new Set(arr.map(x=>x[k]).filter(Boolean)).size;
const countBy=(arr:any[],getter:(x:any)=>string)=>{const m=new Map<string,number>();for(const x of arr){const k=getter(x)||'Unknown';m.set(k,(m.get(k)||0)+1)}return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).map(([label,count])=>({label,count}))};

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
 const excludeVisitor=String(params.get('exclude_visitor')||'').slice(0,200);
 const startParam=params.get('start'),endParam=params.get('end');
 let start:Date,end=new Date();
 if(range==='today')start=easternMidnightUtc(0);
 else if(range==='7d')start=easternMidnightUtc(6);
 else if(range==='custom'&&startParam){start=new Date(`${startParam}T00:00:00-04:00`);if(endParam)end=new Date(`${endParam}T23:59:59.999-04:00`)}
 else start=easternMidnightUtc(29);
 const queryStart=easternMidnightUtc(29);
 const {data,error}=await db.from('website_analytics_events').select('visitor_id,session_id,event_type,path,page_title,referrer,article_slug,duration_ms,scroll_depth,ad_id,ad_name,ad_placement,target_url,created_at').gte('created_at',queryStart.toISOString()).lte('created_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(20000);
 if(error)return NextResponse.json({error:error.message},{status:500});
 const allEvents=(data||[]).filter((r:any)=>!excludeVisitor||String(r.visitor_id)!==excludeVisitor);
 const between=(arr:any[],a:Date,b:Date)=>arr.filter((r:any)=>{const t=new Date(r.created_at).getTime();return t>=a.getTime()&&t<=b.getTime()});
 const pageEvents=allEvents.filter((r:any)=>r.event_type==='page_view');
 const today=between(pageEvents,easternMidnightUtc(0),new Date());
 const week=between(pageEvents,easternMidnightUtc(6),new Date());
 const month=between(pageEvents,easternMidnightUtc(29),new Date());
 let rows=between(pageEvents,start,end);
 if(sourceFilter!=='all')rows=rows.filter((r:any)=>source(r.referrer)===sourceFilter);
 if(pathFilter)rows=rows.filter((r:any)=>String(r.path||'').toLowerCase().includes(pathFilter.toLowerCase()));

 const eventMatchesFilters=(r:any)=>{
  const t=new Date(r.created_at).getTime();
  if(t<start.getTime()||t>end.getTime())return false;
  if(sourceFilter!=='all'&&source(r.referrer)!==sourceFilter)return false;
  if(pathFilter&&!String(r.path||'').toLowerCase().includes(pathFilter.toLowerCase()))return false;
  return true;
 };
 const engagement=allEvents.filter((r:any)=>r.event_type==='page_engagement'&&eventMatchesFilters(r));
 const adEvents=allEvents.filter((r:any)=>(r.event_type==='ad_impression'||r.event_type==='ad_click')&&eventMatchesFilters(r));
 const sessions=new Map<string,any[]>();for(const r of Array.from(rows).reverse()){if(!sessions.has(r.session_id))sessions.set(r.session_id,[]);sessions.get(r.session_id)!.push(r)}
 const sessionValues=Array.from(sessions.values());
 const entries=countBy(sessionValues,s=>String(s[0]?.path||'/').split('?')[0]).slice(0,10);
 const transitions=new Map<string,number>();for(const s of sessionValues){for(let i=1;i<s.length;i++){const a=String(s[i-1].path||'/').split('?')[0],b=String(s[i].path||'/').split('?')[0];if(a===b)continue;const k=`${a} → ${b}`;transitions.set(k,(transitions.get(k)||0)+1)}}
 const paths=Array.from(transitions.entries()).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([label,count])=>({label,count}));
 const topPages=countBy(rows,r=>String(r.path||'/').split('?')[0]).slice(0,15);
 const sources=countBy(rows,r=>source(r.referrer)).filter(x=>x.label!=='Internal').slice(0,12);
 const recent=rows.slice(0,30).map((r:any)=>({path:r.path,page_title:r.page_title,source:source(r.referrer),created_at:r.created_at,article_slug:r.article_slug,session_id:r.session_id}));
 const articleSources=countBy(rows.filter((r:any)=>r.article_slug),r=>`${source(r.referrer)} → ${String(r.path||'/').split('?')[0]}`).filter(x=>!x.label.startsWith('Internal →')).slice(0,20);
 const availableSources=Array.from(new Set(month.map((r:any)=>source(r.referrer)).filter(x=>x!=='Internal'))).sort();

 const durationTotal=engagement.reduce((sum:number,r:any)=>sum+Number(r.duration_ms||0),0);
 const avgEngagedSeconds=engagement.length?durationTotal/engagement.length/1000:0;
 const scrollRows=engagement.filter((r:any)=>Number.isFinite(Number(r.scroll_depth)));
 const avgScrollDepth=scrollRows.length?scrollRows.reduce((sum:number,r:any)=>sum+Number(r.scroll_depth||0),0)/scrollRows.length:0;
 const pagesPerSession=sessionValues.length?rows.length/sessionValues.length:0;
 const engagementByPage=new Map<string,{duration:number;scroll:number;count:number}>();
 for(const r of engagement){const p=String(r.path||'/').split('?')[0];const v=engagementByPage.get(p)||{duration:0,scroll:0,count:0};v.duration+=Number(r.duration_ms||0);v.scroll+=Number(r.scroll_depth||0);v.count++;engagementByPage.set(p,v)}
 const topEngagementPages=Array.from(engagementByPage.entries()).map(([label,v])=>({label,views:v.count,avg_seconds:v.count?v.duration/v.count/1000:0,avg_scroll:v.count?v.scroll/v.count:0})).sort((a,b)=>b.avg_seconds-a.avg_seconds).slice(0,15);

 const ads=new Map<string,any>();
 for(const r of adEvents){const id=String(r.ad_id||'unknown');const placement=String(r.ad_placement||'unspecified');const key=`${id}|${placement}`;const v=ads.get(key)||{ad_id:id,name:r.ad_name||'Advertisement',placement,target_url:r.target_url||'',impressions:0,clicks:0};if(r.event_type==='ad_impression')v.impressions++;if(r.event_type==='ad_click'){v.clicks++;if(r.target_url)v.target_url=r.target_url}ads.set(key,v)}
 const adPerformance=Array.from(ads.values()).map((v:any)=>({...v,ctr:v.impressions?(v.clicks/v.impressions)*100:0})).sort((a:any,b:any)=>b.impressions-a.impressions||b.clicks-a.clicks);
 const adImpressions=adPerformance.reduce((s:number,r:any)=>s+r.impressions,0),adClicks=adPerformance.reduce((s:number,r:any)=>s+r.clicks,0);

 const engagementBySession=new Map<string,number>();for(const r of engagement)engagementBySession.set(r.session_id,(engagementBySession.get(r.session_id)||0)+Number(r.duration_ms||0));
 const recentSessions=Array.from(sessions.entries()).map(([session_id,events])=>({session_id,pages:events.map((r:any)=>String(r.path||'/').split('?')[0]),started_at:events[0]?.created_at,last_seen_at:events[events.length-1]?.created_at,engaged_seconds:(engagementBySession.get(session_id)||0)/1000,source:source(events[0]?.referrer||null)})).sort((a,b)=>new Date(b.last_seen_at).getTime()-new Date(a.last_seen_at).getTime()).slice(0,15);

 return NextResponse.json({
  generated_at:new Date().toISOString(),timezone:'America/New_York',admin_browser_excluded:Boolean(excludeVisitor),
  today:{page_views:today.length,visitors:uniq(today,'visitor_id'),sessions:uniq(today,'session_id')},
  last_7_days:{page_views:week.length,visitors:uniq(week,'visitor_id'),sessions:uniq(week,'session_id')},
  last_30_days:{page_views:month.length,visitors:uniq(month,'visitor_id'),sessions:uniq(month,'session_id')},
  selected:{range,start:start.toISOString(),end:end.toISOString(),page_views:rows.length,visitors:uniq(rows,'visitor_id'),sessions:uniq(rows,'session_id'),avg_engaged_seconds:avgEngagedSeconds,avg_scroll_depth:avgScrollDepth,pages_per_session:pagesPerSession,ad_impressions:adImpressions,ad_clicks:adClicks,ad_ctr:adImpressions?(adClicks/adImpressions)*100:0},
  top_pages:topPages,traffic_sources:sources,article_sources:articleSources,entry_pages:entries,visitor_paths:paths,recent_activity:recent,available_sources:availableSources,
  top_engagement_pages:topEngagementPages,ad_performance:adPerformance,recent_sessions:recentSessions
 });
}
