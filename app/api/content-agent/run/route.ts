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
function titleWords(v:string){return new Set(String(v||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>2&&!['the','and','for','with','from','that','this','into','over','after','before'].includes(w)))}
function titleSimilarity(a:string,b:string){const x=titleWords(a),y=titleWords(b);if(!x.size||!y.size)return 0;let hit=0;for(const w of x)if(y.has(w))hit++;return hit/Math.max(x.size,y.size)}
function sourceHosts(urls:string[]){const hosts=new Set<string>();for(const u of urls){try{hosts.add(new URL(u).hostname.replace(/^www\./,''))}catch{}}return hosts.size}
function todayLabel(){return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'long'}).format(new Date())}
async function readConfig(supabase:any){const {data}=await supabase.from('site_settings').select('setting_value').eq('setting_key',KEY).maybeSingle();if(!data?.setting_value)return DEFAULTS;try{return {...DEFAULTS,...JSON.parse(data.setting_value),enabled:true}}catch{return DEFAULTS}}

async function callResearchModel(apiKey:string,prompt:string,maxOutputTokens=28000){
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',tools:[{type:'web_search'}],input:prompt,max_output_tokens:maxOutputTokens})});
 const json=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(json?.error?.message||'Research request failed.');
 return textFromResponse(json);
}

async function runEditorialPass(apiKey:string,topic:string,draft:any,count:number){
 const prompt=`You are Indie Cut's senior standards editor, fact-checker and rewrite desk. Today is ${todayLabel()}.

Assignment: ${topic}

Below is a first-pass research package. Perform a SECOND independent editorial pass using live web search. Do not merely polish the prose. Re-check the central claim, names, dates, titles, numbers, release information, awards, legal claims and quotes against current credible sources. Look for contradictions, stale reporting, recycled news, missing context and misleading framing. If a story is no longer timely or cannot be supported, mark it not_verified instead of rescuing it with speculation.

EDITORIAL STANDARD:
- Prefer first-party/primary sources, official announcements, public records and direct interviews. Use reputable trades or major newsrooms as corroboration.
- Two URLs from the same copied press release do not count as independent corroboration. Use source diversity when possible.
- Separate confirmed facts from analysis. Never invent motives, reactions, relationships, quotes, dates, numbers, casting or controversy.
- Identify the actual news peg: what happened, what is new today, and why a reader should care now.
- Headlines must be specific, accurate and natural, not clickbait, vague, promotional or stuffed with adjectives.
- Lead paragraph must deliver the news immediately. Do not start with throat-clearing, biography or generic context.
- Write like a sharp human entertainment editor. Vary sentence length. Avoid canned AI phrases such as "marks a significant", "continues to make waves", "in a move that", "underscores", "a testament to", "as the industry evolves", "fans are buzzing", "has taken the world by storm", or empty conclusions.
- Keep each story focused on one clear angle. Add useful context only when it changes how the news is understood.
- Reader-facing headline, subheadline and body must contain NO URLs, hyperlinks, markdown citations, footnotes, bracket citations or source-domain parentheticals. URLs belong only in sources.
- Body should be 4-7 substantial paragraphs and normally 350-700 words unless the story genuinely needs less.
- Category must be one of movies|tv|music|culture|independent|celebrity.
- Image must be attributable to an official/credible source. If uncertain, leave image fields blank.

Score each candidate internally for TIMELINESS, NEWS VALUE, SOURCE QUALITY, ORIGINALITY and INDIE CUT FIT. Keep only the strongest ${count} or fewer. Near-duplicate angles should be merged or one rejected.

FIRST-PASS PACKAGE:
${JSON.stringify(draft)}

Return ONLY valid JSON in this exact shape: {"stories":[{"headline":"","subheadline":"","category":"movies|tv|music|culture|independent|celebrity","subject_name":"","body":"","sources":["https://...","https://..."],"featured_image_url":"","featured_image_source_url":"","verification_status":"verified|not_verified","verification_note":"specific internal note","why_now":"one sentence explaining the news peg","news_score":0}]}.`;
 try{return parseJson(await callResearchModel(apiKey,prompt,30000))}catch{return draft}
}

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
 const prompt=`You are the Indie Cut entertainment newsroom's research editor. Today is ${todayLabel()}. Research CURRENT entertainment news for this assignment: ${topic}.

Do not jump straight to writing. Work like a newsroom:
1. DISCOVER at least twice as many plausible story candidates as needed using live web search.
2. VERIFY the central claim of each candidate and identify the original/primary source when possible.
3. RANK candidates for timeliness, actual news value, source quality, originality and Indie Cut audience fit.
4. REMOVE recycled stories, soft promotional filler, near-duplicates and stories whose only evidence is social speculation.
5. SELECT up to ${count} strongest DIFFERENT stories and write them as publication-ready drafts.

Coverage includes movies, television, music, actors, musicians, filmmakers, comedians, creators, celebrity news, independent entertainment and culture. Give strong editorial attention to Black entertainment and African-American culture when relevant without forcing a race angle where it is not actually part of the story.

VERIFICATION RULES:
- NEVER use blind items, anonymous gossip, rumor aggregation, social-media speculation, fabricated quotes, unverified relationship claims or unsupported controversy.
- Prefer primary sources: official statements, studios, networks, labels, festivals, verified/direct interviews, court/public records, award organizations and direct announcements. Then use reputable entertainment trades and major newsrooms.
- Require at least two credible URLs for a fully verified story whenever possible, and prefer two genuinely independent sources rather than duplicated syndication.
- Cross-check names, dates, titles, release dates, awards, numbers, legal claims, deaths, health information and direct quotations.
- If sources disagree, do not hide the conflict. Use the most authoritative/current source and explain the uncertainty in verification_note.
- If the assignment contains first-party information, an exclusive or a fact the editor says can be confirmed directly with a named source, still draft only the supportable facts; flag the unsupported portion and mark verification_status not_verified.
- Never invent missing facts.

EDITORIAL INTELLIGENCE:
- Identify the real news peg and answer "why now?" before writing.
- Avoid duplicating or merely reframing these existing Indie Cut stories: ${existing||'none yet'}.
- A headline that shares the same event/subject with an existing story should be treated as a likely duplicate unless there is a materially new development.
- Headlines should be specific and factual, not clickbait or press-release copy.
- Lead with the news in the first paragraph. Do not open with generic biography or background.
- Write original, sharp human entertainment journalism. Vary rhythm and sentence length. Avoid AI clichés such as "marks a significant", "continues to make waves", "in a move that", "underscores", "a testament to", "fans are buzzing", "has taken the world by storm", "as the industry evolves", and generic wrap-up paragraphs.
- Keep one clear angle per story. Use context to deepen understanding, not pad length.
- Body should be 4-7 substantial paragraphs, normally 350-700 words.
- Reader-facing headline, subheadline and body must contain NO URLs, hyperlinks, Markdown links, citation markers, footnotes, bracket citations, source-domain parentheticals or strings like ([site.com](https://...)). Research links belong ONLY in sources.

IMAGE RULES:
Locate one strong editorial image when possible. Prefer official studio/network/label/festival/artist press imagery or an image on a credible source page. Do not use random social reposts, search-result thumbnails, fan pages, watermarked stock images or unattributable images. If uncertain, leave image fields blank.

Return ONLY valid JSON: {"stories":[{"headline":"","subheadline":"","category":"movies|tv|music|culture|independent|celebrity","subject_name":"","body":"4-7 substantial paragraphs","sources":["https://...","https://..."],"featured_image_url":"https://direct-image-or-source-hosted-image...","featured_image_source_url":"https://page-that-published-or-owns-image...","verification_status":"verified|not_verified","verification_note":"specific internal explanation","why_now":"one sentence news peg","news_score":0}]}.`;
 let firstPass:any;
 try{firstPass=parseJson(await callResearchModel(apiKey,prompt,30000))}catch(e:any){return NextResponse.json({error:e?.message||'The research model returned invalid JSON.'},{status:502})}
 const parsed=await runEditorialPass(apiKey,topic,firstPass,count);
 const stories=Array.isArray(parsed?.stories)?parsed.stories.slice(0,count):[];const created:any[]=[];const rejected:any[]=[];
 for(const s of stories){
  const headline=String(s?.headline||'').trim();if(!headline){rejected.push({headline:'Untitled',reason:'No headline returned'});continue}
  const slug=cleanSlug(headline);const nearDuplicate=(existingRows||[]).find((x:any)=>cleanSlug(x.slug||x.headline)===slug||String(x.headline||'').trim().toLowerCase()===headline.toLowerCase()||titleSimilarity(String(x.headline||''),headline)>=0.72);const duplicate=Boolean(nearDuplicate)||created.some((x:any)=>x.slug===slug||titleSimilarity(x.headline,headline)>=0.72);if(duplicate){rejected.push({headline,reason:'Duplicate or near-duplicate of existing coverage'});continue}
  const sources=Array.isArray(s?.sources)?s.sources.map((x:any)=>String(x).trim()).filter((x:string)=>/^https?:\/\//i.test(x)):[];
  const imageUrl=/^https?:\/\//i.test(String(s?.featured_image_url||''))?String(s.featured_image_url).trim():'';
  const imageSource=/^https?:\/\//i.test(String(s?.featured_image_source_url||''))?String(s.featured_image_source_url).trim():'';
  if(imageSource&&!sources.includes(imageSource))sources.push(imageSource);
  const diverseSources=sourceHosts(sources);
  const fullyVerified=String(s?.verification_status||'').toLowerCase()==='verified'&&(config.require_multiple_sources===false||(sources.length>=2&&diverseSources>=2));
  if(!fullyVerified&&sources.length===0){rejected.push({headline,reason:s?.verification_note||'No credible source URLs were available to support a review draft'});continue}
  const verificationStatus=fullyVerified?'verified':'pending';
  const note=String(s?.verification_note||(!fullyVerified?'Needs editorial/direct-source confirmation before publication.':'')).trim();
  const body=cleanArticleBody(s?.body);
  if(body.length<700){rejected.push({headline,reason:'Draft was too thin to meet Indie Cut editorial depth standards'});continue}
  const bodyWithNote=!fullyVerified&&note?`${body}\n\nEDITORIAL VERIFICATION NOTE: ${note}`:body;
  const payload={headline,slug,subheadline:String(s?.subheadline||'').trim()||null,category:String(s?.category||'culture').trim().toLowerCase(),subject_name:String(s?.subject_name||'').trim()||null,body:bodyWithNote,featured_media_url:imageUrl||null,sources,verification_status:verificationStatus,status:'draft',published_at:null};
  const {error}=await supabase.from('articles').insert(payload);if(error){rejected.push({headline,reason:error.message});continue}
  created.push({headline,slug,category:payload.category,sources:sources.length,source_hosts:diverseSources,image:imageUrl||null,image_source:imageSource||null,verification_status:verificationStatus,verification_note:note,why_now:String(s?.why_now||''),news_score:Number(s?.news_score||0)});
 }
 return NextResponse.json({requested:count,created,rejected,editorial_pipeline:'two-pass research + standards review'});
}
