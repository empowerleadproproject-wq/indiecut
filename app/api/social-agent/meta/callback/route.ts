import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../../lib/admin';

export const dynamic='force-dynamic';
const GRAPH='https://graph.facebook.com/v23.0';
function back(request:Request,key:string,value:string){return NextResponse.redirect(new URL(`/admin/social-agent?${key}=${encodeURIComponent(value)}`,request.url))}

async function graph(path:string,token:string){
 const joiner=path.includes('?')?'&':'?';
 const r=await fetch(`${GRAPH}/${path}${joiner}access_token=${encodeURIComponent(token)}`,{cache:'no-store'});
 const j=await r.json().catch(()=>({}));
 return {ok:r.ok,json:j};
}

function firstInstagram(...candidates:any[]){
 for(const candidate of candidates){
  if(candidate?.id)return {id:String(candidate.id),username:String(candidate.username||'')};
  if(Array.isArray(candidate?.data)&&candidate.data[0]?.id)return {id:String(candidate.data[0].id),username:String(candidate.data[0].username||'')};
 }
 return null;
}

export async function GET(request:Request){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();if(!user||!isAdminEmail(user.email))return NextResponse.redirect(new URL('/admin/login',request.url));
 const u=new URL(request.url);const code=u.searchParams.get('code');const state=u.searchParams.get('state');const expected=cookies().get('indiecut_meta_oauth_state')?.value;
 if(!code||!state||!expected||state!==expected)return back(request,'meta_error','Invalid or expired Meta authorization. Please try again.');
 const appId=process.env.META_APP_ID,secret=process.env.META_APP_SECRET;if(!appId||!secret)return back(request,'meta_error','META_APP_ID or META_APP_SECRET is missing in Vercel.');
 const origin=process.env.NEXT_PUBLIC_SITE_URL||u.origin;const redirectUri=`${origin.replace(/\/$/,'')}/api/social-agent/meta/callback`;
 try{
  const tokenRes=await fetch(`${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${encodeURIComponent(secret)}&code=${encodeURIComponent(code)}`,{cache:'no-store'});
  const token=await tokenRes.json();if(!tokenRes.ok||!token.access_token)throw new Error(token?.error?.message||'Meta token exchange failed.');

  // Facebook Login for Business can return a system-user token. Keep that token as the
  // canonical connection token. If Meta allows an exchange, use the exchanged token.
  let userToken=String(token.access_token);
  const longRes=await fetch(`${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(secret)}&fb_exchange_token=${encodeURIComponent(userToken)}`,{cache:'no-store'});
  const long=await longRes.json().catch(()=>({}));
  if(longRes.ok&&long?.access_token)userToken=String(long.access_token);

  // Business Login system-user tokens expose the selected Page assets through /me?fields=accounts.
  // Fall back to /me/accounts because Meta still returns that shape for some configurations.
  const selected=await graph('me?fields=accounts{name,id,business,access_token}',userToken);
  const selectedPages=Array.isArray(selected.json?.accounts?.data)?selected.json.accounts.data:[];
  const legacy=await graph('me/accounts?fields=id,name,business,access_token',userToken);
  const legacyPages=Array.isArray(legacy.json?.data)?legacy.json.data:[];
  const list=[...selectedPages,...legacyPages].filter((p:any,i:number,a:any[])=>p?.id&&a.findIndex((x:any)=>String(x?.id)===String(p.id))===i);
  const page=list.find((p:any)=>String(p.name||'').trim().toLowerCase()==='indie cut')||list[0];
  if(!page?.id)throw new Error('No manageable Facebook Page was returned. Make sure you selected the Indie Cut Page during authorization.');
  const pageToken=String(page.access_token||userToken);

  // Do not rely on only instagram_business_account. Facebook Login for Business can expose
  // a selected IG professional asset through connected_instagram_account / instagram_accounts,
  // depending on the Page/account setup and Graph response shape.
  const pageDetails=await graph(`${encodeURIComponent(String(page.id))}?fields=instagram_business_account{id,username},connected_instagram_account{id,username},instagram_accounts{id,username}`,pageToken);
  let instagram=firstInstagram(
   pageDetails.json?.instagram_business_account,
   pageDetails.json?.connected_instagram_account,
   pageDetails.json?.instagram_accounts
  );

  // Business-portfolio fallback for system-user tokens. This is especially important when
  // the IG asset was explicitly selected in the Facebook Login for Business dialog.
  if(!instagram){
   const businesses=await graph('me/businesses?fields=id,name,instagram_accounts{id,username}',userToken);
   for(const business of Array.isArray(businesses.json?.data)?businesses.json.data:[]){
    instagram=firstInstagram(business?.instagram_accounts);
    if(instagram)break;
   }
  }

  // Final Page edge fallback used by newer Graph responses.
  if(!instagram){
   const edge=await graph(`${encodeURIComponent(String(page.id))}/instagram_accounts?fields=id,username`,pageToken);
   instagram=firstInstagram(edge.json);
  }

  const value={
   facebook_page_id:String(page.id),
   facebook_page_name:String(page.name||'Indie Cut'),
   facebook_page_access_token:pageToken,
   instagram_user_id:instagram?.id||'',
   instagram_username:instagram?.username||'',
   connected_at:new Date().toISOString()
  };
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error('Supabase service credentials are missing.');const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await db.from('site_settings').upsert({setting_key:'social_meta_connection',setting_value:JSON.stringify(value),updated_at:new Date().toISOString()},{onConflict:'setting_key'});if(error)throw new Error(error.message);
  const response=back(request,'meta','connected');response.cookies.delete('indiecut_meta_oauth_state');return response;
 }catch(e:any){return back(request,'meta_error',e?.message||'Meta connection failed.');}
}
