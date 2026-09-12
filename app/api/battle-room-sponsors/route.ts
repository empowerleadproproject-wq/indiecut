import {NextResponse} from 'next/server';
import {battleDb} from '../../../lib/battles';

export const dynamic='force-dynamic';
export const revalidate=0;

function parseSponsors(value?:string|null){
  try{
    const rows=JSON.parse(value||'[]');
    return Array.isArray(rows)?rows:[];
  }catch{
    return [];
  }
}

export async function GET(){
  const db=battleDb();
  const {data,error}=await db
    .from('site_settings')
    .select('setting_value')
    .eq('setting_key','admin_battle_room_sponsors')
    .maybeSingle();

  if(error){
    return NextResponse.json({sponsors:[]},{status:200,headers:{'Cache-Control':'no-store'}});
  }

  const sponsors=parseSponsors(data?.setting_value)
    .filter((x:any)=>x?.image_url&&x?.active!==false)
    .map((x:any)=>({
      name:String(x.name||''),
      destination_url:String(x.destination_url||''),
      image_url:String(x.image_url||''),
      active:x.active!==false,
      _id:String(x._id||'')
    }));

  return NextResponse.json({sponsors},{headers:{'Cache-Control':'no-store, max-age=0'}});
}
