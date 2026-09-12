import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {sendTextGridSms} from '../../../../lib/textgrid';
import {enrollMatchingWorkflows} from '../../../../lib/crm-workflows';

export const dynamic='force-dynamic';
export const maxDuration=120;

function db(){return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}
async function sendEmail(to:string,subject:string,body:string){
 const key=process.env.RESEND_API_KEY,from=process.env.INDIECUT_FROM_EMAIL;if(!key||!from)throw new Error('Email integration not configured.');
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({from,to:[to],subject,text:body})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j?.message||'Email send failed.');
}
function waitUntil(config:any){const amount=Math.max(1,Number(config?.amount)||1);const unit=String(config?.unit||'hours');const ms=unit==='minutes'?amount*60000:unit==='days'?amount*86400000:amount*3600000;return new Date(Date.now()+ms).toISOString()}
function mergeText(text:string,contact:any){return String(text||'').replaceAll('{{artist_name}}',contact.artist_name||contact.full_name||'').replaceAll('{{first_name}}',String(contact.full_name||contact.artist_name||'').split(/\s+/)[0]||'').replaceAll('{{genre}}',contact.genre||'').replaceAll('{{city}}',contact.city||'')}

export async function GET(){
 const client=db();let smsSent=0,smsFailed=0,workflowSteps=0,workflowFailed=0;
 const now=new Date().toISOString();
 const {data:smsQueue}=await client.from('crm_sms_queue').select('*').eq('status','queued').lte('scheduled_at',now).order('scheduled_at',{ascending:true}).limit(100);
 for(const item of smsQueue||[]){try{const sent=await sendTextGridSms(item.phone,item.body);await client.from('crm_sms_queue').update({status:'sent',provider_message_id:sent.id||null,sent_at:new Date().toISOString(),error:null}).eq('id',item.id);await client.from('crm_sms_messages').insert({contact_id:item.contact_id,direction:'outbound',phone:item.phone,body:item.body,status:'sent',provider_message_id:sent.id||null});smsSent++;}catch(e:any){await client.from('crm_sms_queue').update({status:'failed',error:String(e?.message||'SMS failed')}).eq('id',item.id);smsFailed++;}}
 const campaignIds=Array.from(new Set((smsQueue||[]).map((x:any)=>x.campaign_id).filter(Boolean)));
 for(const id of campaignIds){const [{count:sent},{count:failed},{count:queued}]=await Promise.all([client.from('crm_sms_queue').select('*',{count:'exact',head:true}).eq('campaign_id',id).eq('status','sent'),client.from('crm_sms_queue').select('*',{count:'exact',head:true}).eq('campaign_id',id).eq('status','failed'),client.from('crm_sms_queue').select('*',{count:'exact',head:true}).eq('campaign_id',id).eq('status','queued')]);await client.from('crm_sms_campaigns').update({sent_count:sent||0,failed_count:failed||0,status:(queued||0)>0?'sending':'completed',updated_at:new Date().toISOString()}).eq('id',id)}

 const {data:enrollments}=await client.from('crm_workflow_enrollments').select('*').eq('status','active').lte('next_run_at',now).order('next_run_at',{ascending:true}).limit(100);
 for(const enrollment of enrollments||[]){try{
  const [{data:workflow},{data:contact},{data:steps}]=await Promise.all([client.from('crm_workflows').select('*').eq('id',enrollment.workflow_id).maybeSingle(),client.from('crm_contacts').select('*').eq('id',enrollment.contact_id).maybeSingle(),client.from('crm_workflow_steps').select('*').eq('workflow_id',enrollment.workflow_id).order('step_order',{ascending:true})]);
  if(!workflow||workflow.status!=='published'||!contact){await client.from('crm_workflow_enrollments').update({status:'stopped',updated_at:new Date().toISOString()}).eq('id',enrollment.id);continue}
  let currentStep=Number(enrollment.current_step||0);let currentContact:any=contact;let settled=false;
  for(let guard=0;guard<100;guard++){
   const step=(steps||[])[currentStep];
   if(!step){await client.from('crm_workflow_enrollments').update({status:'completed',current_step:currentStep,last_error:null,updated_at:new Date().toISOString()}).eq('id',enrollment.id);settled=true;break}
   const cfg=step.step_config||{};
   if(step.step_type==='wait'){
    currentStep++;
    await client.from('crm_workflow_enrollments').update({current_step:currentStep,status:'active',next_run_at:waitUntil(cfg),last_error:null,updated_at:new Date().toISOString()}).eq('id',enrollment.id);
    workflowSteps++;settled=true;break;
   }
   if(step.step_type==='send_sms'){
    if(currentContact.sms_opt_in&&currentContact.phone){const text=mergeText(cfg.message||'',currentContact);const sent=await sendTextGridSms(currentContact.phone,text);await client.from('crm_sms_messages').insert({contact_id:currentContact.id,direction:'outbound',phone:currentContact.phone,body:text,status:'sent',provider_message_id:sent.id||null});await client.from('crm_activity').insert({contact_id:currentContact.id,activity_type:'workflow_sms',detail:`${workflow.name}: ${text.slice(0,160)}`});}
   }else if(step.step_type==='send_email'){
    if(currentContact.email_opt_in&&currentContact.email){await sendEmail(currentContact.email,mergeText(cfg.subject||'Indie Cut',currentContact),mergeText(cfg.message||'',currentContact));await client.from('crm_activity').insert({contact_id:currentContact.id,activity_type:'workflow_email',detail:`${workflow.name}: ${cfg.subject||'Email'}`});}
   }else if(step.step_type==='add_tag'){
    const tag=String(cfg.tag||'').trim();if(tag){const existingTags=Array.isArray(currentContact.tags)?currentContact.tags:[];const hadTag=existingTags.some((x:any)=>String(x).trim().toLowerCase()===tag.toLowerCase());const tags=Array.from(new Set([...existingTags,tag]));await client.from('crm_contacts').update({tags,updated_at:new Date().toISOString()}).eq('id',currentContact.id);currentContact={...currentContact,tags};if(!hadTag)await enrollMatchingWorkflows(client,currentContact.id,'tag_added',{tag});}
   }else if(step.step_type==='update_status'){
    if(cfg.status){const nextStatus=String(cfg.status);const previousStatus=String(currentContact.status||'');await client.from('crm_contacts').update({status:nextStatus,updated_at:new Date().toISOString()}).eq('id',currentContact.id);currentContact={...currentContact,status:nextStatus};if(previousStatus!==nextStatus)await enrollMatchingWorkflows(client,currentContact.id,'status_changed',{status:nextStatus,previousStatus});}
   }else if(step.step_type==='create_task'){
    if(cfg.title)await client.from('crm_tasks').insert({contact_id:currentContact.id,title:mergeText(cfg.title,currentContact),notes:mergeText(cfg.notes||'',currentContact)||null,status:'open',priority:String(cfg.priority||'normal'),due_at:cfg.due_hours?new Date(Date.now()+Number(cfg.due_hours)*3600000).toISOString():null});
   }
   currentStep++;
   const done=currentStep>=(steps||[]).length;
   await client.from('crm_workflow_enrollments').update({current_step:currentStep,status:done?'completed':'active',next_run_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',enrollment.id);
   workflowSteps++;
   if(done){settled=true;break}
  }
  if(!settled)throw new Error('Workflow exceeded 100 immediate steps.');
 }catch(e:any){await client.from('crm_workflow_enrollments').update({status:'failed',last_error:String(e?.message||'Workflow failed'),updated_at:new Date().toISOString()}).eq('id',enrollment.id);workflowFailed++;}}
 return NextResponse.json({ok:true,smsSent,smsFailed,workflowSteps,workflowFailed});
}
