import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';

export const dynamic='force-dynamic';

function db(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return null;return createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
function digits(v:any){return String(v||'').replace(/\D/g,'')}

export async function POST(request:Request,{params}:{params:{workflowId:string}}){
 const client=db();if(!client)return NextResponse.json({error:'Workflow service is not configured.'},{status:503});
 const {data:workflow}=await client.from('crm_workflows').select('*').eq('id',params.workflowId).eq('status','published').eq('trigger_type','webhook_received').maybeSingle();
 if(!workflow)return NextResponse.json({error:'Published webhook workflow not found.'},{status:404});
 const cfg=workflow.trigger_config||{};const supplied=request.headers.get('x-indiecut-workflow-secret')||new URL(request.url).searchParams.get('secret')||'';
 if(cfg.secret&&String(cfg.secret)!==supplied)return NextResponse.json({error:'Invalid workflow secret.'},{status:401});
 const body=await request.json().catch(()=>({}));let contact:any=null;
 const contactId=String(body.contact_id||body.contactId||'').trim();if(contactId){const {data}=await client.from('crm_contacts').select('*').eq('id',contactId).maybeSingle();contact=data}
 if(!contact&&body.email){const {data}=await client.from('crm_contacts').select('*').ilike('email',String(body.email).trim()).maybeSingle();contact=data}
 if(!contact&&body.phone){const target=digits(body.phone);const {data}=await client.from('crm_contacts').select('*').not('phone','is',null);contact=(data||[]).find((x:any)=>digits(x.phone)===target)||null}
 if(!contact)return NextResponse.json({error:'Webhook must identify an existing contact with contact_id, email, or phone.'},{status:400});
 const {data:existing}=await client.from('crm_workflow_enrollments').select('id').eq('workflow_id',workflow.id).eq('contact_id',contact.id).eq('status','active').limit(1);
 if(existing?.length)return NextResponse.json({ok:true,enrolled:false,reason:'already_active'});
 const context={trigger_type:'webhook_received',payload:body};const {data:enrollment,error}=await client.from('crm_workflow_enrollments').insert({workflow_id:workflow.id,contact_id:contact.id,current_step:0,status:'active',next_run_at:new Date().toISOString(),context,last_error:null}).select('id').single();if(error)return NextResponse.json({error:error.message},{status:500});
 await client.from('crm_activity').insert({contact_id:contact.id,activity_type:'workflow_triggered',detail:`${workflow.name||'Workflow'} triggered by inbound webhook`});
 return NextResponse.json({ok:true,enrolled:true,enrollment_id:enrollment.id});
}
