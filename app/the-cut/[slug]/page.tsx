import {notFound} from 'next/navigation';
import {createAdminClient} from '../../../lib/supabase/admin';
import CutRoomClient from './CutRoomClient';

export const dynamic='force-dynamic';

export default async function CutRoomPage({params}:{params:{slug:string}}){
  const admin=createAdminClient();
  const {data:room}=await admin.from('cut_rooms').select('id,slug,title,description,category,status,host_id,cut_profiles(display_name,avatar_url,headline,industry_role)').eq('slug',params.slug).maybeSingle();
  if(!room||room.status==='cancelled'||room.status==='ended')notFound();
  const host:any=Array.isArray((room as any).cut_profiles)?(room as any).cut_profiles[0]:(room as any).cut_profiles;
  return <main className="cut-room-shell">
    <header className="cut-room-header"><a className="cut-room-brand" href="/the-cut">INDIE CUT <span>/ THE CUT</span></a><a className="cut-control" href="/the-cut" style={{textDecoration:'none'}}>Browse rooms</a></header>
    <section className="cut-room-titlebar"><span className="cut-live-pill"><i className="cut-live-dot"/>Live now</span><h1>{room.title}</h1>{room.description&&<p>{room.description}</p>}<div className="cut-room-meta"><strong>Hosted by {host?.display_name||'Indie Cut'}</strong><span>·</span><span>{room.category}</span>{host?.industry_role&&<><span>·</span><span>{host.industry_role}</span></>}</div></section>
    <CutRoomClient slug={room.slug} title={room.title} description={room.description} category={room.category} hostName={host?.display_name||'Indie Cut Host'}/>
  </main>;
}
