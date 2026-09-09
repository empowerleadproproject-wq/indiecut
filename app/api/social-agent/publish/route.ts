import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';
export const maxDuration=120;
const SITE_URL=(process.env.NEXT_PUBLIC_SITE_URL||'https://indiecut.vercel.app').replace(/\/$/,'');
function textFromResponse(json:any){if(typeof json?.output_text==='string')return json.output_text;const parts:string[]=[];for(const item of json?.output||[]){for(const c of item?.content||[]){if(typeof c?.text==='string')parts.push(c.text)}}return parts.join('\n').trim()}

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
 if(article.featured_media_url&&/^https?:\/\//i.test(article.featured_media_url))body.set('link',link||article.featured_media_url);else if(link)body.set('link',link);
 const r=await fetch(`https://graph.facebook.com/v23.0/${pageId}/feed`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
 const j=await r.json().catch(()=>({}));
 return r.ok?{ok:true,id:j.id}:{ok:false,reason:j?.error?.message||'Facebook post failed'};
}

async function postInstagram(article:any,caption:string,link:string,connection:MetaConnection){
 const ig=connection.instagram_user_id||process.env.INSTAGRAM_USER_ID;
 const token=connection.facebook_page_access_token||process.env.META_PAGE_ACCESS_TOKEN;
 if(!ig||!token)return {ok:false,reason:'Instagram not connected'};
 const image=String(article.featured_media_url||'');
 if(!/^https?:\/\//i.test(image)||/\.(mp4|webm|mov|m4v)(\?|$)/i.test(image))return {ok:false,reason:'Instagram auto-post requires a public image on the article'};
 const createBody=new URLSearchParams({access_token:token,image_url:image,caption:`${caption}${link?`\n\n${link}`:''}`});
 const c=await fetch(`https://graph.facebook.com/v23.0/${ig}/media`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:createBody});
 const cj=await c.json().catch(()=>({}));
 if(!c.ok||!cj.id)return {ok:false,reason:cj?.error?.message||'Instagram media creation failed'};
 const pBody=new URLSearchParams({access_token:token,creation_id:cj.id});
 const p=await fetch(`https://graph.facebook.com/v23.0/${ig}/media_publish`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:pBody});
 const pj=await p.json().catch(()=>({}));
 return p.ok?{ok:true,id:pj.id}:{ok:false,reason:pj?.error?.message||'Instagram publish failed'};
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

 const [{data:article},{data:setting},{data:metaSetting}]=await Promise.all([
  db.from('articles').select('*').eq('id',articleId).eq('status','published').maybeSingle(),
  db.from('site_settings').select('setting_value').eq('setting_key','admin_social_agent').maybeSingle(),
  db.from('site_settings').select('setting_value').eq('setting_key','social_meta_connection').maybeSingle()
 ]);
 if(!article)return NextResponse.json({error:'Published article not found'},{status:404});

 let settings:any={enabled:false,auto_post_on_publish:false,facebook:true,instagram:true,tiktok:false,include_link:true,include_hashtags:true};
 try{if(setting?.setting_value)settings={...settings,...JSON.parse(setting.setting_value)}}catch{}
 let connection:MetaConnection={};
 try{if(metaSetting?.setting_value)connection=JSON.parse(metaSetting.setting_value)||{}}catch{}

 if(!settings.enabled||!settings.auto_post_on_publish)return NextResponse.json({ok:true,skipped:'Social Media Agent auto-post is off.'});
 const link=settings.include_link===false?'':`${SITE_URL}/articles/${encodeURIComponent(article.slug)}`;
 const caption=await makeCaption(article,settings);
 const results:any={};
 if(settings.facebook)results.facebook=await postFacebook(article,caption,link,connection);
 if(settings.instagram)results.instagram=await postInstagram(article,caption,link,connection);
 if(settings.tiktok)results.tiktok={ok:false,reason:process.env.TIKTOK_ACCESS_TOKEN&&process.env.TIKTOK_OPEN_ID?'TikTok connection detected; direct publishing requires the approved Content Posting flow for the selected media type.':'TikTok not connected'};
 await db.from('site_settings').upsert({setting_key:`social_post_${article.id}`,setting_value:JSON.stringify({article_id:article.id,headline:article.headline,created_at:new Date().toISOString(),results}),updated_at:new Date().toISOString()},{onConflict:'setting_key'});
 return NextResponse.json({ok:true,caption,results});
}
