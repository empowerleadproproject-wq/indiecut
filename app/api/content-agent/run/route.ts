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
function cleanArticleBody(v:any){return String(v||'').replace(/\s*\(\[[^\]]+\]\(https?:\/\/[^)]+\)\)/gi,'').replace(/\s*\[[^\]]+\]\(https?:\/\/[^)]+\)/gi,'').replace(/\s*\(https?:\/\/[^)]+\)/gi,'').replace(/\n\s*EDITORIAL VERIFICATION NOTE:[\s\S]*$/i,'').trim()}
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

async function runEditorialPass(apiKey:string,topic:string,draft:any,count:number,directAssignment:boolean){
 const assignmentRule=directAssignment?`\nDIRECT EDITOR ASSIGNMENT: The editor explicitly requested this subject. You MUST preserve that assignment. Do not substitute a different celebrity, artist, movie, trend or supposedly bigger story. If the subject is niche or independent, that is acceptable and often desirable for Indie Cut. Search deeply for that exact subject, including spelling variants and aliases. Use official artist/label/management pages, verified social profiles, YouTube channels, Bandcamp, Spotify/Apple Music artist pages, interviews, venue/festival pages, regional outlets and credible independent-music coverage when useful. A lack of national press is NOT a reason to abandon the story. If only one credible source is available, return the draft as not_verified with a clear verification_note rather than dropping the assignment.`:'';
 const prompt=`You are Indie Cut's senior entertainment features editor. Today is ${todayLabel()}.

Assignment: ${topic}${assignmentRule}

Below is a first-pass research package. Your job is to TURN THE RESEARCH INTO A STRONG READER-FACING ARTICLE. Research is support material, not the article itself. Use live web search to quietly verify names, dates, titles, numbers, releases, awards, legal claims and quotes before you write.

CRITICAL SEPARATION OF DUTIES:
- The BODY is for readers. It must read like a polished entertainment magazine feature, profile, spotlight or news story.
- verification_note is for the editor only. Put uncertainty, missing corroboration, source conflicts and fact-check warnings there.
- NEVER place phrases such as "could not verify," "no reliable source located," "does not establish," "not proof," "cannot responsibly present," "for this review," or "EDITORIAL VERIFICATION NOTE" in the article body unless the uncertainty itself is truly the central public story.
- Do not make the article a research memo, source audit, evidence report or disclaimer-heavy fact check.
- If a claim is uncertain, omit it from the body or write only the verified portion. Keep the warning in verification_note.

FEATURE-WRITING STANDARD:
- For artist/profile assignments, tell the reader who the artist is, what the music sounds like, what they are releasing or building, who they collaborate with, where they fit in the scene, and why the story is interesting.
- Build an engaging narrative from verified facts instead of listing database metadata.
- A platform genre tag, DJ-pool listing, release date or catalog entry can support the story, but should not become the entire voice of the story.
- Use context to explain why details matter. Write with momentum, transitions and a clear point of view grounded in facts.
- Prefer a strong feature headline over a technical headline. Do not lead with disclaimers.
- Lead paragraph should hook the reader and establish the angle immediately.
- Write like a sharp human entertainment journalist. Vary sentence length. Avoid canned AI phrases such as "marks a significant", "continues to make waves", "in a move that", "underscores", "a testament to", "as the industry evolves", "fans are buzzing", "has taken the world by storm", and empty conclusions.
- Keep one clear angle per story. Add useful context only when it improves the story.
- Reader-facing headline, subheadline and body must contain NO URLs, hyperlinks, markdown citations, footnotes, bracket citations or source-domain parentheticals. URLs belong only in sources.
- Body should normally be 5-8 substantial paragraphs and 450-800 words. A niche direct assignment may be shorter if public information is limited, but it must still feel complete and publishable.
- Category must be one of movies|tv|music|culture|independent|celebrity.
- Image must be attributable to an official/credible source. If uncertain, leave image fields blank.

FACT-CHECK STANDARD:
- Prefer first-party/primary sources, official announcements, public records and direct interviews. Use reputable trades, regional outlets or specialist outlets as corroboration.
- Two URLs from the same copied press release do not count as independent corroboration.
- Never invent motives, reactions, relationships, quotes, dates, numbers, casting, awards, chart positions, biography or controversy.
- For a direct artist/profile assignment, the valid angle can be the artist's career, sound, current release, regional impact, live activity, catalog or independent rise; it does NOT have to be a national breaking-news event.
- If a historical identity connection is uncertain, do not build the article around it. Mention only what is verified and put the unresolved connection in verification_note.

${directAssignment?`For this direct assignment, return at least ONE polished article about the requested subject whenever there is enough public information to write responsibly. Do not rank the subject out of the package.`:`Score candidates internally for timeliness, news value, source quality, originality and Indie Cut fit. Keep only the strongest ${count} or fewer.`}

FIRST-PASS RESEARCH PACKAGE:
${JSON.stringify(draft)}

Return ONLY valid JSON in this exact shape: {"stories":[{"headline":"","subheadline":"","category":"movies|tv|music|culture|independent|celebrity","subject_name":"","body":"reader-facing polished article only","sources":["https://...","https://..."],"featured_image_url":"","featured_image_source_url":"","verification_status":"verified|not_verified","verification_note":"internal editor-only fact-check note","why_now":"one sentence explaining the angle","news_score":0}]}.`;
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
 const input=await request.json().catch(()=>({}));
 const requestedTopic=String(input.topic||'').trim();
 const directAssignment=Boolean(requestedTopic);
 const topic=String(requestedTopic||config.default_topic||DEFAULTS.default_topic).trim().slice(0,2000);
 const count=Math.min(12,Math.max(1,Number(input.count||config.default_count||3)));
 const {data:existingRows}=await supabase.from('articles').select('headline,slug').order('created_at',{ascending:false}).limit(250);const existing=(existingRows||[]).map((x:any)=>x.headline).join(' | ');
 const assignmentMode=directAssignment?`\n\nEDITOR-DIRECTED ASSIGNMENT — THIS OVERRIDES TREND DISCOVERY:\nThe editor explicitly typed the assignment above. Treat it as a command, not a suggestion. You MUST research and write about the requested subject. Do NOT replace it with a more famous artist, broader trend or unrelated breaking story. If the editor names a person, artist, group, film, show, company or project, search that exact name first, then spelling variants, aliases and connected releases/projects.\n\nFor niche, regional and independent artists, search beyond national entertainment trades. Useful sources can include the artist's official site, label/management pages, verified Facebook/Instagram/X profiles, official YouTube channel, Bandcamp, Spotify/Apple Music artist pages, interviews, venue/festival listings, radio-station coverage, regional newspapers, local TV, music blogs with clear authorship, and other directly attributable pages. Use those sources carefully; do not turn promotional claims into facts without attribution.\n\nA lack of mainstream press is NOT a reason to skip the assignment. Indie Cut should be able to cover independent and emerging talent. If two independent credible sources are unavailable, still create the strongest responsible draft from the credible material you can find and mark verification_status not_verified. If a fact is only supported by the artist's own page, attribute it in the prose where appropriate. Never invent biography, hometown, discography, chart positions, collaborations, awards or quotes.\n\nFor a named artist/profile request, the article does not need a breaking-news peg. A legitimate editorial angle can be the artist's sound, career path, current music, catalog, Southern soul scene, regional following, live circuit or independent rise. Return at least ONE complete story about the requested subject whenever enough public information exists.`:'';
 const prompt=`You are the Indie Cut entertainment newsroom's research editor. Today is ${todayLabel()}. Research this assignment: ${topic}.${assignmentMode}

${directAssignment?`This is DIRECT ASSIGNMENT MODE. Research the requested subject deeply and produce the requested article. Do not run a beauty contest against unrelated trending stories. If count is greater than one, only create additional stories if there are genuinely distinct angles about the SAME requested subject or assignment.`:`This is DISCOVERY MODE. Work like a newsroom:\n1. DISCOVER at least twice as many plausible story candidates as needed using live web search.\n2. VERIFY the central claim of each candidate and identify the original/primary source when possible.\n3. RANK candidates for timeliness, actual news value, source quality, originality and Indie Cut audience fit.\n4. REMOVE recycled stories, soft promotional filler, near-duplicates and stories whose only evidence is social speculation.\n5. SELECT up to ${count} strongest DIFFERENT stories and write them as publication-ready drafts.`}

Coverage includes movies, television, music, actors, musicians, filmmakers, comedians, creators, celebrity news, independent entertainment and culture. Give strong editorial attention to Black entertainment and African-American culture when relevant without forcing a race angle where it is not actually part of the story.

RESEARCH RULES:
- NEVER use blind items, anonymous gossip, rumor aggregation, fabricated quotes, unverified relationship claims or unsupported controversy.
- Social media CAN be used as a primary source for what a verified/official subject directly announced about themselves, but not as proof of third-party rumors or speculation.
- Prefer primary sources: official statements, artists, labels, studios, networks, festivals, verified/direct interviews, public records, award organizations and direct announcements. Then use reputable entertainment trades, major newsrooms, regional media and credible specialist outlets.
- Require at least two credible URLs for a fully verified story whenever possible, and prefer genuinely independent sources rather than duplicated syndication.
- Cross-check names, dates, titles, release dates, awards, numbers, legal claims, deaths, health information and direct quotations.
- For a direct editor assignment, one credible source is enough to RETURN A DRAFT, but mark it not_verified/pending if corroboration is insufficient.
- Never invent missing facts.

WRITING RULES:
- The final deliverable is an ARTICLE, not a research report.
- Research silently. Do not narrate the verification process to the reader.
- Do not fill the body with caveats about what was not found. Put uncertainty in verification_note.
- If a claim is uncertain, omit it from the body rather than making the whole article about the uncertainty.
- For artist/profile assignments, tell a coherent story about the artist's music, releases, collaborations, sound, scene and career using the strongest verified material available.
- Write original, sharp human entertainment journalism with a strong headline, hook, transitions and a satisfying close.
- Lead with the feature angle, not metadata.
- Avoid phrases such as "no reliable source located," "does not establish," "not proof," "cannot be confirmed," or "for this review" in the body unless absolutely necessary to the public story.
- Avoid AI clichés such as "marks a significant", "continues to make waves", "in a move that", "underscores", "a testament to", "fans are buzzing", "has taken the world by storm", "as the industry evolves", and generic wrap-up paragraphs.
- Body should normally be 5-8 substantial paragraphs, 450-800 words when enough material exists.
- Reader-facing headline, subheadline and body must contain NO URLs, hyperlinks, Markdown links, citation markers, footnotes, bracket citations or source-domain parentheticals. Research links belong ONLY in sources.

Avoid duplicating or merely reframing these existing Indie Cut stories: ${existing||'none yet'}. For direct assignments, reject only an exact or materially identical existing angle; a genuinely new profile or feature is allowed.

IMAGE RULES:
Locate one strong editorial image when possible. For artist assignments, official artist/label/management press imagery and images from the artist's verified official channels are acceptable when attributable. Do not use random fan reposts, search-result thumbnails, watermarked stock images or unattributable images. If uncertain, leave image fields blank.

Return ONLY valid JSON: {"stories":[{"headline":"","subheadline":"","category":"movies|tv|music|culture|independent|celebrity","subject_name":"","body":"publication-ready reader-facing article","sources":["https://...","https://..."],"featured_image_url":"https://direct-image-or-source-hosted-image...","featured_image_source_url":"https://page-that-published-or-owns-image...","verification_status":"verified|not_verified","verification_note":"internal editor-only fact-check note","why_now":"one sentence story angle","news_score":0}]}.`;
 let firstPass:any;
 try{firstPass=parseJson(await callResearchModel(apiKey,prompt,30000))}catch(e:any){return NextResponse.json({error:e?.message||'The research model returned invalid JSON.'},{status:502})}
 const parsed=await runEditorialPass(apiKey,topic,firstPass,count,directAssignment);
 const stories=Array.isArray(parsed?.stories)?parsed.stories.slice(0,count):[];const created:any[]=[];const rejected:any[]=[];
 for(const s of stories){
  const headline=String(s?.headline||'').trim();if(!headline){rejected.push({headline:'Untitled',reason:'No headline returned'});continue}
  const slug=cleanSlug(headline);
  const nearDuplicate=directAssignment
   ?(existingRows||[]).find((x:any)=>cleanSlug(x.slug||x.headline)===slug||String(x.headline||'').trim().toLowerCase()===headline.toLowerCase())
   :(existingRows||[]).find((x:any)=>cleanSlug(x.slug||x.headline)===slug||String(x.headline||'').trim().toLowerCase()===headline.toLowerCase()||titleSimilarity(String(x.headline||''),headline)>=0.72);
  const duplicate=Boolean(nearDuplicate)||created.some((x:any)=>x.slug===slug||(!directAssignment&&titleSimilarity(x.headline,headline)>=0.72));if(duplicate){rejected.push({headline,reason:'Duplicate or near-duplicate of existing coverage'});continue}
  const sources=Array.isArray(s?.sources)?s.sources.map((x:any)=>String(x).trim()).filter((x:string)=>/^https?:\/\//i.test(x)):[];
  const imageUrl=/^https?:\/\//i.test(String(s?.featured_image_url||''))?String(s.featured_image_url).trim():'';
  const imageSource=/^https?:\/\//i.test(String(s?.featured_image_source_url||''))?String(s.featured_image_source_url).trim():'';
  if(imageSource&&!sources.includes(imageSource))sources.push(imageSource);
  const diverseSources=sourceHosts(sources);
  const fullyVerified=String(s?.verification_status||'').toLowerCase()==='verified'&&(config.require_multiple_sources===false||(sources.length>=2&&diverseSources>=2));
  if(sources.length===0){rejected.push({headline,reason:s?.verification_note||'No supportable public source was found for the requested draft'});continue}
  const verificationStatus=fullyVerified?'verified':'pending';
  const note=String(s?.verification_note||(!fullyVerified?'Needs editorial/direct-source confirmation before publication.':'')).trim();
  const body=cleanArticleBody(s?.body);
  const minimumBodyLength=directAssignment?400:700;
  if(body.length<minimumBodyLength){rejected.push({headline,reason:directAssignment?'Draft did not contain enough supportable material yet':'Draft was too thin to meet Indie Cut editorial depth standards'});continue}
  const payload={headline,slug,subheadline:String(s?.subheadline||'').trim()||null,category:String(s?.category||'culture').trim().toLowerCase(),subject_name:String(s?.subject_name||'').trim()||null,body,featured_media_url:imageUrl||null,sources,verification_status:verificationStatus,status:'draft',published_at:null};
  const {error}=await supabase.from('articles').insert(payload);if(error){rejected.push({headline,reason:error.message});continue}
  created.push({headline,slug,category:payload.category,sources:sources.length,source_hosts:diverseSources,image:imageUrl||null,image_source:imageSource||null,verification_status:verificationStatus,verification_note:note,why_now:String(s?.why_now||''),news_score:Number(s?.news_score||0)});
 }
 return NextResponse.json({requested:count,created,rejected,mode:directAssignment?'direct_assignment':'discovery',editorial_pipeline:'research + feature rewrite + internal fact-check'});
}
