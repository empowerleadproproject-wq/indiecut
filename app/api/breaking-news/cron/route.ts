import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';

export const dynamic='force-dynamic';
export const maxDuration=180;
const KEY='breaking_news_latest_scan';
const COOLDOWN_MS=90*60*1000;
function textFromResponse(json:any){if(typeof json?.output_text==='string')return json.output_text;const parts:string[]=[];for(const item of json?.output||[])for(const c of item?.content||[])if(typeof c?.text==='string')parts.push(c.text);return parts.join('\n').trim()}
function parseJson(text:string){const t=String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();const s=t.indexOf('{'),e=t.lastIndexOf('}');if(s<0||e<s)throw new Error('Invalid JSON');return JSON.parse(t.slice(s,e+1))}
function safeUrl(v:any){const s=String(v||'').trim();return /^https?:\/\//i.test(s)?s:''}

export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,apiKey=process.env.OPENAI_API_KEY;
 if(!url||!key||!apiKey)return NextResponse.json({error:'Breaking News Radar environment variables are incomplete.'},{status:503});
 const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:priorSetting}=await db.from('site_settings').select('setting_value').eq('setting_key',KEY).maybeSingle();let prior:any={};try{prior=JSON.parse(priorSetting?.setting_value||'{}')}catch{}
 const lastScanMs=prior?.scanned_at?new Date(prior.scanned_at).getTime():0;
 if(lastScanMs&&Date.now()-lastScanMs<COOLDOWN_MS){
  return NextResponse.json({ok:true,skipped:true,reason:'cooldown',last_scan:prior.scanned_at,next_scan_after:new Date(lastScanMs+COOLDOWN_MS).toISOString()});
 }
 const focus=String(prior.focus||'Black entertainment, hip-hop, R&B, film, television, celebrities, creators and culture').slice(0,800);
 const hours=Math.min(24,Math.max(2,Number(prior.hours||6)));
 const count=Math.min(6,Math.max(3,Number(prior.count||5)));
 const {data:existingRows}=await db.from('articles').select('headline').order('created_at',{ascending:false}).limit(40);
 const existing=(existingRows||[]).map((x:any)=>x.headline).filter(Boolean).join(' | ');
 const now=new Date().toISOString();
 const prompt=`You are Indie Cut's automated BREAKING NEWS RADAR. Search the live web for entertainment developments first reported or materially updated within approximately the last ${hours} hours. Coverage focus: ${focus}. Return up to ${count} strong leads ranked by urgency. Do not invent or predict news. Exclude rumors, blind items, unsupported social posts, recycled old stories and speculation. Prefer official or primary announcements and major entertainment/news outlets. Mark VERIFIED only when the central claim is supported by at least two credible source URLs, or one authoritative primary source plus a credible corroborating report. Otherwise mark needs_verification. Avoid Indie Cut stories already covered: ${existing||'none'}. Keep summaries concise. Return ONLY valid JSON: {"leads":[{"headline":"","summary":"1-2 factual sentences","category":"movies|tv|music|culture|independent|celebrity","subject_name":"","why_breaking":"","source_published_at":"ISO timestamp if available","urgency_score":0,"verification_status":"verified|needs_verification","verification_note":"","sources":["https://...","https://..."],"image_url":"optional trustworthy image URL or blank"}]}. Current UTC time: ${now}.`;
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',tools:[{type:'web_search'}],input:prompt,max_output_tokens:3500})});
 const j=await r.json().catch(()=>({}));if(!r.ok)return NextResponse.json({error:j?.error?.message||'Breaking News Radar cron failed'},{status:502});
 let parsed:any;try{parsed=parseJson(textFromResponse(j))}catch{return NextResponse.json({error:'Breaking News Radar returned invalid data.'},{status:502})}
 const raw=Array.isArray(parsed?.leads)?parsed.leads.slice(0,count):[];
 const leads=raw.map((x:any,i:number)=>({id:`${Date.now()}-${i}`,headline:String(x?.headline||'').trim(),summary:String(x?.summary||'').trim(),category:String(x?.category||'culture').trim().toLowerCase(),subject_name:String(x?.subject_name||'').trim(),why_breaking:String(x?.why_breaking||'').trim(),first_seen_at:now,source_published_at:String(x?.source_published_at||'').trim(),urgency_score:Math.max(0,Math.min(100,Number(x?.urgency_score||0))),verification_status:String(x?.verification_status||'needs_verification').toLowerCase()==='verified'?'verified':'needs_verification',verification_note:String(x?.verification_note||'').trim(),sources:(Array.isArray(x?.sources)?x.sources:[]).map(safeUrl).filter(Boolean).slice(0,4),image_url:safeUrl(x?.image_url)})).filter((x:any)=>x.headline&&x.summary).sort((a:any,b:any)=>b.urgency_score-a.urgency_score);
 const scan={scanned_at:now,focus,hours,count,leads,automatic:true};
 await db.from('site_settings').upsert({setting_key:KEY,setting_value:JSON.stringify(scan),updated_at:now},{onConflict:'setting_key'});
 return NextResponse.json({ok:true,scanned_at:now,verified:leads.filter((x:any)=>x.verification_status==='verified').length,total:leads.length});
}
