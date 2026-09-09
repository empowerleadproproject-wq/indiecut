import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../../lib/admin';

export const dynamic='force-dynamic';
const GRAPH='https://graph.facebook.com/v23.0';
function back(request:Request,key:string,value:string){return NextResponse.redirect(new URL(`/admin/social-agent?${key}=${encodeURIComponent(value)}`,request.url))}

export async function GET(request:Request){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();if(!user||!isAdminEmail(user.email))return NextResponse.redirect(new URL('/admin/login',request.url));
 const u=new URL(request.url);const code=u.searchParams.get('code');const state=u.searchParams.get('state');const expected=cookies().get('indiecut_meta_oauth_state')?.value;
 if(!code||!state||!expected||state!==expected)return back(request,'meta_error','Invalid or expired Meta authorization. Please try again.');
 const appId=process.env.META_APP_ID,secret=process.env.META_APP_SECRET;if(!appId||!secret)return back(request,'meta_error','META_APP_ID or META_APP_SECRET is missing in Vercel.');
 const origin=process.env.NEXT_PUBLIC_SITE_URL||u.origin;const redirectUri=`${origin.replace(/\/$/,'')}/api/social-agent/meta/callback`;
 try{
  const tokenRes=await fetch(`${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${encodeURIComponent(secret)}&code=${encodeURIComponent(code)}`,{cache:'no-store'});const token=await tokenRes.json();if(!tokenRes.ok||!token.access_token)throw new Error(token?.error?.message||'Meta token exchange failed.');
  const longRes=await fetch(`${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(secret)}&fb_exchange_token=${encodeURIComponent(token.access_token)}`,{cache:'no-store'});const long=await longRes.json();const userToken=long.access_token||token.access_token;
  const pagesRes=await fetch(`${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(userToken)}`,{cache:'no-store'});const pages=await pagesRes.json();if(!pagesRes.ok)throw new Error(pages?.error?.message||'Could not read your Facebook Pages.');
  const list=Array.isArray(pages.data)?pages.data:[];const page=list.find((p:any)=>String(p.name||'').trim().toLowerCase()==='indie cut')||list[0];if(!page?.id||!page?.access_token)throw new Error('No manageable Facebook Page was returned. Make sure you selected the Indie Cut Page during authorization.');
  const value={facebook_page_id:page.id,facebook_page_name:page.name||'Indie Cut',facebook_page_access_token:page.access_token,instagram_user_id:page.instagram_business_account?.id||'',instagram_username:page.instagram_business_account?.username||'',connected_at:new Date().toISOString()};
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Supabase service credentials are missing.');const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await db.from('site_settings').upsert({setting_key:'social_meta_connection',setting_value:JSON.stringify(value),updated_at:new Date().toISOString()},{onConflict:'setting_key'});if(error)throw new Error(error.message);
  const response=back(request,'meta','connected');response.cookies.delete('indiecut_meta_oauth_state');return response;
 }catch(e:any){return back(request,'meta_error',e?.message||'Meta connection failed.');}
}
