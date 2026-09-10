import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';
export const maxDuration=120;
const SITE_URL=(process.env.NEXT_PUBLIC_SITE_URL||'https://indiecut.vercel.app').replace(/\/$/,'');
const GRAPH='https://graph.facebook.com/v23.0';

type MetaConnection={facebook_page_id?:string;facebook_page_name?:string;facebook_page_access_token?:string;instagram_user_id?:string;instagram_username?:string};
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const isVideoUrl=(url:string)=>/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);

async function waitForInstagramContainer(id:string,token:string){
 for(let i=0;i<40;i++){
  const r=await fetch(`${GRAPH}/${encodeURIComponent(id)}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,{cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  const code=String(j?.status_code||'').toUpperCase();
  if(code==='FINISHED')return {ok:true};
  if(code==='ERROR'||code==='EXPIRED')return {ok:false,reason:j?.status||`Instagram media container ${code.toLowerCase()}`};
  await sleep(2000);
 }
 return {ok:false,reason:'Instagram media was still processing. Please try the post again.'};
}

async function postFacebook(article:any,caption:string,link:string,connection:MetaConnection){
 const pageId=connection.facebook_page_id||process.env.META_PAGE_ID;
 const token=connection.facebook_page_access_token||process.env.META_PAGE_ACCESS_TOKEN;
 if(!pageId||!token)return {ok:false,reason:'Facebook not connected'};
 const body=new URLSearchParams({access_token:token,message:`${caption}${link&&!caption.includes(link)?`\n\n${link}`:''}`});
 if(link)body.set('link',link);
 const r=await fetch(`${GRAPH}/${pageId}/feed`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
 const j=await r.json().catch(()=>({}));
 return r.ok?{ok:true,id:j.id}:{ok:false,reason:j?.error?.message||'Facebook post failed'};
}

async function postInstagram(article:any,caption:string,link:string,connection:MetaConnection){
 const ig=connection.instagram_user_id||process.env.INSTAGRAM_USER_ID;
 const token=connection.facebook_page_access_token||process.env.META_PAGE_ACCESS_TOKEN;
 if(!ig||!token)return {ok:false,reason:'Instagram not connected'};
 const source=String(article.featured_media_url||'').trim();
 if(!/^https?:\/\//i.test(source))return {ok:false,reason:'Instagram direct posting requires public featured media on the article'};
 const finalCaption=`${caption}${link&&!caption.includes(link)?`\n\n${link}`:''}`;
 const video=isVideoUrl(source);
 const createBody=video
  ? new URLSearchParams({access_token:token,media_type:'REELS',video_url:source,caption:finalCaption,share_to_feed:'true'})
  : new URLSearchParams({access_token:token,image_url:`${SITE_URL}/api/social-agent/instagram-image?article_id=${encodeURIComponent(article.id)}&v=${Date.now()}`,caption:finalCaption});
 const c=await fetch(`${GRAPH}/${ig}/media`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:createBody});
 const cj=await c.json().catch(()=>({}));
 if(!c.ok||!cj.id)return {ok:false,reason:cj?.error?.message||`Instagram ${video?'Reel':'media'} creation failed`};
 const ready=await waitForInstagramContainer(String(cj.id),token);
 if(!ready.ok)return {ok:false,reason:ready.reason};
 const pBody=new URLSearchParams({access_token:token,creation_id:String(cj.id)});
 const p=await fetch(`${GRAPH}/${ig}/media_publish`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:pBody});
 const pj=await p.json().catch(()=>({}));
 return p.ok&&pj?.id?{ok:true,id:pj.id,type:video?'reel':'image'}:{ok:false,reason:pj?.error?.message||`Instagram ${video?'Reel':'post'} publish failed`};
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
 const platform=String(input.platform||'').toLowerCase();
 const caption=String(input.caption||'').trim();
 const facebookCaption=String(input.facebook_caption||caption).trim();
 const instagramCaption=String(input.instagram_caption||caption).trim();
 if(!articleId||!['facebook','instagram','both'].includes(platform))return NextResponse.json({error:'article_id and a supported platform are required'},{status:400});
 if(platform==='facebook'&&!facebookCaption)return NextResponse.json({error:'Facebook caption is required'},{status:400});
 if(platform==='instagram'&&!instagramCaption)return NextResponse.json({error:'Instagram caption is required'},{status:400});
 if(platform==='both'&&(!facebookCaption||!instagramCaption))return NextResponse.json({error:'Facebook and Instagram captions are required'},{status:400});

 const [{data:article},{data:metaSetting}]=await Promise.all([
  db.from('articles').select('*').eq('id',articleId).eq('status','published').maybeSingle(),
  db.from('site_settings').select('setting_value').eq('setting_key','social_meta_connection').maybeSingle()
 ]);
 if(!article)return NextResponse.json({error:'Published article not found'},{status:404});
 let connection:MetaConnection={};
 try{if(metaSetting?.setting_value)connection=JSON.parse(metaSetting.setting_value)||{}}catch{}
 const link=`${SITE_URL}/articles/${encodeURIComponent(article.slug)}`;

 if(platform==='both'){
  const [facebook,instagram]=await Promise.all([
   postFacebook(article,facebookCaption,link,connection),
   postInstagram(article,instagramCaption,link,connection)
  ]);
  const result={facebook,instagram};
  await db.from('site_settings').upsert({setting_key:`social_manual_${article.id}_both`,setting_value:JSON.stringify({article_id:article.id,headline:article.headline,platform:'both',created_at:new Date().toISOString(),result}),updated_at:new Date().toISOString()},{onConflict:'setting_key'});
  const ok=facebook.ok&&instagram.ok;
  return NextResponse.json({ok,platform:'both',result,...(!ok?{error:[!facebook.ok?`Facebook: ${facebook.reason}`:'',!instagram.ok?`Instagram: ${instagram.reason}`:''].filter(Boolean).join(' | ')}:{})},{status:ok?200:400});
 }

 const result=platform==='facebook'?await postFacebook(article,facebookCaption,link,connection):await postInstagram(article,instagramCaption,link,connection);
 await db.from('site_settings').upsert({setting_key:`social_manual_${article.id}_${platform}`,setting_value:JSON.stringify({article_id:article.id,headline:article.headline,platform,created_at:new Date().toISOString(),result}),updated_at:new Date().toISOString()},{onConflict:'setting_key'});
 if(!result.ok)return NextResponse.json({error:result.reason||'Publish failed',result},{status:400});
 return NextResponse.json({ok:true,platform,result});
}
