import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';
export const maxDuration=120;
const SITE_URL=(process.env.NEXT_PUBLIC_SITE_URL||'https://indiecut.info').replace(/\/$/,'');
const GRAPH='https://graph.facebook.com/v23.0';
function textFromResponse(json:any){if(typeof json?.output_text==='string')return json.output_text;const parts:string[]=[];for(const item of json?.output||[]){for(const c of item?.content||[]){if(typeof c?.text==='string')parts.push(c.text)}}return parts.join('\n').trim()}
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const isVideoUrl=(url:string)=>/\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(url||''));
const isHttp=(url:string)=>/^https?:\/\//i.test(String(url||''));

async function waitForInstagramContainer(id:string,token:string){
 for(let i=0;i<40;i++){
  const r=await fetch(`${GRAPH}/${encodeURIComponent(id)}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,{cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  const code=String(j?.status_code||'').toUpperCase();
  if(code==='FINISHED')return {ok:true};
  if(code==='ERROR'||code==='EXPIRED')return {ok:false,reason:j?.status||`Instagram media container ${code.toLowerCase()}`};
  await sleep(2000);
 }
 return {ok:false,reason:'Instagram media was still processing. Please try again.'};
}

async function makeCaption(article:any,settings:any){
 const fallback=`${article.headline}\n\n${article.subheadline||''}`.trim();
 const apiKey=process.env.OPENAI_API_KEY;if(!apiKey)return fallback;
 const prompt=`You are Indie Cut's social editor. Create ONE concise social caption for this published entertainment article. ${settings.caption_style||''} Do not add facts that are not in the article. Headline: ${article.headline}. Subheadline: ${article.subheadline||''}. Category: ${article.category||'entertainment'}. ${settings.include_hashtags!==false?'Add 2-4 relevant tasteful hashtags.':'Do not add hashtags.'} Return only the caption.`;
 try{const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',input:prompt,max_output_tokens:500})});const j=await r.json().catch(()=>({}));return r.ok?(textFromResponse(j)||fallback):fallback}catch{return fallback}
}

type MetaConnection={facebook_page_id?:string;facebook_page_name?:string;facebook_page_access_token?:string;instagram_user_id?:string;instagram_username?:string};

async function postFacebook(article:any,caption:string,link:string,connection:MetaConnection){
 const pageId=connection.facebook_page_id||process.env.META_PAGE_ID;
 const token=connection.facebook_page_access_token||process.env.META_PAGE_ACCESS_TOKEN;
 if(!pageId||!token)return {ok:false,reason:'Facebook not connected'};
 const body=new URLSearchParams({access_token:token,message:`${caption}${link?`\n\n${link}`:''}`});
 if(link)body.set('link',link);
 const r=await fetch(`${GRAPH}/${pageId}/feed`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
 const j=await r.json().catch(()=>({}));
 return r.ok?{ok:true,id:j.id}:{ok:false,reason:j?.error?.message||'Facebook post failed'};
}

async function ensureMediaBucket(db:any){
 const bucket='indiecut-media';
 try{
  const {data:buckets}=await db.storage.listBuckets();
  if(!(buckets||[]).some((b:any)=>b.name===bucket))await db.storage.createBucket(bucket,{public:true,fileSizeLimit:524288000});
 }catch{}
 return bucket;
}

async function materializeInstagramCard(db:any,article:any,origin:string){
 const featured=String(article.featured_media_url||'').trim();
 const fallback=isHttp(featured)&&!isVideoUrl(featured)?featured:'';
 try{
  const cardUrl=`${origin.replace(/\/$/,'')}/api/social-agent/instagram-image?article_id=${encodeURIComponent(article.id)}&v=${Date.now()}`;
  const card=await fetch(cardUrl,{cache:'no-store'});
  const type=String(card.headers.get('content-type')||'').split(';')[0].toLowerCase();
  if(!card.ok||!type.startsWith('image/'))return fallback;
  const bytes=new Uint8Array(await card.arrayBuffer());
  if(bytes.length<1000)return fallback;
  const bucket=await ensureMediaBucket(db);
  const ext=type.includes('jpeg')?'jpg':type.includes('webp')?'webp':'png';
  const path=`social/${article.id}/${Date.now()}.${ext}`;
  const {error}=await db.storage.from(bucket).upload(path,bytes,{contentType:type,upsert:false,cacheControl:'3600'});
  if(error)return fallback;
  const {data:pub}=db.storage.from(bucket).getPublicUrl(path);
  return String(pub?.publicUrl||fallback);
 }catch{return fallback}
}

async function postInstagram(article:any,music:any,caption:string,link:string,connection:MetaConnection,db:any,origin:string){
 const ig=connection.instagram_user_id||process.env.INSTAGRAM_USER_ID;
 const token=connection.facebook_page_access_token||process.env.META_PAGE_ACCESS_TOKEN;
 if(!ig||!token)return {ok:false,reason:'Instagram not connected'};
 const featured=String(article.featured_media_url||'').trim();
 const leadVideo=String(article.lead_video_url||'').trim();
 const musicMedia=String(music?.media_url||'').trim();
 const spotify=String(music?.spotify||'').trim();
 let finalCaption=`${caption}${link&&!caption.includes(link)?`\n\n${link}`:''}`;
 if(spotify&&isHttp(spotify)&&!finalCaption.includes(spotify))finalCaption+=`\n\nListen on Spotify: ${spotify}`;

 // Instagram Graph can publish a Reel only from a direct public video file URL.
 // YouTube/watch-page links stay embedded in the Indie Cut article; social falls back to the branded story card.
 const directVideo=[leadVideo,featured,musicMedia].find(v=>isHttp(v)&&isVideoUrl(v))||'';
 let createBody:URLSearchParams;
 let postType:'reel'|'image'='image';
 if(directVideo){
  postType='reel';
  createBody=new URLSearchParams({access_token:token,media_type:'REELS',video_url:directVideo,caption:finalCaption,share_to_feed:'true'});
 }else{
  const image=await materializeInstagramCard(db,article,origin);
  if(!image)return {ok:false,reason:'Instagram could not create a public story image for this article'};
  createBody=new URLSearchParams({access_token:token,image_url:image,caption:finalCaption});
 }

 const c=await fetch(`${GRAPH}/${ig}/media`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:createBody});
 const cj=await c.json().catch(()=>({}));
 if(!c.ok||!cj.id)return {ok:false,reason:cj?.error?.message||`Instagram ${postType==='reel'?'Reel':'media'} creation failed`};
 const ready=await waitForInstagramContainer(String(cj.id),token);
 if(!ready.ok)return {ok:false,reason:ready.reason};
 const pBody=new URLSearchParams({access_token:token,creation_id:String(cj.id)});
 const p=await fetch(`${GRAPH}/${ig}/media_publish`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:pBody});
 const pj=await p.json().catch(()=>({}));
 return p.ok&&pj?.id?{ok:true,id:pj.id,type:postType}:{ok:false,reason:pj?.error?.message||`Instagram ${postType==='reel'?'Reel':'post'} publish failed`};
}

export async function POST(request:Request){
 const auth=createClient();
 const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:'Supabase admin credentials missing'},{status:503});
 const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const input=await request.json().catch(()=>({}));
 const articleId=String(input.article_id||'');
 if(!articleId)return NextResponse.json({error:'Missing article_id'},{status:400});

 const [{data:article},{data:setting},{data:metaSetting},{data:musicSetting}]=await Promise.all([
  db.from('articles').select('*').eq('id',articleId).eq('status','published').maybeSingle(),
  db.from('site_settings').select('setting_value').eq('setting_key','admin_social_agent').maybeSingle(),
  db.from('site_settings').select('setting_value').eq('setting_key','social_meta_connection').maybeSingle(),
  db.from('site_settings').select('setting_value').eq('setting_key',`article_media_${articleId}`).maybeSingle()
 ]);
 if(!article)return NextResponse.json({error:'Published article not found'},{status:404});

 let settings:any={enabled:false,auto_post_on_publish:false,facebook:true,instagram:true,tiktok:false,include_link:true,include_hashtags:true};
 try{if(setting?.setting_value)settings={...settings,...JSON.parse(setting.setting_value)}}catch{}
 let connection:MetaConnection={};
 try{if(metaSetting?.setting_value)connection=JSON.parse(metaSetting.setting_value)||{}}catch{}
 let music:any=null;
 try{if(musicSetting?.setting_value)music=JSON.parse(musicSetting.setting_value)||null}catch{}

 if(!settings.enabled)return NextResponse.json({ok:true,skipped:'Social Media Agent is off.'});
 if(!settings.auto_post_on_publish&&!input.force)return NextResponse.json({ok:true,skipped:'Social Media Agent auto-post is off.'});
 const origin=new URL(request.url).origin||SITE_URL;
 const link=settings.include_link===false?'':`${SITE_URL}/articles/${encodeURIComponent(article.slug)}`;
 const caption=await makeCaption(article,settings);
 const results:any={};
 if(settings.facebook)results.facebook=await postFacebook(article,caption,link,connection);
 if(settings.instagram)results.instagram=await postInstagram(article,music,caption,link,connection,db,origin);
 if(settings.tiktok)results.tiktok={ok:false,reason:process.env.TIKTOK_ACCESS_TOKEN&&process.env.TIKTOK_OPEN_ID?'TikTok connection detected; direct publishing requires the approved Content Posting flow for the selected media type.':'TikTok not connected'};
 await db.from('site_settings').upsert({setting_key:`social_post_${article.id}`,setting_value:JSON.stringify({article_id:article.id,headline:article.headline,created_at:new Date().toISOString(),results}),updated_at:new Date().toISOString()},{onConflict:'setting_key'});
 return NextResponse.json({ok:true,caption,results});
}
