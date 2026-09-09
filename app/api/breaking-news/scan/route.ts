import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';
export const maxDuration=180;
const KEY='breaking_news_latest_scan';

function textFromResponse(json:any){if(typeof json?.output_text==='string')return json.output_text;const parts:string[]=[];for(const item of json?.output||[])for(const c of item?.content||[])if(typeof c?.text==='string')parts.push(c.text);return parts.join('\n').trim()}
function parseJson(text:string){const t=String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();const s=t.indexOf('{'),e=t.lastIndexOf('}');if(s<0||e<s)throw new Error('Invalid JSON');return JSON.parse(t.slice(s,e+1))}
function safeUrl(v:any){const s=String(v||'').trim();return /^https?:\/\//i.test(s)?s:''}

async function getAdminDb(){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return {error:NextResponse.json({error:'Unauthorized'},{status:401})};
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return {error:NextResponse.json({error:'Supabase admin credentials missing'},{status:503})};
 return {db:createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})};
}

export async function GET(){
 const ctx:any=await getAdminDb();if(ctx.error)return ctx.error;
 const {data}=await ctx.db.from('site_settings').select('setting_value').eq('setting_key',KEY).maybeSingle();
 if(!data?.setting_value)return NextResponse.json({ok:true,scan:null});
 try{return NextResponse.json({ok:true,scan:JSON.parse(data.setting_value)})}catch{return NextResponse.json({ok:true,scan:null})}
}

export async function POST(request:Request){
 const ctx:any=await getAdminDb();if(ctx.error)return ctx.error;const db=ctx.db;
 const apiKey=process.env.OPENAI_API_KEY;if(!apiKey)return NextResponse.json({error:'OPENAI_API_KEY is not configured.'},{status:503});
 const input=await request.json().catch(()=>({}));
 const focus=String(input.focus||'Black entertainment, hip-hop, R&B, film, television, celebrities, creators and culture').trim().slice(0,1200);
 const hours=Math.min(24,Math.max(1,Number(input.hours||6)));
 const count=Math.min(12,Math.max(3,Number(input.count||8)));
 const {data:existingRows}=await db.from('articles').select('headline').order('created_at',{ascending:false}).limit(200);
 const existing=(existingRows||[]).map((x:any)=>x.headline).filter(Boolean).join(' | ');
 const now=new Date().toISOString();
 const prompt=`You are Indie Cut's BREAKING NEWS RADAR. Search the live web for entertainment developments first reported or materially updated within approximately the last ${hours} hours. Coverage focus: ${focus}. Return up to ${count} strong leads, ranked by urgency and editorial value.\n\nThe objective is speed WITH verification. Do not invent or predict news. Do not include rumors, blind items, anonymous gossip, unsupported social posts, fan speculation, recycled old stories, or opinion pieces presented as breaking news. Prefer primary sources (official announcements, studios, labels, networks, festivals, verified direct statements, public records) and top entertainment/news outlets. A lead is VERIFIED only when a central claim is supported by at least two credible source URLs, or one authoritative primary source plus a credible corroborating report. If corroboration is weak, keep it as needs_verification.\n\nFor every lead, identify the freshest known publication/update time from the sources. If a story is older than the requested freshness window and has no material new update, omit it. Avoid duplicating Indie Cut stories already covered: ${existing||'none'}.\n\nReturn ONLY valid JSON with this exact shape: {"leads":[{"headline":"suggested original Indie Cut headline","summary":"2-4 sentence factual summary","category":"movies|tv|music|culture|independent|celebrity","subject_name":"","why_breaking":"why this matters right now","source_published_at":"ISO-8601 timestamp if available","urgency_score":0,"verification_status":"verified|needs_verification","verification_note":"brief explanation of corroboration","sources":["https://...","https://..."],"image_url":"optional trustworthy editorial image URL or blank"}]}. Current UTC time: ${now}.`;
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',tools:[{type:'web_search'}],input:prompt,max_output_tokens:9000})});
 const j=await r.json().catch(()=>({}));if(!r.ok)return NextResponse.json({error:j?.error?.message||'Breaking news research failed'},{status:502});
 let parsed:any;try{parsed=parseJson(textFromResponse(j))}catch{return NextResponse.json({error:'Breaking News Radar returned invalid data.'},{status:502})}
 const raw=Array.isArray(parsed?.leads)?parsed.leads.slice(0,count):[];
 const leads=raw.map((x:any,i:number)=>({
  id:`${Date.now()}-${i}`,
  headline:String(x?.headline||'').trim(),summary:String(x?.summary||'').trim(),category:String(x?.category||'culture').trim().toLowerCase(),subject_name:String(x?.subject_name||'').trim(),why_breaking:String(x?.why_breaking||'').trim(),
  first_seen_at:now,source_published_at:String(x?.source_published_at||'').trim(),urgency_score:Math.max(0,Math.min(100,Number(x?.urgency_score||0))),
  verification_status:String(x?.verification_status||'needs_verification').toLowerCase()==='verified'?'verified':'needs_verification',verification_note:String(x?.verification_note||'').trim(),
  sources:(Array.isArray(x?.sources)?x.sources:[]).map(safeUrl).filter(Boolean).slice(0,6),image_url:safeUrl(x?.image_url)
 })).filter((x:any)=>x.headline&&x.summary).sort((a:any,b:any)=>b.urgency_score-a.urgency_score);
 const scan={scanned_at:now,focus,hours,count,leads};
 await db.from('site_settings').upsert({setting_key:KEY,setting_value:JSON.stringify(scan),updated_at:now},{onConflict:'setting_key'});
 return NextResponse.json({ok:true,...scan});
}
