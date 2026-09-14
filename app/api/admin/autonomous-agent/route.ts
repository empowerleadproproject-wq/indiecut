import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';
import {autonomousIntegrationStatus,getAutonomousDashboard,loadAutonomousState,newMission,runAutonomousCycle,saveAutonomousState,type AgentAutonomy,type AgentVertical} from '../../../../lib/autonomous-agent';

export const dynamic='force-dynamic';
export const maxDuration=300;

async function adminDb(){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();if(!user||!isAdminEmail(user.email))return {error:NextResponse.json({error:'Unauthorized'},{status:401})};
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return {error:NextResponse.json({error:'CRM database is not configured.'},{status:503})};
 return {db:createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})};
}

async function payload(db:any){const [state,integrations,dashboard]=await Promise.all([loadAutonomousState(db),autonomousIntegrationStatus(db),getAutonomousDashboard(db)]);return {state,integrations,dashboard};}

export async function GET(){const a=await adminDb();if(a.error)return a.error;return NextResponse.json(await payload(a.db));}

export async function POST(request:Request){
 const a=await adminDb();if(a.error)return a.error;const db=a.db;const body=await request.json().catch(()=>({}));const action=String(body.action||'');
 try{
  let state=await loadAutonomousState(db);
  if(action==='start'){
   const goal=String(body.goal||'').trim();if(goal.length<8)return NextResponse.json({error:'Describe the business outcome you want the agent to achieve.'},{status:400});
   const vertical=(['artist','restaurant','general'].includes(String(body.vertical))?String(body.vertical):'general') as AgentVertical;
   const autonomy=(String(body.autonomy)==='autopilot'?'autopilot':'guided') as AgentAutonomy;
   if(state.active_mission&&['active','paused'].includes(state.active_mission.status)){state.active_mission.status='stopped';state.active_mission.updated_at=new Date().toISOString();state.history=[{...state.active_mission},...(state.history||[])].slice(0,20)}
   state.active_mission=newMission(goal,vertical,autonomy);await saveAutonomousState(db,state);state=await runAutonomousCycle(db,state,'start',true);
  }else if(action==='run_now'){
   if(!state.active_mission)return NextResponse.json({error:'Start a mission first.'},{status:409});if(state.active_mission.status!=='active')return NextResponse.json({error:'Resume the mission before running another cycle.'},{status:409});state=await runAutonomousCycle(db,state,'manual',true);
  }else if(action==='pause'){
   if(!state.active_mission)return NextResponse.json({error:'There is no active mission.'},{status:409});state.active_mission.status='paused';state.active_mission.updated_at=new Date().toISOString();state.active_mission.next_run_at=null;await saveAutonomousState(db,state);
  }else if(action==='resume'){
   if(!state.active_mission)return NextResponse.json({error:'There is no mission to resume.'},{status:409});state.active_mission.status='active';state.active_mission.updated_at=new Date().toISOString();state.active_mission.next_run_at=new Date().toISOString();await saveAutonomousState(db,state);
  }else if(action==='stop'){
   if(!state.active_mission)return NextResponse.json({error:'There is no active mission.'},{status:409});state.active_mission.status='stopped';state.active_mission.updated_at=new Date().toISOString();state.active_mission.next_run_at=null;state.history=[{...state.active_mission},...(state.history||[])].slice(0,20);state.active_mission=null;await saveAutonomousState(db,state);
  }else if(action==='set_autonomy'){
   if(!state.active_mission)return NextResponse.json({error:'There is no active mission.'},{status:409});state.active_mission.autonomy=String(body.autonomy)==='autopilot'?'autopilot':'guided';state.active_mission.updated_at=new Date().toISOString();await saveAutonomousState(db,state);
  }else if(action==='configure'){
   state.config.cycle_minutes=Math.max(15,Math.min(1440,Number(body.cycle_minutes||state.config.cycle_minutes||60)));state.config.max_actions_per_cycle=Math.max(1,Math.min(8,Number(body.max_actions_per_cycle||state.config.max_actions_per_cycle||5)));await saveAutonomousState(db,state);
  }else return NextResponse.json({error:'Unknown autonomous agent action.'},{status:400});
  return NextResponse.json({ok:true,...await payload(db)});
 }catch(e:any){return NextResponse.json({error:e?.message||'Autonomous agent request failed.'},{status:500});}
}
