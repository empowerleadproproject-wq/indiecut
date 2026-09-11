import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';

export const dynamic='force-dynamic';
export const maxDuration=180;
const KEY='breaking_news_latest_scan';
const COOLDOWN_MS=90*60*1000;
function textFromResponse(json:any){if(typeof json?.output_text==='string')return json.output_text;const parts:string[]=[];for(const item of json?.output||[])for(const c of item?.content||[])if(typeof c?.text==='string')parts.push(c.text);return parts.join('\n').trim()}
function parseJson(text:string){const t=String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();const s=t.indexOf('{'),e=t.lastIndexOf('}');if(s<0||e<s)throw new Error('Invalid JSON');return JSON.parse(t.slice(s,e+1))}
function safeUrl(v:any){const s=String(v||'').trim();return /^https?:\/\//i.test(s)?s:''}
function keyFor(v:any){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}

export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,apiKey=process.env.OPENAI_API_KEY;
 if(!url||!key||!apiKey)return NextResponse.json({error:'Breaking News Radar environment variables are incomplete.'},{status:503});
 const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:priorSetting}=await db.from('site_settings').select('setting_value').eq('setting_key',KEY).maybeSingle();let prior:any={};try{prior=JSON.parse(priorSetting?.setting_value||'{}')}catch{}
 const lastScanMs=prior?.scanned_at?new Date(prior.scanned_at).getTime():0;
 if(lastScanMs&&Date.now()-lastScanMs<COOLDOWN_MS)return NextResponse.json({ok:true,skipped:true,reason:'cooldown',last_scan:prior.scanned_at,next_scan_after:new Date(lastScanMs+COOLDOWN_MS).toISOString()});
 const focus=String(prior.focus||'Black entertainment, hip-hop, R&B, film, television, celebrities, creators and culture').slice(0,800);
 const hours=Math.min(24,Math.max(6,Number(prior.hours||12)));
 const count=Math.min(8,Math.max(5,Number(prior.count||6)));
 const dismissed=new Set((Array.isArray(prior.dismissed)?prior.dismissed:[]).map(keyFor));
 const {data:existingRows}=await db.from('articles').select('headline').order('created_at',{ascending:false}).limit(80);
 const existing=(existingRows||[]).map((x:any)=>x.headline).filter(Boolean).join(' | ');
 const now=new Date().toISOString();
 const prompt=`You are Indie Cut's automated BREAKING NEWS RADAR. Search the live web for CURRENT entertainment news and fill the editor queue with useful leads. PRIORITIZE ${focus}, especially Black entertainment, hip-hop, R&B, film, television, celebrities, creators and culture, BUT DO NOT restrict results to that niche. If there are not enough stories in that focus, include major general entertainment, music, film, TV, celebrity, streaming, awards, festival, casting, release, business and culture developments.

Freshness rules: first look for stories first reported or materially updated in the last ${hours} hours. If that does not produce at least 3 credible leads, expand to the last 24 hours. If there are still fewer than 3, expand to the last 48 hours for stories that are still current, developing, newly announced or strongly newsworthy. Do not return an empty list merely because a story is not "breaking" enough. If credible current entertainment news exists, return it.

Return up to ${count} useful leads ranked by urgency and editorial value, and aim for AT LEAST 3 leads whenever credible current entertainment news exists. Do not invent or predict news. Exclude rumors, blind items, unsupported social posts, recycled old stories with no new development and speculation. Prefer primary sources and reputable entertainment/news outlets. A lead needs only ONE credible source to enter the queue. Mark VERIFIED when the central claim is supported by at least two credible source URLs, or one authoritative primary source plus credible corroboration. Otherwise mark needs_verification so the editor can review it. Avoid Indie Cut stories already covered: ${existing||'none'}. Keep summaries concise.

Return ONLY valid JSON: {"leads":[{"headline":"","summary":"1-2 factual sentences","category":"movies|tv|music|culture|independent|celebrity","subject_name":"","why_breaking":"","source_published_at":"ISO timestamp if available","urgency_score":0,"verification_status":"verified|needs_verification","verification_note":"","sources":["https://...","https://..."],"image_url":"optional trustworthy image URL or blank"}]}. Current UTC time: ${now}.`;
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',tools:[{type:'web_search'}],input:prompt,max_output_tokens:4500})});
 const j=await r.json().catch(()=>({}));if(!r.ok)return NextResponse.json({error:j?.error?.message||'Breaking News Radar cron failed'},{status:502});
 let parsed:any;try{parsed=parseJson(textFromResponse(j))}catch{return NextResponse.json({error:'Breaking News Radar returned invalid data.'},{status:502})}
 const raw=Array.isArray(parsed?.leads)?parsed.leads.slice(0,count):[];
 const fresh=raw.map((x:any,i:number)=>({id:`${Date.now()}-${i}`,headline:String(x?.headline||'').trim(),summary:String(x?.summary||'').trim(),category:String(x?.category||'culture').trim().toLowerCase(),subject_name:String(x?.subject_name||'').trim(),why_breaking:String(x?.why_breaking||'').trim(),first_seen_at:now,source_published_at:String(x?.source_published_at||'').trim(),urgency_score:Math.max(0,Math.min(100,Number(x?.urgency_score||0))),verification_status:String(x?.verification_status||'needs_verification').toLowerCase()==='verified'?'verified':'needs_verification',verification_note:String(x?.verification_note||'').trim(),sources:(Array.isArray(x?.sources)?x.sources:[]).map(safeUrl).filter(Boolean).slice(0,4),image_url:safeUrl(x?.image_url)})).filter((x:any)=>x.headline&&x.summary&&x.sources.length>0&&!dismissed.has(keyFor(x.headline)));
 const map=new Map<string,any>();for(const x of (Array.isArray(prior.leads)?prior.leads:[]))if(x?.headline&&!dismissed.has(keyFor(x.headline)))map.set(keyFor(x.headline),x);for(const x of fresh)map.set(keyFor(x.headline),x);
 const leads=Array.from(map.values()).sort((a:any,b:any)=>(Number(b.urgency_score||0)-Number(a.urgency_score||0))||(new Date(b.first_seen_at||0).getTime()-new Date(a.first_seen_at||0).getTime())).slice(0,30);
 const scan={scanned_at:now,focus,hours,count,leads,dismissed:Array.from(dismissed),automatic:true};
 await db.from('site_settings').upsert({setting_key:KEY,setting_value:JSON.stringify(scan),updated_at:now},{onConflict:'setting_key'});
 return NextResponse.json({ok:true,scanned_at:now,new_leads:fresh.length,total_queue:leads.length,verified:leads.filter((x:any)=>x.verification_status==='verified').length});
}
