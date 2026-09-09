import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

const KEY='content_agent_config';
const DEFAULTS={enabled:true,default_topic:'top current entertainment news involving Black culture, movies, television, music, celebrities and independent creators',default_count:3,require_multiple_sources:true,reject_rumors:true,frequency:'daily',cron_hour:9,cron_day:1,cron_timezone:'America/New_York'};

async function adminDb(){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return {error:NextResponse.json({error:'Unauthorized'},{status:401})};
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return {error:NextResponse.json({error:'Supabase service credentials missing'},{status:503})};
 return {db:createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})};
}

export async function GET(){
 const a=await adminDb();if(a.error)return a.error;const db=a.db!;
 const {data,error}=await db.from('site_settings').select('setting_value').eq('setting_key',KEY).maybeSingle();
 if(error)return NextResponse.json({error:error.message},{status:400});
 let config:any={...DEFAULTS};try{if(data?.setting_value)config={...config,...JSON.parse(data.setting_value)}}catch{}
 return NextResponse.json({config});
}

export async function PUT(request:Request){
 const a=await adminDb();if(a.error)return a.error;const db=a.db!;
 const input=await request.json().catch(()=>({}));
 const config={...DEFAULTS,...input,default_count:Math.min(12,Math.max(1,Number(input.default_count||3))),cron_hour:Math.min(23,Math.max(0,Number(input.cron_hour??9))),cron_day:Math.min(6,Math.max(0,Number(input.cron_day??1))),frequency:['daily','weekdays','weekly'].includes(String(input.frequency))?String(input.frequency):'daily',cron_timezone:String(input.cron_timezone||'America/New_York')};
 const {error}=await db.from('site_settings').upsert({setting_key:KEY,setting_value:JSON.stringify(config),updated_at:new Date().toISOString()},{onConflict:'setting_key'});
 if(error)return NextResponse.json({error:error.message},{status:400});
 return NextResponse.json({ok:true,config});
}
