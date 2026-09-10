import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';
export const maxDuration=300;
const KEY='independent_music_radar_latest';
function textFromResponse(json:any){if(typeof json?.output_text==='string')return json.output_text;const parts:string[]=[];for(const item of json?.output||[]){for(const c of item?.content||[]){if(typeof c?.text==='string')parts.push(c.text)}}return parts.join('\n').trim()}
function parseJson(text:string){return JSON.parse(String(text||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim())}
async function getDb(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return null;return createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}

export async function GET(){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});
 const db=await getDb();if(!db)return NextResponse.json({error:'Supabase admin credentials missing'},{status:503});
 const {data}=await db.from('site_settings').select('setting_value').eq('setting_key',KEY).maybeSingle();let scan=null;try{scan=data?.setting_value?JSON.parse(data.setting_value):null}catch{}return NextResponse.json({scan});
}

export async function POST(request:Request){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});
 const db=await getDb();if(!db)return NextResponse.json({error:'Supabase admin credentials missing'},{status:503});
 const apiKey=process.env.OPENAI_API_KEY;if(!apiKey)return NextResponse.json({error:'OPENAI_API_KEY is not configured'},{status:503});
 const input=await request.json().catch(()=>({}));const focus=String(input.focus||'Independent R&B, hip-hop, soul, alternative R&B, Afrobeats and adjacent urban music').slice(0,1200);const count=Math.min(20,Math.max(5,Number(input.count||10)));const days=Math.min(60,Math.max(7,Number(input.days||30)));
 const prompt=`You are Indie Cut's independent-music discovery editor. Use live web search to find up to ${count} genuinely rising artists with meaningful momentum in the last ${days} days. Prioritize ${focus}. Strongly favor Black and urban music discovery without excluding adjacent independent talent. Do NOT simply return already-famous major-label stars. Look for recent release traction, credible playlist/editorial pickup, YouTube or TikTok momentum, Bandcamp/SoundCloud traction, festival/show announcements, press coverage, chart movement, notable collaborations, or other verifiable signs that attention is increasing.

Independence verification matters. Classify every artist as exactly one of: confirmed_independent, likely_independent, label_affiliated, unknown. Use confirmed_independent only when a credible source, official artist/label page, distributor information, release credits, or reputable coverage supports that they are unsigned, self-releasing, artist-owned, or on a genuinely independent label. If they are tied to a major label or major-label imprint, mark label_affiliated. Never guess independence from follower count or obscurity.

For momentum, give a 0-100 editorial score based on recency, growth signals, cross-platform evidence and storyworthiness. Do not invent follower counts, stream counts, chart positions, cities, labels, quotes or release details. If a social/music profile URL is not confidently verified, leave it blank. Prefer direct artist/platform links and at least two credible source URLs whenever possible. Return ONLY valid JSON in this shape: {"artists":[{"artist_name":"","genre":"","city":"","independence_status":"confirmed_independent|likely_independent|label_affiliated|unknown","independence_note":"","why_trending":"2-4 sentence evidence-based explanation","momentum_score":0,"latest_release":"","latest_release_url":"","instagram":"","tiktok":"","spotify":"","youtube":"","bandcamp":"","soundcloud":"","sources":["https://..."],"story_angle":"specific Indie Cut editorial angle","image_url":"","discovered_at":"ISO timestamp"}]}.`;
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',tools:[{type:'web_search'}],input:prompt,max_output_tokens:24000})});
 const j=await r.json().catch(()=>({}));if(!r.ok)return NextResponse.json({error:j?.error?.message||'Independent music research failed'},{status:502});
 let parsed:any;try{parsed=parseJson(textFromResponse(j))}catch{return NextResponse.json({error:'The music discovery model returned invalid JSON'},{status:502})}
 const raw=Array.isArray(parsed?.artists)?parsed.artists.slice(0,count):[];
 const allowed=new Set(['confirmed_independent','likely_independent','label_affiliated','unknown']);
 const artists=raw.filter((a:any)=>String(a?.artist_name||'').trim()).map((a:any)=>({artist_name:String(a.artist_name).trim(),genre:String(a.genre||'').trim(),city:String(a.city||'').trim(),independence_status:allowed.has(String(a.independence_status))?String(a.independence_status):'unknown',independence_note:String(a.independence_note||'').trim(),why_trending:String(a.why_trending||'').trim(),momentum_score:Math.max(0,Math.min(100,Number(a.momentum_score||0))),latest_release:String(a.latest_release||'').trim(),latest_release_url:/^https?:\/\//i.test(String(a.latest_release_url||''))?String(a.latest_release_url):'',instagram:/^https?:\/\//i.test(String(a.instagram||''))?String(a.instagram):'',tiktok:/^https?:\/\//i.test(String(a.tiktok||''))?String(a.tiktok):'',spotify:/^https?:\/\//i.test(String(a.spotify||''))?String(a.spotify):'',youtube:/^https?:\/\//i.test(String(a.youtube||''))?String(a.youtube):'',bandcamp:/^https?:\/\//i.test(String(a.bandcamp||''))?String(a.bandcamp):'',soundcloud:/^https?:\/\//i.test(String(a.soundcloud||''))?String(a.soundcloud):'',sources:Array.isArray(a.sources)?a.sources.map((u:any)=>String(u)).filter((u:string)=>/^https?:\/\//i.test(u)).slice(0,6):[],story_angle:String(a.story_angle||'').trim(),image_url:/^https?:\/\//i.test(String(a.image_url||''))?String(a.image_url):'',discovered_at:String(a.discovered_at||new Date().toISOString())})).sort((a:any,b:any)=>b.momentum_score-a.momentum_score);
 const scan={scanned_at:new Date().toISOString(),focus,days,count,artists};
 await db.from('site_settings').upsert({setting_key:KEY,setting_value:JSON.stringify(scan),updated_at:new Date().toISOString()},{onConflict:'setting_key'});
 return NextResponse.json(scan);
}
