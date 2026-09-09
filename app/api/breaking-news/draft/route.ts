import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';
export const maxDuration=180;

function textFromResponse(json:any){if(typeof json?.output_text==='string')return json.output_text;const parts:string[]=[];for(const item of json?.output||[])for(const c of item?.content||[])if(typeof c?.text==='string')parts.push(c.text);return parts.join('\n').trim()}
function parseJson(text:string){const t=String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();const s=t.indexOf('{'),e=t.lastIndexOf('}');if(s<0||e<s)throw new Error('Invalid JSON');return JSON.parse(t.slice(s,e+1))}
function cleanSlug(value:string){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
function safeUrl(v:any){const s=String(v||'').trim();return /^https?:\/\//i.test(s)?s:''}

export async function POST(request:Request){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,apiKey=process.env.OPENAI_API_KEY;
 if(!url||!key)return NextResponse.json({error:'Supabase admin credentials missing'},{status:503});
 if(!apiKey)return NextResponse.json({error:'OPENAI_API_KEY is not configured.'},{status:503});
 const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const input=await request.json().catch(()=>({}));const lead=input?.lead||{};
 if(String(lead.verification_status||'')!=='verified')return NextResponse.json({error:'This lead is not verified yet.'},{status:400});
 const headline=String(lead.headline||'').trim();const seedSources=(Array.isArray(lead.sources)?lead.sources:[]).map(safeUrl).filter(Boolean);
 if(!headline||seedSources.length<2)return NextResponse.json({error:'A verified headline and at least two credible sources are required.'},{status:400});
 const {data:existing}=await db.from('articles').select('id,headline,slug').order('created_at',{ascending:false}).limit(300);
 const slug=cleanSlug(headline);if((existing||[]).some((x:any)=>cleanSlug(x.slug||x.headline)===slug||String(x.headline||'').trim().toLowerCase()===headline.toLowerCase()))return NextResponse.json({error:'Indie Cut already appears to have this story.'},{status:409});

 const prompt=`You are Indie Cut's breaking-news editor. Re-check this entertainment lead using live web search and create a review-ready article draft ONLY if the central claim remains verified. Use the supplied sources as starting points, but verify them and add stronger sources if needed. Never invent quotes, dates, casting, legal details, health claims, deaths, relationships, numbers or context. If the central claim cannot be corroborated by at least two credible sources, return verification_status not_verified and do not write the article as fact. Write original journalism, not copied source language.\n\nLEAD HEADLINE: ${headline}\nLEAD SUMMARY: ${String(lead.summary||'')}\nWHY BREAKING: ${String(lead.why_breaking||'')}\nSUBJECT: ${String(lead.subject_name||'')}\nSTARTING SOURCES: ${seedSources.join(' | ')}\n\nReturn ONLY valid JSON: {"verification_status":"verified|not_verified","verification_note":"","headline":"strong accurate Indie Cut headline","subheadline":"","category":"movies|tv|music|culture|independent|celebrity","subject_name":"","body":"4-7 substantial paragraphs, current and factual","sources":["https://...","https://..."],"featured_image_url":"optional trustworthy image URL or blank","featured_image_source_url":"optional source page URL or blank"}.`;
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',tools:[{type:'web_search'}],input:prompt,max_output_tokens:12000})});
 const j=await r.json().catch(()=>({}));if(!r.ok)return NextResponse.json({error:j?.error?.message||'Verification request failed'},{status:502});
 let parsed:any;try{parsed=parseJson(textFromResponse(j))}catch{return NextResponse.json({error:'The verification model returned invalid data.'},{status:502})}
 if(String(parsed?.verification_status||'').toLowerCase()!=='verified')return NextResponse.json({error:parsed?.verification_note||'The lead could not be re-verified.'},{status:409});
 const finalHeadline=String(parsed?.headline||headline).trim();const finalSlug=cleanSlug(finalHeadline);
 if((existing||[]).some((x:any)=>cleanSlug(x.slug||x.headline)===finalSlug||String(x.headline||'').trim().toLowerCase()===finalHeadline.toLowerCase()))return NextResponse.json({error:'Indie Cut already appears to have this story.'},{status:409});
 const sources=(Array.isArray(parsed?.sources)?parsed.sources:[]).map(safeUrl).filter(Boolean);const imageUrl=safeUrl(parsed?.featured_image_url),imageSource=safeUrl(parsed?.featured_image_source_url);if(imageSource&&!sources.includes(imageSource))sources.push(imageSource);
 if(sources.length<2)return NextResponse.json({error:'The re-check did not produce two credible sources.'},{status:409});
 const payload={headline:finalHeadline,slug:finalSlug,subheadline:String(parsed?.subheadline||'').trim()||null,category:String(parsed?.category||lead.category||'culture').trim().toLowerCase(),subject_name:String(parsed?.subject_name||lead.subject_name||'').trim()||null,body:String(parsed?.body||'').trim(),featured_media_url:imageUrl||null,sources,verification_status:'verified',status:'draft',published_at:null};
 if(!payload.body)return NextResponse.json({error:'The verified draft came back without article copy.'},{status:502});
 const {data:created,error}=await db.from('articles').insert(payload).select('id,headline,slug').single();if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({ok:true,id:created.id,headline:created.headline,slug:created.slug,sources:sources.length});
}
