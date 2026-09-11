import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';

export const dynamic='force-dynamic';
export const revalidate=0;

function db(){return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}

export async function GET(){
 const client=db();
 const {data,error}=await client.from('site_settings').select('setting_value').eq('setting_key','admin_advertising').maybeSingle();
 if(error)return NextResponse.json({error:error.message},{status:500});
 let ads:any[]=[];try{ads=JSON.parse(data?.setting_value||'[]')}catch{}
 const now=new Date().toISOString().slice(0,10);
 const rows=await Promise.all((ads||[]).filter((a:any)=>a?.creative_url).map(async(a:any)=>{
  const live=a.active!==false&&(!a.start_date||a.start_date<=now)&&(!a.end_date||a.end_date>=now);
  let status:number|null=null,contentType='',contentLength='';
  try{const r=await fetch(String(a.creative_url),{method:'HEAD',cache:'no-store'});status=r.status;contentType=String(r.headers.get('content-type')||'');contentLength=String(r.headers.get('content-length')||'')}catch{}
  return {id:a._id||a.id||null,title:a.title||'',advertiser:a.advertiser||'',placement:a.placement||'',active:a.active!==false,live,start_date:a.start_date||'',end_date:a.end_date||'',creative_url:a.creative_url,creative_media_type:a.creative_media_type||'',http_status:status,content_type:contentType,content_length:contentLength};
 }));
 return NextResponse.json({count:rows.length,ads:rows},{headers:{'cache-control':'no-store'}});
}
