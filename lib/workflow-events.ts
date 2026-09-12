import {enrollMatchingWorkflows} from './crm-workflows';

export async function resolveOrCreateWorkflowContact(db:any,input:any){
 const contactId=String(input?.contact_id||input?.contactId||'').trim();
 if(contactId){const {data}=await db.from('crm_contacts').select('*').eq('id',contactId).maybeSingle();if(data)return data}
 const email=String(input?.email||'').trim().toLowerCase();
 if(email){const {data}=await db.from('crm_contacts').select('*').eq('email',email).maybeSingle();if(data)return data}
 const phone=String(input?.phone||'').replace(/\D/g,'');
 if(phone){const {data:rows}=await db.from('crm_contacts').select('*');const match=(rows||[]).find((x:any)=>String(x.phone||'').replace(/\D/g,'')===phone);if(match)return match}
 if(!email&&!phone&&!input?.artist_name&&!input?.full_name)return null;
 const payload:any={
  artist_name:String(input?.artist_name||'').trim()||null,
  full_name:String(input?.full_name||'').trim()||null,
  email:email||null,
  phone:String(input?.phone||'').trim()||null,
  source:String(input?.source||'workflow_event').trim()||'workflow_event',
  status:String(input?.status||'lead').trim()||'lead',
  tags:Array.isArray(input?.tags)?input.tags:[],
  email_opt_in:Boolean(input?.email_opt_in),
  sms_opt_in:Boolean(input?.sms_opt_in),
  updated_at:new Date().toISOString()
 };
 const {data,error}=await db.from('crm_contacts').insert(payload).select('*').single();if(error)throw error;return data;
}

export async function emitWorkflowEvent(db:any,eventType:string,contact:any,payload:any={},objectId?:string|null){
 const type=String(eventType||'').trim();if(!type)throw new Error('Workflow event type is required.');
 const contactId=contact?.id||String(payload?.contact_id||payload?.contactId||'').trim()||null;
 await db.from('crm_workflow_event_log').insert({event_type:type,contact_id:contactId||null,object_id:objectId||null,payload:payload&&typeof payload==='object'?payload:{}});
 if(!contactId)return {matched:0,enrolled:0,enrollmentIds:[]};
 return enrollMatchingWorkflows(db,contactId,type,payload);
}

export async function upsertWorkflowObject(db:any,args:{object_type:string;contact_id?:string|null;external_id?:string|null;title?:string|null;status?:string|null;amount?:number|null;starts_at?:string|null;due_at?:string|null;data?:any;id?:string|null}){
 const now=new Date().toISOString();
 const payload:any={object_type:String(args.object_type||'').trim(),contact_id:args.contact_id||null,external_id:args.external_id||null,title:args.title||null,status:args.status||null,amount:args.amount??null,starts_at:args.starts_at||null,due_at:args.due_at||null,data:args.data&&typeof args.data==='object'?args.data:{},updated_at:now};
 if(!payload.object_type)throw new Error('Workflow object type is required.');
 if(args.id){const {data,error}=await db.from('crm_workflow_objects').update(payload).eq('id',args.id).select('*').single();if(error)throw error;return data}
 const {data,error}=await db.from('crm_workflow_objects').insert(payload).select('*').single();if(error)throw error;return data;
}
