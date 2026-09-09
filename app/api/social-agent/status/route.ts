import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';
export async function GET(){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});
 let meta:any={};const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(url&&key){const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data}=await db.from('site_settings').select('setting_value').eq('setting_key','social_meta_connection').maybeSingle();try{meta=JSON.parse(data?.setting_value||'{}')}catch{}}
 const legacyFacebook=Boolean(process.env.META_PAGE_ID&&process.env.META_PAGE_ACCESS_TOKEN);const legacyInstagram=Boolean(process.env.INSTAGRAM_USER_ID&&process.env.META_PAGE_ACCESS_TOKEN);
 return NextResponse.json({facebook:Boolean(meta.facebook_page_id&&meta.facebook_page_access_token)||legacyFacebook,facebook_name:meta.facebook_page_name||'',instagram:Boolean(meta.instagram_user_id&&meta.facebook_page_access_token)||legacyInstagram,instagram_username:meta.instagram_username||'',tiktok:Boolean(process.env.TIKTOK_ACCESS_TOKEN&&process.env.TIKTOK_OPEN_ID),meta_app_ready:Boolean(process.env.META_APP_ID&&process.env.META_APP_SECRET)});
}
