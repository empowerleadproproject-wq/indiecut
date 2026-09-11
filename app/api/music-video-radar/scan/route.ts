import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';
export const maxDuration=300;
const KEY='music_video_radar_latest';
function textFromResponse(json:any){if(typeof json?.output_text==='string')return json.output_text;const parts:string[]=[];for(const item of json?.output||[]){for(const c of item?.content||[]){if(typeof c?.text==='string')parts.push(c.text)}}return parts.join('\n').trim()}
function parseJson(text:string){return JSON.parse(String(text||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim())}
function validUrl(v:any){const s=String(v||'').trim();return /^https?:\/\//i.test(s)?s:''}
function youtubeId(url:string){try{const u=new URL(url);if(u.hostname.includes('youtu.be'))return u.pathname.replace(/^\//,'').split('/')[0];if(u.hostname.includes('youtube.com'))return u.searchParams.get('v')||u.pathname.match(/\/shorts\/([^/?]+)/)?.[1]||''}catch{}return ''}
async function getDb(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return null;return createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}

export async function GET(){const auth=createClient();const {data:{user}}=await auth.auth.getUser();if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});const db=await getDb();if(!db)return NextResponse.json({error:'Supabase admin credentials missing'},{status:503});const {data}=await db.from('site_settings').select('setting_value').eq('setting_key',KEY).maybeSingle();let scan=null;try{scan=data?.setting_value?JSON.parse(data.setting_value):null}catch{}return NextResponse.json({scan});}

export async function POST(request:Request){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});
 const db=await getDb();if(!db)return NextResponse.json({error:'Supabase admin credentials missing'},{status:503});
 const apiKey=process.env.OPENAI_API_KEY;if(!apiKey)return NextResponse.json({error:'OPENAI_API_KEY is not configured'},{status:503});
 const input=await request.json().catch(()=>({}));const focus=String(input.focus||'New official music videos across R&B, hip-hop, soul, pop, Afrobeats and adjacent genres, from independent and major artists').slice(0,1200);const count=Math.min(20,Math.max(5,Number(input.count||12)));const days=Math.min(30,Math.max(3,Number(input.days||14)));
 const prompt=`You are Indie Cut's music-video discovery editor. Use live web search to find up to ${count} music videos released or newly gaining meaningful attention in the last ${days} days. Focus on ${focus}.

Include both independent and major-label artists. Strongly prioritize official uploads from the artist's verified/official YouTube channel, Vevo channel, or record-label channel. Do not return fan uploads, lyric reposts, reaction videos, unauthorized mirrors, Shorts when a full official video exists, or videos where the official status cannot be reasonably verified.

For every lead, classify artist_tier as independent, major, or unknown. Give a 0-100 momentum score based on recency, visibility, credible press/social signals, and editorial relevance. Do not invent view counts, release dates, labels, quotes, or channel names. Prefer the direct official YouTube watch URL. Include at least one corroborating source URL when possible.

Return ONLY valid JSON in this shape: {"videos":[{"artist_name":"","song_title":"","video_title":"","genre":"","artist_tier":"independent|major|unknown","official_video_url":"https://www.youtube.com/watch?v=...","channel_name":"","release_date":"YYYY-MM-DD or blank","why_feature":"2-4 sentence evidence-based reason to feature it","momentum_score":0,"thumbnail_url":"","sources":["https://..."],"discovered_at":"ISO timestamp"}]}.`;
 const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',tools:[{type:'web_search'}],input:prompt,max_output_tokens:24000})});
 const j=await r.json().catch(()=>({}));if(!r.ok)return NextResponse.json({error:j?.error?.message||'Music-video research failed'},{status:502});
 let parsed:any;try{parsed=parseJson(textFromResponse(j))}catch{return NextResponse.json({error:'The music-video model returned invalid JSON'},{status:502})}
 const tiers=new Set(['independent','major','unknown']);const raw=Array.isArray(parsed?.videos)?parsed.videos.slice(0,count):[];
 const seen=new Set<string>();const videos=raw.map((v:any)=>{const official=validUrl(v.official_video_url);const id=youtubeId(official);if(!id||seen.has(id))return null;seen.add(id);return {artist_name:String(v.artist_name||'').trim(),song_title:String(v.song_title||'').trim(),video_title:String(v.video_title||'').trim(),genre:String(v.genre||'').trim(),artist_tier:tiers.has(String(v.artist_tier))?String(v.artist_tier):'unknown',official_video_url:official,channel_name:String(v.channel_name||'').trim(),release_date:String(v.release_date||'').trim(),why_feature:String(v.why_feature||'').trim(),momentum_score:Math.max(0,Math.min(100,Number(v.momentum_score||0))),thumbnail_url:validUrl(v.thumbnail_url)||`https://img.youtube.com/vi/${id}/hqdefault.jpg`,sources:Array.isArray(v.sources)?v.sources.map(validUrl).filter(Boolean).slice(0,6):[],discovered_at:String(v.discovered_at||new Date().toISOString())}}).filter((v:any)=>v&&v.artist_name&&v.song_title).sort((a:any,b:any)=>b.momentum_score-a.momentum_score);
 const scan={scanned_at:new Date().toISOString(),focus,days,count,videos};await db.from('site_settings').upsert({setting_key:KEY,setting_value:JSON.stringify(scan),updated_at:new Date().toISOString()},{onConflict:'setting_key'});return NextResponse.json(scan);
}
