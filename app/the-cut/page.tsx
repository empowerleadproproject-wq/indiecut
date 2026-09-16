import type {Metadata} from 'next';
import PublicHeader from '../PublicHeader';
import PublicFooter from '../PublicFooter';
import {createClient} from '../../lib/supabase/server';
import {createAdminClient} from '../../lib/supabase/admin';
import StartCutForm from './StartCutForm';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'The Cut — Live conversations',description:'Live audio rooms for independent artists, filmmakers, managers, labels, investors and creators on Indie Cut.'};

function initials(name?:string|null){return String(name||'IC').split(/\s+/).slice(0,2).map(v=>v[0]).join('').toUpperCase()}

export default async function TheCut(){
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  const admin=createAdminClient();
  const {data:rooms}=await admin.from('cut_rooms').select('id,slug,title,description,category,status,scheduled_for,started_at,peak_listeners,host_id,cut_profiles(display_name,avatar_url,headline,industry_role)').in('status',['live','scheduled']).order('created_at',{ascending:false}).limit(30);
  let profile:any=null;
  if(user){
    const result=await admin.from('cut_profiles').select('display_name,avatar_url,headline,industry_role').eq('id',user.id).maybeSingle();
    profile=result.data;
  }
  const live=(rooms||[]).filter((r:any)=>r.status==='live');
  const upcoming=(rooms||[]).filter((r:any)=>r.status==='scheduled');
  return <main className="cut-shell"><PublicHeader/><div className="cut-container">
    <section className="cut-hero">
      <div className="cut-hero-main"><div className="cut-kicker">Indie Cut presents</div><h1>The Cut</h1><p>Pull up. Listen in. Cut in when you have something to say. Live conversations for independent music, film, business and the people moving the culture forward.</p></div>
      <div className="cut-hero-card"><div><div className="cut-kicker">How it works</div><h2>Listen free. Join the conversation.</h2><p>Shared links open straight into the room for listening. To request the mic, create your Indie Cut profile and ask the host to bring you into The Cut.</p></div><div className="cut-actions">{user?<a className="cut-btn dark" href="/the-cut/profile">My Cut Profile</a>:<a className="cut-btn" href="/the-cut/sign-in?next=/the-cut">Create account</a>}</div></div>
    </section>

    <StartCutForm authenticated={Boolean(user)} displayName={profile?.display_name||user?.user_metadata?.display_name||null}/>

    <div className="cut-section-head"><div><h2>Live now</h2><p>Drop into a conversation already happening.</p></div><span className="cut-live-pill"><i className="cut-live-dot"/>{live.length} live</span></div>
    {live.length?<section className="cut-room-grid">{live.map((room:any)=>{const host=Array.isArray(room.cut_profiles)?room.cut_profiles[0]:room.cut_profiles;return <a className="cut-room-card" key={room.id} href={`/the-cut/${room.slug}`}>
      <div className="cut-room-top"><span className="cut-live-pill"><i className="cut-live-dot"/>Live</span><span className="cut-category">{room.category}</span></div>
      <div><h3>{room.title}</h3>{room.description&&<p>{room.description}</p>}</div>
      <div className="cut-host-row"><div className="cut-avatar">{host?.avatar_url?<img src={host.avatar_url} alt=""/>:initials(host?.display_name)}</div><div className="cut-host-meta"><strong>{host?.display_name||'Indie Cut Host'}</strong><span>{host?.industry_role||host?.headline||'Host'}{room.peak_listeners?` · ${room.peak_listeners} peak listeners`:''}</span></div></div>
    </a>})}</section>:<div className="cut-empty"><strong>No rooms are live this second.</strong><div style={{marginTop:8}}>Start the first Cut and invite your people in.</div></div>}

    {upcoming.length>0&&<><div className="cut-section-head"><div><h2>Coming up</h2><p>Scheduled conversations worth catching.</p></div></div><section className="cut-room-grid">{upcoming.map((room:any)=>{const host=Array.isArray(room.cut_profiles)?room.cut_profiles[0]:room.cut_profiles;return <a className="cut-room-card" key={room.id} href={`/the-cut/${room.slug}`}><div className="cut-room-top"><span className="cut-category">Upcoming</span><span className="cut-category">{room.category}</span></div><div><h3>{room.title}</h3>{room.description&&<p>{room.description}</p>}</div><div className="cut-host-row"><div className="cut-avatar">{host?.avatar_url?<img src={host.avatar_url} alt=""/>:initials(host?.display_name)}</div><div className="cut-host-meta"><strong>{host?.display_name||'Indie Cut Host'}</strong><span>{room.scheduled_for?new Date(room.scheduled_for).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):'Time TBA'}</span></div></div></a>})}</section></>}
  </div><PublicFooter/></main>;
}
