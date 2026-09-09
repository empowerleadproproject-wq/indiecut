import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';

export async function GET(){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});
 return NextResponse.json({
  facebook:Boolean(process.env.META_PAGE_ID&&process.env.META_PAGE_ACCESS_TOKEN),
  instagram:Boolean(process.env.INSTAGRAM_USER_ID&&process.env.META_PAGE_ACCESS_TOKEN),
  tiktok:Boolean(process.env.TIKTOK_ACCESS_TOKEN&&process.env.TIKTOK_OPEN_ID)
 });
}
