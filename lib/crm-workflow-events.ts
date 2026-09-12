function matchesConfig(triggerType:string,config:any,event:any){
 if(triggerType==='status_changed'&&config?.status)return String(event?.status||'')===String(config.status);
 if(triggerType==='tag_added'&&config?.tag)return String(event?.tag||'').toLowerCase()===String(config.tag).toLowerCase();
 if(triggerType==='sms_reply'&&config?.keyword)return String(event?.message||'').toLowerCase().includes(String(config.keyword).toLowerCase());
 return true;
}

export async function enrollWorkflowsForEvent(db:any,triggerType:string,contactId:string,event:any={}){
 if(!contactId)return 0;
 const {data:workflows,error}=await db.from('crm_workflows').select('id,trigger_type,trigger_config,status').eq('status','published').eq('trigger_type',triggerType);
 if(error)throw error;
 const matches=(workflows||[]).filter((w:any)=>matchesConfig(triggerType,w.trigger_config||{},event));
 if(!matches.length)return 0;
 const rows=matches.map((w:any)=>({workflow_id:w.id,contact_id:contactId,current_step:0,status:'active',next_run_at:new Date().toISOString(),context:event||{}}));
 const {error:insertError}=await db.from('crm_workflow_enrollments').insert(rows);if(insertError)throw insertError;
 return rows.length;
}
