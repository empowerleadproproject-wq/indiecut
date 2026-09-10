import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { isAdminEmail } from '../../../../lib/admin';

export const dynamic='force-dynamic';
export const maxDuration=300;
const KEY='content_agent_config';
const DEFAULTS={enabled:true,default_topic:'trending entertainment stories involving Black culture, film, television, music, celebrities and independent creators',default_count:3,require_multiple_sources:true,reject_rumors:true};
function cleanSlug(value:string){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
function textFromResponse(json:any){if(typeof json?.output_text==='string')return json.output_text;const parts:string[]=[];for(const item of json?.output||[]){for(const c of item?.content||[]){if(typeof c?.text==='string')parts.push(c.text)}}return parts.join('\n')}
function parseJson(text:string){return JSON.parse(String(text||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim())}
function cleanArticleBody(v:any){return String(v||'').replace(/\s*\(\[[^\]]+\]\(https?:\/\/[^)]+\)\)/gi,'').replace(/\s*\[[^\]]+\]\(https?:\/\/[^)]+\)/gi,'').replace(/\s*\(https?:\/\/[^)]+\)/gi,'').trim()}
async function readConfig(supabase:any){const {data}=await supabase.from('site_settings').select('setting_value').eq('setting_key',KEY).maybeSingle();if(!data?.setting_value)return DEFAULTS;try{return {...DEFAULTS,...JSON.parse(data.setting_value),enabled:true}}catch{return DEFAULTS}}

export async function POST(request:Request){
 const authClient=createClient();const {data:{user}}=await authClient.auth.getUser();
 if(!user)return NextResponse.json({error:'Please sign in to the Indie Cut Back Office.'},{status:401});
 if(!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized admin account.'},{status:403});
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
 if(!serviceKey||!supabaseUrl)return NextResponse.json({error:'Supabase admin environment variables are not configured.'},{status:503});
 const supabase=createServiceClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});const config=await readConfig(supabase);
 const apiKey=process.env.OPENAI_API_KEY;if(!apiKey)return NextResponse.json({error:'OPENAI_API_KEY is not configured.'},{status:503});
 const input=await request.json().catch(()=>({}));const topic=String(input.topic||config.default_topic||DEFAULTS.default_topic).trim().slice(0,2000);const count=Math.min(12,Math.max(1,Number(input.count||config.default_count||3)));
 const {data:existingRows}=await supabase.from('articles').select('headline,slug').order('created_at',{ascending:false}).limit(250);const existing=(existingRows||[]).map((x:any)=>x.headline).join(' | ');
 const prompt=`You are the Indie Cut entertainment research editor. Research CURRENT entertainment news for this assignment: ${topic}. Create up to ${count} DIFFERENT, non-duplicate, genuinely newsworthy stories. Focus on movies, television, music, actors, musicians, filmmakers, comedians, creators, celebrity news, independent entertainment and culture. Give strong editorial attention to Black entertainment and African-American culture when relevant, while covering the broader entertainment industry. Use live web search. NEVER use blind items, anonymous gossip, rumor aggregation, social-media speculation, fabricated quotes, unverified relationship claims, or unsupported controversy. Prefer primary sources such as official statements, studios, networks, labels, festivals, verified interviews, court/public records and direct announcements, then reputable entertainment trades and major newsrooms. Require at least two credible source URLs for a fully verified story whenever possible. IMPORTANT: if the assignment contains first-party information, an exclusive, or a fact the editor says can be confirmed directly with a named source, still write the draft using only the facts you can support, clearly flag the unconfirmed facts in verification_note, and mark verification_status not_verified rather than refusing to draft it. Never invent missing facts. Never invent casting, release dates, box office numbers, awards, health information, deaths, legal claims, quotes or personal relationships. Avoid duplicating these existing Indie Cut stories: ${existing||'none yet'}. Write original sharp entertainment journalism, not copied source language. CRITICAL ARTICLE FORMAT: reader-facing headline, subheadline and body must contain NO URLs, hyperlinks, Markdown links, citation markers, source-domain parentheticals, footnotes, bracket citations, or strings like ([site.com](https://...)). Research links belong ONLY in the sources array. The article body must read as clean finished journalism. Also locate one strong editorial image whenever possible. Prefer an official studio/network/label/festival/artist press image or an image published on one of the credible source pages. Do not use random social reposts, search-result thumbnails, fan pages, watermarked stock images, or an image whose source cannot be identified. If you cannot identify a trustworthy image, leave the image fields blank. Return ONLY valid JSON: {"stories":[{"headline":"","subheadline":"","category":"movies|tv|music|culture|independent|celebrity","subject_name":"","body":"4-7 substantial paragraphs","sources":["https://...","https://..."],"featured_image_url":"https://direct-image-or-source-hosted-image...","featured_image_source_url":"https://page-that-published-or-owns-image...","verification_status":"verified|not_verified","verification_note":"brief internal explanation, including facts that need direct confirmation"}]}.`;
 const ai=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',tools:[{type:'web_search'}],input:prompt,max_output_tokens:28000})});
 const aiJson=await ai.json().catch(()=>({}));if(!ai.ok)return NextResponse.json({error:aiJson?.error?.message||'Research request failed.'},{status:502});
 let parsed:any;try{parsed=parseJson(textFromResponse(aiJson))}catch{return NextResponse.json({error:'The research model returned invalid JSON.'},{status:502})}
 const stories=Array.isArray(parsed?.stories)?parsed.stories.slice(0,count):[];const created:any[]=[];const rejected:any[]=[];
 for(const s of stories){
  const headline=String(s?.headline||'').trim();if(!headline){rejected.push({headline:'Untitled',reason:'No headline returned'});continue}
  const slug=cleanSlug(headline);const duplicate=(existingRows||[]).some((x:any)=>cleanSlug(x.slug||x.headline)===slug||String(x.headline||'').trim().toLowerCase()===headline.toLowerCase())||created.some((x:any)=>x.slug===slug);if(duplicate){rejected.push({headline,reason:'Duplicate'});continue}
  const sources=Array.isArray(s?.sources)?s.sources.map((x:any)=>String(x).trim()).filter((x:string)=>/^https?:\/\//i.test(x)):[];
  const imageUrl=/^https?:\/\//i.test(String(s?.featured_image_url||''))?String(s.featured_image_url).trim():'';
  const imageSource=/^https?:\/\//i.test(String(s?.featured_image_source_url||''))?String(s.featured_image_source_url).trim():'';
  if(imageSource&&!sources.includes(imageSource))sources.push(imageSource);
  const fullyVerified=String(s?.verification_status||'').toLowerCase()==='verified'&&(config.require_multiple_sources===false||sources.length>=2);
  if(!fullyVerified&&sources.length===0){rejected.push({headline,reason:s?.verification_note||'No credible source URLs were available to support a review draft'});continue}
  const verificationStatus=fullyVerified?'verified':'pending';
  const note=String(s?.verification_note||(!fullyVerified?'Needs editorial/direct-source confirmation before publication.':'')).trim();
  const body=cleanArticleBody(s?.body);
  const bodyWithNote=!fullyVerified&&note?`${body}\n\nEDITORIAL VERIFICATION NOTE: ${note}`:body;
  const payload={headline,slug,subheadline:String(s?.subheadline||'').trim()||null,category:String(s?.category||'culture').trim().toLowerCase(),subject_name:String(s?.subject_name||'').trim()||null,body:bodyWithNote,featured_media_url:imageUrl||null,sources,verification_status:verificationStatus,status:'draft',published_at:null};
  const {error}=await supabase.from('articles').insert(payload);if(error){rejected.push({headline,reason:error.message});continue}
  created.push({headline,slug,category:payload.category,sources:sources.length,image:imageUrl||null,image_source:imageSource||null,verification_status:verificationStatus,verification_note:note});
 }
 return NextResponse.json({requested:count,created,rejected});
}
