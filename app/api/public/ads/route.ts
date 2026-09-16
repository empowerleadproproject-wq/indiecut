import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import {audienceMatches,effectiveAudienceScope,sortLocalFirst,visitorGeo,type VisitorGeo} from '../../../../lib/ad-targeting';

export const dynamic='force-dynamic';
export const revalidate=0;
function db(){return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}
function isLiveAd(ad:any,now:string){return ad?.active!==false&&(!ad.start_date||ad.start_date<=now)&&(!ad.end_date||ad.end_date>=now)}
function normalizedPlacement(ad:any){return String(ad?.placement||'').trim().toLowerCase()}
function isVideoCreative(ad:any){const mime=String(ad?.creative_media_type||'').trim().toLowerCase();const url=String(ad?.creative_url||'').split('?')[0].toLowerCase();return mime.startsWith('video/')||/\.(mp4|webm|mov|m4v|ogv)$/.test(url)}
function placementMatches(ad:any,requested:string){if(!requested)return true;const placement=normalizedPlacement(ad),want=requested.trim().toLowerCase();if(placement===want||placement==='sitewide')return true;
 // Older video campaigns were sometimes saved under a display placement. Keep them eligible
 // for Watch so every active commercial participates in the streaming rotation.
 if(want==='video-midroll'&&isVideoCreative(ad))return true;
 return false}
function publicAd(ad:any,geo:VisitorGeo){return {
 _id:String(ad?._id||''),advertiser:String(ad?.advertiser||''),title:String(ad?.title||''),creative_url:String(ad?.creative_url||''),creative_media_type:String(ad?.creative_media_type||''),destination_url:String(ad?.destination_url||''),cta_text:String(ad?.cta_text||'Learn More').slice(0,40),placement:String(ad?.placement||''),
 require_full_watch:Boolean(ad?.require_full_watch),skip_after_seconds:Math.max(0,Number(ad?.skip_after_seconds??30)||0),_audience_scope:effectiveAudienceScope(ad,geo)
}}
function creativeKey(ad:any){try{const u=new URL(String(ad?.creative_url||''));return `${u.origin}${u.pathname}`.toLowerCase()}catch{return String(ad?.creative_url||'').split('?')[0].trim().toLowerCase()}}
export async function GET(request:Request){try{const client=db();const {data,error}=await client.from('site_settings').select('setting_value').eq('setting_key','admin_advertising').maybeSingle();if(error)throw error;let ads:any[]=[];try{ads=JSON.parse(data?.setting_value||'[]')}catch{}const now=new Date().toISOString().slice(0,10);const requested=new URL(request.url).searchParams.get('placement')||'';const geo=visitorGeo(request);
 const eligible=ads.filter((ad:any)=>isLiveAd(ad,now)&&ad.creative_url&&placementMatches(ad,requested)&&audienceMatches(ad,geo));
 // A campaign can accidentally be saved more than once. Never put the same commercial
 // creative into the Watch rotation twice.
 const seen=new Set<string>();const unique=eligible.filter((ad:any)=>{const key=creativeKey(ad);if(!key||seen.has(key))return false;seen.add(key);return true});
 const live=sortLocalFirst(unique,geo).map((ad:any)=>publicAd(ad,geo));return NextResponse.json({ads:live,count:live.length,geo_available:Boolean(geo.latitude!==null&&geo.longitude!==null)},{headers:{'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store'}})}catch(error){return NextResponse.json({ads:[],count:0,error:error instanceof Error?error.message:'Unable to load ads'},{status:500,headers:{'Cache-Control':'no-store, max-age=0'}})}}
