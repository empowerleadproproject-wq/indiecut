import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import {audienceMatches,isLocalTarget,sortLocalFirst,visitorGeo} from '../../../../lib/ad-targeting';

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
function placementMatches(ad:any,requested:string){
 if(!requested)return true;
 const placement=String(ad?.placement||'');
 return placement===requested||placement==='sitewide';
}
function publicAd(ad:any){
 return {
  _id:String(ad?._id||''),advertiser:String(ad?.advertiser||''),title:String(ad?.title||''),
  creative_url:String(ad?.creative_url||''),creative_media_type:String(ad?.creative_media_type||''),
  destination_url:String(ad?.destination_url||''),placement:String(ad?.placement||''),
  _audience_scope:isLocalTarget(ad)?'local':'global'
 };
}

export async function GET(request:Request){
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
    const requested=new URL(request.url).searchParams.get('placement')||'';
    const geo=visitorGeo(request);
    const eligible=ads.filter((ad:any)=>isLiveAd(ad,now)&&ad.creative_url&&placementMatches(ad,requested)&&audienceMatches(ad,geo));
    const live=sortLocalFirst(eligible).map(publicAd);
    return NextResponse.json({ads:live,geo_available:Boolean(geo.latitude!==null&&geo.longitude!==null)},{headers:{'Cache-Control':'no-store, max-age=0'}});
  }catch(error){
    return NextResponse.json({ads:[],error:error instanceof Error?error.message:'Unable to load ads'},{status:500,headers:{'Cache-Control':'no-store, max-age=0'}});
  }
}
