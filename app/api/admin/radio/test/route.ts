import {NextResponse} from 'next/server';
import {createClient as serviceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../../lib/admin';

export async function POST(req:Request){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});
 const db=serviceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:rows}=await db.from('site_settings').select('setting_key,setting_value').in('setting_key',['indiecut_radio','indiecut_radio_worker_token']);
 const map=Object.fromEntries((rows||[]).map((r:any)=>[r.setting_key,r.setting_value]));
 let worker='';try{worker=String(JSON.parse(map.indiecut_radio||'{}').worker_url||'')}catch{}
 const token=String(map.indiecut_radio_worker_token||'');
 if(!worker||!token)return NextResponse.json({error:'Radio relay is not configured.'},{status:503});
 const body=await req.json().catch(()=>({}));const seconds=Math.max(2,Math.min(15,Number(body.seconds)||5));
 try{
  const r=await fetch(worker.replace(/\/$/,'')+'/test-tone',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({seconds}),cache:'no-store'});
  const j=await r.json().catch(()=>({}));
  return NextResponse.json(j,{status:r.status,headers:{'cache-control':'no-store'}});
 }catch(e:any){return NextResponse.json({error:e?.message||'Radio relay unavailable.'},{status:502})}
}