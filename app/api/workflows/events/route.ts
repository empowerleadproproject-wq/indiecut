import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';
import {emitWorkflowEvent,resolveOrCreateWorkflowContact,upsertWorkflowObject} from '../../../../lib/workflow-events';

export const dynamic='force-dynamic';
function serviceDb(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return null;return createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
async function authorized(request:Request){
 const configured=process.env.WORKFLOW_WEBHOOK_SECRET||process.env.CRON_SECRET;
 const supplied=request.headers.get('x-indiecut-workflow-secret')||request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
 if(configured&&supplied===configured)return true;
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();return Boolean(user&&isAdminEmail(user.email));
}
export async function POST(request:Request){
 if(!await authorized(request))return NextResponse.json({error:'Unauthorized workflow event.'},{status:401});
 const db=serviceDb();if(!db)return NextResponse.json({error:'Workflow database is not configured.'},{status:503});
 const body=await request.json().catch(()=>({}));const eventType=String(body.event_type||body.eventType||'').trim();if(!eventType)return NextResponse.json({error:'event_type is required.'},{status:400});
 try{
  const contact=await resolveOrCreateWorkflowContact(db,body.contact||body);
  let object:any=null;
  if(body.object&&body.object.object_type)object=await upsertWorkflowObject(db,{...body.object,contact_id:body.object.contact_id||contact?.id||null});
  const result=await emitWorkflowEvent(db,eventType,contact,body.payload||body.data||{},object?.id||null);
  return NextResponse.json({ok:true,event_type:eventType,contact_id:contact?.id||null,object_id:object?.id||null,...result});
 }catch(e:any){return NextResponse.json({error:e?.message||'Workflow event failed.'},{status:500})}
}
