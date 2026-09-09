import Link from 'next/link';
import { notFound,redirect } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { isAdminEmail } from '../../../lib/admin';
import SectionManager from '../SectionManager';
import FooterSettings from '../FooterSettings';
import ContentAgentScheduler from '../ContentAgentScheduler';
import SocialAgentSettings from '../SocialAgentSettings';
import BreakingNewsRadar from '../BreakingNewsRadar';

const sections:Record<string,{title:string;intro:string}>={
 homepage:{title:'Homepage',intro:'Control hero content, featured stories and homepage presentation.'},
 articles:{title:'Articles',intro:'Create, edit, verify and publish Indie Cut stories with uploaded media.'},
 artists:{title:'Artists & People',intro:'Manage actors, musicians, filmmakers, creators and emerging talent.'},
 music:{title:'Music',intro:'Add songs, releases, performances and music media.'},
 'video-media':{title:'Video & Media',intro:'Upload video and photography for stories, artists and homepage placements.'},
 'breaking-news':{title:'Breaking News Radar',intro:'Scan live sources for newly reported entertainment news, verify the strongest leads and move fast without publishing rumors.'},
 'content-agent':{title:'AI Content Agent',intro:'Research current entertainment stories, verify multiple sources, save drafts for review, and schedule automatic research.'},
 'social-agent':{title:'Social Media Agent',intro:'Automatically turn published Indie Cut stories into platform-ready social posts.'},
 advertising:{title:'Advertising',intro:'Manage ad creative, placements, destination links and campaign schedules.'},
 authors:{title:'Authors & Editors',intro:'Manage editorial profiles, headshots, bios and bylines.'},
 analytics:{title:'Analytics',intro:'Review Indie Cut publication activity.'},
 'media-library':{title:'Media Library',intro:'Browse and add reusable image and video assets.'},
 subscribers:{title:'Email Subscribers',intro:'Manage the Indie Cut reader list.'},
 settings:{title:'Site Settings',intro:'Control publication-wide brand, navigation, footer and social settings.'}
};
export const dynamic='force-dynamic';
export default async function AdminSectionPage({params}:{params:{section:string}}){
 const section=sections[params.section];if(!section)notFound();
 const supabase=createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/admin/login');if(!isAdminEmail(user.email))redirect('/');
 const content=params.section==='breaking-news'?<BreakingNewsRadar/>:params.section==='social-agent'?<SocialAgentSettings/>:<SectionManager section={params.section}/>;
 return <main className="ic-module-page"><header className="ic-module-header"><Link href="/admin">← Back Office</Link><div className="ic-admin-eyebrow">INDIE CUT ADMIN</div><h1>{section.title}</h1><p>{section.intro}</p></header>{content}{params.section==='content-agent'&&<ContentAgentScheduler/>}{params.section==='settings'&&<FooterSettings/>}</main>
}
