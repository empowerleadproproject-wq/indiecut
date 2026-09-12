import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {enrollWorkflowsForEvent} from '../../../../lib/crm-workflow-events';

export const dynamic='force-dynamic';
function db(){return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}
function digits(v:any){return String(v||'').replace(/\D/g,'').slice(-10)}
async function parseBody(request:Request){const type=request.headers.get('content-type')||'';if(type.includes('application/json'))return await request.json().catch(()=>({}));const text=await request.text();const p=new URLSearchParams(text);return Object.fromEntries(p.entries())}

export async function POST(request:Request){
 const expected=String(process.env.TEXTGRID_WEBHOOK_SECRET||'').trim();if(expected){const u=new URL(request.url);const supplied=request.headers.get('x-textgrid-webhook-secret')||u.searchParams.get('secret')||'';if(supplied!==expected)return NextResponse.json({error:'Unauthorized'},{status:401})}
 const body:any=await parseBody(request);const from=String(body.From||body.from||body.sender||'').trim();const message=String(body.Body||body.body||body.message||'').trim();const providerId=String(body.MessageSid||body.SmsSid||body.sid||body.id||'').trim();if(!from||!message)return NextResponse.json({ok:true,ignored:true});
 const client=db();const {data:contacts}=await client.from('crm_contacts').select('id,phone,sms_opt_in').not('phone','is',null).limit(2000);const contact=(contacts||[]).find((c:any)=>digits(c.phone)===digits(from));const contactId=contact?.id||null;
 await client.from('crm_sms_messages').insert({contact_id:contactId,direction:'inbound',phone:from,body:message,status:'received',provider_message_id:providerId||null});
 const upper=message.trim().toUpperCase();const stopWords=new Set(['STOP','STOPALL','UNSUBSCRIBE','CANCEL','END','QUIT','REMOVE']);const startWords=new Set(['START','UNSTOP','YES']);
 if(contactId&&stopWords.has(upper)){await client.from('crm_contacts').update({sms_opt_in:false,updated_at:new Date().toISOString()}).eq('id',contactId);await client.from('crm_activity').insert({contact_id:contactId,activity_type:'sms_opt_out',detail:`Opted out by replying ${upper}`});return NextResponse.json({ok:true,optedOut:true});}
 if(contactId&&startWords.has(upper)){await client.from('crm_contacts').update({sms_opt_in:true,updated_at:new Date().toISOString()}).eq('id',contactId);await client.from('crm_activity').insert({contact_id:contactId,activity_type:'sms_opt_in',detail:`Opted in by replying ${upper}`});}
 if(contactId){await client.from('crm_activity').insert({contact_id:contactId,activity_type:'sms_received',detail:message.slice(0,240)});await enrollWorkflowsForEvent(client,'sms_reply',contactId,{message,from,providerId});}
 return NextResponse.json({ok:true,contactId});
}
