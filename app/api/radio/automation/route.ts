import {NextResponse} from 'next/server';
import {createClient as svc} from '@supabase/supabase-js';

export const dynamic='force-dynamic';
function db(){return svc(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}})}
async function authorized(req:Request,x:ReturnType<typeof db>){
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'')||'';
  if(!token)return false;
  const {data}=await x.from('site_settings').select('setting_value').eq('setting_key','indiecut_radio_worker_token').maybeSingle();
  return Boolean(data?.setting_value&&token===data.setting_value);
}
function noStore(body:any,status=200){return NextResponse.json(body,{status,headers:{'cache-control':'no-store, max-age=0'}})}

export async function GET(req:Request){
  const x=db();
  if(!await authorized(req,x))return noStore({error:'Unauthorized'},401);

  const {data:activeSchedule,error:scheduleError}=await x.rpc('radio_current_schedule',{p_now:new Date().toISOString()});
  if(scheduleError)return noStore({error:scheduleError.message},500);
  const scheduled=activeSchedule?.[0];
  if(scheduled){
    if(scheduled.media_id){
      const {data:item}=await x.from('radio_media').select('*').eq('id',scheduled.media_id).eq('active',true).maybeSingle();
      if(item)return noStore({source:'schedule',item,event:scheduled});
    }
    if(scheduled.event_type==='live')return noStore({source:'live_schedule',item:null,event:scheduled});
  }

  const {data:rots,error:rotationError}=await x.from('radio_rotations').select('*,radio_rotation_items(*,radio_media(*))').eq('active',true).order('weight',{ascending:false});
  if(rotationError)return noStore({error:rotationError.message},500);
  const r=rots?.find((z:any)=>z.radio_rotation_items?.length);
  if(!r)return noStore({source:'silence',item:null});

  const {data:history}=await x.from('radio_play_history').select('media_id,played_at,radio_media(kind,artist_or_host)').order('played_at',{ascending:false}).limit(500);
  const h:any[]=history||[];
  const songsSince=(kind:string)=>{
    let songs=0;
    for(const q of h){
      if(q.radio_media?.kind===kind)break;
      if(q.radio_media?.kind==='music')songs++;
    }
    return songs;
  };
  async function pickKind(kind:'station_id'|'commercial'){
    const {data}=await x.from('radio_media').select('*').eq('active',true).eq('kind',kind);
    if(!data?.length)return null;
    return data[Math.floor(Math.random()*data.length)];
  }

  if(Number(r.station_id_every_songs)>0&&songsSince('station_id')>=Number(r.station_id_every_songs)){
    const item=await pickKind('station_id');
    if(item)return noStore({source:'station_id',rotation:r.name,item});
  }
  if(Number(r.commercial_every_songs)>0&&songsSince('commercial')>=Number(r.commercial_every_songs)){
    const item=await pickKind('commercial');
    if(item)return noStore({source:'commercial',rotation:r.name,item});
  }

  const items=r.radio_rotation_items.map((z:any)=>z.radio_media).filter((m:any)=>m?.active&&m.kind==='music');
  const now=Date.now();
  const eligible=items.filter((m:any)=>
    !h.some((q:any)=>q.media_id===m.id&&now-new Date(q.played_at).getTime()<Number(r.song_separation_minutes||0)*60000)
    &&!h.some((q:any)=>q.radio_media?.artist_or_host&&m.artist_or_host&&q.radio_media.artist_or_host.toLowerCase()===m.artist_or_host.toLowerCase()&&now-new Date(q.played_at).getTime()<Number(r.artist_separation_minutes||0)*60000)
  );
  const pool=eligible.length?eligible:items;
  if(!pool.length)return noStore({source:'silence',item:null});
  const item=r.shuffle?pool[Math.floor(Math.random()*pool.length)]:pool[0];
  return noStore({source:'rotation',rotation:r.name,item});
}

export async function POST(req:Request){
  const x=db();
  if(!await authorized(req,x))return noStore({error:'Unauthorized'},401);
  const b=await req.json().catch(()=>({}));
  if(!b.media_id)return noStore({error:'media_id required'},400);
  const {error}=await x.from('radio_play_history').insert({media_id:b.media_id,source:String(b.source||'automation').slice(0,80)});
  return error?noStore({error:error.message},400):noStore({ok:true});
}
