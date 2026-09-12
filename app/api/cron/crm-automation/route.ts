import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {sendTextGridSms} from '../../../../lib/textgrid';
import {executeWorkflowStep,runScheduledWorkflowTriggers,waitUntil} from '../../../../lib/workflow-runner';

export const dynamic='force-dynamic';
export const maxDuration=120;
function db(){return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}

export async function GET(){
 const client=db(),nowDate=new Date(),now=nowDate.toISOString();let smsSent=0,smsFailed=0,workflowSteps=0,workflowFailed=0;
 const scheduledEnrolled=await runScheduledWorkflowTriggers(client,nowDate);
 const {data:smsQueue}=await client.from('crm_sms_queue').select('*').eq('status','queued').lte('scheduled_at',now).order('scheduled_at',{ascending:true}).limit(100);
 for(const item of smsQueue||[]){try{const sent=await sendTextGridSms(item.phone,item.body);await client.from('crm_sms_queue').update({status:'sent',provider_message_id:sent.id||null,sent_at:new Date().toISOString(),error:null}).eq('id',item.id);await client.from('crm_sms_messages').insert({contact_id:item.contact_id,direction:'outbound',phone:item.phone,body:item.body,status:'sent',provider_message_id:sent.id||null});smsSent++}catch(e:any){await client.from('crm_sms_queue').update({status:'failed',error:String(e?.message||'SMS failed')}).eq('id',item.id);smsFailed++}}
 const campaignIds=Array.from(new Set((smsQueue||[]).map((x:any)=>x.campaign_id).filter(Boolean)));for(const id of campaignIds){const[{count:sent},{count:failed},{count:queued}]=await Promise.all([client.from('crm_sms_queue').select('*',{count:'exact',head:true}).eq('campaign_id',id).eq('status','sent'),client.from('crm_sms_queue').select('*',{count:'exact',head:true}).eq('campaign_id',id).eq('status','failed'),client.from('crm_sms_queue').select('*',{count:'exact',head:true}).eq('campaign_id',id).eq('status','queued')]);await client.from('crm_sms_campaigns').update({sent_count:sent||0,failed_count:failed||0,status:(queued||0)>0?'sending':'completed',updated_at:new Date().toISOString()}).eq('id',id)}
 const {data:enrollments}=await client.from('crm_workflow_enrollments').select('*').eq('status','active').lte('next_run_at',now).order('next_run_at',{ascending:true}).limit(100);
 for(const enrollment of enrollments||[]){try{
  const[{data:workflow},{data:contact},{data:steps}]=await Promise.all([client.from('crm_workflows').select('*').eq('id',enrollment.workflow_id).maybeSingle(),client.from('crm_contacts').select('*').eq('id',enrollment.contact_id).maybeSingle(),client.from('crm_workflow_steps').select('*').eq('workflow_id',enrollment.workflow_id).order('step_order',{ascending:true})]);
  if(!workflow||workflow.status!=='published'||!contact){await client.from('crm_workflow_enrollments').update({status:'stopped',updated_at:new Date().toISOString()}).eq('id',enrollment.id);continue}
  let currentStep=Number(enrollment.current_step||0),currentContact:any=contact,settled=false;
  for(let guard=0;guard<150;guard++){
   const step=(steps||[])[currentStep];if(!step){await client.from('crm_workflow_enrollments').update({status:'completed',current_step:currentStep,last_error:null,updated_at:new Date().toISOString()}).eq('id',enrollment.id);settled=true;break}
   const cfg=step.step_config||{};
   if(step.step_type==='wait'||step.step_type==='wait_until'){currentStep++;const resume=step.step_type==='wait_until'&&cfg.datetime?new Date(cfg.datetime).toISOString():waitUntil(cfg);await client.from('crm_workflow_enrollments').update({current_step:currentStep,status:'active',next_run_at:resume,last_error:null,updated_at:new Date().toISOString()}).eq('id',enrollment.id);workflowSteps++;settled=true;break}
   const result=await executeWorkflowStep(step,currentContact,workflow,client);currentContact=result.contact;
   if(result.jumpTo!==undefined){currentStep=Math.max(0,Math.min(Number(result.jumpTo)||0,(steps||[]).length));await client.from('crm_workflow_enrollments').update({current_step:currentStep,status:'active',next_run_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',enrollment.id);workflowSteps++;continue}
   currentStep++;
   if(result.stop){await client.from('crm_workflow_enrollments').update({current_step:currentStep,status:'stopped',last_error:null,updated_at:new Date().toISOString()}).eq('id',enrollment.id);workflowSteps++;settled=true;break}
   const done=currentStep>=(steps||[]).length;await client.from('crm_workflow_enrollments').update({current_step:currentStep,status:done?'completed':'active',next_run_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq('id',enrollment.id);workflowSteps++;if(done){settled=true;break}
  }
  if(!settled)throw new Error('Workflow exceeded 150 immediate steps.');
 }catch(e:any){await client.from('crm_workflow_enrollments').update({status:'failed',last_error:String(e?.message||'Workflow failed'),updated_at:new Date().toISOString()}).eq('id',enrollment.id);workflowFailed++}}
 return NextResponse.json({ok:true,smsSent,smsFailed,scheduledEnrolled,workflowSteps,workflowFailed});
}
