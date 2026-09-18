import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '../../lib/supabase/server';
import { isAdminEmail } from '../../lib/admin';

const modules=[
 {slug:'distribution',label:'Film Distribution',description:'Manage the public distribution page, review filmmaker submissions, rights information, screeners, statuses and internal notes.'},
 {slug:'homepage',label:'Homepage',description:'Control the Indie Cut homepage, featured stories, hero media and section visibility.'},
 {slug:'streaming',label:'Streaming / Shows & Episodes',description:'Upload and manage Indie Cut shows, episodes, trailers and hosted video content for Indie Cut Watch.'},
 {slug:'advertising',label:'Advertising / Commercials',description:'Upload commercials, run streaming ad breaks, set campaign dates, targeting and destination links.'},
 {slug:'articles',label:'Articles',description:'Create, edit, review, publish and feature entertainment stories.'},
 {slug:'artists',label:'Artists',description:'Review artist profiles, approve or reject new submissions, and edit approved artists.'},
 {slug:'music',label:'Music',description:'Add songs, performances, releases, covers and artist media.'},
 {slug:'the-cut',label:'The Cut',description:'Manage Indie Cut live audio rooms, hosts, speakers, listeners, room links and live conversations.'},
 {slug:'live-battles',label:'Live Battles',description:'Run artist qualifying, fan voting, live DJ battles, sponsor breaks, brackets and winners.'},
 {slug:'crm',label:'Artist CRM',description:'Collect and manage artist names, emails, phone numbers, genres, locations, notes, campaigns and GoHighLevel sync.'},
 {slug:'workflows',label:'Workflows & SMS',description:'Build GoHighLevel-style visual automations, send TextGrid SMS, schedule campaigns and run artist follow-up sequences.'},
 {slug:'live-battles#battle-room-sponsors',label:'Battle Room Sponsors',description:'Upload the rotating sponsor ads shown inside the Indie Battle Room and set each sponsor destination link.'},
 {slug:'independent-music',label:'Independent Music Radar',description:'Find trending independent R&B, hip-hop, soul, Afrobeats and other emerging urban artists.'},
 {slug:'music-video-radar',label:'Music Video Radar',description:'Find official new music videos from independent and major artists, preview them, and publish them to Watch.'},
 {slug:'video-media',label:'Video & Media',description:'Upload videos, images, thumbnails and editorial media.'},
 {slug:'breaking-news',label:'Breaking News Radar',description:'Scan live sources for fresh entertainment developments, rank urgency and create verified drafts fast.'},
 {slug:'content-agent',label:'AI Content Agent',description:'Research current mainstream entertainment news, verify sources and create review-ready drafts.'},
 {slug:'indie-spotlight-agent',label:'Indie Spotlight AI Agent',description:'Discover and verify independent music artists, filmmakers and creators for Indie Spotlight.'},
 {slug:'social-agent',label:'Social Media Agent',description:'Turn published stories into Facebook, Instagram and TikTok-ready social posts automatically.'},
 {slug:'authors',label:'Authors & Editors',description:'Manage bylines, headshots, bios and editorial identities.'},
 {slug:'analytics',label:'Analytics',description:'Track publication activity and content performance.'},
 {slug:'tracking-pixels',label:'Tracking & Pixels',description:'Connect Meta Pixel, GA4, Google Ads, TikTok Pixel and Google Tag Manager for retargeting and conversions.'},
 {slug:'media-library',label:'Media Library',description:'Central library for editorial images, video, covers, logos and ad creative.'},
 {slug:'subscribers',label:'Email Subscribers',description:'Manage Indie Cut audience and newsletter subscribers.'},
 {slug:'settings',label:'Site Settings',description:'Control publication name, tagline, navigation, social links and global options.'},
];

export const dynamic='force-dynamic';
export default async function AdminPage(){
 const auth=createClient();const {data:{user}}=await auth.auth.getUser();if(!user)redirect('/admin/login');if(!isAdminEmail(user.email))redirect('/');
 const db=createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const [{count:published},{count:artists},{count:media},adsSetting]=await Promise.all([db.from('articles').select('*',{count:'exact',head:true}).eq('status','published'),db.from('artists').select('*',{count:'exact',head:true}),db.from('media_items').select('*',{count:'exact',head:true}),db.from('site_settings').select('setting_value').eq('setting_key','admin_advertising').maybeSingle()]);
 let adCount=0;try{adCount=JSON.parse(adsSetting.data?.setting_value||'[]').filter((x:any)=>x.active!==false).length}catch{}
 return <main className="ic-admin-shell"><aside className="ic-admin-sidebar"><Link href="/" className="ic-admin-brand">INDIE<br/>CUT</Link><div className="ic-admin-label">BACK OFFICE</div><nav><Link className="active" href="/admin">Dashboard</Link>{modules.map(m=><Link href={`/admin/${m.slug}`} key={m.slug}>{m.label}</Link>)}</nav><form action="/api/auth/signout" method="post"><button className="ic-signout" type="submit">Sign out</button></form></aside><section className="ic-admin-main"><header className="ic-admin-topbar"><div><div className="ic-admin-eyebrow">INDIE CUT EDITORIAL</div><h1>Back Office</h1><p>Run Indie Cut from one control room: streaming shows and episodes, commercials, stories, artists, music, live audio, battles, audience and publishing.</p></div><div className="ic-admin-user"><span>CF</span><div><strong>Administrator</strong><br/><small>{user.email}</small></div></div></header><section className="ic-admin-stats"><article><span>Published stories</span><strong>{published||0}</strong><small>Live editorial content</small></article><article><span>Artists & people</span><strong>{artists||0}</strong><small>Talent profiles</small></article><article><span>Media assets</span><strong>{media||0}</strong><small>Music, episodes and video</small></article><article><span>Active ads</span><strong>{adCount}</strong><small>Current ad inventory</small></article></section><div className="ic-admin-section-head"><div><div className="ic-admin-eyebrow">CONTROL CENTER</div><h2>Manage Indie Cut</h2></div><Link className="ic-view-site" href="/">View live publication ↗</Link></div><section className="ic-admin-modules">{modules.map(m=><Link className="ic-admin-module" href={`/admin/${m.slug}`} key={m.slug}><div className="ic-admin-icon">IC</div><h3>{m.label}</h3><p>{m.description}</p><span>Open →</span></Link>)}</section></section></main>
}
