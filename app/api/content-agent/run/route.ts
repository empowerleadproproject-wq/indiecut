import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { isAdminEmail } from '../../../../lib/admin';

export const dynamic='force-dynamic';
export const maxDuration=60;
const KEY='content_agent_config';
const DEFAULTS={enabled:true,default_topic:'trending entertainment stories involving Black culture, film, television, music, celebrities and independent creators',default_count:3,require_multiple_sources:true,reject_rumors:true};
function cleanSlug(value:string){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
function textFromResponse(json:any){if(typeof json?.output_text==='string')return json.output_text;const parts:string[]=[];for(const item of json?.output||[]){for(const c of item?.content||[]){if(typeof c?.text==='string')parts.push(c.text)}}return parts.join('\n')}
function parseJson(text:string){return JSON.parse(String(text||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim())}
async function readConfig(supabase:any){const {data}=await supabase.from('site_settings').select('setting_value').eq('setting_key',KEY).maybeSingle();if(!data?.setting_value)return DEFAULTS;try{return {...DEFAULTS,...JSON.parse(data.setting_value),enabled:true}}catch{return DEFAULTS}}

export async function POST(request:Request){
 const authClient=createClient();const {data:{user}}=await authClient.auth.getUser();
 if(!user)return NextResponse.json({error:'Please sign in to the Indie Cut Back Office.'},{status:401});
 if(!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized admin account.'},{status:403});
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!serviceKey||!supabaseUrl)return NextResponse.json({error:'Supabase admin environment variables are not configured.'},{status:503});
 const supabase=createServiceClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});const config=await readConfig(supabase);
 const apiKey=process.env.OPENAI_API_KEY;if(!apiKey)return NextResponse.json({error:'OPENAI_API_KEY is not configured.'},{status:503});
 const input=await request.json().catch(()=>({}));const topic=String(input.topic||config.default_topic||DEFAULTS.default_topic).trim().slice(0,2000);const count=Math.min(5,Math.max(1,Number(input.count||config.default_count||3)));
 const {data:existingRows}=await supabase.from('articles').select('headline,slug').order('created_at',{ascending:false}).limit(250);const existing=(existingRows||[]).map((x:any)=>x.headline).join(' | ');
 const prompt=`You are the Indie Cut entertainment research editor. Research CURRENT entertainment news for this assignment: ${topic}. Focus on movies, television, music, actors, musicians, filmmakers, comedians, creators, celebrity news, independent entertainment and culture. Give strong editorial attention to Black entertainment and African-American culture when relevant, while covering the broader entertainment industry. Use live web search. Find stories that are genuinely current and newsworthy. NEVER use blind items, anonymous gossip, rumor aggregation, social-media speculation, fabricated quotes, unverified relationship claims, or unsupported controversy. Prefer primary sources such as official statements, studios, networks, labels, festivals, verified interviews, court/public records and direct announcements, then reputable entertainment trades and major newsrooms. Require at least two credible source URLs for a story whenever possible. If a major claim cannot be corroborated, mark it not_verified. Never invent casting, release dates, box office numbers, awards, health information, deaths, legal claims, quotes or personal relationships. Avoid duplicating these existing Indie Cut stories: ${existing||'none yet'}. Write original sharp entertainment journalism, not copied source language. Return ONLY valid JSON: {"stories":[{"headline":"","subheadline":"","category":"movies|tv|music|culture|independent|celebrity","subject_name":"","body":"4-7 substantial paragraphs","sources":["https://...","https://..."],"verification_status":"verified|not_verified","verification_note":"brief internal explanation"}]}.`;
 const ai=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',tools:[{type:'web_search'}],input:prompt,max_output_tokens:12000})});
 const aiJson=await ai.json().catch(()=>({}));if(!ai.ok)return NextResponse.json({error:aiJson?.error?.message||'Research request failed.'},{status:502});
 let parsed:any;try{parsed=parseJson(textFromResponse(aiJson))}catch{return NextResponse.json({error:'The research model returned invalid JSON.'},{status:502})}
 const stories=Array.isArray(parsed?.stories)?parsed.stories.slice(0,count):[];const created:any[]=[];const rejected:any[]=[];
 for(const s of stories){if(String(s?.verification_status||'').toLowerCase()!=='verified'){rejected.push({headline:s?.headline||'Untitled',reason:s?.verification_note||'Not sufficiently verified'});continue}
  const headline=String(s?.headline||'').trim();if(!headline)continue;const slug=cleanSlug(headline);const duplicate=(existingRows||[]).some((x:any)=>cleanSlug(x.slug||x.headline)===slug||String(x.headline||'').trim().toLowerCase()===headline.toLowerCase());if(duplicate){rejected.push({headline,reason:'Duplicate'});continue}
  const sources=Array.isArray(s?.sources)?s.sources.map((x:any)=>String(x).trim()).filter((x:string)=>/^https?:\/\//i.test(x)):[];if(config.require_multiple_sources!==false&&sources.length<2){rejected.push({headline,reason:'Fewer than two credible source URLs'});continue}
  const payload={headline,slug,subheadline:String(s?.subheadline||'').trim()||null,category:String(s?.category||'culture').trim().toLowerCase(),subject_name:String(s?.subject_name||'').trim()||null,body:String(s?.body||'').trim(),sources,verification_status:'verified',status:'draft',published_at:null};const {error}=await supabase.from('articles').insert(payload);if(error){rejected.push({headline,reason:error.message});continue}created.push({headline,slug,category:payload.category,sources:sources.length});}
 return NextResponse.json({created,rejected});
}
