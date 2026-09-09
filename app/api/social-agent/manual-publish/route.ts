import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';
export const maxDuration=120;
const SITE_URL=(process.env.NEXT_PUBLIC_SITE_URL||'https://indiecut.vercel.app').replace(/\/$/,'');

type MetaConnection={facebook_page_id?:string;facebook_page_name?:string;facebook_page_access_token?:string;instagram_user_id?:string;instagram_username?:string};

async function postFacebook(article:any,caption:string,link:string,connection:MetaConnection){
 const pageId=connection.facebook_page_id||process.env.META_PAGE_ID;
 const token=connection.facebook_page_access_token||process.env.META_PAGE_ACCESS_TOKEN;
 if(!pageId||!token)return {ok:false,reason:'Facebook not connected'};
 const body=new URLSearchParams({access_token:token,message:`${caption}${link&& !caption.includes(link)?`\n\n${link}`:''}`});
 if(link)body.set('link',link);
 const r=await fetch(`https://graph.facebook.com/v23.0/${pageId}/feed`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
 const j=await r.json().catch(()=>({}));
 return r.ok?{ok:true,id:j.id}:{ok:false,reason:j?.error?.message||'Facebook post failed'};
}

async function postInstagram(article:any,caption:string,link:string,connection:MetaConnection){
 const ig=connection.instagram_user_id||process.env.INSTAGRAM_USER_ID;
 const token=connection.facebook_page_access_token||process.env.META_PAGE_ACCESS_TOKEN;
 if(!ig||!token)return {ok:false,reason:'Instagram not connected'};
 const image=String(article.featured_media_url||'');
 if(!/^https?:\/\//i.test(image)||/\.(mp4|webm|mov|m4v)(\?|$)/i.test(image))return {ok:false,reason:'Instagram direct posting currently requires a public featured image on the article'};
 const finalCaption=`${caption}${link&& !caption.includes(link)?`\n\n${link}`:''}`;
 const createBody=new URLSearchParams({access_token:token,image_url:image,caption:finalCaption});
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
 const platform=String(input.platform||'').toLowerCase();
 const caption=String(input.caption||'').trim();
 if(!articleId||!caption||!['facebook','instagram'].includes(platform))return NextResponse.json({error:'article_id, caption and a supported platform are required'},{status:400});

 const [{data:article},{data:metaSetting}]=await Promise.all([
  db.from('articles').select('*').eq('id',articleId).eq('status','published').maybeSingle(),
  db.from('site_settings').select('setting_value').eq('setting_key','social_meta_connection').maybeSingle()
 ]);
 if(!article)return NextResponse.json({error:'Published article not found'},{status:404});
 let connection:MetaConnection={};
 try{if(metaSetting?.setting_value)connection=JSON.parse(metaSetting.setting_value)||{}}catch{}
 const link=`${SITE_URL}/articles/${encodeURIComponent(article.slug)}`;
 const result=platform==='facebook'?await postFacebook(article,caption,link,connection):await postInstagram(article,caption,link,connection);
 await db.from('site_settings').upsert({setting_key:`social_manual_${article.id}_${platform}`,setting_value:JSON.stringify({article_id:article.id,headline:article.headline,platform,created_at:new Date().toISOString(),result}),updated_at:new Date().toISOString()},{onConflict:'setting_key'});
 if(!result.ok)return NextResponse.json({error:result.reason||'Publish failed',result},{status:400});
 return NextResponse.json({ok:true,platform,result});
}
