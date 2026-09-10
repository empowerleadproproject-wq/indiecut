import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const dynamic='force-dynamic';
export const revalidate=0;

function db(){
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {auth:{persistSession:false,autoRefreshToken:false}}
  );
}

function isLiveAd(ad:any,now:string){
  return ad?.active!==false&&(!ad.start_date||ad.start_date<=now)&&(!ad.end_date||ad.end_date>=now);
}

export async function GET(){
  try{
    const client=db();
    const {data,error}=await client
      .from('site_settings')
      .select('setting_value')
      .eq('setting_key','admin_advertising')
      .maybeSingle();
    if(error)throw error;
    let ads:any[]=[];
    try{ads=JSON.parse(data?.setting_value||'[]')}catch{}
    const now=new Date().toISOString().slice(0,10);
    const live=ads.filter((ad:any)=>isLiveAd(ad,now)&&ad.creative_url);
    return NextResponse.json({ads:live},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    return NextResponse.json({ads:[],error:error instanceof Error?error.message:'Unable to load ads'},{status:500});
  }
}
