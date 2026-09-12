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

async function runEditorialPass(apiKey:string,topic:string,draft:any,count:number,directAssignment:boolean){
 const assignmentRule=directAssignment?`\nDIRECT EDITOR ASSIGNMENT: The editor explicitly requested this subject. You MUST preserve that assignment. Do not substitute a different celebrity, artist, movie, trend or supposedly bigger story. If the subject is niche or independent, that is acceptable and often desirable for Indie Cut. Search deeply for that exact subject, including spelling variants and aliases. Use official artist/label/management pages, verified social profiles, YouTube channels, Bandcamp, Spotify/Apple Music artist pages, interviews, venue/festival pages, regional outlets and credible independent-music coverage when useful. A lack of national press is NOT a reason to abandon the story. If only one credible source is available, return the draft as not_verified with a clear verification_note rather than dropping the assignment.`:'';
 const prompt=`You are Indie Cut's senior standards editor, fact-checker and rewrite desk. Today is ${todayLabel()}.

Assignment: ${topic}${assignmentRule}

Below is a first-pass research package. Perform a SECOND independent editorial pass using live web search. Do not merely polish the prose. Re-check the central claim, names, dates, titles, numbers, release information, awards, legal claims and quotes against current credible sources. Look for contradictions, stale reporting, recycled news, missing context and misleading framing. If a claim cannot be supported, remove or qualify that claim; for a direct editor assignment, do not discard the entire requested subject merely because it is niche.

EDITORIAL STANDARD:
- Prefer first-party/primary sources, official announcements, public records and direct interviews. Use reputable trades or major newsrooms as corroboration.
- Two URLs from the same copied press release do not count as independent corroboration. Use source diversity when possible.
- Separate confirmed facts from analysis. Never invent motives, reactions, relationships, quotes, dates, numbers, casting or controversy.
- For breaking-news discovery, identify the actual news peg: what happened, what is new today, and why a reader should care now.
- For an editor-requested artist/profile/feature assignment, the valid angle can be the artist's career, sound, current release, regional impact, live activity, catalog or independent rise; it does NOT have to be a national breaking-news event.
- Headlines must be specific, accurate and natural, not clickbait, vague, promotional or stuffed with adjectives.
- Lead paragraph must deliver the angle immediately. Do not start with throat-clearing or generic context.
- Write like a sharp human entertainment editor. Vary sentence length. Avoid canned AI phrases such as "marks a significant", "continues to make waves", "in a move that", "underscores", "a testament to", "as the industry evolves", "fans are buzzing", "has taken the world by storm", or empty conclusions.
- Keep each story focused on one clear angle. Add useful context only when it changes how the story is understood.
- Reader-facing headline, subheadline and body must contain NO URLs, hyperlinks, markdown citations, footnotes, bracket citations or source-domain parentheticals. URLs belong only in sources.
- Body should be 4-7 substantial paragraphs and normally 350-700 words. A niche direct assignment may be somewhat shorter if verified public information is limited, but it must still read like a complete article.
- Category must be one of movies|tv|music|culture|independent|celebrity.
- Image must be attributable to an official/credible source. If uncertain, leave image fields blank.

${directAssignment?`For this direct assignment, return at least ONE story about the requested subject whenever there is enough public information to write a responsible draft. Do not rank the requested subject out of the package. Only reject the subject if there is effectively no supportable public information at all.`:`Score each candidate internally for TIMELINESS, NEWS VALUE, SOURCE QUALITY, ORIGINALITY and INDIE CUT FIT. Keep only the strongest ${count} or fewer. Near-duplicate angles should be merged or one rejected.`}

FIRST-PASS PACKAGE:
${JSON.stringify(draft)}

Return ONLY valid JSON in this exact shape: {"stories":[{"headline":"","subheadline":"","category":"movies|tv|music|culture|independent|celebrity","subject_name":"","body":"","sources":["https://...","https://..."],"featured_image_url":"","featured_image_source_url":"","verification_status":"verified|not_verified","verification_note":"specific internal note","why_now":"one sentence explaining the angle","news_score":0}]}.`;
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

VERIFICATION RULES:
- NEVER use blind items, anonymous gossip, rumor aggregation, fabricated quotes, unverified relationship claims or unsupported controversy.
- Social media CAN be used as a primary source for what a verified/official subject directly announced about themselves, but not as proof of third-party rumors or speculation.
- Prefer primary sources: official statements, artists, labels, studios, networks, festivals, verified/direct interviews, public records, award organizations and direct announcements. Then use reputable entertainment trades, major newsrooms, regional media and credible specialist outlets.
- Require at least two credible URLs for a fully verified story whenever possible, and prefer genuinely independent sources rather than duplicated syndication.
- Cross-check names, dates, titles, release dates, awards, numbers, legal claims, deaths, health information and direct quotations.
- If sources disagree, do not hide the conflict. Use the most authoritative/current source and explain the uncertainty in verification_note.
- For a direct editor assignment, one credible source is enough to RETURN A DRAFT, but mark it not_verified/pending if corroboration is insufficient.
- If the assignment contains first-party information, an exclusive or a fact the editor says can be confirmed directly with a named source, still draft only the supportable facts; flag unsupported portions in verification_note.
- Never invent missing facts.

EDITORIAL INTELLIGENCE:
- In discovery mode, identify the real news peg and answer "why now?" before writing.
- In direct assignment mode, honor the editor's requested subject even when the best format is a profile, artist spotlight, career feature or scene story rather than breaking news.
- Avoid duplicating or merely reframing these existing Indie Cut stories: ${existing||'none yet'}.
- For direct assignments, do not treat every article about the same person as a duplicate. Reject only an exact or materially identical existing angle/event; a genuinely new profile or angle is allowed.
- Headlines should be specific and factual, not clickbait or press-release copy.
- Lead with the story angle in the first paragraph. Do not open with generic biography filler.
- Write original, sharp human entertainment journalism. Vary rhythm and sentence length. Avoid AI clichés such as "marks a significant", "continues to make waves", "in a move that", "underscores", "a testament to", "fans are buzzing", "has taken the world by storm", "as the industry evolves", and generic wrap-up paragraphs.
- Keep one clear angle per story. Use context to deepen understanding, not pad length.
- Body should be 4-7 substantial paragraphs, normally 350-700 words. For a niche direct assignment, a shorter complete feature is acceptable if public information is genuinely limited.
- Reader-facing headline, subheadline and body must contain NO URLs, hyperlinks, Markdown links, citation markers, footnotes, bracket citations, source-domain parentheticals or strings like ([site.com](https://...)). Research links belong ONLY in sources.

IMAGE RULES:
Locate one strong editorial image when possible. For artist assignments, official artist/label/management press imagery and images from the artist's verified official channels are acceptable when attributable. Do not use random fan reposts, search-result thumbnails, watermarked stock images or unattributable images. If uncertain, leave image fields blank.

Return ONLY valid JSON: {"stories":[{"headline":"","subheadline":"","category":"movies|tv|music|culture|independent|celebrity","subject_name":"","body":"4-7 substantial paragraphs","sources":["https://...","https://..."],"featured_image_url":"https://direct-image-or-source-hosted-image...","featured_image_source_url":"https://page-that-published-or-owns-image...","verification_status":"verified|not_verified","verification_note":"specific internal explanation","why_now":"one sentence story angle","news_score":0}]}.`;
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
  const bodyWithNote=!fullyVerified&&note?`${body}\n\nEDITORIAL VERIFICATION NOTE: ${note}`:body;
  const payload={headline,slug,subheadline:String(s?.subheadline||'').trim()||null,category:String(s?.category||'culture').trim().toLowerCase(),subject_name:String(s?.subject_name||'').trim()||null,body:bodyWithNote,featured_media_url:imageUrl||null,sources,verification_status:verificationStatus,status:'draft',published_at:null};
  const {error}=await supabase.from('articles').insert(payload);if(error){rejected.push({headline,reason:error.message});continue}
  created.push({headline,slug,category:payload.category,sources:sources.length,source_hosts:diverseSources,image:imageUrl||null,image_source:imageSource||null,verification_status:verificationStatus,verification_note:note,why_now:String(s?.why_now||''),news_score:Number(s?.news_score||0)});
 }
 return NextResponse.json({requested:count,created,rejected,mode:directAssignment?'direct_assignment':'discovery',editorial_pipeline:'two-pass research + standards review'});
}
