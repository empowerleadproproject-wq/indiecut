import {NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../../lib/admin';

export const dynamic='force-dynamic';

// INDIE V1 Facebook Login for Business configuration.
// Keep the env override so the configuration can be rotated later without a code change.
const DEFAULT_META_LOGIN_CONFIG_ID='2254016548723105';

export async function GET(request:Request){
 const auth=createClient();
 const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return NextResponse.redirect(new URL('/admin/login',request.url));

 const appId=process.env.META_APP_ID;
 const configId=process.env.META_LOGIN_CONFIG_ID||DEFAULT_META_LOGIN_CONFIG_ID;
 if(!appId)return NextResponse.redirect(new URL('/admin/social-agent?meta_error=META_APP_ID+is+missing+in+Vercel',request.url));

 const origin=process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin;
 const redirectUri=`${origin.replace(/\/$/,'')}/api/social-agent/meta/callback`;
 const state=crypto.randomUUID();
 const oauth=new URL('https://www.facebook.com/v23.0/dialog/oauth');
 oauth.searchParams.set('client_id',appId);
 oauth.searchParams.set('redirect_uri',redirectUri);
 oauth.searchParams.set('state',state);
 oauth.searchParams.set('config_id',configId);
 oauth.searchParams.set('response_type','code');
 oauth.searchParams.set('override_default_response_type','true');

 const response=NextResponse.redirect(oauth.toString());
 response.cookies.set('indiecut_meta_oauth_state',state,{httpOnly:true,secure:true,sameSite:'lax',maxAge:600,path:'/'});
 return response;
}
