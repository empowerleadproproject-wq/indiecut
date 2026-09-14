import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {loadAutonomousState,runAutonomousCycle} from '../../../../lib/autonomous-agent';

export const dynamic='force-dynamic';
export const maxDuration=300;

export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(secret&&request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:'CRM database is not configured.'},{status:503});
 const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const before=await loadAutonomousState(db);
  if(!before.active_mission||before.active_mission.status!=='active')return NextResponse.json({ok:true,ran:false,reason:'No active autonomous CRM mission.'});
  const due=!before.active_mission.next_run_at||new Date(before.active_mission.next_run_at).getTime()<=Date.now();
  if(!due)return NextResponse.json({ok:true,ran:false,reason:'Mission is active but not due yet.',next_run_at:before.active_mission.next_run_at});
  const after=await runAutonomousCycle(db,before,'cron',false);
  return NextResponse.json({ok:true,ran:true,active_mission:after.active_mission?{id:after.active_mission.id,status:after.active_mission.status,progress:after.active_mission.progress,next_run_at:after.active_mission.next_run_at}:null,latest_run:after.runs?.[0]||null});
 }catch(e:any){return NextResponse.json({error:e?.message||'Autonomous CRM cron failed.'},{status:500});}
}
