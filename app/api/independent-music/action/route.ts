import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';
export const maxDuration=300;

function slug(v:string){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
function textFromResponse(json:any){if(typeof json?.output_text==='string')return json.output_text;const parts:string[]=[];for(const item of json?.output||[]){for(const c of item?.content||[]){if(typeof c?.text==='string')parts.push(c.text)}}return parts.join('\n').trim()}
function parseJson(text:string){return JSON.parse(String(text||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim())}
function validUrl(v:any){const s=String(v||'').trim();return /^https?:\/\//i.test(s)?s:''}
function playableUrl(lead:any){return validUrl(lead.latest_release_url)||validUrl(lead.spotify)||validUrl(lead.youtube)||validUrl(lead.soundcloud)||validUrl(lead.bandcamp)||''}

async function adminDb(){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return {error:NextResponse.json({error:'Unauthorized'},{status:401})};
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return {error:NextResponse.json({error:'Supabase admin credentials missing'},{status:503})};
 return {db:createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})};
}

async function saveArticleMedia(db:any,articleId:string,lead:any){
 const media={article_id:articleId,artist_name:String(lead.artist_name||'').trim(),title:String(lead.latest_release||'').trim(),media_url:playableUrl(lead),cover_url:validUrl(lead.image_url),spotify:validUrl(lead.spotify),youtube:validUrl(lead.youtube),soundcloud:validUrl(lead.soundcloud),bandcamp:validUrl(lead.bandcamp),updated_at:new Date().toISOString()};
 await db.from('site_settings').upsert({setting_key:`article_media_${articleId}`,setting_value:JSON.stringify(media),updated_at:new Date().toISOString()},{onConflict:'setting_key'});
 return media;
}

export async function POST(request:Request){
 const a=await adminDb();if(a.error)return a.error;const db=a.db!;
 const input=await request.json().catch(()=>({}));const action=String(input.action||'');const lead=input.artist||{};
 const name=String(lead.artist_name||'').trim();if(!name)return NextResponse.json({error:'Artist name is required'},{status:400});

 if(action==='add_artist'){
  const {data:existing}=await db.from('artists').select('id,name').ilike('name',name).limit(1).maybeSingle();
  if(existing)return NextResponse.json({ok:true,existing:true,row:existing,message:`${name} is already in Artists & People.`});
  const bio=[lead.genre&&`${lead.genre}${lead.city?` · ${lead.city}`:''}`,lead.why_trending,lead.independence_note&&`Independence: ${lead.independence_note}`].filter(Boolean).join('\n\n');
  const payload={name,kind:'musician',bio,image_url:validUrl(lead.image_url)||null,website_url:validUrl(lead.spotify)||validUrl(lead.youtube)||validUrl(lead.latest_release_url)||null,instagram_url:validUrl(lead.instagram)||null,featured:false};
  const {data,error}=await db.from('artists').insert(payload).select().single();if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,row:data,message:`${name} added to Artists & People.`});
 }

 if(action==='add_music'){
  const mediaUrl=playableUrl(lead);if(!mediaUrl)return NextResponse.json({error:'No verified release or listening URL is available for this artist.'},{status:400});
  const title=String(lead.latest_release||`${name} — featured release`).trim();
  const {data:existing}=await db.from('media_items').select('id,title,artist_name').eq('media_type','music').ilike('artist_name',name).ilike('title',title).limit(1).maybeSingle();
  if(existing)return NextResponse.json({ok:true,existing:true,row:existing,message:`${title} is already in Music.`});
  const payload={title,media_type:'music',artist_name:name,description:String(lead.why_trending||lead.story_angle||'').trim()||null,media_url:mediaUrl,cover_url:validUrl(lead.image_url)||null,featured:false};
  const {data,error}=await db.from('media_items').insert(payload).select().single();if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,row:data,message:`${title} added to the Music section.`});
 }

 if(action==='create_article'){
  const apiKey=process.env.OPENAI_API_KEY;if(!apiKey)return NextResponse.json({error:'OPENAI_API_KEY is not configured'},{status:503});
  const sources=Array.isArray(lead.sources)?lead.sources.map((x:any)=>validUrl(x)).filter(Boolean):[];
  const context=JSON.stringify({artist_name:name,genre:lead.genre,city:lead.city,independence_status:lead.independence_status,independence_note:lead.independence_note,why_trending:lead.why_trending,latest_release:lead.latest_release,latest_release_url:lead.latest_release_url,story_angle:lead.story_angle,sources});
  const prompt=`You are an Indie Cut music editor. Re-check the current public web and write a factual, energetic music-news/profile article about this rising artist. Use the supplied lead only as a starting point: ${context}. Verify all material claims with live web search. Do not invent quotes, numbers, label status, relationships, biography details or achievements. If independence cannot be confirmed, say that clearly rather than claiming the artist is independent. Write original copy for Indie Cut, with a sharp headline, concise subheadline, and 5-7 substantial paragraphs. Focus on why the artist matters now, the latest release, momentum and the supplied Indie Cut angle. Return ONLY valid JSON: {"headline":"","subheadline":"","body":"","subject_name":"","sources":["https://..."],"verification_status":"verified|not_verified","verification_note":""}.`;
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',tools:[{type:'web_search'}],input:prompt,max_output_tokens:10000})});
  const j=await r.json().catch(()=>({}));if(!r.ok)return NextResponse.json({error:j?.error?.message||'Article research failed'},{status:502});
  let story:any;try{story=parseJson(textFromResponse(j))}catch{return NextResponse.json({error:'Article writer returned invalid JSON'},{status:502})}
  if(String(story.verification_status||'').toLowerCase()!=='verified')return NextResponse.json({error:story.verification_note||'The article could not be sufficiently verified.'},{status:400});
  const headline=String(story.headline||'').trim();if(!headline)return NextResponse.json({error:'Article writer returned no headline'},{status:502});
  const articleSlug=slug(headline);const cover=validUrl(lead.image_url)||null;const verifiedSources=Array.isArray(story.sources)?story.sources.map((x:any)=>validUrl(x)).filter(Boolean):sources;
  let {data:article}=await db.from('articles').select('*').eq('slug',articleSlug).maybeSingle();
  if(!article){const {data:subjectMatch}=await db.from('articles').select('*').eq('category','music').ilike('subject_name',name).order('created_at',{ascending:false}).limit(1).maybeSingle();article=subjectMatch||null;}
  const base={headline,slug:articleSlug,subheadline:String(story.subheadline||'').trim()||null,category:'music',subject_name:String(story.subject_name||name).trim(),body:String(story.body||'').trim(),featured_media_url:cover,sources:verifiedSources,verification_status:'verified',status:'published',published_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  if(article){const {data:updated,error}=await db.from('articles').update(base).eq('id',article.id).select().single();if(error)return NextResponse.json({error:error.message},{status:400});await saveArticleMedia(db,article.id,lead);return NextResponse.json({ok:true,existing:true,row:updated,message:`${name} article updated with cover art and playable music/video and published live.`});}
  const {data:created,error}=await db.from('articles').insert(base).select().single();if(error)return NextResponse.json({error:error.message},{status:400});await saveArticleMedia(db,created.id,lead);
  return NextResponse.json({ok:true,row:created,message:`${name} article created with cover art and playable music/video and published live.`});
 }

 return NextResponse.json({error:'Unsupported action'},{status:400});
}
