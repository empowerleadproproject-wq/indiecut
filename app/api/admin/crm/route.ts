import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';
import {enrollMatchingWorkflows} from '../../../../lib/crm-workflows';

export const dynamic='force-dynamic';

type SocialNetwork='instagram'|'tiktok'|'youtube'|'facebook';

function serviceDb(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return null;
 return createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function adminDb(){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return {error:NextResponse.json({error:'Unauthorized'},{status:401})};
 const db=serviceDb();if(!db)return {error:NextResponse.json({error:'CRM database is not configured.'},{status:503})};
 return {db};
}
function cleanTags(value:any){return Array.from(new Set((Array.isArray(value)?value:String(value||'').split(',')).map((x:any)=>String(x).trim()).filter(Boolean))).slice(0,30)}
function ids(value:any){return Array.from(new Set((Array.isArray(value)?value:[]).map((x:any)=>String(x)).filter(Boolean))).slice(0,500)}
function addedTags(before:any,after:any){const old=new Set(cleanTags(before).map((x:any)=>String(x).toLowerCase()));return cleanTags(after).filter((x:any)=>!old.has(String(x).toLowerCase()))}
function cleanSocial(value:any,network:SocialNetwork){
 const raw=String(value||'').trim();if(!raw)return null;
 const handle=raw.replace(/^@/,'').trim();
 if(!/^https?:\/\//i.test(raw)&&/^[A-Za-z0-9._-]+$/.test(handle)){
  if(network==='instagram')return `https://www.instagram.com/${handle}/`;
  if(network==='tiktok')return `https://www.tiktok.com/@${handle}`;
  if(network==='youtube')return `https://www.youtube.com/@${handle}`;
  return `https://www.facebook.com/${handle}`;
 }
 try{
  const u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);const host=u.hostname.toLowerCase().replace(/^www\./,'');
  const domains:Record<SocialNetwork,string[]>={instagram:['instagram.com'],tiktok:['tiktok.com'],youtube:['youtube.com','youtu.be'],facebook:['facebook.com','fb.com']};
  if(domains[network].some(domain=>host===domain||host.endsWith(`.${domain}`)))return u.toString();
 }catch{}
 return null;
}

async function snapshot(db:any){
 const [{data:contacts},{data:templates},{data:campaigns},{data:activity},{data:smartLists},{data:tasks},{data:opportunities},{count:queued},{count:sent},{count:failed}]=await Promise.all([
  db.from('crm_contacts').select('*').order('updated_at',{ascending:false}).limit(1000),
  db.from('crm_email_templates').select('*').order('updated_at',{ascending:false}).limit(100),
  db.from('crm_email_campaigns').select('*').order('created_at',{ascending:false}).limit(100),
  db.from('crm_activity').select('*').order('created_at',{ascending:false}).limit(500),
  db.from('crm_smart_lists').select('*').order('updated_at',{ascending:false}).limit(100),
  db.from('crm_tasks').select('*').order('due_at',{ascending:true,nullsFirst:false}).limit(500),
  db.from('crm_opportunities').select('*').order('updated_at',{ascending:false}).limit(500),
  db.from('crm_email_queue').select('*',{count:'exact',head:true}).eq('status','queued'),
  db.from('crm_email_queue').select('*',{count:'exact',head:true}).eq('status','sent'),
  db.from('crm_email_queue').select('*',{count:'exact',head:true}).eq('status','failed')
 ]);
 return {contacts:contacts||[],templates:templates||[],campaigns:campaigns||[],activity:activity||[],smartLists:smartLists||[],tasks:tasks||[],opportunities:opportunities||[],queueStats:{queued:queued||0,sent:sent||0,failed:failed||0},integrations:{email:Boolean(process.env.RESEND_API_KEY&&process.env.INDIECUT_FROM_EMAIL),ghl:Boolean(process.env.GHL_PRIVATE_INTEGRATION_TOKEN&&process.env.GHL_LOCATION_ID)}};
}

async function sendEmail(to:string,subject:string,body:string){
 const key=process.env.RESEND_API_KEY,from=process.env.INDIECUT_FROM_EMAIL;
 if(!key||!from)throw new Error('Email sending is not connected yet. Add RESEND_API_KEY and INDIECUT_FROM_EMAIL in Vercel.');
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({from,to:[to],subject,text:body})});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j?.message||j?.error||'Email send failed.');return j;
}
async function syncGhl(contact:any){
 const token=process.env.GHL_PRIVATE_INTEGRATION_TOKEN,locationId=process.env.GHL_LOCATION_ID;
 if(!token||!locationId)throw new Error('GoHighLevel is not connected yet. Add GHL_PRIVATE_INTEGRATION_TOKEN and GHL_LOCATION_ID in Vercel.');
 const r=await fetch('https://services.leadconnectorhq.com/contacts/upsert',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',Version:'v3'},body:JSON.stringify({name:contact.artist_name||contact.full_name||undefined,email:contact.email||undefined,phone:contact.phone||undefined,city:contact.city||undefined,locationId,tags:Array.isArray(contact.tags)?contact.tags:[],source:contact.source||'Indie Cut CRM'})});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j?.message||j?.error||'GoHighLevel sync failed.');return j?.contact?.id||j?.contactId||null;
}

export async function GET(){const a=await adminDb();if(a.error)return a.error;return NextResponse.json(await snapshot(a.db));}

export async function POST(request:Request){
 const a=await adminDb();if(a.error)return a.error;const db=a.db;const body=await request.json().catch(()=>({}));const action=String(body.action||'');
 try{
  if(action==='save_contact'){
   const p=body.contact||{};const email=String(p.email||'').trim().toLowerCase()||null;
   const payload:any={artist_name:String(p.artist_name||'').trim()||null,full_name:String(p.full_name||'').trim()||null,email,phone:String(p.phone||'').trim()||null,genre:String(p.genre||'').trim()||null,city:String(p.city||'').trim()||null,social_handle:String(p.social_handle||'').trim()||null,instagram_url:cleanSocial(p.instagram_url,'instagram'),tiktok_url:cleanSocial(p.tiktok_url,'tiktok'),youtube_url:cleanSocial(p.youtube_url,'youtube'),facebook_url:cleanSocial(p.facebook_url,'facebook'),source:String(p.source||'manual').trim()||'manual',status:String(p.status||'lead').trim()||'lead',tags:cleanTags(p.tags),notes:String(p.notes||'').trim()||null,email_opt_in:Boolean(p.email_opt_in),sms_opt_in:Boolean(p.sms_opt_in),updated_at:new Date().toISOString()};
   let contactId=String(p.id||''),before:any=null,wasCreated=false;
   if(contactId){const q=await db.from('crm_contacts').select('id,status,tags,battle_entry_id').eq('id',contactId).maybeSingle();before=q.data;const {error}=await db.from('crm_contacts').update(payload).eq('id',contactId);if(error)throw error;}
   else{
    let existing:any=null;if(email){const q=await db.from('crm_contacts').select('id,status,tags,battle_entry_id').eq('email',email).maybeSingle();existing=q.data}
    if(existing){contactId=existing.id;before=existing;const {error}=await db.from('crm_contacts').update(payload).eq('id',existing.id);if(error)throw error;}
    else{const {data:newRow,error}=await db.from('crm_contacts').insert(payload).select('id,battle_entry_id').single();if(error)throw error;contactId=newRow.id;before=newRow;wasCreated=true;}
   }
   if(contactId){
    const linkedEntryId=before?.battle_entry_id||null;
    if(linkedEntryId){const {error:entryError}=await db.from('battle_entries').update({instagram_url:payload.instagram_url,tiktok_url:payload.tiktok_url,youtube_url:payload.youtube_url,facebook_url:payload.facebook_url,updated_at:new Date().toISOString()}).eq('id',linkedEntryId);if(entryError)throw entryError;}
    await db.from('crm_activity').insert({contact_id:contactId,activity_type:wasCreated?'contact_created':'contact_updated',detail:linkedEntryId?'Contact updated; public artist profile synced':wasCreated?'Contact created':'Contact updated'});
    if(wasCreated){
     await enrollMatchingWorkflows(db,contactId,'contact_created',{});
     for(const tag of payload.tags||[])await enrollMatchingWorkflows(db,contactId,'tag_added',{tag});
    }else{
     if(before&&String(before.status||'')!==String(payload.status||''))await enrollMatchingWorkflows(db,contactId,'status_changed',{status:payload.status,previousStatus:before.status});
     for(const tag of addedTags(before?.tags,payload.tags))await enrollMatchingWorkflows(db,contactId,'tag_added',{tag});
    }
   }
  }else if(action==='delete_contact'){
   const {error}=await db.from('crm_contacts').delete().eq('id',String(body.contactId||''));if(error)throw error;
  }else if(action==='bulk_delete_contacts'){
   const contactIds=ids(body.contactIds);if(!contactIds.length)return NextResponse.json({error:'Select at least one contact.'},{status:400});const {error}=await db.from('crm_contacts').delete().in('id',contactIds);if(error)throw error;
  }else if(action==='bulk_update_contacts'){
   const contactIds=ids(body.contactIds);if(!contactIds.length)return NextResponse.json({error:'Select at least one contact.'},{status:400});
   const {data:beforeRows,error:beforeErr}=await db.from('crm_contacts').select('id,status,tags').in('id',contactIds);if(beforeErr)throw beforeErr;
   const patch:any={updated_at:new Date().toISOString()};if(body.status)patch.status=String(body.status);if(body.email_opt_in!==undefined)patch.email_opt_in=Boolean(body.email_opt_in);if(body.sms_opt_in!==undefined)patch.sms_opt_in=Boolean(body.sms_opt_in);
   if(body.addTag){
    const tag=String(body.addTag).trim();
    for(const row of beforeRows||[]){const tags=cleanTags([...(row.tags||[]),tag]);const {error}=await db.from('crm_contacts').update({...patch,tags}).eq('id',row.id);if(error)throw error;if(tag&&!cleanTags(row.tags).some((x:any)=>String(x).toLowerCase()===tag.toLowerCase()))await enrollMatchingWorkflows(db,row.id,'tag_added',{tag});if(patch.status&&String(row.status||'')!==String(patch.status))await enrollMatchingWorkflows(db,row.id,'status_changed',{status:patch.status,previousStatus:row.status});}
   }else{
    const {error}=await db.from('crm_contacts').update(patch).in('id',contactIds);if(error)throw error;
    if(patch.status)for(const row of beforeRows||[])if(String(row.status||'')!==String(patch.status))await enrollMatchingWorkflows(db,row.id,'status_changed',{status:patch.status,previousStatus:row.status});
   }
  }else if(action==='add_note'){
   const contactId=String(body.contactId||''),detail=String(body.detail||'').trim();if(!contactId||!detail)return NextResponse.json({error:'Contact and note are required.'},{status:400});
   const {error}=await db.from('crm_activity').insert({contact_id:contactId,activity_type:'note',detail});if(error)throw error;
  }else if(action==='save_smart_list'){
   const p=body.smartList||{};const payload={name:String(p.name||'').trim(),filter_status:String(p.filter_status||'').trim()||null,filter_genre:String(p.filter_genre||'').trim()||null,filter_tag:String(p.filter_tag||'').trim()||null,updated_at:new Date().toISOString()};if(!payload.name)return NextResponse.json({error:'Smart list name is required.'},{status:400});
   if(p.id){const {error}=await db.from('crm_smart_lists').update(payload).eq('id',String(p.id));if(error)throw error;}else{const {error}=await db.from('crm_smart_lists').insert(payload);if(error)throw error;}
  }else if(action==='delete_smart_list'){
   const {error}=await db.from('crm_smart_lists').delete().eq('id',String(body.smartListId||''));if(error)throw error;
  }else if(action==='save_task'){
   const p=body.task||{};const payload={contact_id:p.contact_id||null,title:String(p.title||'').trim(),due_at:p.due_at?new Date(p.due_at).toISOString():null,status:String(p.status||'open'),priority:String(p.priority||'normal'),notes:String(p.notes||'').trim()||null,updated_at:new Date().toISOString()};if(!payload.title)return NextResponse.json({error:'Task title is required.'},{status:400});if(p.id){const {error}=await db.from('crm_tasks').update(payload).eq('id',String(p.id));if(error)throw error;}else{const {error}=await db.from('crm_tasks').insert(payload);if(error)throw error;}
  }else if(action==='toggle_task'){
   const {error}=await db.from('crm_tasks').update({status:String(body.status||'done'),updated_at:new Date().toISOString()}).eq('id',String(body.taskId||''));if(error)throw error;
  }else if(action==='delete_task'){
   const {error}=await db.from('crm_tasks').delete().eq('id',String(body.taskId||''));if(error)throw error;
  }else if(action==='save_opportunity'){
   const p=body.opportunity||{};const payload={contact_id:p.contact_id||null,title:String(p.title||'').trim(),stage:String(p.stage||'new'),value:Number(p.value||0),notes:String(p.notes||'').trim()||null,updated_at:new Date().toISOString()};if(!payload.title)return NextResponse.json({error:'Opportunity title is required.'},{status:400});if(p.id){const {error}=await db.from('crm_opportunities').update(payload).eq('id',String(p.id));if(error)throw error;}else{const {error}=await db.from('crm_opportunities').insert(payload);if(error)throw error;}
  }else if(action==='delete_opportunity'){
   const {error}=await db.from('crm_opportunities').delete().eq('id',String(body.opportunityId||''));if(error)throw error;
  }else if(action==='save_template'){
   const p=body.template||{};const payload={name:String(p.name||'').trim(),subject:String(p.subject||'').trim(),body:String(p.body||'').trim(),active:p.active!==false,updated_at:new Date().toISOString()};if(!payload.name||!payload.subject||!payload.body)return NextResponse.json({error:'Template name, subject and body are required.'},{status:400});
   if(p.id){const {error}=await db.from('crm_email_templates').update(payload).eq('id',String(p.id));if(error)throw error;}else{const {error}=await db.from('crm_email_templates').insert(payload);if(error)throw error;}
  }else if(action==='delete_template'){
   const {error}=await db.from('crm_email_templates').delete().eq('id',String(body.templateId||''));if(error)throw error;
  }else if(action==='send_email'){
   const contactId=String(body.contactId||''),subject=String(body.subject||'').trim(),message=String(body.body||'').trim();const {data:contact}=await db.from('crm_contacts').select('*').eq('id',contactId).maybeSingle();if(!contact?.email)return NextResponse.json({error:'This contact does not have an email address.'},{status:400});if(!subject||!message)return NextResponse.json({error:'Subject and message are required.'},{status:400});
   await sendEmail(contact.email,subject,message);await Promise.all([db.from('crm_contacts').update({last_contacted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',contactId),db.from('crm_activity').insert({contact_id:contactId,activity_type:'email_sent',detail:subject})]);
  }else if(action==='queue_campaign'){
   const p=body.campaign||{};const name=String(p.name||'').trim(),subject=String(p.subject||'').trim(),message=String(p.body||'').trim(),filterStatus=String(p.filter_status||'').trim()||null,filterGenre=String(p.filter_genre||'').trim()||null,scheduledAt=p.scheduled_at?new Date(p.scheduled_at).toISOString():new Date().toISOString();if(!name||!subject||!message)return NextResponse.json({error:'Campaign name, subject and message are required.'},{status:400});
   let q=db.from('crm_contacts').select('id,email').eq('email_opt_in',true).not('email','is',null);if(filterStatus)q=q.eq('status',filterStatus);if(filterGenre)q=q.eq('genre',filterGenre);const {data:recipients,error:recErr}=await q;if(recErr)throw recErr;if(!recipients?.length)return NextResponse.json({error:'No opted-in contacts match this campaign filter.'},{status:409});
   const {data:campaign,error:campErr}=await db.from('crm_email_campaigns').insert({name,subject,body:message,status:'scheduled',filter_status:filterStatus,filter_genre:filterGenre,scheduled_at:scheduledAt}).select('*').single();if(campErr)throw campErr;
   const queue=(recipients||[]).map((c:any)=>({campaign_id:campaign.id,contact_id:c.id,email:c.email,subject,body:message,status:'queued',scheduled_at:scheduledAt}));const {error:qErr}=await db.from('crm_email_queue').insert(queue);if(qErr)throw qErr;
  }else if(action==='sync_contact'){
   const contactId=String(body.contactId||'');const {data:contact}=await db.from('crm_contacts').select('*').eq('id',contactId).maybeSingle();if(!contact)return NextResponse.json({error:'Contact not found.'},{status:404});const ghlId=await syncGhl(contact);await db.from('crm_contacts').update({ghl_contact_id:ghlId||contact.ghl_contact_id,updated_at:new Date().toISOString()}).eq('id',contactId);await db.from('crm_activity').insert({contact_id:contactId,activity_type:'ghl_sync',detail:'Synced to GoHighLevel'});
  }else if(action==='sync_all'){
   const {data:contacts}=await db.from('crm_contacts').select('*').order('updated_at',{ascending:false}).limit(500);let synced=0,failed=0;for(const contact of contacts||[]){try{const ghlId=await syncGhl(contact);await db.from('crm_contacts').update({ghl_contact_id:ghlId||contact.ghl_contact_id,updated_at:new Date().toISOString()}).eq('id',contact.id);synced++}catch{failed++}}return NextResponse.json({ok:true,synced,failed,...await snapshot(db)});
  }else return NextResponse.json({error:'Unknown CRM action.'},{status:400});
  return NextResponse.json({ok:true,...await snapshot(db)});
 }catch(e:any){return NextResponse.json({error:e?.message||'CRM update failed.'},{status:500});}
}
