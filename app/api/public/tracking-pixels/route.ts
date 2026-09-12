import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';
const DEFAULTS={meta_enabled:false,meta_pixel_id:'',ga4_enabled:false,ga4_measurement_id:'',google_ads_enabled:false,google_ads_id:'',google_ads_conversion_label:'',tiktok_enabled:false,tiktok_pixel_id:'',gtm_enabled:false,gtm_container_id:''};

export async function GET(){
 try{
  const auth=createClient();const {data:{user}}=await auth.auth.getUser();
  const isAdmin=Boolean(user&&isAdminEmail(user.email));
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return NextResponse.json({...DEFAULTS,is_admin:isAdmin},{headers:{'cache-control':'no-store'}});
  const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data}=await db.from('site_settings').select('setting_value').eq('setting_key','tracking_pixels').maybeSingle();
  let value:any={};try{value=JSON.parse(data?.setting_value||'{}')}catch{}
  return NextResponse.json({...DEFAULTS,...value,is_admin:isAdmin},{headers:{'cache-control':'no-store, max-age=0'}});
 }catch{return NextResponse.json(DEFAULTS,{headers:{'cache-control':'no-store'}})}
}
