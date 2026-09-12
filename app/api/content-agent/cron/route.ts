import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';

export const dynamic='force-dynamic';
export const maxDuration=300;

const KEY='content_agent_config';
const LAST_RUN_KEY='content_agent_last_daily_run';
const STATUS_KEY='content_agent_last_schedule_status';
const DEFAULTS={enabled:true,default_topic:'top current entertainment news involving Black culture, movies, television, music, celebrities and independent creators',default_count:3,require_multiple_sources:true,reject_rumors:true,frequency:'daily',cron_hour:9,cron_day:1,cron_timezone:'America/New_York'};

function cleanSlug(value:string){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
function textFromResponse(json:any){if(typeof json?.output_text==='string')return json.output_text;const parts:string[]=[];for(const item of json?.output||[]){for(const c of item?.content||[]){if(typeof c?.text==='string')parts.push(c.text)}}return parts.join('\n')}
function parseJson(text:string){return JSON.parse(String(text||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim())}
function cleanArticleBody(v:any){return String(v||'').replace(/\s*\(\[[^\]]+\]\(https?:\/\/[^)]+\)\)/gi,'').replace(/\s*\[[^\]]+\]\(https?:\/\/[^)]+\)/gi,'').replace(/\s*\(https?:\/\/[^)]+\)/gi,'').trim()}
function titleWords(v:string){return new Set(String(v||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>2&&!['the','and','for','with','from','that','this','into','over','after','before'].includes(w)))}
function titleSimilarity(a:string,b:string){const x=titleWords(a),y=titleWords(b);if(!x.size||!y.size)return 0;let hit=0;for(const w of x)if(y.has(w))hit++;return hit/Math.max(x.size,y.size)}
function sourceHosts(urls:string[]){const hosts=new Set<string>();for(const u of urls){try{hosts.add(new URL(u).hostname.replace(/^www\./,''))}catch{}}return hosts.size}
function localParts(timeZone:string){const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const get=(t:string)=>parts.find(p=>p.type===t)?.value||'';const days:any={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};return {date:`${get('year')}-${get('month')}-${get('day')}`,hour:Number(get('hour')),weekday:days[get('weekday')]??0}}
function todayLabel(){return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'long'}).format(new Date())}
async function recordStatus(db:any,payload:any){await db.from('site_settings').upsert({setting_key:STATUS_KEY,setting_value:JSON.stringify({...payload,updated_at:new Date().toISOString()}),updated_at:new Date().toISOString()},{onConflict:'setting_key'})}
async function callResearchModel(apiKey:string,prompt:string,maxOutputTokens=28000){const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',tools:[{type:'web_search'}],input:prompt,max_output_tokens:maxOutputTokens})});const json=await r.json().catch(()=>({}));if(!r.ok)throw new Error(json?.error?.message||'Research request failed.');return textFromResponse(json)}
async function runEditorialPass(apiKey:string,topic:string,draft:any,count:number){const prompt=`You are Indie Cut's senior standards editor and fact-checker. Today is ${todayLabel()}. Assignment: ${topic}. Review this first-pass research package with a SECOND live web search. Re-check central claims, names, dates, titles, numbers, awards, legal claims, release details and quotes. Reject stale, recycled, contradictory or weakly sourced stories. Prefer primary sources and independent corroboration. Two URLs repeating the same press release do not count as strong independent sourcing. Headlines must be specific and factual. Lead with the news immediately. Write like a sharp human entertainment editor, not a press release or AI summary. Avoid canned phrases such as "marks a significant", "continues to make waves", "in a move that", "underscores", "a testament to", "fans are buzzing", "has taken the world by storm" and empty wrap-ups. Keep each story focused on one clear angle. Reader-facing text must contain no URLs or citation markers. Body should be 4-7 substantial paragraphs, normally 350-700 words. Score candidates for timeliness, news value, source quality, originality and Indie Cut fit. Keep only the strongest ${count} or fewer. FIRST PASS: ${JSON.stringify(draft)}. Return ONLY valid JSON: {"stories":[{"headline":"","subheadline":"","category":"movies|tv|music|culture|independent|celebrity","subject_name":"","body":"","sources":["https://...","https://..."],"featured_image_url":"","featured_image_source_url":"","verification_status":"verified|not_verified","verification_note":"specific internal note","why_now":"one sentence explaining the news peg","news_score":0}]}.`;try{return parseJson(await callResearchModel(apiKey,prompt,30000))}catch{return draft}}

export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret)return NextResponse.json({error:'CRON_SECRET is not configured. Scheduled research cannot authenticate.'},{status:503});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized cron request'},{status:401});

 const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY,apiKey=process.env.OPENAI_API_KEY;
 if(!supabaseUrl||!serviceKey||!apiKey)return NextResponse.json({error:'Cron environment variables are incomplete.',missing:{supabase_url:!supabaseUrl,supabase_service_role:!serviceKey,openai:!apiKey}},{status:503});
 const supabase=createServiceClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:setting}=await supabase.from('site_settings').select('setting_value').eq('setting_key',KEY).maybeSingle();
 let config:any={...DEFAULTS};try{if(setting?.setting_value)config={...config,...JSON.parse(setting.setting_value)}}catch{}
 if(config.enabled===false){await recordStatus(supabase,{status:'skipped',reason:'Content Agent is OFF.'});return NextResponse.json({ok:true,skipped:'Content Agent is OFF.'})}

 const now=localParts(String(config.cron_timezone||DEFAULTS.cron_timezone));
 const targetHour=Number(config.cron_hour??DEFAULTS.cron_hour);
 const frequency=String(config.frequency||'daily');
 if(now.hour<targetHour)return NextResponse.json({ok:true,skipped:`Scheduled time has not arrived. Current local hour ${now.hour}, scheduled ${targetHour}.`});
 if(frequency==='weekdays'&&(now.weekday===0||now.weekday===6))return NextResponse.json({ok:true,skipped:'Weekday schedule; today is weekend.'});
 if(frequency==='weekly'&&now.weekday!==Number(config.cron_day??1))return NextResponse.json({ok:true,skipped:'Not the scheduled weekday.'});

 const runToken=frequency==='weekly'?`${now.date}-${now.weekday}`:now.date;
 const {data:last}=await supabase.from('site_settings').select('setting_value').eq('setting_key',LAST_RUN_KEY).maybeSingle();
 if(last?.setting_value===runToken)return NextResponse.json({ok:true,skipped:'Already ran for this scheduled period.'});

 const topic=String(config.default_topic||DEFAULTS.default_topic).trim().slice(0,2000);
 const count=Math.min(12,Math.max(1,Number(config.default_count||DEFAULTS.default_count)));
 await recordStatus(supabase,{status:'running',date:now.date,frequency,scheduled_hour:targetHour,topic,requested:count,pipeline:'two-pass research + standards review'});

 const {data:existingRows}=await supabase.from('articles').select('headline,slug').order('created_at',{ascending:false}).limit(400);
 const existing=(existingRows||[]).map((x:any)=>x.headline).join(' | ');
 const prompt=`You are the Indie Cut scheduled entertainment newsroom research editor. Today is ${todayLabel()}. Find the strongest CURRENT entertainment stories for today. Assignment focus: ${topic}.

Use a newsroom workflow instead of writing the first things you find: discover at least twice as many plausible candidates as needed; verify each central claim; identify the original/primary source; rank by timeliness, real news value, source quality, originality and Indie Cut audience fit; remove recycled, promotional, weak or near-duplicate stories; then select up to ${count} strongest DIFFERENT stories.

Cover movies, television, music, actors, musicians, filmmakers, creators, celebrity news, independent entertainment and culture, with strong editorial attention to Black entertainment and African-American culture when relevant. Use live web search. NEVER use blind items, anonymous gossip, rumor aggregation, social-media speculation, fabricated quotes, unverified relationship claims or unsupported controversy. Prefer primary sources such as official statements, studios, networks, labels, festivals, direct interviews, court/public records, awards bodies and direct announcements, then reputable entertainment trades and major newsrooms. Require at least two credible source URLs whenever possible, preferably from genuinely different sources. Cross-check names, dates, titles, release information, awards, numbers, legal claims, deaths, health information and quotations. If sources disagree, mark the uncertainty instead of smoothing it over. If a major claim cannot be corroborated, mark it not_verified.

Avoid duplicating or lightly reframing existing Indie Cut coverage: ${existing||'none yet'}. Treat the same event/subject as a likely duplicate unless there is a materially new development.

Write original sharp entertainment journalism, not copied source language or press-release copy. Headlines should be specific and factual. Lead with the news immediately. Avoid generic biography openings, clickbait and AI clichés like "marks a significant", "continues to make waves", "in a move that", "underscores", "a testament to", "fans are buzzing", "has taken the world by storm" and generic concluding paragraphs. Keep one clear angle per story. Body should be 4-7 substantial paragraphs, normally 350-700 words. Reader-facing headline, subheadline and body must contain NO URLs, hyperlinks, citation markers, footnotes or source-domain parentheticals; research links belong ONLY in sources.

Find one trustworthy editorial image when possible, preferably official or from a credible source page. Do not use random social reposts, search-result thumbnails, fan pages, watermarked stock or unattributable images. If uncertain, leave image fields blank.

Return ONLY valid JSON: {"stories":[{"headline":"","subheadline":"","category":"movies|tv|music|culture|independent|celebrity","subject_name":"","body":"4-7 substantial paragraphs","sources":["https://...","https://..."],"featured_image_url":"https://...","featured_image_source_url":"https://...","verification_status":"verified|not_verified","verification_note":"specific internal explanation","why_now":"one sentence news peg","news_score":0}]}.`;

 let firstPass:any;
 try{firstPass=parseJson(await callResearchModel(apiKey,prompt,30000))}catch(e:any){await recordStatus(supabase,{status:'failed',date:now.date,reason:e?.message||'The research model returned invalid JSON.'});return NextResponse.json({error:e?.message||'The research model returned invalid JSON.'},{status:502})}
 const parsed=await runEditorialPass(apiKey,topic,firstPass,count);
 const stories=Array.isArray(parsed?.stories)?parsed.stories.slice(0,count):[];const created:any[]=[];const rejected:any[]=[];
 for(const s of stories){
  if(String(s?.verification_status||'').toLowerCase()!=='verified'){rejected.push({headline:s?.headline||'Untitled',reason:s?.verification_note||'Not sufficiently verified'});continue}
  const headline=String(s?.headline||'').trim();if(!headline)continue;const slug=cleanSlug(headline);
  const nearDuplicate=(existingRows||[]).find((x:any)=>cleanSlug(x.slug||x.headline)===slug||String(x.headline||'').trim().toLowerCase()===headline.toLowerCase()||titleSimilarity(String(x.headline||''),headline)>=0.72);
  const duplicate=Boolean(nearDuplicate)||created.some((x:any)=>x.slug===slug||titleSimilarity(x.headline,headline)>=0.72);
  if(duplicate){rejected.push({headline,reason:'Duplicate or near-duplicate of existing coverage'});continue}
  const sources=Array.isArray(s?.sources)?s.sources.map((x:any)=>String(x).trim()).filter((x:string)=>/^https?:\/\//i.test(x)):[];
  const imageUrl=/^https?:\/\//i.test(String(s?.featured_image_url||''))?String(s.featured_image_url).trim():'';
  const imageSource=/^https?:\/\//i.test(String(s?.featured_image_source_url||''))?String(s.featured_image_source_url).trim():'';
  if(imageSource&&!sources.includes(imageSource))sources.push(imageSource);
  const diverseSources=sourceHosts(sources);
  if(config.require_multiple_sources!==false&&(sources.length<2||diverseSources<2)){rejected.push({headline,reason:'Fewer than two independent credible sources'});continue}
  const body=cleanArticleBody(s?.body);
  if(body.length<700){rejected.push({headline,reason:'Draft was too thin to meet Indie Cut editorial depth standards'});continue}
  const payload={headline,slug,subheadline:String(s?.subheadline||'').trim()||null,category:String(s?.category||'culture').trim().toLowerCase(),subject_name:String(s?.subject_name||'').trim()||null,body,featured_media_url:imageUrl||null,sources,verification_status:'verified',status:'draft',published_at:null};
  const {error}=await supabase.from('articles').insert(payload);if(error){rejected.push({headline,reason:error.message});continue}
  created.push({headline,slug,category:payload.category,sources:sources.length,source_hosts:diverseSources,image:imageUrl||null,why_now:String(s?.why_now||''),news_score:Number(s?.news_score||0)});
 }

 await supabase.from('site_settings').upsert({setting_key:LAST_RUN_KEY,setting_value:runToken,updated_at:new Date().toISOString()},{onConflict:'setting_key'});
 await recordStatus(supabase,{status:created.length?'success':'completed_no_articles',date:now.date,frequency,scheduled_hour:targetHour,requested:count,created_count:created.length,rejected_count:rejected.length,created,rejected,pipeline:'two-pass research + standards review'});
 return NextResponse.json({ok:true,date:now.date,frequency,requested:count,created,rejected,editorial_pipeline:'two-pass research + standards review'});
}
