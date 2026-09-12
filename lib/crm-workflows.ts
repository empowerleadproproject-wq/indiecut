export type WorkflowEventType='contact_created'|'status_changed'|'tag_added'|'sms_reply';

function sameText(a:any,b:any){return String(a??'').trim().toLowerCase()===String(b??'').trim().toLowerCase()}

function matchesTrigger(workflow:any,eventType:WorkflowEventType,payload:any){
 if(workflow?.status!=='published'||workflow?.trigger_type!==eventType)return false;
 const cfg=workflow.trigger_config&&typeof workflow.trigger_config==='object'?workflow.trigger_config:{};
 if(eventType==='status_changed')return !cfg.status||sameText(cfg.status,payload?.status);
 if(eventType==='tag_added')return !cfg.tag||sameText(cfg.tag,payload?.tag);
 if(eventType==='sms_reply')return !cfg.keyword||String(payload?.message||'').toLowerCase().includes(String(cfg.keyword).trim().toLowerCase());
 return true;
}

export async function enrollMatchingWorkflows(db:any,contactId:string,eventType:WorkflowEventType,payload:any={}){
 if(!contactId)return {matched:0,enrolled:0};
 const {data:workflows,error}=await db.from('crm_workflows').select('id,name,status,trigger_type,trigger_config').eq('status','published').eq('trigger_type',eventType);
 if(error)throw error;
 const matched=(workflows||[]).filter((w:any)=>matchesTrigger(w,eventType,payload));
 let enrolled=0;
 for(const workflow of matched){
  // Prevent the same event from creating duplicate active enrollments for the same workflow/contact.
  const {data:existing,error:existingError}=await db.from('crm_workflow_enrollments').select('id').eq('workflow_id',workflow.id).eq('contact_id',contactId).eq('status','active').limit(1);
  if(existingError)throw existingError;
  if(existing?.length)continue;
  const {error:insertError}=await db.from('crm_workflow_enrollments').insert({workflow_id:workflow.id,contact_id:contactId,current_step:0,status:'active',next_run_at:new Date().toISOString(),last_error:null});
  if(insertError)throw insertError;
  enrolled++;
  await db.from('crm_activity').insert({contact_id:contactId,activity_type:'workflow_triggered',detail:`${workflow.name||'Workflow'} triggered by ${eventType}`});
 }
 return {matched:matched.length,enrolled};
}
