import {NextResponse} from 'next/server';
import {battleDb} from '../../../lib/battles';
import {audienceMatches,isLocalTarget,sortLocalFirst,visitorGeo} from '../../../lib/ad-targeting';

export const dynamic='force-dynamic';
export const revalidate=0;

function parseRows(value?:string|null){
  try{const rows=JSON.parse(value||'[]');return Array.isArray(rows)?rows:[]}catch{return []}
}
function isLive(ad:any,now:string){return ad?.active!==false&&(!ad.start_date||ad.start_date<=now)&&(!ad.end_date||ad.end_date>=now)}

export async function GET(request:Request){
  const db=battleDb();
  const {data,error}=await db.from('site_settings').select('setting_key,setting_value').in('setting_key',['admin_battle_room_sponsors','admin_advertising']);
  if(error)return NextResponse.json({sponsors:[]},{status:200,headers:{'Cache-Control':'no-store, max-age=0'}});

  const settings=new Map((data||[]).map((x:any)=>[x.setting_key,x.setting_value]));
  const now=new Date().toISOString().slice(0,10);
  const dedicated=parseRows(settings.get('admin_battle_room_sponsors')).filter((x:any)=>x?.image_url&&isLive(x,now));
  const advertising=parseRows(settings.get('admin_advertising'))
    .filter((x:any)=>x?.creative_url&&isLive(x,now)&&(x.placement==='battle-room'||x.placement==='sitewide'))
    .map((x:any)=>({...x,name:x.advertiser||x.title||'Sponsor',image_url:x.creative_url}));
  const geo=visitorGeo(request);
  const sponsors=sortLocalFirst([...dedicated,...advertising].filter((x:any)=>audienceMatches(x,geo))).map((x:any)=>({
    name:String(x.name||x.advertiser||x.title||''),
    destination_url:String(x.destination_url||''),
    image_url:String(x.image_url||x.creative_url||''),
    creative_media_type:String(x.creative_media_type||''),
    active:x.active!==false,
    _id:String(x._id||''),
    _audience_scope:isLocalTarget(x)?'local':'global'
  }));

  return NextResponse.json({sponsors,geo_available:Boolean(geo.latitude!==null&&geo.longitude!==null)},{headers:{'Cache-Control':'no-store, max-age=0'}});
}
