import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';

export const dynamic='force-dynamic';
function db(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}
function out(body:any,status=200){return NextResponse.json(body,{status,headers:{'cache-control':'no-store, max-age=0'}})}

export async function GET(req:Request){
  const url=new URL(req.url),role=url.searchParams.get('role'),token=(url.searchParams.get('token')||'').trim(),guestId=(url.searchParams.get('guest_id')||'').trim();
  if(!token||!['host','guest'].includes(role||''))return out({authorized:false},401);
  const x=db();
  let session:any=null;
  if(role==='host'){
    const {data}=await x.from('radio_live_sessions').select('id,status,title,broadcast_token').eq('broadcast_token',token).neq('status','ended').maybeSingle();
    session=data;
    if(!session)return out({authorized:false},403);
  }else{
    if(!guestId)return out({authorized:false},401);
    const {data:s}=await x.from('radio_live_sessions').select('id,status,title,guest_token').eq('guest_token',token).neq('status','ended').maybeSingle();
    if(!s)return out({authorized:false},403);
    const {data:g}=await x.from('radio_live_guests').select('id,status').eq('id',guestId).eq('session_id',s.id).maybeSingle();
    if(!g||g.status!=='admitted'||s.status!=='live')return out({authorized:false,status:g?.status||'waiting',session_status:s.status},403);
    session=s;
  }
  const {data:settings}=await x.from('site_settings').select('setting_value').eq('setting_key','indiecut_radio').maybeSingle();
  let worker_url='';try{worker_url=String(JSON.parse(settings?.setting_value||'{}').worker_url||'')}catch{}
  return out({authorized:true,role,session_id:session.id,session_status:session.status,title:session.title,worker_url});
}
