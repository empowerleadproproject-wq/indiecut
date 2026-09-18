import {NextResponse} from 'next/server';
import {createClient as serviceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../../lib/admin';

export const dynamic='force-dynamic';
export const revalidate=0;

function empty(message:string){return {configured:false,source:'',listeners_live:null,peak_listeners:null,total_sessions:null,average_listen_minutes:null,updated_at:null,message}}

export async function GET(){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});
 const endpoint=process.env.RADIO_STATS_URL||'',token=process.env.RADIO_STATS_TOKEN||'';
 if(endpoint){
  try{
   const r=await fetch(endpoint,{cache:'no-store',headers:token?{authorization:`Bearer ${token}`}:{}});
   if(!r.ok)throw new Error(`Provider returned ${r.status}`);
   const j:any=await r.json();const n=(...v:any[])=>{const x=v.find(z=>z!==undefined&&z!==null&&z!=='');const y=Number(x);return Number.isFinite(y)?y:null};
   return NextResponse.json({configured:true,source:String(j.source||j.provider||'stream provider'),listeners_live:n(j.listeners_live,j.listeners,j.current_listeners,j.currentListeners),peak_listeners:n(j.peak_listeners,j.peak,j.peakListeners),total_sessions:n(j.total_sessions,j.sessions,j.totalSessions),average_listen_minutes:n(j.average_listen_minutes,j.average_minutes,j.avgListenMinutes),updated_at:j.updated_at||new Date().toISOString()},{headers:{'cache-control':'no-store, max-age=0'}});
  }catch(e:any){
   return NextResponse.json({configured:true,source:'stream provider',listeners_live:null,peak_listeners:null,total_sessions:null,average_listen_minutes:null,updated_at:null,message:e?.message||'Listener analytics unavailable'},{headers:{'cache-control':'no-store'}});
  }
 }
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(url&&key){
   const db=serviceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data}=await db.from('site_settings').select('setting_value').eq('setting_key','indiecut_radio').maybeSingle();
   let worker='';try{worker=String(JSON.parse(data?.setting_value||'{}').worker_url||'')}catch{}
   if(worker){
    const r=await fetch(worker.replace(/\/$/,'')+'/status',{cache:'no-store'});
    if(r.ok){
      const j:any=await r.json();
      return NextResponse.json({configured:true,source:'Indie Cut radio relay',listeners_live:Number(j.stream_clients||0),peak_listeners:null,total_sessions:null,average_listen_minutes:null,updated_at:new Date().toISOString(),message:j.live365_configured?'Live365 encoder configured.':'Testing through the Indie Cut relay until Live365 is connected.'},{headers:{'cache-control':'no-store'}});
    }
   }
  }
 }catch{}
 return NextResponse.json(empty('The Indie Cut radio relay is not reachable yet.'),{headers:{'cache-control':'no-store'}});
}
