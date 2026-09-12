// @ts-nocheck
'use client';

import {useEffect,useMemo,useState} from 'react';
import styles from './AutomationBuilder.module.css';

type Capability={
 id:string;
 label:string;
 category:string;
 description:string;
 requires?:string;
 mode?:'native'|'connection';
};

const cap=(id:string,label:string,category:string,description:string,requires?:string,mode:'native'|'connection'='native'):Capability=>({id,label,category,description,requires,mode});

const TRIGGERS:Capability[]=[
 cap('manual','Manual Enrollment','Contacts','Start manually'),
 cap('contact_created','Contact Created','Contacts','New CRM contact created'),
 cap('contact_updated','Contact Changed','Contacts','Tracked contact field changed'),
 cap('status_changed','Contact Status Changed','Contacts','CRM status changed'),
 cap('tag_added','Contact Tag Added','Contacts','Tag added'),
 cap('tag_removed','Contact Tag Removed','Contacts','Tag removed'),
 cap('contact_dnd','Contact DND','Contacts','DND changed'),
 cap('birthday_reminder','Birthday Reminder','Contacts','Runs on a contact birthday'),
 cap('custom_date_reminder','Custom Date Reminder','Contacts','Runs from a custom date field'),
 cap('note_added','Note Added','Contacts','CRM note added'),
 cap('task_added','Task Added','Contacts','CRM task created'),
 cap('task_reminder','Task Reminder','Contacts','CRM task reaches its due time'),
 cap('contact_engagement_score','Contact Engagement Score','Contacts','Engagement score changed'),

 cap('webhook_received','Inbound Webhook','Events','External system calls a workflow webhook'),
 cap('form_submitted','Form Submitted','Events','Indie Cut form submitted'),
 cap('scheduled','Scheduler','Events','Run once or on a recurring schedule'),
 cap('sms_reply','Customer Replied by SMS','Events','Inbound TextGrid reply','textgrid','connection'),
 cap('email_reply','Email Reply','Events','Inbound email reply','inbound_email','connection'),
 cap('call_details','Call Details','Events','Call event received','voice','connection'),
 cap('email_event','Email Events','Events','Delivery, open, click or bounce event','email_events','connection'),
 cap('survey_submitted','Survey Submitted','Events','Survey response received','surveys','connection'),
 cap('trigger_link_clicked','Trigger Link Clicked','Events','Tracked workflow link clicked','tracking_links','connection'),
 cap('page_view','Funnel / Website PageView','Events','Tracked website page view','website_events','connection'),
 cap('new_review_received','New Review Received','Events','Connected review source received a review','reviews','connection'),

 cap('appointment_created','Customer Booked Appointment','Appointments','Native Indie Cut appointment created'),
 cap('appointment_changed','Appointment Status Changed','Appointments','Native Indie Cut appointment changed'),
 cap('service_booking','Service Booking','Appointments','Service-booking event received','booking_source','connection'),
 cap('rental_booking','Rental Booking','Appointments','Rental-booking event received','booking_source','connection'),

 cap('opportunity_created','Opportunity Created','Opportunities','Native Indie Cut opportunity created'),
 cap('opportunity_changed','Opportunity Changed','Opportunities','Native Indie Cut opportunity changed'),
 cap('pipeline_stage_changed','Pipeline Stage Changed','Opportunities','Native opportunity pipeline stage changed'),
 cap('stale_opportunities','Stale Opportunities','Opportunities','Opportunity has not moved for a set period'),

 cap('affiliate_created','Affiliate Created','Affiliate','Native affiliate record created'),
 cap('affiliate_changed','Affiliate Changed','Affiliate','Native affiliate record changed'),
 cap('offer_access_granted','Offer Access Granted','Courses','Native course/offer access granted'),
 cap('offer_access_removed','Offer Access Removed','Courses','Native course/offer access removed'),
 cap('group_access_granted','Group Access Granted','Communities','Native group access granted'),
 cap('group_access_revoked','Group Access Revoked','Communities','Native group access revoked'),
 cap('certificate_issued','Certificate Issued','Certificates','Native certificate issued'),

 cap('invoice','Invoice Created','Payments','Native invoice record created'),
 cap('estimate','Estimate Created','Payments','Native estimate record created'),
 cap('order_submitted','Order Submitted','Payments','Native order record created'),
 cap('subscription','Subscription Created','Payments','Native subscription record created'),
 cap('payment_received','Payment Received','Payments','Processor reports a successful payment','payments','connection'),
 cap('payment_failed','Payment Failed','Payments','Processor reports a failed payment','payments','connection'),
 cap('refund_issued','Refund Issued','Payments','Processor reports a refund','payments','connection'),

 cap('meta_lead','Facebook / Instagram Lead Form','Social','Meta lead form submitted','meta_leads','connection'),
 cap('tiktok_lead','TikTok Lead Form','Social','TikTok lead form submitted','tiktok_leads','connection'),
 cap('social_message','Social Message Received','Social','Connected social inbox message','social_messaging','connection'),
 cap('facebook_comment','Facebook Comment','Social','Facebook post comment','meta_messaging','connection'),
 cap('instagram_comment','Instagram Comment','Social','Instagram post comment','meta_messaging','connection'),
 cap('tiktok_comment','TikTok Comment','Social','TikTok video comment','tiktok_messaging','connection'),
 cap('google_lead','Google Lead Form Submitted','Google Ads','Google Ads lead form submitted','google_ads','connection'),

 cap('battle_submission_received','Battle Submission Received','Indie Cut Battles','Artist submits music'),
 cap('battle_submission_approved','Battle Submission Approved','Indie Cut Battles','Submission approved'),
 cap('battle_submission_rejected','Battle Submission Rejected','Indie Cut Battles','Submission rejected'),
 cap('vote_received','Vote Received','Indie Cut Battles','Verified fan vote received'),
 cap('artist_advanced','Artist Advanced','Indie Cut Battles','Artist advances'),
 cap('battle_started','Battle Started','Indie Cut Battles','Battle goes live'),
 cap('battle_ended','Battle Ended','Indie Cut Battles','Battle completes'),
 cap('winner_selected','Winner Selected','Indie Cut Battles','Champion selected')
];

const ACTIONS:Capability[]=[
 cap('send_email','Send Email','Communication','Send through Indie Cut email','email'),
 cap('send_sms','Send SMS','Communication','Send through TextGrid','textgrid'),
 cap('internal_email','Internal Email Notification','Communication','Notify a team member','email'),
 cap('send_slack','Send Slack Message','Communication','Send to Slack','slack','connection'),
 cap('call','Call','Communication','Place a voice call','voice','connection'),
 cap('messenger','Facebook Messenger','Communication','Send Messenger message','meta_messaging','connection'),
 cap('instagram_dm','Instagram DM','Communication','Send Instagram message','meta_messaging','connection'),
 cap('gmb_message','Google Business Messaging','Communication','Send Google Business message','google_business','connection'),
 cap('review_request','Send Review Request','Communication','Send through connected review provider','reviews','connection'),
 cap('reply_comment','Reply in Comments','Communication','Reply through connected social provider','social_messaging','connection'),
 cap('whatsapp','WhatsApp','Communication','Send WhatsApp message','whatsapp','connection'),
 cap('live_chat','Send Live Chat Message','Communication','Send through connected live chat','live_chat','connection'),

 cap('if_else','If / Else','Logic','Split into YES / NO paths'),
 cap('wait','Wait','Logic','Pause for a duration'),
 cap('wait_until','Wait Until','Logic','Pause until a date/time'),
 cap('go_to','Go To','Logic','Jump to a workflow step'),
 cap('stop_workflow','Stop Workflow','Logic','Stop this enrollment'),
 cap('enroll_workflow','Add to Workflow','Logic','Enroll contact in another workflow'),
 cap('remove_from_workflow','Remove from Workflow','Logic','Stop another workflow enrollment'),

 cap('update_contact','Update Contact Field','CRM','Update CRM contact data'),
 cap('add_tag','Add Contact Tag','CRM','Add a tag'),
 cap('remove_tag','Remove Contact Tag','CRM','Remove a tag'),
 cap('update_status','Update Status','CRM','Change CRM status'),
 cap('assign_user','Assign to User','CRM','Assign a contact owner'),
 cap('remove_assigned_user','Remove Assigned User','CRM','Clear contact owner'),
 cap('set_dnd','Disable / Enable DND','CRM','Change DND'),
 cap('engagement_score','Modify Engagement Score','CRM','Set engagement score'),
 cap('add_note','Add Note','CRM','Append CRM note'),
 cap('create_task','Add Task','CRM','Create a follow-up task'),
 cap('copy_contact','Copy Contact','CRM','Create a new contact from the current contact'),
 cap('delete_contact','Delete Contact','CRM','Delete current contact'),
 cap('update_custom_value','Update Custom Value','CRM','Set a custom value'),
 cap('text_formatter','Text Formatter','CRM','Transform text and save it'),

 cap('outbound_webhook','Webhook / Custom Webhook','Send Data','Send JSON to another system'),
 cap('google_sheets','Google Sheets','Send Data','Write data to Google Sheets','google_sheets','connection'),

 cap('ai_generate','AI Prompt','Workflow AI','Generate workflow text','openai'),
 cap('ai_decision','AI Decision Maker','Workflow AI','Make a workflow decision','openai'),
 cap('ai_detect_intent','AI Intent Detection','Workflow AI','Classify intent','openai'),
 cap('ai_summarize','AI Summarize','Workflow AI','Summarize context','openai'),
 cap('ai_translate','AI Translate','Workflow AI','Translate text','openai'),
 cap('ai_extract','AI Extract Data','Workflow AI','Extract structured facts','openai'),

 cap('create_appointment','Create Appointment','Appointments','Create a native Indie Cut appointment'),
 cap('update_appointment','Update Appointment','Appointments','Update a native Indie Cut appointment'),
 cap('create_opportunity','Create Opportunity','Opportunities','Create a native Indie Cut opportunity'),
 cap('update_opportunity','Create / Update Opportunity','Opportunities','Move or update a native opportunity'),
 cap('affiliate_add','Add to Affiliate Manager','Affiliate','Create a native affiliate record'),
 cap('affiliate_update','Update Affiliate','Affiliate','Update a native affiliate record'),
 cap('course_grant','Course Grant Offer','Courses','Grant native course/offer access'),
 cap('course_revoke','Course Revoke Offer','Courses','Revoke native course/offer access'),
 cap('community_grant','Grant Group Access','Communities','Grant native group access'),
 cap('community_revoke','Revoke Group Access','Communities','Revoke native group access'),
 cap('issue_certificate','Issue Certificate','Certificates','Create a native certificate record'),

 cap('create_invoice','Create Invoice','Payments','Create a native invoice record'),
 cap('create_estimate','Create Estimate','Payments','Create a native estimate record'),
 cap('create_order','Create Order','Payments','Create a native order record'),
 cap('create_subscription','Create Subscription Record','Payments','Create a native subscription record'),
 cap('create_payment_link','Create Payment Link','Payments','Create through connected payment processor','payments','connection'),
 cap('refund_payment','Refund Payment','Payments','Refund through connected payment processor','payments','connection'),
 cap('stripe_charge','Stripe One-Time Charge','Payments','Charge through Stripe','stripe','connection'),
 cap('send_documents','Send Documents and Contracts','Documents','Send through connected e-sign provider','documents','connection'),

 cap('google_analytics','Add to Google Analytics','Marketing','Send marketing event','google_analytics','connection'),
 cap('google_ads','Add to Google Ads','Marketing','Send Google Ads conversion','google_ads','connection'),
 cap('facebook_audience_add','Add to Meta Custom Audience','Marketing','Add contact to Meta audience','meta_ads','connection'),
 cap('facebook_audience_remove','Remove from Meta Custom Audience','Marketing','Remove contact from Meta audience','meta_ads','connection'),
 cap('facebook_capi','Facebook Conversion API','Marketing','Send server-side Meta event','meta_ads','connection'),
 cap('tiktok_audience','TikTok Audience Action','Marketing','Manage TikTok audience','tiktok_ads','connection'),

 cap('ivr_gather','Gather Input on Call','IVR','Collect keypad or speech input','voice','connection'),
 cap('ivr_play','Play Message','IVR','Play a voice message','voice','connection'),
 cap('ivr_connect','Connect to Call','IVR','Transfer or connect a call','voice','connection'),
 cap('ivr_end','End Call','IVR','End the current call','voice','connection'),
 cap('ivr_voicemail','Record Voicemail','IVR','Record voicemail','voice','connection'),
 cap('voicemail_drop','Voicemail Drop','IVR','Send voicemail drop','voice','connection')
];

const STATUSES=['lead','pending','approved','active','rejected','inactive'];
const GENRES=['Hip-Hop','R&B','Gospel','Southern Soul','Pop','Rock','Country','Afrobeats','Reggae / Dancehall','Latin','Electronic / Dance','Jazz','Soul','Alternative','Blues','Folk'];
const CONTACT_FIELDS=[['artist_name','Artist name'],['full_name','Full name'],['email','Email'],['phone','Phone'],['genre','Genre'],['city','City / State'],['source','Source'],['notes','Notes'],['birthday','Birthday'],['engagement_score','Engagement score']];
const CONDITION_FIELDS=[['status','Status'],['genre','Genre'],['tag','Tag'],['city','City / State'],['source','Source'],['email_opt_in','Email opt-in'],['sms_opt_in','SMS opt-in'],['dnd','DND'],['email','Email'],['phone','Phone'],['engagement_score','Engagement score']];
const OPERATORS=[['equals','Equals'],['not_equals','Does not equal'],['contains','Contains'],['not_contains','Does not contain'],['exists','Exists'],['not_exists','Does not exist'],['gt','Greater than'],['gte','Greater or equal'],['lt','Less than'],['lte','Less or equal']];
const blankWorkflow={name:'Untitled Workflow',description:'',trigger_type:'manual',trigger_config:{},status:'draft'};

const byId=(list:Capability[],id:string)=>list.find(x=>x.id===id);
const categories=(list:Capability[])=>Array.from(new Set(list.map(x=>x.category)));
const isConnected=(capability:Capability|undefined,integrations:any)=>!capability?.requires||Boolean(integrations?.[capability.requires]);
const isImmediate=(capability:Capability|undefined,integrations:any)=>capability?.mode!=='connection'&&isConnected(capability,integrations);

function defaultConfig(type:string){
 if(type==='send_sms')return {message:''};
 if(type==='send_email')return {subject:'',message:''};
 if(type==='internal_email')return {to:'',subject:'Indie Cut workflow notification',message:''};
 if(type==='if_else')return {field:'status',operator:'equals',value:'approved',yes_steps:[],no_steps:[]};
 if(type==='wait')return {amount:1,unit:'hours'};
 if(type==='wait_until')return {datetime:''};
 if(type==='go_to')return {step_index:0};
 if(['add_tag','remove_tag'].includes(type))return {tag:''};
 if(type==='update_status')return {status:'active'};
 if(type==='update_contact')return {field:'genre',value:''};
 if(type==='assign_user')return {user:''};
 if(type==='set_dnd')return {value:true};
 if(type==='engagement_score')return {value:0};
 if(type==='add_note')return {note:''};
 if(type==='create_task')return {title:'Follow up with {{artist_name}}',notes:'',due_hours:24};
 if(type==='copy_contact')return {artist_name:'{{artist_name}} Copy',email:'',phone:''};
 if(type==='update_custom_value')return {key:'',value:''};
 if(type==='text_formatter')return {input:'{{notes}}',operation:'trim',save_to:'notes'};
 if(type==='outbound_webhook')return {url:'',method:'POST',secret:'',body_template:''};
 if(['enroll_workflow','remove_from_workflow'].includes(type))return {workflow_id:''};
 if(type.startsWith('ai_'))return {input:'{{notes}}',instruction:'',save_to:'notes',language:'Spanish'};
 if(['create_appointment','update_appointment'].includes(type))return {title:'Appointment',status:'scheduled',starts_at:'',object_id:''};
 if(['create_opportunity','update_opportunity'].includes(type))return {title:'Opportunity',status:'open',stage:'new',amount:'',object_id:''};
 if(['affiliate_add','affiliate_update'].includes(type))return {title:'Affiliate',status:'active',object_id:''};
 if(['course_grant','course_revoke'].includes(type))return {title:'Course Access',status:'active',object_id:''};
 if(['community_grant','community_revoke'].includes(type))return {title:'Group Access',status:'active',object_id:''};
 if(type==='issue_certificate')return {title:'Certificate',status:'issued'};
 if(['create_invoice','create_estimate','create_order','create_subscription'].includes(type))return {title:'',status:'active',amount:'',due_at:''};
 return {};
}

async function request(action:string,extra:any={}){
 const response=await fetch('/api/admin/automation',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...extra})});
 const json=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(json.error||'Automation request failed');
 return json;
}

export default function AutomationBuilderV5(){
 const [data,setData]=useState<any>({workflows:[],steps:[],contacts:[],enrollments:[],smsStats:{},integrations:{}});
 const [tags,setTags]=useState<any[]>([]);
 const [tab,setTab]=useState('builder');
 const [workflow,setWorkflow]=useState<any>({...blankWorkflow});
 const [steps,setSteps]=useState<any[]>([]);
 const [selected,setSelected]=useState<number|null>(null);
 const [insertAt,setInsertAt]=useState(0);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState('');
 const [newTag,setNewTag]=useState('');
 const [historyWorkflow,setHistoryWorkflow]=useState('');
 const [enrollContact,setEnrollContact]=useState('');
 const [directSms,setDirectSms]=useState({contactId:'',message:''});

 async function load(){
  try{
   const [automationResponse,tagsResponse]=await Promise.all([
    fetch('/api/admin/automation',{cache:'no-store'}),
    fetch('/api/admin/tags',{cache:'no-store'})
   ]);
   const automation=await automationResponse.json();
   const tagData=await tagsResponse.json();
   if(!automationResponse.ok)throw new Error(automation.error||'Unable to load workflows');
   setData(automation);
   setTags(tagData.tags||[]);
   if(!workflow.id&&automation.workflows?.length)openWorkflow(automation.workflows[0],automation);
  }catch(error:any){setMessage(error.message)}
 }
 useEffect(()=>{load()},[]);

 function openWorkflow(w:any,source=data){
  const loaded=(source.steps||[]).filter((x:any)=>x.workflow_id===w.id).sort((a:any,b:any)=>a.step_order-b.step_order).map((x:any)=>({step_type:x.step_type,step_config:x.step_config||{}}));
  setWorkflow({...w,trigger_config:w.trigger_config||{}});
  setSteps(loaded);
  setSelected(null);
  setInsertAt(loaded.length);
 }

 async function run(key:string,action:string,extra:any={}){
  setBusy(key);setMessage('');
  try{const next=await request(action,extra);setData(next);return next}
  catch(error:any){setMessage(error.message)}
  finally{setBusy('')}
 }

 async function saveWorkflow(){
  const next=await run('save','save_workflow',{workflow,steps});
  if(next){const saved=(next.workflows||[]).find((x:any)=>x.name===workflow.name)||next.workflows?.[0];if(saved)openWorkflow(saved,next);setMessage('Workflow saved.');}
 }
 async function publishWorkflow(){
  if(!workflow.id){setMessage('Save the workflow first.');return;}
  const next=await run('publish','publish_workflow',{workflowId:workflow.id,publish:workflow.status!=='published'});
  if(next){const saved=(next.workflows||[]).find((x:any)=>x.id===workflow.id);if(saved)openWorkflow(saved,next);}
 }
 function addStep(type:string){
  const index=Math.max(0,Math.min(insertAt,steps.length));
  const next={step_type:type,step_config:defaultConfig(type)};
  setSteps(current=>{const copy=[...current];copy.splice(index,0,next);return copy});
  setSelected(index);setInsertAt(index+1);
 }
 function patchStep(index:number,patch:any){setSteps(current=>current.map((step,i)=>i===index?{...step,step_config:{...(step.step_config||{}),...patch}}:step))}

 const currentStep=selected===null||selected<0?null:steps[selected];
 const history=useMemo(()=>historyWorkflow?(data.enrollments||[]).filter((x:any)=>x.workflow_id===historyWorkflow):(data.enrollments||[]),[data.enrollments,historyWorkflow]);

 return <section className={styles.shell}>
  <div className={styles.topbar}>
   <div className={styles.topTitle}><h2>Indie Cut Workflows</h2><span className={`${styles.badge} ${!data.integrations?.textgrid?styles.badgeOff:''}`}>{data.integrations?.textgrid?'TEXTGRID CONNECTED':'TEXTGRID NOT CONNECTED'}</span></div>
   <div className={styles.tabs}>{[['builder','Builder'],['library','Trigger + Action Library'],['tags',`Tags (${tags.length})`],['sms','SMS'],['history',`Enrollment History (${history.length})`]].map(([id,label])=><button key={id} className={`${styles.tab} ${tab===id?styles.tabActive:''}`} onClick={()=>setTab(id)}>{label}</button>)}</div>
  </div>
  {message&&<div className={styles.message}>{message}</div>}

  {tab==='builder'&&<div className={styles.workspace}>
   <aside className={styles.left}>
    <div className={styles.leftHead}><strong>WORKFLOWS</strong><button className={styles.newButton} onClick={()=>{setWorkflow({...blankWorkflow});setSteps([]);setSelected(null);setInsertAt(0)}}>＋ New</button></div>
    <div className={styles.workflowList}>{(data.workflows||[]).map((w:any)=><button key={w.id} className={`${styles.workflowItem} ${workflow.id===w.id?styles.workflowActive:''}`} onClick={()=>openWorkflow(w)}><span className={styles.workflowName}>{w.name}</span><span className={styles.workflowMeta}><span>{byId(TRIGGERS,w.trigger_type)?.label||w.trigger_type}</span><span>{w.status}</span></span></button>)}</div>
   </aside>

   <main className={styles.canvasWrap}>
    <div className={styles.canvasHead}><div><input className={styles.nameInput} value={workflow.name||''} onChange={e=>setWorkflow({...workflow,name:e.target.value})}/><div className={styles.tiny}>{workflow.status==='published'?'PUBLISHED — LIVE AUTOMATION':'DRAFT — NOT RUNNING'}</div></div><div className={styles.actions}><button className={styles.ghost} onClick={saveWorkflow}>{busy==='save'?'Saving…':'Save'}</button><button className={styles.primary} onClick={publishWorkflow}>{workflow.status==='published'?'Unpublish':'Publish'}</button></div></div>
    <div className={styles.flow}>
     <div className={`${styles.node} ${styles.nodeTrigger}`} onClick={()=>setSelected(-1)}><div className={styles.nodeHead}><div className={styles.nodeType}><span className={`${styles.icon} ${styles.triggerIcon}`}>⚡</span><div><div className={styles.nodeTitle}>Trigger</div><div className={styles.nodeSub}>{byId(TRIGGERS,workflow.trigger_type)?.label||workflow.trigger_type}</div></div></div></div></div>
     {steps.map((step:any,index:number)=><div key={index} style={{width:'100%',display:'flex',flexDirection:'column',alignItems:'center'}}><div className={styles.connector}/><button className={styles.plus} onClick={()=>{setInsertAt(index);setSelected(null)}}>+</button><div className={styles.connector}/><div className={`${styles.node} ${styles.nodeAction}`} onClick={()=>{setSelected(index);setInsertAt(index+1)}}><div className={styles.nodeHead}><div className={styles.nodeType}><span className={styles.icon}>•</span><div><div className={styles.nodeTitle}>{byId(ACTIONS,step.step_type)?.label||step.step_type}</div><div className={styles.nodeSub}>{stepSummary(step)}</div></div></div><button className={styles.danger} onClick={event=>{event.stopPropagation();setSteps(current=>current.filter((_,i)=>i!==index));setSelected(null)}}>×</button></div></div></div>)}
     <div className={styles.connector}/><button className={styles.plus} onClick={()=>{setInsertAt(steps.length);setSelected(null)}}>+</button><div className={styles.connector}/><div className={styles.tiny}>END</div>
    </div>
   </main>

   <aside className={styles.right}>
    {selected===-1?<TriggerEditor workflow={workflow} setWorkflow={setWorkflow} tags={tags} integrations={data.integrations}/>:currentStep?<StepEditor step={currentStep} tags={tags} workflows={data.workflows||[]} integrations={data.integrations} onChange={(patch:any)=>patchStep(selected!,patch)}/>:<ActionPicker data={data} onAdd={addStep} workflow={workflow} enrollContact={enrollContact} setEnrollContact={setEnrollContact} onEnroll={async()=>{if(workflow.id&&enrollContact){await run('enroll','enroll_contact',{workflowId:workflow.id,contactId:enrollContact});setEnrollContact('')}}}/>} 
   </aside>
  </div>}

  {tab==='library'&&<div className={styles.smsGrid}><CapabilityCatalog title="All Triggers" list={TRIGGERS} integrations={data.integrations}/><CapabilityCatalog title="All Actions" list={ACTIONS} integrations={data.integrations}/></div>}

  {tab==='tags'&&<div className={styles.smsGrid}><div className={styles.panel} style={{gridColumn:'1 / -1'}}><h3>CRM Tags</h3><div style={{display:'flex',gap:8}}><input className={styles.input} value={newTag} onChange={e=>setNewTag(e.target.value)} placeholder="e.g. finalist, VIP"/><button className={styles.primary} onClick={async()=>{if(!newTag.trim())return;const response=await fetch('/api/admin/tags',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'create_tag',name:newTag.trim()})});const json=await response.json();if(response.ok){setTags(json.tags||[]);setNewTag('')}}}>Create Tag</button></div>{tags.map((tag:any)=><div className={styles.row} key={tag.id}><strong>{tag.name}</strong><button className={styles.danger} onClick={async()=>{const response=await fetch('/api/admin/tags',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'delete_tag',id:tag.id})});const json=await response.json();if(response.ok)setTags(json.tags||[])}}>Delete</button></div>)}</div></div>}

  {tab==='sms'&&<div className={styles.smsGrid}><div className={styles.panel}><h3>Direct Text Message</h3><label className={styles.label}>Contact<select className={styles.select} value={directSms.contactId} onChange={e=>setDirectSms({...directSms,contactId:e.target.value})}><option value="">Choose contact…</option>{(data.contacts||[]).filter((c:any)=>c.sms_opt_in&&c.phone).map((c:any)=><option key={c.id} value={c.id}>{c.artist_name||c.full_name||c.phone}</option>)}</select></label><label className={styles.label}>Message<textarea className={styles.textarea} rows={6} value={directSms.message} onChange={e=>setDirectSms({...directSms,message:e.target.value})}/></label><button className={styles.primary} disabled={!data.integrations?.textgrid||!directSms.contactId||!directSms.message.trim()} onClick={async()=>{await run('sms','send_sms',{contactId:directSms.contactId,message:directSms.message});setDirectSms({contactId:'',message:''})}}>Send Text</button></div><div className={styles.panel}><div className={styles.statGrid}><div className={styles.stat}><b>{data.smsStats?.queued||0}</b><span>Queued</span></div><div className={styles.stat}><b>{data.smsStats?.sent||0}</b><span>Sent</span></div><div className={styles.stat}><b>{data.smsStats?.failed||0}</b><span>Failed</span></div></div></div></div>}

  {tab==='history'&&<div className={styles.smsGrid}><div className={styles.panel} style={{gridColumn:'1 / -1'}}><h3>Workflow Enrollment History</h3><label className={styles.label}>Workflow<select className={styles.select} value={historyWorkflow} onChange={e=>setHistoryWorkflow(e.target.value)}><option value="">All workflows</option>{(data.workflows||[]).map((w:any)=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>{history.map((entry:any)=>{const contact=(data.contacts||[]).find((x:any)=>x.id===entry.contact_id);const w=(data.workflows||[]).find((x:any)=>x.id===entry.workflow_id);return <div className={styles.row} key={entry.id}><div><strong>{contact?.artist_name||contact?.full_name||contact?.email||'Unknown contact'}</strong><div className={styles.tiny}>{w?.name} · {entry.context?.trigger_type||w?.trigger_type} · step {entry.current_step||0}</div>{entry.last_error&&<div className={styles.tiny} style={{color:'#b42318'}}>{entry.last_error}</div>}</div><span className={styles.badge}>{entry.status}</span></div>})}</div></div>}
 </section>;
}

function capabilityStatus(capability:Capability,integrations:any){
 if(capability.mode==='connection')return isConnected(capability,integrations)?'CONNECTED — PROVIDER ADAPTER READY':'BUILT — CONNECT PROVIDER TO EXECUTE';
 if(capability.requires&&!isConnected(capability,integrations))return `BUILT — CONNECT ${capability.requires.toUpperCase()}`;
 return 'AVAILABLE NOW';
}

function CapabilityDot({capability,integrations}:{capability:Capability;integrations:any}){
 const live=isImmediate(capability,integrations);
 const color=live?'#12b76a':'#f79009';
 return <span style={{width:9,height:9,borderRadius:999,background:color,flex:'0 0 auto',marginTop:3}}/>;
}

function CapabilityCatalog({title,list,integrations}:{title:string;list:Capability[];integrations:any}){
 return <div className={styles.panel}><h3>{title}</h3><p className={styles.muted}>Green = executes immediately in Indie Cut. Amber = the workflow capability is built and selectable, but an outside provider must be connected before that external event/action can complete.</p>{categories(list).map(category=><div key={category}><div className={styles.sectionTitle}>{category}</div>{list.filter(x=>x.category===category).map(x=><div className={styles.integrationCard} key={x.id}><CapabilityDot capability={x} integrations={integrations}/><div><strong>{x.label}</strong><div className={styles.muted}>{x.description}</div><div className={styles.tiny}>{capabilityStatus(x,integrations)}</div></div></div>)}</div>)}</div>;
}

function ActionPicker({data,onAdd,workflow,enrollContact,setEnrollContact,onEnroll}:any){
 return <><h3>Add an Action</h3><p className={styles.muted}>Every action can be added now. Native actions execute immediately. Provider actions are stored in the workflow and queue safely until that provider is connected.</p>{categories(ACTIONS).map(category=><div key={category}><div className={styles.sectionTitle}>{category}</div><div className={styles.library}>{ACTIONS.filter(x=>x.category===category).map(action=><button className={styles.libraryButton} key={action.id} onClick={()=>onAdd(action.id)}><CapabilityDot capability={action} integrations={data.integrations}/><span>{action.label}<div className={styles.tiny}>{action.description}{action.mode==='connection'&&!isConnected(action,data.integrations)?` · connection needed: ${action.requires}`:''}</div></span></button>)}</div></div>)}{workflow.id&&<><div className={styles.sectionTitle}>TEST / MANUAL ENROLL</div><select className={styles.select} value={enrollContact} onChange={e=>setEnrollContact(e.target.value)}><option value="">Choose contact…</option>{(data.contacts||[]).map((c:any)=><option key={c.id} value={c.id}>{c.artist_name||c.full_name||c.email||c.phone}</option>)}</select><button className={styles.primary} disabled={!enrollContact} onClick={onEnroll}>Enroll Contact</button></>}</>;
}

function TriggerEditor({workflow,setWorkflow,tags,integrations}:any){
 const selected=byId(TRIGGERS,workflow.trigger_type);
 return <><h3>Workflow Trigger</h3><p className={styles.muted}>All triggers are selectable. External triggers begin firing as soon as their source connection is added.</p><label className={styles.label}>Trigger<select className={styles.select} value={workflow.trigger_type||'manual'} onChange={e=>setWorkflow({...workflow,trigger_type:e.target.value,trigger_config:{}})}>{categories(TRIGGERS).map(category=><optgroup label={category} key={category}>{TRIGGERS.filter(x=>x.category===category).map(trigger=><option key={trigger.id} value={trigger.id}>{trigger.label}</option>)}</optgroup>)}</select></label>{selected&&selected.mode==='connection'&&!isConnected(selected,integrations)&&<div className={styles.message}>This trigger is built into the workflow engine. Connect {selected.requires} before live events can enter the workflow.</div>}{workflow.trigger_type==='status_changed'&&<label className={styles.label}>New status<select className={styles.select} value={workflow.trigger_config?.status||''} onChange={e=>setWorkflow({...workflow,trigger_config:{...workflow.trigger_config,status:e.target.value}})}><option value="">Any status</option>{STATUSES.map(status=><option key={status}>{status}</option>)}</select></label>}{['tag_added','tag_removed'].includes(workflow.trigger_type)&&<label className={styles.label}>Tag<select className={styles.select} value={workflow.trigger_config?.tag||''} onChange={e=>setWorkflow({...workflow,trigger_config:{...workflow.trigger_config,tag:e.target.value}})}><option value="">Any tag</option>{tags.map((tag:any)=><option key={tag.id} value={tag.name}>{tag.name}</option>)}</select></label>}{workflow.trigger_type==='sms_reply'&&<label className={styles.label}>Optional keyword<input className={styles.input} value={workflow.trigger_config?.keyword||''} onChange={e=>setWorkflow({...workflow,trigger_config:{...workflow.trigger_config,keyword:e.target.value}})}/></label>}{workflow.trigger_type==='vote_received'&&<label className={styles.label}>Minimum votes<input className={styles.input} type="number" min="1" value={workflow.trigger_config?.min_votes||''} onChange={e=>setWorkflow({...workflow,trigger_config:{...workflow.trigger_config,min_votes:Number(e.target.value)||null}})}/></label>}{workflow.trigger_type==='scheduled'&&<><label className={styles.label}>Repeat<select className={styles.select} value={workflow.trigger_config?.recurrence||'daily'} onChange={e=>setWorkflow({...workflow,trigger_config:{...workflow.trigger_config,recurrence:e.target.value}})}><option value="once">One time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label className={styles.label}>First run<input className={styles.input} type="datetime-local" value={workflow.trigger_config?.run_at||''} onChange={e=>setWorkflow({...workflow,trigger_config:{...workflow.trigger_config,run_at:e.target.value}})}/></label></>}{workflow.trigger_type==='stale_opportunities'&&<label className={styles.label}>Stale after days<input className={styles.input} type="number" min="1" value={workflow.trigger_config?.days||7} onChange={e=>setWorkflow({...workflow,trigger_config:{...workflow.trigger_config,days:Number(e.target.value)||7}})}/></label>}{workflow.trigger_type==='custom_date_reminder'&&<label className={styles.label}>Custom field key<input className={styles.input} value={workflow.trigger_config?.field||''} onChange={e=>setWorkflow({...workflow,trigger_config:{...workflow.trigger_config,field:e.target.value}})} placeholder="renewal_date"/></label>}{workflow.trigger_type==='webhook_received'&&<div className={styles.message}>Endpoint after saving: /api/workflows/webhook/{workflow.id||'WORKFLOW_ID'}</div>}</>;
}

function StepEditor({step,tags,workflows,integrations,onChange,nested=false}:any){
 const config=step.step_config||{};
 const capability=byId(ACTIONS,step.step_type);
 const connectionWaiting=capability?.mode==='connection'&&!isConnected(capability,integrations);
 return <>{!nested&&<><h3>{capability?.label||step.step_type}</h3><p className={styles.muted}>{capability?.description}</p>{connectionWaiting&&<div className={styles.message}>This action is saved in the workflow now. If it runs before {capability?.requires} is connected, Indie Cut will place it in the integration queue instead of losing the action.</div>}</>}
  <div className={styles.form}>
   {step.step_type==='send_sms'&&<label className={styles.label}>Message<textarea className={styles.textarea} rows={6} value={config.message||''} onChange={e=>onChange({message:e.target.value})}/></label>}
   {step.step_type==='send_email'&&<><label className={styles.label}>Subject<input className={styles.input} value={config.subject||''} onChange={e=>onChange({subject:e.target.value})}/></label><label className={styles.label}>Message<textarea className={styles.textarea} rows={6} value={config.message||''} onChange={e=>onChange({message:e.target.value})}/></label></>}
   {step.step_type==='internal_email'&&<><label className={styles.label}>Send to<input className={styles.input} value={config.to||''} onChange={e=>onChange({to:e.target.value})}/></label><label className={styles.label}>Subject<input className={styles.input} value={config.subject||''} onChange={e=>onChange({subject:e.target.value})}/></label><label className={styles.label}>Message<textarea className={styles.textarea} rows={5} value={config.message||''} onChange={e=>onChange({message:e.target.value})}/></label></>}
   {step.step_type==='if_else'&&<IfElseEditor config={config} tags={tags} onChange={onChange}/>} 
   {step.step_type==='wait'&&<><label className={styles.label}>Amount<input className={styles.input} type="number" min="1" value={config.amount||1} onChange={e=>onChange({amount:Number(e.target.value)})}/></label><label className={styles.label}>Unit<select className={styles.select} value={config.unit||'hours'} onChange={e=>onChange({unit:e.target.value})}><option>minutes</option><option>hours</option><option>days</option></select></label></>}
   {step.step_type==='wait_until'&&<label className={styles.label}>Resume at<input className={styles.input} type="datetime-local" value={config.datetime||''} onChange={e=>onChange({datetime:e.target.value})}/></label>}
   {step.step_type==='go_to'&&<label className={styles.label}>Step index<input className={styles.input} type="number" min="0" value={config.step_index||0} onChange={e=>onChange({step_index:Number(e.target.value)})}/></label>}
   {['add_tag','remove_tag'].includes(step.step_type)&&<label className={styles.label}>Tag<select className={styles.select} value={config.tag||''} onChange={e=>onChange({tag:e.target.value})}><option value="">Choose tag…</option>{tags.map((tag:any)=><option key={tag.id} value={tag.name}>{tag.name}</option>)}</select></label>}
   {step.step_type==='update_status'&&<label className={styles.label}>Status<select className={styles.select} value={config.status||'active'} onChange={e=>onChange({status:e.target.value})}>{STATUSES.map(status=><option key={status}>{status}</option>)}</select></label>}
   {step.step_type==='update_contact'&&<><label className={styles.label}>Field<select className={styles.select} value={config.field||'genre'} onChange={e=>onChange({field:e.target.value})}>{CONTACT_FIELDS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label className={styles.label}>Value<input className={styles.input} value={config.value||''} onChange={e=>onChange({value:e.target.value})}/></label></>}
   {step.step_type==='assign_user'&&<label className={styles.label}>Assigned user<input className={styles.input} value={config.user||''} onChange={e=>onChange({user:e.target.value})}/></label>}
   {step.step_type==='set_dnd'&&<label className={styles.label}>DND<select className={styles.select} value={String(config.value??true)} onChange={e=>onChange({value:e.target.value==='true'})}><option value="true">Enable DND</option><option value="false">Disable DND</option></select></label>}
   {step.step_type==='engagement_score'&&<label className={styles.label}>Score<input className={styles.input} type="number" value={config.value||0} onChange={e=>onChange({value:Number(e.target.value)})}/></label>}
   {step.step_type==='add_note'&&<label className={styles.label}>Note<textarea className={styles.textarea} rows={5} value={config.note||''} onChange={e=>onChange({note:e.target.value})}/></label>}
   {step.step_type==='create_task'&&<><label className={styles.label}>Task title<input className={styles.input} value={config.title||''} onChange={e=>onChange({title:e.target.value})}/></label><label className={styles.label}>Notes<textarea className={styles.textarea} rows={4} value={config.notes||''} onChange={e=>onChange({notes:e.target.value})}/></label><label className={styles.label}>Due in hours<input className={styles.input} type="number" min="0" value={config.due_hours||24} onChange={e=>onChange({due_hours:Number(e.target.value)})}/></label></>}
   {step.step_type==='copy_contact'&&<><label className={styles.label}>New contact name<input className={styles.input} value={config.artist_name||''} onChange={e=>onChange({artist_name:e.target.value})}/></label><label className={styles.label}>New email<input className={styles.input} value={config.email||''} onChange={e=>onChange({email:e.target.value})}/></label><label className={styles.label}>New phone<input className={styles.input} value={config.phone||''} onChange={e=>onChange({phone:e.target.value})}/></label></>}
   {step.step_type==='update_custom_value'&&<><label className={styles.label}>Key<input className={styles.input} value={config.key||''} onChange={e=>onChange({key:e.target.value})}/></label><label className={styles.label}>Value<input className={styles.input} value={config.value||''} onChange={e=>onChange({value:e.target.value})}/></label></>}
   {step.step_type==='text_formatter'&&<><label className={styles.label}>Input<textarea className={styles.textarea} rows={4} value={config.input||''} onChange={e=>onChange({input:e.target.value})}/></label><label className={styles.label}>Operation<select className={styles.select} value={config.operation||'trim'} onChange={e=>onChange({operation:e.target.value})}><option value="trim">Trim</option><option value="uppercase">Uppercase</option><option value="lowercase">Lowercase</option><option value="titlecase">Title Case</option></select></label><label className={styles.label}>Save to<select className={styles.select} value={config.save_to||'notes'} onChange={e=>onChange({save_to:e.target.value})}><option value="notes">Notes</option><option value="source">Source</option><option value="status">Status</option></select></label></>}
   {['enroll_workflow','remove_from_workflow'].includes(step.step_type)&&<label className={styles.label}>Workflow<select className={styles.select} value={config.workflow_id||''} onChange={e=>onChange({workflow_id:e.target.value})}><option value="">Choose workflow…</option>{workflows.map((w:any)=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
   {step.step_type==='outbound_webhook'&&<><label className={styles.label}>URL<input className={styles.input} value={config.url||''} onChange={e=>onChange({url:e.target.value})} placeholder="https://..."/></label><label className={styles.label}>Method<select className={styles.select} value={config.method||'POST'} onChange={e=>onChange({method:e.target.value})}><option>POST</option><option>PUT</option><option>PATCH</option></select></label><label className={styles.label}>JSON body<textarea className={styles.textarea} rows={4} value={config.body_template||''} onChange={e=>onChange({body_template:e.target.value})} placeholder={'{"artist":"{{artist_name}}"}'}/></label></>}
   {step.step_type.startsWith('ai_')&&<><label className={styles.label}>Input<textarea className={styles.textarea} rows={5} value={config.input||''} onChange={e=>onChange({input:e.target.value})}/></label><label className={styles.label}>Instruction<textarea className={styles.textarea} rows={3} value={config.instruction||''} onChange={e=>onChange({instruction:e.target.value})}/></label>{step.step_type==='ai_translate'&&<label className={styles.label}>Language<input className={styles.input} value={config.language||'Spanish'} onChange={e=>onChange({language:e.target.value})}/></label>}<label className={styles.label}>Save result to<select className={styles.select} value={config.save_to||'notes'} onChange={e=>onChange({save_to:e.target.value})}><option value="notes">Notes</option><option value="source">Source</option><option value="status">Status</option></select></label></>}
   {['create_appointment','update_appointment','create_opportunity','update_opportunity','affiliate_add','affiliate_update','course_grant','course_revoke','community_grant','community_revoke','issue_certificate','create_invoice','create_estimate','create_order','create_subscription'].includes(step.step_type)&&<ObjectActionEditor type={step.step_type} config={config} onChange={onChange}/>} 
   {capability?.mode==='connection'&&<ExternalActionEditor capability={capability} config={config} onChange={onChange}/>} 
   <div className={styles.tiny}>Merge fields: {'{{artist_name}}'}, {'{{first_name}}'}, {'{{genre}}'}, {'{{city}}'}, {'{{email}}'}, {'{{phone}}'}, {'{{notes}}'}</div>
  </div>
 </>;
}

function ObjectActionEditor({type,config,onChange}:any){
 const appointment=['create_appointment','update_appointment'].includes(type);
 const opportunity=['create_opportunity','update_opportunity'].includes(type);
 const hasAmount=opportunity||['create_invoice','create_estimate','create_order','create_subscription'].includes(type);
 return <><label className={styles.label}>Title<input className={styles.input} value={config.title||''} onChange={e=>onChange({title:e.target.value})} placeholder={appointment?'Appointment title':opportunity?'Opportunity title':'Name / title'}/></label>{['update_appointment','update_opportunity','affiliate_update'].includes(type)&&<label className={styles.label}>Existing object ID <span className={styles.tiny}>(optional)</span><input className={styles.input} value={config.object_id||''} onChange={e=>onChange({object_id:e.target.value})}/></label>}<label className={styles.label}>Status<input className={styles.input} value={config.status||''} onChange={e=>onChange({status:e.target.value})}/></label>{appointment&&<label className={styles.label}>Starts at<input className={styles.input} type="datetime-local" value={config.starts_at||''} onChange={e=>onChange({starts_at:e.target.value})}/></label>}{opportunity&&<label className={styles.label}>Pipeline stage<input className={styles.input} value={config.stage||''} onChange={e=>onChange({stage:e.target.value})}/></label>}{hasAmount&&<label className={styles.label}>Amount<input className={styles.input} type="number" step="0.01" value={config.amount||''} onChange={e=>onChange({amount:e.target.value})}/></label>}{['create_invoice','create_estimate'].includes(type)&&<label className={styles.label}>Due at<input className={styles.input} type="datetime-local" value={config.due_at||''} onChange={e=>onChange({due_at:e.target.value})}/></label>}</>;
}

function ExternalActionEditor({capability,config,onChange}:any){
 return <><label className={styles.label}>Action payload / note<textarea className={styles.textarea} rows={5} value={config.message||config.note||''} onChange={e=>onChange({message:e.target.value})} placeholder={`Configure ${capability.label}. This is retained until ${capability.requires} is connected.`}/></label><div className={styles.message}>Connection required: {capability.requires}. This action will be placed in Indie Cut's integration queue if the workflow reaches it before the provider adapter is live.</div></>;
}

function IfElseEditor({config,tags,onChange}:any){
 const branch=(key:string,label:string)=>{
  const items=Array.isArray(config[key])?config[key]:[];
  const allowed=ACTIONS.filter(action=>action.mode!=='connection'&&!['wait','wait_until','if_else','go_to','stop_workflow','delete_contact'].includes(action.id));
  return <div className={styles.panel} style={{padding:10,marginTop:10}}><strong>{label}</strong>{items.map((step:any,index:number)=><div key={index} className={styles.row}><span>{byId(ACTIONS,step.step_type)?.label||step.step_type}</span><button className={styles.danger} onClick={()=>onChange({[key]:items.filter((_:any,i:number)=>i!==index)})}>Remove</button></div>)}<select className={styles.select} value="" onChange={e=>{if(e.target.value)onChange({[key]:[...items,{step_type:e.target.value,step_config:defaultConfig(e.target.value)}]})}}><option value="">＋ Add branch action</option>{allowed.map(action=><option key={action.id} value={action.id}>{action.label}</option>)}</select></div>;
 };
 return <><label className={styles.label}>Check field<select className={styles.select} value={config.field||'status'} onChange={e=>onChange({field:e.target.value,value:''})}>{CONDITION_FIELDS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label className={styles.label}>Condition<select className={styles.select} value={config.operator||'equals'} onChange={e=>onChange({operator:e.target.value})}>{OPERATORS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>{!['exists','not_exists'].includes(config.operator)&&<label className={styles.label}>Value{config.field==='tag'?<select className={styles.select} value={config.value||''} onChange={e=>onChange({value:e.target.value})}><option value="">Choose tag…</option>{tags.map((tag:any)=><option key={tag.id} value={tag.name}>{tag.name}</option>)}</select>:config.field==='status'?<select className={styles.select} value={config.value||''} onChange={e=>onChange({value:e.target.value})}>{STATUSES.map(status=><option key={status}>{status}</option>)}</select>:config.field==='genre'?<select className={styles.select} value={config.value||''} onChange={e=>onChange({value:e.target.value})}>{GENRES.map(genre=><option key={genre}>{genre}</option>)}</select>:<input className={styles.input} value={config.value??''} onChange={e=>onChange({value:e.target.value})}/>}</label>}{branch('yes_steps','YES — condition matches')}{branch('no_steps','NO — condition does not match')}</>;
}

function stepSummary(step:any){
 const config=step.step_config||{};
 if(step.step_type==='send_email')return config.subject||'Compose email';
 if(step.step_type==='send_sms')return config.message||'Compose SMS';
 if(step.step_type==='if_else')return `If ${config.field||'status'} ${config.operator||'equals'} ${config.value??''}`;
 if(step.step_type==='wait')return `${config.amount||1} ${config.unit||'hours'}`;
 if(step.step_type==='wait_until')return config.datetime||'Choose date/time';
 if(['add_tag','remove_tag'].includes(step.step_type))return config.tag||'Choose tag';
 if(['create_appointment','update_appointment','create_opportunity','update_opportunity'].includes(step.step_type))return config.title||byId(ACTIONS,step.step_type)?.description||'';
 return byId(ACTIONS,step.step_type)?.description||'';
}
