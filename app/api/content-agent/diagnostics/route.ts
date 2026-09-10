import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';
const STATUS_KEY='content_agent_last_schedule_status';

export async function GET(){
 const auth=createClient();
 const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});

 const env={
  cron_secret:!!process.env.CRON_SECRET,
  openai:!!process.env.OPENAI_API_KEY,
  supabase_url:!!process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabase_service_role:!!process.env.SUPABASE_SERVICE_ROLE_KEY
 };
 let last_status:any=null;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(url&&key){
  const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data}=await db.from('site_settings').select('setting_value').eq('setting_key',STATUS_KEY).maybeSingle();
  try{if(data?.setting_value)last_status=JSON.parse(data.setting_value)}catch{}
 }
 return NextResponse.json({ok:true,env,last_status});
}
