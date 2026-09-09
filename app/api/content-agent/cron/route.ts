import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';

export const dynamic='force-dynamic';
export const maxDuration=300;

const KEY='content_agent_config';
const LAST_RUN_KEY='content_agent_last_daily_run';
const DEFAULTS={enabled:true,default_topic:'top current entertainment news involving Black culture, movies, television, music, celebrities and independent creators',default_count:3,require_multiple_sources:true,reject_rumors:true,frequency:'daily',cron_hour:9,cron_day:1,cron_timezone:'America/New_York'};

function cleanSlug(value:string){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
function textFromResponse(json:any){if(typeof json?.output_text==='string')return json.output_text;const parts:string[]=[];for(const item of json?.output||[]){for(const c of item?.content||[]){if(typeof c?.text==='string')parts.push(c.text)}}return parts.join('\n')}
function parseJson(text:string){return JSON.parse(String(text||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim())}
function localParts(timeZone:string){const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const get=(t:string)=>parts.find(p=>p.type===t)?.value||'';const days:any={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};return {date:`${get('year')}-${get('month')}-${get('day')}`,hour:Number(get('hour')),weekday:days[get('weekday')]??0}}

export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY,apiKey=process.env.OPENAI_API_KEY;
 if(!supabaseUrl||!serviceKey||!apiKey)return NextResponse.json({error:'Cron environment variables are incomplete.'},{status:503});
 const supabase=createServiceClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:setting}=await supabase.from('site_settings').select('setting_value').eq('setting_key',KEY).maybeSingle();
 let config:any={...DEFAULTS};try{if(setting?.setting_value)config={...config,...JSON.parse(setting.setting_value)}}catch{}
 if(config.enabled===false)return NextResponse.json({ok:true,skipped:'Content Agent is OFF.'});
 const now=localParts(String(config.cron_timezone||DEFAULTS.cron_timezone));
 const targetHour=Number(config.cron_hour??DEFAULTS.cron_hour);
 const frequency=String(config.frequency||'daily');
 if(now.hour!==targetHour)return NextResponse.json({ok:true,skipped:`Not scheduled hour yet. Current local hour ${now.hour}, scheduled ${targetHour}.`});
 if(frequency==='weekdays'&&(now.weekday===0||now.weekday===6))return NextResponse.json({ok:true,skipped:'Weekday schedule; today is weekend.'});
 if(frequency==='weekly'&&now.weekday!==Number(config.cron_day??1))return NextResponse.json({ok:true,skipped:'Not the scheduled weekday.'});
 const runToken=frequency==='weekly'?`${now.date}-${now.weekday}`:now.date;
 const {data:last}=await supabase.from('site_settings').select('setting_value').eq('setting_key',LAST_RUN_KEY).maybeSingle();
 if(last?.setting_value===runToken)return NextResponse.json({ok:true,skipped:'Already ran for this scheduled period.'});

 const topic=String(config.default_topic||DEFAULTS.default_topic).trim().slice(0,2000);
 const count=Math.min(12,Math.max(1,Number(config.default_count||DEFAULTS.default_count)));
 const {data:existingRows}=await supabase.from('articles').select('headline,slug').order('created_at',{ascending:false}).limit(400);
 const existing=(existingRows||[]).map((x:any)=>x.headline).join(' | ');
 const prompt=`You are the Indie Cut scheduled entertainment research editor. Find the ${count} strongest CURRENT, genuinely newsworthy entertainment stories for today. Assignment focus: ${topic}. Cover movies, television, music, actors, musicians, filmmakers, creators, celebrity news, independent entertainment and culture, with strong editorial attention to Black entertainment and African-American culture when relevant. Use live web search. NEVER use blind items, anonymous gossip, rumor aggregation, social-media speculation, fabricated quotes, unverified relationship claims, or unsupported controversy. Prefer primary sources such as official statements, studios, networks, labels, festivals, verified interviews, court/public records and direct announcements, then reputable entertainment trades and major newsrooms. Require at least two credible source URLs whenever possible. If a major claim cannot be corroborated, mark it not_verified. Avoid duplicating existing Indie Cut coverage: ${existing||'none yet'}. Write original sharp entertainment journalism, not copied source language. Find one trustworthy editorial image when possible, preferably from an official or credible source page. Return ONLY valid JSON: {"stories":[{"headline":"","subheadline":"","category":"movies|tv|music|culture|independent|celebrity","subject_name":"","body":"4-7 substantial paragraphs","sources":["https://...","https://..."],"featured_image_url":"https://...","featured_image_source_url":"https://...","verification_status":"verified|not_verified","verification_note":""}]}.`;
 const ai=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',tools:[{type:'web_search'}],input:prompt,max_output_tokens:28000})});
 const aiJson=await ai.json().catch(()=>({}));if(!ai.ok)return NextResponse.json({error:aiJson?.error?.message||'Research request failed.'},{status:502});
 let parsed:any;try{parsed=parseJson(textFromResponse(aiJson))}catch{return NextResponse.json({error:'The research model returned invalid JSON.'},{status:502})}
 const stories=Array.isArray(parsed?.stories)?parsed.stories.slice(0,count):[];const created:any[]=[];const rejected:any[]=[];
 for(const s of stories){
  if(String(s?.verification_status||'').toLowerCase()!=='verified'){rejected.push({headline:s?.headline||'Untitled',reason:s?.verification_note||'Not sufficiently verified'});continue}
  const headline=String(s?.headline||'').trim();if(!headline)continue;const slug=cleanSlug(headline);
  const duplicate=(existingRows||[]).some((x:any)=>cleanSlug(x.slug||x.headline)===slug||String(x.headline||'').trim().toLowerCase()===headline.toLowerCase())||created.some((x:any)=>x.slug===slug);
  if(duplicate){rejected.push({headline,reason:'Duplicate'});continue}
  const sources=Array.isArray(s?.sources)?s.sources.map((x:any)=>String(x).trim()).filter((x:string)=>/^https?:\/\//i.test(x)):[];
  const imageUrl=/^https?:\/\//i.test(String(s?.featured_image_url||''))?String(s.featured_image_url).trim():'';
  const imageSource=/^https?:\/\//i.test(String(s?.featured_image_source_url||''))?String(s.featured_image_source_url).trim():'';
  if(imageSource&&!sources.includes(imageSource))sources.push(imageSource);
  if(config.require_multiple_sources!==false&&sources.length<2){rejected.push({headline,reason:'Fewer than two credible source URLs'});continue}
  const payload={headline,slug,subheadline:String(s?.subheadline||'').trim()||null,category:String(s?.category||'culture').trim().toLowerCase(),subject_name:String(s?.subject_name||'').trim()||null,body:String(s?.body||'').trim(),featured_media_url:imageUrl||null,sources,verification_status:'verified',status:'draft',published_at:null};
  const {error}=await supabase.from('articles').insert(payload);if(error){rejected.push({headline,reason:error.message});continue}
  created.push({headline,slug,category:payload.category,sources:sources.length,image:imageUrl||null});
 }
 await supabase.from('site_settings').upsert({setting_key:LAST_RUN_KEY,setting_value:runToken,updated_at:new Date().toISOString()},{onConflict:'setting_key'});
 return NextResponse.json({ok:true,date:now.date,frequency,requested:count,created,rejected});
}
