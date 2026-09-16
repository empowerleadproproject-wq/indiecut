import type { Metadata } from 'next';
import Link from 'next/link';
import PublicHeader from '../PublicHeader';
import PublicFooter from '../PublicFooter';

export const metadata:Metadata={
  title:'Watch & Earn',
  description:'Activate an Indie Cut rewards identity for eligible sponsored Watch & Earn offers.'
};

const steps=[
  ['01','Create your rewards identity','Sign in, confirm your email, verify one phone number and accept the Watch & Earn program rules.'],
  ['02','Choose an eligible sponsored title','Only videos clearly marked Watch & Earn can produce a cash reward. The amount and requirements will be shown before you start.'],
  ['03','Complete a qualified watch','A reward requires the defined viewing threshold and advertiser requirements. Opening a video by itself does not create a reward.'],
  ['04','Reward is reviewed','Eligible rewards will first be pending while Indie Cut checks viewing and fraud signals, then move to an available balance when approved.']
];

const rules=[
  ['18+ program','Watch & Earn activation is limited to adults age 18 or older during the initial program.'],
  ['One rewards identity per person','Creating extra accounts, rotating accounts or using another person’s identity to collect duplicate rewards is prohibited.'],
  ['Qualified watches only','The reward shown on an offer is earned only after the offer’s required viewing and ad conditions are satisfied.'],
  ['One reward per eligible offer','Replaying, refreshing, using multiple tabs or switching devices does not create additional rewards unless an offer explicitly says otherwise.'],
  ['Fraud checks apply','Automation, emulators, manipulated playback, false identity information and other attempts to manufacture viewing can make a reward ineligible.'],
  ['Rewards can be pending','A completed watch may remain pending while eligibility is verified. The viewer dashboard will eventually show the status and reason for each reward.'],
  ['Advertiser-funded offers only','Indie Cut will not promise a Watch & Earn cash reward unless the associated campaign has a funded reward allocation.'],
  ['Normal viewing stays separate','Content can still be available to watch without a cash reward. Only explicitly labeled Watch & Earn offers participate in this program.']
];

export default function RewardsPage(){
  return <main className="rewards-page"><PublicHeader/>
    <section className="rewards-hero"><div className="rewards-shell">
      <span className="rewards-badge">● Indie Cut Rewards</span>
      <div className="rewards-kicker" style={{marginTop:22}}>Sponsored viewing · verified rewards</div>
      <h1>WATCH. EARN. SUPPORT INDIE.</h1>
      <p>Indie Cut Watch & Earn is being built around advertiser-funded rewards. When an eligible sponsored movie, episode or video is marked Watch & Earn, verified viewers can qualify for the amount shown on that offer after completing its requirements.</p>
      <div className="rewards-actions"><Link className="rewards-button" href="/rewards/auth">Activate Watch & Earn</Link><Link className="rewards-button secondary" href="/videos">Browse Indie Cut Watch</Link></div>
      <p className="rewards-fineprint">Watch & Earn offers are not guaranteed to be continuously available. Simply playing content does not guarantee payment. Eligibility depends on the rules shown for the specific offer.</p>
    </div></section>

    <section className="rewards-section"><div className="rewards-shell">
      <div className="rewards-kicker">How the program works</div><h2>Clear rules before money moves.</h2>
      <div className="rewards-grid">{steps.map(([number,title,copy])=><article className="rewards-card" key={number}><div className="rewards-step">STEP {number}</div><h3>{title}</h3><p>{copy}</p></article>)}</div>
    </div></section>

    <section className="rewards-section" id="program-rules"><div className="rewards-shell">
      <div className="rewards-kicker">Program rules</div><h2>One person. One rewards identity.</h2>
      <div className="rewards-rule-list">{rules.map(([title,copy])=><div className="rewards-rule" key={title}><strong>{title}</strong>{copy}</div>)}</div>
      <div className="rewards-note"><strong>What “qualified watch” means:</strong> each sponsored offer will define its own eligibility requirements. Indie Cut will record the applicable offer, required viewing threshold, ad requirements and reward amount before determining whether the reward is approved. Detailed viewing verification and wallet processing are separate builds of the rewards system.</div>
    </div></section>

    <section className="rewards-section"><div className="rewards-shell" style={{textAlign:'center'}}><div className="rewards-kicker">Start with identity protection</div><h2>Activate once. Earn through one verified profile.</h2><div className="rewards-actions" style={{justifyContent:'center'}}><Link className="rewards-button" href="/rewards/auth">Create or sign in to your account</Link></div></div></section>
    <PublicFooter/>
  </main>;
}
