import {NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';

export async function GET(request:Request){
 const auth=createClient();
 const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});
 const zip=new URL(request.url).searchParams.get('zip')?.trim()||'';
 if(!/^\d{5}(?:-\d{4})?$/.test(zip))return NextResponse.json({error:'Enter a valid U.S. ZIP code.'},{status:400});
 try{
  const r=await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip.slice(0,5))}`,{cache:'no-store',headers:{'user-agent':'IndieCut/1.0 local-ad-geocoder'}});
  if(!r.ok)return NextResponse.json({error:'ZIP code could not be located.'},{status:404});
  const j:any=await r.json();const p=j?.places?.[0];
  if(!p)return NextResponse.json({error:'ZIP code could not be located.'},{status:404});
  const latitude=Number(p.latitude),longitude=Number(p.longitude);
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return NextResponse.json({error:'Location coordinates were unavailable.'},{status:502});
  return NextResponse.json({zip:j['post code']||zip.slice(0,5),city:p['place name']||'',region:p['state abbreviation']||'',state:p.state||'',latitude,longitude});
 }catch(e:any){return NextResponse.json({error:e?.message||'Unable to look up ZIP code.'},{status:502})}
}
