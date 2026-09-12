import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';

export const dynamic='force-dynamic';
export const maxDuration=300;

async function sendEmail(to:string,subject:string,body:string){
 const key=process.env.RESEND_API_KEY,from=process.env.INDIECUT_FROM_EMAIL;
 if(!key||!from)throw new Error('CRM email delivery is not configured.');
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({from,to:[to],subject,text:body})});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j?.message||j?.error||'Email send failed.');return j;
}

export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;if(!secret)return NextResponse.json({error:'CRON_SECRET is not configured.'},{status:503});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return NextResponse.json({error:'Unauthorized cron request'},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return NextResponse.json({error:'Supabase service credentials are missing.'},{status:503});
 if(!process.env.RESEND_API_KEY||!process.env.INDIECUT_FROM_EMAIL)return NextResponse.json({ok:true,skipped:'CRM email provider is not connected.'});
 const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const now=new Date().toISOString();
 const {data:rows,error}=await db.from('crm_email_queue').select('*').eq('status','queued').lte('scheduled_at',now).order('scheduled_at',{ascending:true}).limit(50);if(error)return NextResponse.json({error:error.message},{status:500});
 let sent=0,failed=0;const campaignIds=new Set<string>();
 for(const row of rows||[]){campaignIds.add(row.campaign_id);try{await sendEmail(row.email,row.subject,row.body);const at=new Date().toISOString();await db.from('crm_email_queue').update({status:'sent',sent_at:at,error:null}).eq('id',row.id);if(row.contact_id){await Promise.all([db.from('crm_contacts').update({last_contacted_at:at,updated_at:at}).eq('id',row.contact_id),db.from('crm_activity').insert({contact_id:row.contact_id,activity_type:'campaign_email',detail:row.subject})])}sent++}catch(e:any){await db.from('crm_email_queue').update({status:'failed',error:String(e?.message||'Email failed')}).eq('id',row.id);failed++}}
 for(const campaignId of Array.from(campaignIds)){const [{count:s},{count:f},{count:q}]=await Promise.all([db.from('crm_email_queue').select('*',{count:'exact',head:true}).eq('campaign_id',campaignId).eq('status','sent'),db.from('crm_email_queue').select('*',{count:'exact',head:true}).eq('campaign_id',campaignId).eq('status','failed'),db.from('crm_email_queue').select('*',{count:'exact',head:true}).eq('campaign_id',campaignId).eq('status','queued')]);await db.from('crm_email_campaigns').update({sent_count:s||0,failed_count:f||0,status:(q||0)>0?'sending':'sent',updated_at:new Date().toISOString()}).eq('id',campaignId)}
 return NextResponse.json({ok:true,processed:(rows||[]).length,sent,failed});
}
