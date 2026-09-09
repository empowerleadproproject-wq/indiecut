import {NextResponse} from 'next/server';
import {createClient} from '../../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../../lib/admin';

export const dynamic='force-dynamic';

export async function GET(request:Request){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return NextResponse.redirect(new URL('/admin/login',request.url));
 const appId=process.env.META_APP_ID;if(!appId)return NextResponse.redirect(new URL('/admin/social-agent?meta_error=META_APP_ID+is+missing+in+Vercel',request.url));
 const origin=process.env.NEXT_PUBLIC_SITE_URL||new URL(request.url).origin;
 const redirectUri=`${origin.replace(/\/$/,'')}/api/social-agent/meta/callback`;
 const state=crypto.randomUUID();
 const response=NextResponse.redirect(`https://www.facebook.com/v23.0/dialog/oauth?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent('pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish')}`);
 response.cookies.set('indiecut_meta_oauth_state',state,{httpOnly:true,secure:true,sameSite:'lax',maxAge:600,path:'/'});
 return response;
}
