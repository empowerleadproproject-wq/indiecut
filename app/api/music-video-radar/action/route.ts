import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {isAdminEmail} from '../../../../lib/admin';

function validUrl(v:any){const s=String(v||'').trim();return /^https?:\/\//i.test(s)?s:''}
function youtubeId(url:string){try{const u=new URL(url);if(u.hostname.includes('youtu.be'))return u.pathname.replace(/^\//,'').split('/')[0];if(u.hostname.includes('youtube.com'))return u.searchParams.get('v')||u.pathname.match(/\/shorts\/([^/?]+)/)?.[1]||''}catch{}return ''}

export async function POST(request:Request){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return NextResponse.json({error:'Supabase admin credentials missing'},{status:503});
 const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const body=await request.json().catch(()=>({}));if(body.action!=='publish_to_watch')return NextResponse.json({error:'Unknown action'},{status:400});
 const v=body.video||{};const mediaUrl=validUrl(v.official_video_url);const id=youtubeId(mediaUrl);if(!id)return NextResponse.json({error:'A valid official YouTube video is required'},{status:400});
 const {data:existing}=await db.from('media_items').select('id,title').eq('media_url',mediaUrl).maybeSingle();if(existing)return NextResponse.json({ok:true,message:`Already published to Watch: ${existing.title}`});
 const artist=String(v.artist_name||'').trim();const song=String(v.song_title||'').trim();if(!artist||!song)return NextResponse.json({error:'Artist and song title are required'},{status:400});
 const title=String(v.video_title||'').trim()||`${artist} — ${song}`;const description=[String(v.why_feature||'').trim(),v.channel_name?`Official video source: ${String(v.channel_name).trim()}.`:''].filter(Boolean).join(' ');
 const payload={title,media_type:'music_video',artist_name:artist,description,media_url:mediaUrl,cover_url:validUrl(v.thumbnail_url)||`https://img.youtube.com/vi/${id}/hqdefault.jpg`,featured:false};
 const {data,error}=await db.from('media_items').insert(payload).select().single();if(error)return NextResponse.json({error:error.message},{status:400});
 return NextResponse.json({ok:true,row:data,message:`Published ${artist} — ${song} to Indie Cut Watch.`});
}
