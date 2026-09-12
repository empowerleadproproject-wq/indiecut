export type WorkflowEventType=string;

function sameText(a:any,b:any){return String(a??'').trim().toLowerCase()===String(b??'').trim().toLowerCase()}
function includesText(a:any,b:any){return String(a??'').toLowerCase().includes(String(b??'').trim().toLowerCase())}
function matchesTrigger(workflow:any,eventType:WorkflowEventType,payload:any){
 if(workflow?.status!=='published'||workflow?.trigger_type!==eventType)return false;
 const cfg=workflow.trigger_config&&typeof workflow.trigger_config==='object'?workflow.trigger_config:{};
 if(cfg.status&&!sameText(cfg.status,payload?.status))return false;
 if(cfg.previous_status&&!sameText(cfg.previous_status,payload?.previous_status||payload?.previousStatus))return false;
 if(cfg.tag&&!sameText(cfg.tag,payload?.tag))return false;
 if(cfg.keyword&&!includesText(payload?.message||payload?.text||payload?.body,cfg.keyword))return false;
 if(cfg.field&&!sameText(cfg.field,payload?.field))return false;
 if(cfg.value!==undefined&&cfg.value!==''&&!sameText(String(cfg.value),String(payload?.value)))return false;
 if(cfg.genre&&!sameText(cfg.genre,payload?.genre))return false;
 if(cfg.source&&!sameText(cfg.source,payload?.source))return false;
 if(cfg.object_type&&!sameText(cfg.object_type,payload?.object_type))return false;
 if(cfg.min_votes&&Number(payload?.vote_count||payload?.votes||0)<Number(cfg.min_votes))return false;
 if(cfg.min_amount&&Number(payload?.amount||0)<Number(cfg.min_amount))return false;
 if(cfg.stage&&!sameText(cfg.stage,payload?.stage||payload?.pipeline_stage))return false;
 if(cfg.event_name&&!sameText(cfg.event_name,payload?.event_name||payload?.name))return false;
 return true;
}

export async function enrollMatchingWorkflows(db:any,contactId:string,eventType:WorkflowEventType,payload:any={}){
 if(!contactId)return {matched:0,enrolled:0,enrollmentIds:[] as string[]};
 const {data:workflows,error}=await db.from('crm_workflows').select('id,name,status,trigger_type,trigger_config').eq('status','published').eq('trigger_type',eventType);
 if(error)throw error;
 const matched=(workflows||[]).filter((w:any)=>matchesTrigger(w,eventType,payload));
 let enrolled=0;const enrollmentIds:string[]=[];const context={trigger_type:eventType,...(payload&&typeof payload==='object'?payload:{})};
 for(const workflow of matched){
  const {data:existing,error:existingError}=await db.from('crm_workflow_enrollments').select('id').eq('workflow_id',workflow.id).eq('contact_id',contactId).eq('status','active').limit(1);
  if(existingError)throw existingError;if(existing?.length)continue;
  const {data:inserted,error:insertError}=await db.from('crm_workflow_enrollments').insert({workflow_id:workflow.id,contact_id:contactId,current_step:0,status:'active',next_run_at:new Date().toISOString(),context,last_error:null}).select('id').single();
  if(insertError)throw insertError;enrolled++;if(inserted?.id)enrollmentIds.push(String(inserted.id));
  await db.from('crm_activity').insert({contact_id:contactId,activity_type:'workflow_triggered',detail:`${workflow.name||'Workflow'} triggered by ${eventType}`});
 }
 return {matched:matched.length,enrolled,enrollmentIds};
}
