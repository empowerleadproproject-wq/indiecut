import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';

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
function cleanName(value:any){return String(value||'').trim().replace(/\s+/g,' ').slice(0,60)}
function sameTag(a:any,b:any){return String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase()}

async function listTags(db:any){
 const {data,error}=await db.from('crm_tags').select('id,name,created_at,updated_at').order('name',{ascending:true});
 if(error)throw error;
 return data||[];
}

export async function GET(){
 const a=await adminDb();if(a.error)return a.error;
 try{return NextResponse.json({tags:await listTags(a.db)});}catch(e:any){return NextResponse.json({error:e?.message||'Unable to load tags.'},{status:500})}
}

export async function POST(request:Request){
 const a=await adminDb();if(a.error)return a.error;const db=a.db;const body=await request.json().catch(()=>({}));const action=String(body.action||'');
 try{
  if(action==='create_tag'){
   const name=cleanName(body.name);
   if(!name)return NextResponse.json({error:'Tag name is required.'},{status:400});
   if(name.includes(','))return NextResponse.json({error:'Create one tag at a time. Do not separate tags with commas.'},{status:400});
   const {data:existing}=await db.from('crm_tags').select('id,name').ilike('name',name).limit(1);
   if(existing?.length)return NextResponse.json({error:'That tag already exists.'},{status:409});
   const {error}=await db.from('crm_tags').insert({name,updated_at:new Date().toISOString()});if(error)throw error;
  }else if(action==='delete_tag'){
   const id=String(body.id||'');if(!id)return NextResponse.json({error:'Tag is required.'},{status:400});
   const {data:tag,error:tagErr}=await db.from('crm_tags').select('id,name').eq('id',id).maybeSingle();if(tagErr)throw tagErr;if(!tag)return NextResponse.json({error:'Tag not found.'},{status:404});
   const [{data:contacts},{data:workflows},{data:steps}]=await Promise.all([
    db.from('crm_contacts').select('id,tags').limit(1000),
    db.from('crm_workflows').select('id,name,trigger_type,trigger_config').limit(500),
    db.from('crm_workflow_steps').select('workflow_id,step_type,step_config').limit(2000)
   ]);
   const usedByContact=(contacts||[]).some((c:any)=>(c.tags||[]).some((x:any)=>sameTag(x,tag.name)));
   const usedByTrigger=(workflows||[]).some((w:any)=>w.trigger_type==='tag_added'&&sameTag(w.trigger_config?.tag,tag.name));
   const usedByAction=(steps||[]).some((s:any)=>s.step_type==='add_tag'&&sameTag(s.step_config?.tag,tag.name));
   if(usedByContact||usedByTrigger||usedByAction)return NextResponse.json({error:'This tag is currently in use. Remove it from contacts and workflows before deleting it.'},{status:409});
   const {error}=await db.from('crm_tags').delete().eq('id',id);if(error)throw error;
  }else return NextResponse.json({error:'Unknown tag action.'},{status:400});
  return NextResponse.json({ok:true,tags:await listTags(db)});
 }catch(e:any){return NextResponse.json({error:e?.message||'Tag update failed.'},{status:500})}
}
