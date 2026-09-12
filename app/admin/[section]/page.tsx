import Link from 'next/link';
import { notFound,redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { isAdminEmail } from '../../../lib/admin';
import SectionManager from '../SectionManager';
import FooterSettings from '../FooterSettings';
import ContentAgentScheduler from '../ContentAgentScheduler';
import SocialAgentSettings from '../SocialAgentSettings';
import SocialAnalytics from '../SocialAnalytics';
import WebsiteAnalytics from '../WebsiteAnalytics';
import BreakingNewsRadar from '../BreakingNewsRadar';
import IndependentMusicRadar from '../IndependentMusicRadar';
import MusicVideoRadar from '../MusicVideoRadar';
import AdvertisingManager from '../AdvertisingManager';
import BattleManager from '../BattleManager';
import BattleLandingSettings from '../BattleLandingSettings';
import BattleSubmissionsManager from '../BattleSubmissionsManager';
import BattleRoomSponsors from '../BattleRoomSponsors';
import BattleArtistEditor from '../BattleArtistEditor';
import CrmManager from '../CrmManager';
import AutomationBuilder from '../AutomationBuilder';
import TrackingPixelsSettings from '../TrackingPixelsSettings';

const sections:Record<string,{title:string;intro:string}>={
 homepage:{title:'Homepage',intro:'Control hero content, featured stories and homepage presentation.'},
 articles:{title:'Articles',intro:'Create, edit, verify and publish Indie Cut stories with uploaded media.'},
 artists:{title:'Artists & People',intro:'Manage actors, musicians, filmmakers, creators and emerging talent.'},
 music:{title:'Music',intro:'Add songs, releases, performances and music media.'},
 'live-battles':{title:'Live Battles',intro:'Control the Live Battles front door, Battle Room sponsor ads, artist submissions, approved artist profiles, fan qualifying, the three-person stage, sponsor breaks, round votes and bracket results.'},
 crm:{title:'Artist CRM',intro:'Own the artist relationship database: names, emails, phone numbers, genre, location, notes, tags, email campaigns and optional GoHighLevel sync.'},
 workflows:{title:'Workflows & SMS',intro:'Build visual automations, send TextGrid SMS, create drip sequences, schedule campaigns and manage workflow enrollments.'},
 'independent-music':{title:'Independent Music Radar',intro:'Discover trending independent R&B, hip-hop, soul, Afrobeats and other emerging urban artists using live web signals.'},
 'music-video-radar':{title:'Music Video Radar',intro:'Find newly released official music videos from independent and major artists, preview them, and publish them to Indie Cut Watch.'},
 'video-media':{title:'Video & Media',intro:'Upload video and photography for stories, artists and homepage placements.'},
 'breaking-news':{title:'Breaking News Radar',intro:'Scan live sources for newly reported entertainment news, verify the strongest leads and move fast without publishing rumors.'},
 'content-agent':{title:'AI Content Agent',intro:'Research current entertainment stories, verify multiple sources, save drafts for review, and schedule automatic research.'},
 'social-agent':{title:'Social Media Agent',intro:'Automatically turn published stories into platform-ready social posts.'},
 advertising:{title:'Advertising',intro:'Manage ad creative, placements, destination links and campaign schedules.'},
 authors:{title:'Authors & Editors',intro:'Manage editorial profiles, headshots, bios and bylines.'},
 analytics:{title:'Analytics',intro:'Review Indie Cut website audience plus live Facebook and Instagram performance.'},
 'tracking-pixels':{title:'Tracking & Pixels',intro:'Connect Meta, Google, TikTok and Google Tag Manager for retargeting, attribution and conversion tracking.'},
 'media-library':{title:'Media Library',intro:'Browse and add reusable image and video assets.'},
 subscribers:{title:'Email Subscribers',intro:'Manage the Indie Cut reader list.'},
 settings:{title:'Site Settings',intro:'Control publication-wide brand, navigation, footer and social settings.'}
};
export const dynamic='force-dynamic';
export default async function AdminSectionPage({params}:{params:{section:string}}){
 const section=sections[params.section];if(!section)notFound();
 const supabase=createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/admin/login');if(!isAdminEmail(user.email))redirect('/');
 const content=params.section==='live-battles'?<><BattleRoomSponsors/><BattleLandingSettings/><BattleSubmissionsManager/><BattleArtistEditor/><BattleManager/></>:params.section==='crm'?<CrmManager/>:params.section==='workflows'?<AutomationBuilder/>:params.section==='breaking-news'?<BreakingNewsRadar/>:params.section==='independent-music'?<IndependentMusicRadar/>:params.section==='music-video-radar'?<MusicVideoRadar/>:params.section==='social-agent'?<SocialAgentSettings/>:params.section==='analytics'?<><WebsiteAnalytics/><SocialAnalytics/></>:params.section==='tracking-pixels'?<TrackingPixelsSettings/>:params.section==='advertising'?<AdvertisingManager/>:<SectionManager section={params.section}/>;
 return <main className="ic-module-page"><header className="ic-module-header"><Link href="/admin">← Back Office</Link><div className="ic-admin-eyebrow">INDIE CUT ADMIN</div><h1>{section.title}</h1><p>{section.intro}</p></header>{content}{params.section==='content-agent'&&<ContentAgentScheduler/>}{params.section==='settings'&&<FooterSettings/>}</main>
}
