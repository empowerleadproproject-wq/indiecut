import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';
const KEY='tracking_pixels';
const DEFAULTS={meta_enabled:false,meta_pixel_id:'',ga4_enabled:false,ga4_measurement_id:'',google_ads_enabled:false,google_ads_id:'',google_ads_conversion_label:'',tiktok_enabled:false,tiktok_pixel_id:'',gtm_enabled:false,gtm_container_id:''};

async function adminDb(){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return {error:NextResponse.json({error:'Unauthorized'},{status:401})};
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return {error:NextResponse.json({error:'Supabase admin credentials missing'},{status:503})};
 return {db:createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})};
}
function text(v:any,max=120){return String(v||'').trim().slice(0,max)}
function validOrBlank(label:string,value:string,re:RegExp){if(value&&!re.test(value))throw new Error(`${label} does not look valid.`);return value}
function clean(input:any){
 const meta=validOrBlank('Meta Pixel ID',text(input.meta_pixel_id),/^\d{5,30}$/);
 const ga4=validOrBlank('GA4 Measurement ID',text(input.ga4_measurement_id),/^G-[A-Z0-9]+$/i).toUpperCase();
 const ads=validOrBlank('Google Ads ID',text(input.google_ads_id),/^AW-\d+$/i).toUpperCase();
 const label=text(input.google_ads_conversion_label);
 const tiktok=validOrBlank('TikTok Pixel ID',text(input.tiktok_pixel_id),/^[A-Za-z0-9_-]{6,64}$/);
 const gtm=validOrBlank('Google Tag Manager ID',text(input.gtm_container_id),/^GTM-[A-Z0-9]+$/i).toUpperCase();
 return {meta_enabled:Boolean(input.meta_enabled&&meta),meta_pixel_id:meta,ga4_enabled:Boolean(input.ga4_enabled&&ga4),ga4_measurement_id:ga4,google_ads_enabled:Boolean(input.google_ads_enabled&&ads),google_ads_id:ads,google_ads_conversion_label:label,tiktok_enabled:Boolean(input.tiktok_enabled&&tiktok),tiktok_pixel_id:tiktok,gtm_enabled:Boolean(input.gtm_enabled&&gtm),gtm_container_id:gtm};
}

export async function GET(){
 const a=await adminDb();if(a.error)return a.error;const {data,error}=await a.db!.from('site_settings').select('setting_value').eq('setting_key',KEY).maybeSingle();if(error)return NextResponse.json({error:error.message},{status:500});
 let value:any={};try{value=JSON.parse(data?.setting_value||'{}')}catch{}return NextResponse.json({...DEFAULTS,...value},{headers:{'cache-control':'no-store'}});
}
export async function POST(request:Request){
 const a=await adminDb();if(a.error)return a.error;try{const input=await request.json().catch(()=>({}));const settings=clean(input);const {error}=await a.db!.from('site_settings').upsert({setting_key:KEY,setting_value:JSON.stringify(settings),updated_at:new Date().toISOString()},{onConflict:'setting_key'});if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({ok:true,settings})}catch(e:any){return NextResponse.json({error:e.message||'Invalid tracking settings'},{status:400})}
}
