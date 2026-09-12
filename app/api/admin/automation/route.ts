import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';
import {sendTextGridSms,textGridConfigured} from '../../../../lib/textgrid';

export const dynamic='force-dynamic';

function serviceDb(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return null;
 return createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function adminDb(){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return {error:NextResponse.json({error:'Unauthorized'},{status:401})};
 const db=serviceDb();if(!db)return {error:NextResponse.json({error:'CRM database is not configured.'},{status:503})};
 return {db};
}

async function snapshot(db:any){
 const [{data:workflows},{data:steps},{data:smsTemplates},{data:smsCampaigns},{data:contacts},{data:enrollments},{count:smsQueued},{count:smsSent},{count:smsFailed}]=await Promise.all([
  db.from('crm_workflows').select('*').order('updated_at',{ascending:false}).limit(200),
  db.from('crm_workflow_steps').select('*').order('step_order',{ascending:true}).limit(2000),
  db.from('crm_sms_templates').select('*').order('updated_at',{ascending:false}).limit(200),
  db.from('crm_sms_campaigns').select('*').order('created_at',{ascending:false}).limit(200),
  db.from('crm_contacts').select('id,artist_name,full_name,email,phone,genre,status,tags,email_opt_in,sms_opt_in').order('updated_at',{ascending:false}).limit(1000),
  db.from('crm_workflow_enrollments').select('*').order('created_at',{ascending:false}).limit(500),
  db.from('crm_sms_queue').select('*',{count:'exact',head:true}).eq('status','queued'),
  db.from('crm_sms_queue').select('*',{count:'exact',head:true}).eq('status','sent'),
  db.from('crm_sms_queue').select('*',{count:'exact',head:true}).eq('status','failed')
 ]);
 return {workflows:workflows||[],steps:steps||[],smsTemplates:smsTemplates||[],smsCampaigns:smsCampaigns||[],contacts:contacts||[],enrollments:enrollments||[],smsStats:{queued:smsQueued||0,sent:smsSent||0,failed:smsFailed||0},integrations:{textgrid:textGridConfigured(),email:Boolean(process.env.RESEND_API_KEY&&process.env.INDIECUT_FROM_EMAIL)}};
}

function cleanSteps(items:any[]){return (Array.isArray(items)?items:[]).map((s:any,i:number)=>({step_order:i,step_type:String(s.step_type||'').trim(),step_config:s.step_config&&typeof s.step_config==='object'?s.step_config:{}})).filter((s:any)=>s.step_type).slice(0,100)}

export async function GET(){const a=await adminDb();if(a.error)return a.error;return NextResponse.json(await snapshot(a.db));}

export async function POST(request:Request){
 const a=await adminDb();if(a.error)return a.error;const db=a.db;const body=await request.json().catch(()=>({}));const action=String(body.action||'');
 try{
  if(action==='save_workflow'){
   const w=body.workflow||{};const payload={name:String(w.name||'').trim(),description:String(w.description||'').trim()||null,trigger_type:String(w.trigger_type||'manual').trim(),trigger_config:w.trigger_config&&typeof w.trigger_config==='object'?w.trigger_config:{},status:String(w.status||'draft'),updated_at:new Date().toISOString()};
   if(!payload.name)return NextResponse.json({error:'Workflow name is required.'},{status:400});
   let id=String(w.id||'');
   if(id){const {error}=await db.from('crm_workflows').update(payload).eq('id',id);if(error)throw error;}
   else{const {data,error}=await db.from('crm_workflows').insert(payload).select('id').single();if(error)throw error;id=data.id;}
   const steps=cleanSteps(body.steps||[]);const {error:delErr}=await db.from('crm_workflow_steps').delete().eq('workflow_id',id);if(delErr)throw delErr;
   if(steps.length){const {error}=await db.from('crm_workflow_steps').insert(steps.map((s:any)=>({...s,workflow_id:id})));if(error)throw error;}
  }else if(action==='delete_workflow'){
   const {error}=await db.from('crm_workflows').delete().eq('id',String(body.workflowId||''));if(error)throw error;
  }else if(action==='publish_workflow'){
   const status=body.publish===false?'draft':'published';const {error}=await db.from('crm_workflows').update({status,updated_at:new Date().toISOString()}).eq('id',String(body.workflowId||''));if(error)throw error;
  }else if(action==='enroll_contact'){
   const workflowId=String(body.workflowId||''),contactId=String(body.contactId||'');
   if(!workflowId||!contactId)return NextResponse.json({error:'Workflow and contact are required.'},{status:400});
   const {error}=await db.from('crm_workflow_enrollments').insert({workflow_id:workflowId,contact_id:contactId,current_step:0,status:'active',next_run_at:new Date().toISOString()});if(error)throw error;
  }else if(action==='send_sms'){
   const contactId=String(body.contactId||''),message=String(body.message||'').trim();
   if(!message)return NextResponse.json({error:'Text message is required.'},{status:400});
   const {data:contact}=await db.from('crm_contacts').select('*').eq('id',contactId).maybeSingle();
   if(!contact?.phone)return NextResponse.json({error:'This contact does not have a phone number.'},{status:400});
   if(!contact.sms_opt_in)return NextResponse.json({error:'This contact has not opted in to SMS.'},{status:409});
   const sent=await sendTextGridSms(contact.phone,message);
   await Promise.all([
    db.from('crm_sms_messages').insert({contact_id:contact.id,direction:'outbound',phone:contact.phone,body:message,status:'sent',provider_message_id:sent.id||null}),
    db.from('crm_activity').insert({contact_id:contact.id,activity_type:'sms_sent',detail:message.slice(0,180)}),
    db.from('crm_contacts').update({last_contacted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',contact.id)
   ]);
  }else if(action==='save_sms_template'){
   const t=body.template||{};const payload={name:String(t.name||'').trim(),body:String(t.body||'').trim(),active:t.active!==false,updated_at:new Date().toISOString()};
   if(!payload.name||!payload.body)return NextResponse.json({error:'Template name and message are required.'},{status:400});
   if(t.id){const {error}=await db.from('crm_sms_templates').update(payload).eq('id',String(t.id));if(error)throw error;}else{const {error}=await db.from('crm_sms_templates').insert(payload);if(error)throw error;}
  }else if(action==='delete_sms_template'){
   const {error}=await db.from('crm_sms_templates').delete().eq('id',String(body.templateId||''));if(error)throw error;
  }else if(action==='queue_sms_campaign'){
   const p=body.campaign||{};const name=String(p.name||'').trim(),message=String(p.body||'').trim(),filterStatus=String(p.filter_status||'').trim()||null,filterGenre=String(p.filter_genre||'').trim()||null,scheduledAt=p.scheduled_at?new Date(p.scheduled_at).toISOString():new Date().toISOString();
   if(!name||!message)return NextResponse.json({error:'Campaign name and message are required.'},{status:400});
   let q=db.from('crm_contacts').select('id,phone').eq('sms_opt_in',true).not('phone','is',null);if(filterStatus)q=q.eq('status',filterStatus);if(filterGenre)q=q.eq('genre',filterGenre);
   const {data:recipients,error:recErr}=await q;if(recErr)throw recErr;if(!recipients?.length)return NextResponse.json({error:'No opted-in contacts match this SMS campaign.'},{status:409});
   const {data:campaign,error:campErr}=await db.from('crm_sms_campaigns').insert({name,body:message,status:'scheduled',filter_status:filterStatus,filter_genre:filterGenre,scheduled_at:scheduledAt,queued_count:recipients.length}).select('*').single();if(campErr)throw campErr;
   const queue=recipients.map((c:any)=>({campaign_id:campaign.id,contact_id:c.id,phone:c.phone,body:message,status:'queued',scheduled_at:scheduledAt}));const {error:qErr}=await db.from('crm_sms_queue').insert(queue);if(qErr)throw qErr;
  }else return NextResponse.json({error:'Unknown automation action.'},{status:400});
  return NextResponse.json({ok:true,...await snapshot(db)});
 }catch(e:any){return NextResponse.json({error:e?.message||'Automation update failed.'},{status:500});}
}
