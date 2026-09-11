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
function keyFor(v:any){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}

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

export async function DELETE(request:Request){
 const ctx:any=await getAdminDb();if(ctx.error)return ctx.error;const db=ctx.db;
 const input=await request.json().catch(()=>({}));const id=String(input.id||'');const headline=String(input.headline||'');
 const {data}=await db.from('site_settings').select('setting_value').eq('setting_key',KEY).maybeSingle();let prior:any={};try{prior=JSON.parse(data?.setting_value||'{}')}catch{}
 const dismissKey=keyFor(headline);const leads=(Array.isArray(prior.leads)?prior.leads:[]).filter((x:any)=>String(x.id||'')!==id&&(!dismissKey||keyFor(x.headline)!==dismissKey));
 const dismissed=Array.from(new Set([...(Array.isArray(prior.dismissed)?prior.dismissed:[]),...(dismissKey?[dismissKey]:[])])).slice(-150);
 const next={...prior,leads,dismissed};await db.from('site_settings').upsert({setting_key:KEY,setting_value:JSON.stringify(next),updated_at:new Date().toISOString()},{onConflict:'setting_key'});
 return NextResponse.json({ok:true,leads});
}

export async function POST(request:Request){
 const ctx:any=await getAdminDb();if(ctx.error)return ctx.error;const db=ctx.db;
 const apiKey=process.env.OPENAI_API_KEY;if(!apiKey)return NextResponse.json({error:'OPENAI_API_KEY is not configured.'},{status:503});
 const input=await request.json().catch(()=>({}));
 const focus=String(input.focus||'Black entertainment, hip-hop, R&B, film, television, celebrities, creators and culture').trim().slice(0,800);
 const hours=Math.min(24,Math.max(2,Number(input.hours||12)));
 const count=Math.min(10,Math.max(5,Number(input.count||8)));
 const {data:settingRow}=await db.from('site_settings').select('setting_value').eq('setting_key',KEY).maybeSingle();let prior:any={};try{prior=JSON.parse(settingRow?.setting_value||'{}')}catch{}
 const dismissed=new Set((Array.isArray(prior.dismissed)?prior.dismissed:[]).map(keyFor));
 const {data:existingRows}=await db.from('articles').select('headline').order('created_at',{ascending:false}).limit(80);
 const existing=(existingRows||[]).map((x:any)=>x.headline).filter(Boolean).join(' | ');
 const now=new Date().toISOString();
 const prompt=`You are Indie Cut's BREAKING NEWS RADAR. Search the live web for CURRENT entertainment news and fill the editor queue with useful leads. PRIORITIZE ${focus}, especially Black entertainment, hip-hop, R&B, film, television, celebrities, creators and culture, BUT DO NOT restrict results to that niche. If there are not enough stories in that focus, include major general entertainment, music, film, TV, celebrity, streaming, awards, festival, casting, release, business and culture developments.

Freshness rules: first look for stories first reported or materially updated in the last ${hours} hours. If that does not produce at least 3 credible leads, expand to the last 24 hours. If there are still fewer than 3, expand to the last 48 hours for stories that are still current, developing, newly announced or strongly newsworthy. Do not return an empty list merely because a story is not "breaking" enough. If credible current entertainment news exists, return it.

Return up to ${count} useful leads ranked by urgency and editorial value, and aim for AT LEAST 3 leads whenever credible current entertainment news exists. Do not invent or predict news. Exclude rumors, blind items, unsupported social posts, fan speculation, recycled stories with no new development and opinion pieces presented as breaking news. Prefer primary sources and reputable entertainment/news outlets. A lead needs only ONE credible source to enter the queue. Mark VERIFIED when the central claim is supported by at least two credible source URLs, or one authoritative primary source plus credible corroboration. Otherwise mark needs_verification so the editor can review it. Avoid Indie Cut stories already covered: ${existing||'none'}.

Return ONLY valid JSON with this shape: {"leads":[{"headline":"suggested original Indie Cut headline","summary":"1-3 sentence factual summary","category":"movies|tv|music|culture|independent|celebrity","subject_name":"","why_breaking":"why this matters now","source_published_at":"ISO-8601 timestamp if available","urgency_score":0,"verification_status":"verified|needs_verification","verification_note":"brief explanation","sources":["https://...","https://..."],"image_url":"optional trustworthy editorial image URL or blank"}]}. Current UTC time: ${now}.`;
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',tools:[{type:'web_search'}],input:prompt,max_output_tokens:5000})});
 const j=await r.json().catch(()=>({}));if(!r.ok)return NextResponse.json({error:j?.error?.message||'Breaking news research failed'},{status:502});
 let parsed:any;try{parsed=parseJson(textFromResponse(j))}catch{return NextResponse.json({error:'Breaking News Radar returned invalid data.'},{status:502})}
 const raw=Array.isArray(parsed?.leads)?parsed.leads.slice(0,count):[];
 const fresh=raw.map((x:any,i:number)=>({id:`${Date.now()}-${i}`,headline:String(x?.headline||'').trim(),summary:String(x?.summary||'').trim(),category:String(x?.category||'culture').trim().toLowerCase(),subject_name:String(x?.subject_name||'').trim(),why_breaking:String(x?.why_breaking||'').trim(),first_seen_at:now,source_published_at:String(x?.source_published_at||'').trim(),urgency_score:Math.max(0,Math.min(100,Number(x?.urgency_score||0))),verification_status:String(x?.verification_status||'needs_verification').toLowerCase()==='verified'?'verified':'needs_verification',verification_note:String(x?.verification_note||'').trim(),sources:(Array.isArray(x?.sources)?x.sources:[]).map(safeUrl).filter(Boolean).slice(0,6),image_url:safeUrl(x?.image_url)})).filter((x:any)=>x.headline&&x.summary&&x.sources.length>0&&!dismissed.has(keyFor(x.headline)));
 const map=new Map<string,any>();for(const x of (Array.isArray(prior.leads)?prior.leads:[]))if(x?.headline&&!dismissed.has(keyFor(x.headline)))map.set(keyFor(x.headline),x);for(const x of fresh)map.set(keyFor(x.headline),x);
 const leads=Array.from(map.values()).sort((a:any,b:any)=>(Number(b.urgency_score||0)-Number(a.urgency_score||0))||(new Date(b.first_seen_at||0).getTime()-new Date(a.first_seen_at||0).getTime())).slice(0,30);
 const scan={scanned_at:now,focus,hours,count,leads,dismissed:Array.from(dismissed),automatic:false};
 await db.from('site_settings').upsert({setting_key:KEY,setting_value:JSON.stringify(scan),updated_at:now},{onConflict:'setting_key'});
 return NextResponse.json({ok:true,...scan,new_leads:fresh.length});
}
