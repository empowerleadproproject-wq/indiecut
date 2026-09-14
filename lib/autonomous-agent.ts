import {randomUUID} from 'crypto';
import {enrollMatchingWorkflows} from './crm-workflows';
import {sendTextGridSms,textGridConfigured} from './textgrid';

export type AgentVertical='artist'|'restaurant'|'general';
export type AgentAutonomy='guided'|'autopilot';
export type MissionStatus='active'|'paused'|'completed'|'stopped';

export type AgentMission={
 id:string;
 goal:string;
 vertical:AgentVertical;
 autonomy:AgentAutonomy;
 status:MissionStatus;
 created_at:string;
 updated_at:string;
 last_run_at:string|null;
 next_run_at:string|null;
 cycles:number;
 progress:number;
 strategy:string;
 last_summary:string;
};

export type AgentRun={
 id:string;
 mission_id:string;
 started_at:string;
 completed_at:string;
 source:'manual'|'cron'|'start';
 summary:string;
 actions:Array<{type:string;status:'done'|'skipped'|'failed';detail:string}>;
 error?:string;
};

export type AutonomousAgentState={
 version:1;
 active_mission:AgentMission|null;
 history:AgentMission[];
 runs:AgentRun[];
 config:{cycle_minutes:number;max_actions_per_cycle:number};
};

const STATE_KEY='crm_autonomous_agent_state';
const DEFAULT_STATE:AutonomousAgentState={version:1,active_mission:null,history:[],runs:[],config:{cycle_minutes:60,max_actions_per_cycle:5}};

function cloneDefault():AutonomousAgentState{return JSON.parse(JSON.stringify(DEFAULT_STATE));}
function safeJson(value:any,fallback:any){try{return JSON.parse(String(value||''))}catch{return fallback}}
function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(max,n));}
function cleanText(v:any,max=5000){return String(v||'').trim().slice(0,max)}
function uniqueStrings(v:any){return Array.from(new Set((Array.isArray(v)?v:[]).map(x=>String(x||'').trim()).filter(Boolean)))}
function nextIso(minutes:number){return new Date(Date.now()+minutes*60000).toISOString()}
function textFromResponse(json:any){if(typeof json?.output_text==='string')return json.output_text;const parts:string[]=[];for(const item of json?.output||[])for(const c of item?.content||[])if(typeof c?.text==='string')parts.push(c.text);return parts.join('\n')}
function parseModelJson(text:string){return JSON.parse(String(text||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim())}

export async function loadAutonomousState(db:any):Promise<AutonomousAgentState>{
 const {data}=await db.from('site_settings').select('setting_value').eq('setting_key',STATE_KEY).maybeSingle();
 if(!data?.setting_value)return cloneDefault();
 const parsed=safeJson(data.setting_value,cloneDefault());
 return {...cloneDefault(),...parsed,config:{...DEFAULT_STATE.config,...(parsed?.config||{})},history:Array.isArray(parsed?.history)?parsed.history:[],runs:Array.isArray(parsed?.runs)?parsed.runs:[]};
}

export async function saveAutonomousState(db:any,state:AutonomousAgentState){
 state.history=(state.history||[]).slice(0,20);state.runs=(state.runs||[]).slice(0,40);
 const {error}=await db.from('site_settings').upsert({setting_key:STATE_KEY,setting_value:JSON.stringify(state),updated_at:new Date().toISOString()},{onConflict:'setting_key'});if(error)throw error;
 return state;
}

export async function autonomousIntegrationStatus(db:any){
 let meta:any={};const {data}=await db.from('site_settings').select('setting_value').eq('setting_key','social_meta_connection').maybeSingle();if(data?.setting_value)meta=safeJson(data.setting_value,{});
 return {
  ai:Boolean(process.env.OPENAI_API_KEY),
  crm:true,
  email:Boolean(process.env.RESEND_API_KEY&&process.env.INDIECUT_FROM_EMAIL),
  sms:textGridConfigured(),
  ghl:Boolean(process.env.GHL_PRIVATE_INTEGRATION_TOKEN&&process.env.GHL_LOCATION_ID),
  facebook:Boolean((meta.facebook_page_id&&meta.facebook_page_access_token)||(process.env.META_PAGE_ID&&process.env.META_PAGE_ACCESS_TOKEN)),
  instagram:Boolean((meta.instagram_user_id&&meta.facebook_page_access_token)||(process.env.INSTAGRAM_USER_ID&&process.env.META_PAGE_ACCESS_TOKEN))
 };
}

function countBy(rows:any[],key:string){const out:Record<string,number>={};for(const row of rows){const value=String(row?.[key]||'unknown').trim()||'unknown';out[value]=(out[value]||0)+1}return out}
function topEntries(map:Record<string,number>,limit=12){return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([name,count])=>({name,count}))}

export async function getAutonomousDashboard(db:any){
 const now=Date.now();
 const [{data:contacts},{data:tasks},{data:opportunities},{data:campaigns},{count:queued},{count:sent},{count:failed}]=await Promise.all([
  db.from('crm_contacts').select('id,status,genre,source,tags,email,email_opt_in,phone,sms_opt_in,created_at,last_contacted_at').order('updated_at',{ascending:false}).limit(1000),
  db.from('crm_tasks').select('id,status,priority,due_at').order('created_at',{ascending:false}).limit(500),
  db.from('crm_opportunities').select('id,stage,value,created_at,updated_at').order('updated_at',{ascending:false}).limit(500),
  db.from('crm_email_campaigns').select('id,name,status,scheduled_at,created_at').order('created_at',{ascending:false}).limit(50),
  db.from('crm_email_queue').select('*',{count:'exact',head:true}).eq('status','queued'),
  db.from('crm_email_queue').select('*',{count:'exact',head:true}).eq('status','sent'),
  db.from('crm_email_queue').select('*',{count:'exact',head:true}).eq('status','failed')
 ]);
 const c=contacts||[],t=tasks||[],o=opportunities||[];
 const tags:Record<string,number>={};for(const row of c)for(const tag of uniqueStrings(row.tags)){tags[tag]=(tags[tag]||0)+1}
 const openTasks=t.filter((x:any)=>x.status!=='done'&&x.status!=='completed');
 const overdue=openTasks.filter((x:any)=>x.due_at&&new Date(x.due_at).getTime()<now);
 const pipelineValue=o.filter((x:any)=>!['won','lost','closed'].includes(String(x.stage||'').toLowerCase())).reduce((sum:number,x:any)=>sum+Number(x.value||0),0);
 return {
  contacts:{total:c.length,email_opted_in:c.filter((x:any)=>x.email&&x.email_opt_in).length,sms_opted_in:c.filter((x:any)=>x.phone&&x.sms_opt_in).length,statuses:countBy(c,'status'),genres:topEntries(countBy(c,'genre')),sources:topEntries(countBy(c,'source')),top_tags:topEntries(tags)},
  tasks:{total:t.length,open:openTasks.length,overdue:overdue.length},
  opportunities:{total:o.length,pipeline_value:pipelineValue,stages:countBy(o,'stage')},
  email_queue:{queued:queued||0,sent:sent||0,failed:failed||0},
  recent_campaigns:(campaigns||[]).slice(0,10)
 };
}

const verticalPlaybooks:Record<AgentVertical,string>={
 artist:'Artist/music playbook: grow audience and relationships, nurture artists/fans, promote releases and events, surface press and social opportunities, keep follow-up organized, and move qualified opportunities forward.',
 restaurant:'Restaurant playbook: grow repeat business and catering, nurture leads, recover lapsed customers, improve follow-up, promote offers responsibly, and move catering or event opportunities forward.',
 general:'General business playbook: improve pipeline coverage, segment contacts, follow up consistently, nurture opted-in leads, create tasks, and move qualified opportunities forward.'
};

async function planCycle(mission:AgentMission,dashboard:any,integrations:any,maxActions:number){
 const key=process.env.OPENAI_API_KEY;
 if(!key)return {summary:'AI planning is waiting for OPENAI_API_KEY.',strategy:mission.strategy||verticalPlaybooks[mission.vertical],progress:mission.progress||0,mission_status:'active',next_check_minutes:60,actions:[{type:'create_task',title:'Connect the AI planning key',notes:'Add OPENAI_API_KEY so the autonomous CRM agent can plan and adapt each cycle.',priority:'high',due_days:0,reason:'The AI planner is not connected.'}]};
 const prompt=`You are the autonomous operating agent inside a multi-industry CRM. Your job is to make measurable progress toward ONE business goal by choosing a few concrete CRM actions, then come back later, inspect results and adapt.

MISSION GOAL: ${mission.goal}
VERTICAL: ${mission.vertical}
AUTONOMY MODE: ${mission.autonomy}
PLAYBOOK: ${verticalPlaybooks[mission.vertical]}
CURRENT STRATEGY: ${mission.strategy||'Not set yet'}
CURRENT PROGRESS: ${mission.progress||0}%
CRM SNAPSHOT: ${JSON.stringify(dashboard)}
CONNECTED TOOLS: ${JSON.stringify(integrations)}

You may choose ONLY these action types:
1) create_task: {type,title,notes,priority:"low|normal|high",due_days:0-30,reason}
2) create_opportunity: {type,title,value,stage:"new|contacted|qualified|proposal|won",notes,reason}
3) tag_contacts: {type,filter:{status?,genre?,source?,tag?},add_tag,reason}
4) set_status: {type,filter:{status?,genre?,source?,tag?},status:"lead|pending|approved|active|rejected|inactive",reason}
5) queue_email: {type,filter:{status?,genre?,source?,tag?},subject,body,reason}
6) send_sms: {type,filter:{status?,genre?,source?,tag?},body,reason}
7) sync_ghl: {type,filter:{status?,genre?,source?,tag?},reason}
8) no_op: {type,reason}

Operating rules:
- Choose at most ${maxActions} actions.
- Never invent contacts or metrics. Use filters that match the CRM snapshot.
- Email and SMS are only for contacts who explicitly opted in; the executor enforces this.
- In guided mode, email/SMS/GoHighLevel external actions become approval tasks instead of being sent automatically. You can still recommend them.
- In autopilot mode, external actions may execute when the integration is actually connected.
- Do not spam. Prefer small, targeted segments and useful messages. Avoid sending the same broad blast every cycle.
- Internal actions (tasks, opportunities, tags, status changes) should be specific and directly tied to the mission.
- If there is not enough data, create a task that improves the data or next step instead of fabricating activity.
- Progress is your estimate from 0-100 based on the CRM evidence, not optimism.
- Mark mission_status completed only when the goal is genuinely achieved from the available evidence.

Return ONLY valid JSON in this shape:
{"summary":"what you learned and what this cycle should accomplish","strategy":"updated 1-3 sentence strategy","progress":0,"mission_status":"active|completed","next_check_minutes":60,"actions":[...]}`;
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',input:prompt,max_output_tokens:6000})});
 const json=await response.json().catch(()=>({}));if(!response.ok)throw new Error(json?.error?.message||'Autonomous agent planning failed.');
 const plan=parseModelJson(textFromResponse(json));
 return {...plan,actions:Array.isArray(plan?.actions)?plan.actions.slice(0,maxActions):[]};
}

function applyFilter(rows:any[],filter:any){
 const f=filter||{};return rows.filter(row=>{
  if(f.status&&String(row.status||'').toLowerCase()!==String(f.status).toLowerCase())return false;
  if(f.genre&&String(row.genre||'').toLowerCase()!==String(f.genre).toLowerCase())return false;
  if(f.source&&String(row.source||'').toLowerCase()!==String(f.source).toLowerCase())return false;
  if(f.tag&&!uniqueStrings(row.tags).some(x=>x.toLowerCase()===String(f.tag).toLowerCase()))return false;
  return true;
 });
}

async function matchingContacts(db:any,filter:any){
 const {data,error}=await db.from('crm_contacts').select('id,artist_name,full_name,email,phone,status,genre,source,tags,email_opt_in,sms_opt_in,ghl_contact_id').order('updated_at',{ascending:false}).limit(500);if(error)throw error;return applyFilter(data||[],filter).slice(0,100);
}

async function createApprovalTask(db:any,title:string,notes:string){
 const {error}=await db.from('crm_tasks').insert({contact_id:null,title:cleanText(title,180),notes:cleanText(notes,4000),status:'open',priority:'high',due_at:new Date().toISOString(),updated_at:new Date().toISOString()});if(error)throw error;
}

async function syncGhl(contact:any){
 const token=process.env.GHL_PRIVATE_INTEGRATION_TOKEN,locationId=process.env.GHL_LOCATION_ID;if(!token||!locationId)throw new Error('GoHighLevel is not connected.');
 const r=await fetch('https://services.leadconnectorhq.com/contacts/upsert',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',Version:'v3'},body:JSON.stringify({name:contact.artist_name||contact.full_name||undefined,email:contact.email||undefined,phone:contact.phone||undefined,locationId,tags:uniqueStrings(contact.tags),source:contact.source||'CRM Autonomous Agent'})});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j?.message||j?.error||'GoHighLevel sync failed.');return j?.contact?.id||j?.contactId||null;
}

async function executeAction(db:any,mission:AgentMission,action:any,integrations:any){
 const type=String(action?.type||'no_op');
 if(type==='no_op')return {type,status:'skipped' as const,detail:cleanText(action?.reason||'No action needed.',500)};
 if(type==='create_task'){
  const title=cleanText(action.title||'Autonomous agent follow-up',180);const notes=cleanText(action.notes||action.reason||'',4000);const dueDays=clamp(Number(action.due_days||0),0,30);const priority=['low','normal','high'].includes(String(action.priority))?String(action.priority):'normal';
  const {error}=await db.from('crm_tasks').insert({contact_id:null,title,notes,status:'open',priority,due_at:new Date(Date.now()+dueDays*86400000).toISOString(),updated_at:new Date().toISOString()});if(error)throw error;return {type,status:'done' as const,detail:`Created task: ${title}`};
 }
 if(type==='create_opportunity'){
  const title=cleanText(action.title||'Agent-created opportunity',180);const stage=['new','contacted','qualified','proposal','won'].includes(String(action.stage))?String(action.stage):'new';const value=Math.max(0,Number(action.value||0));
  const {error}=await db.from('crm_opportunities').insert({contact_id:null,title,stage,value,notes:cleanText(action.notes||action.reason||'',4000),updated_at:new Date().toISOString()});if(error)throw error;return {type,status:'done' as const,detail:`Created opportunity: ${title}`};
 }
 if(type==='tag_contacts'){
  const tag=cleanText(action.add_tag,80);if(!tag)return {type,status:'skipped' as const,detail:'No tag was provided.'};const rows=await matchingContacts(db,action.filter);let changed=0;
  for(const row of rows){const tags=uniqueStrings([...(row.tags||[]),tag]);if(tags.length===uniqueStrings(row.tags).length)continue;const {error}=await db.from('crm_contacts').update({tags,updated_at:new Date().toISOString()}).eq('id',row.id);if(error)throw error;await enrollMatchingWorkflows(db,row.id,'tag_added',{tag});changed++}
  return {type,status:'done' as const,detail:`Added “${tag}” to ${changed} contact(s).`};
 }
 if(type==='set_status'){
  const status=String(action.status||'');if(!['lead','pending','approved','active','rejected','inactive'].includes(status))return {type,status:'skipped' as const,detail:'Invalid status.'};const rows=await matchingContacts(db,action.filter);let changed=0;
  for(const row of rows){if(String(row.status)===status)continue;const previousStatus=row.status;const {error}=await db.from('crm_contacts').update({status,updated_at:new Date().toISOString()}).eq('id',row.id);if(error)throw error;await enrollMatchingWorkflows(db,row.id,'status_changed',{status,previousStatus});changed++}
  return {type,status:'done' as const,detail:`Moved ${changed} contact(s) to ${status}.`};
 }
 if(type==='queue_email'){
  const subject=cleanText(action.subject,250),body=cleanText(action.body,8000);if(!subject||!body)return {type,status:'skipped' as const,detail:'Email subject/body missing.'};
  if(mission.autonomy!=='autopilot'){await createApprovalTask(db,`Approve agent email: ${subject}`,`Proposed email\n\n${body}\n\nReason: ${cleanText(action.reason,1000)}`);return {type,status:'done' as const,detail:'Created an approval task for the proposed email.'};}
  if(!integrations.email)return {type,status:'skipped' as const,detail:'Email integration is not connected.'};
  const rows=(await matchingContacts(db,action.filter)).filter((x:any)=>x.email&&x.email_opt_in).slice(0,100);if(!rows.length)return {type,status:'skipped' as const,detail:'No opted-in email contacts matched.'};const now=new Date().toISOString();
  const {data:campaign,error:campError}=await db.from('crm_email_campaigns').insert({name:`Agent · ${mission.goal.slice(0,80)}`,subject,body,status:'scheduled',filter_status:action?.filter?.status||null,filter_genre:action?.filter?.genre||null,scheduled_at:now}).select('id').single();if(campError)throw campError;
  const queue=rows.map((x:any)=>({campaign_id:campaign.id,contact_id:x.id,email:x.email,subject,body,status:'queued',scheduled_at:now}));const {error:qError}=await db.from('crm_email_queue').insert(queue);if(qError)throw qError;return {type,status:'done' as const,detail:`Queued email for ${rows.length} opted-in contact(s).`};
 }
 if(type==='send_sms'){
  const body=cleanText(action.body,1400);if(!body)return {type,status:'skipped' as const,detail:'SMS body missing.'};
  if(mission.autonomy!=='autopilot'){await createApprovalTask(db,'Approve agent SMS',`Proposed SMS\n\n${body}\n\nReason: ${cleanText(action.reason,1000)}`);return {type,status:'done' as const,detail:'Created an approval task for the proposed SMS.'};}
  if(!integrations.sms)return {type,status:'skipped' as const,detail:'TextGrid is not connected.'};
  const rows=(await matchingContacts(db,action.filter)).filter((x:any)=>x.phone&&x.sms_opt_in).slice(0,25);if(!rows.length)return {type,status:'skipped' as const,detail:'No opted-in SMS contacts matched.'};let sent=0,failed=0;
  for(const row of rows){try{await sendTextGridSms(row.phone,body);sent++;await Promise.all([db.from('crm_contacts').update({last_contacted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',row.id),db.from('crm_activity').insert({contact_id:row.id,activity_type:'sms_sent',detail:'Sent by Autonomous CRM Agent'})])}catch{failed++}}
  return {type,status:sent?'done' as const:'failed' as const,detail:`SMS sent to ${sent} contact(s); ${failed} failed.`};
 }
 if(type==='sync_ghl'){
  if(mission.autonomy!=='autopilot'){await createApprovalTask(db,'Approve GoHighLevel sync',`The autonomous agent wants to sync a CRM segment to GoHighLevel. Reason: ${cleanText(action.reason,1200)}`);return {type,status:'done' as const,detail:'Created an approval task for GoHighLevel sync.'};}
  if(!integrations.ghl)return {type,status:'skipped' as const,detail:'GoHighLevel is not connected.'};const rows=(await matchingContacts(db,action.filter)).slice(0,25);let synced=0,failed=0;
  for(const row of rows){try{const ghlId=await syncGhl(row);await db.from('crm_contacts').update({ghl_contact_id:ghlId||row.ghl_contact_id,updated_at:new Date().toISOString()}).eq('id',row.id);synced++}catch{failed++}}
  return {type,status:synced?'done' as const:'failed' as const,detail:`Synced ${synced} contact(s) to GoHighLevel; ${failed} failed.`};
 }
 return {type,status:'skipped' as const,detail:`Unsupported action: ${type}`};
}

export async function runAutonomousCycle(db:any,state:AutonomousAgentState,source:'manual'|'cron'|'start'='manual',force=false){
 const mission=state.active_mission;if(!mission||mission.status!=='active')return state;
 if(!force&&mission.next_run_at&&new Date(mission.next_run_at).getTime()>Date.now())return state;
 const startedAt=new Date().toISOString();const run:AgentRun={id:randomUUID(),mission_id:mission.id,started_at:startedAt,completed_at:startedAt,source,summary:'',actions:[]};
 try{
  const [dashboard,integrations]=await Promise.all([getAutonomousDashboard(db),autonomousIntegrationStatus(db)]);const maxActions=clamp(Number(state.config.max_actions_per_cycle||5),1,8);const plan=await planCycle(mission,dashboard,integrations,maxActions);
  mission.strategy=cleanText(plan.strategy||mission.strategy||verticalPlaybooks[mission.vertical],3000);mission.progress=clamp(Number(plan.progress||mission.progress||0),0,100);mission.last_summary=cleanText(plan.summary||'Cycle completed.',3000);mission.last_run_at=new Date().toISOString();mission.cycles=Number(mission.cycles||0)+1;
  const requestedMinutes=clamp(Number(plan.next_check_minutes||state.config.cycle_minutes||60),15,1440);mission.next_run_at=nextIso(requestedMinutes);
  for(const action of (Array.isArray(plan.actions)?plan.actions:[]).slice(0,maxActions)){
   try{run.actions.push(await executeAction(db,mission,action,integrations))}catch(e:any){run.actions.push({type:String(action?.type||'unknown'),status:'failed',detail:cleanText(e?.message||'Action failed.',1000)})}
  }
  if(String(plan.mission_status)==='completed'||mission.progress>=100){mission.status='completed';mission.progress=100;mission.next_run_at=null;state.history=[{...mission},...(state.history||[])].slice(0,20);state.active_mission=null;}
  else{mission.updated_at=new Date().toISOString();state.active_mission={...mission};}
  run.summary=mission.last_summary;run.completed_at=new Date().toISOString();state.runs=[run,...(state.runs||[])].slice(0,40);
 }catch(e:any){
  mission.last_run_at=new Date().toISOString();mission.next_run_at=nextIso(60);mission.updated_at=new Date().toISOString();mission.last_summary=`Agent cycle error: ${cleanText(e?.message||'Unknown error.',1000)}`;state.active_mission={...mission};run.summary=mission.last_summary;run.error=cleanText(e?.message||'Autonomous cycle failed.',1000);run.completed_at=new Date().toISOString();state.runs=[run,...(state.runs||[])].slice(0,40);
 }
 await saveAutonomousState(db,state);return state;
}

export function newMission(goal:string,vertical:AgentVertical,autonomy:AgentAutonomy):AgentMission{
 const now=new Date().toISOString();return {id:randomUUID(),goal:cleanText(goal,2000),vertical,status:'active',autonomy,created_at:now,updated_at:now,last_run_at:null,next_run_at:now,cycles:0,progress:0,strategy:'',last_summary:'Mission created. The agent is preparing its first cycle.'};
}
