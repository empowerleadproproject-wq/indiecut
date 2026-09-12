import PublicHeader from '../PublicHeader';
import PublicFooter from '../PublicFooter';
import SitewideAd from '../SitewideAd';
import {battleDb} from '../../lib/battles';

export const dynamic='force-dynamic';
export const revalidate=0;

const defaults={
 headline:'WHERE INDEPENDENT ARTISTS BATTLE FOR THE CROWN.',
 subheadline:'Listen to the artists. Vote for who you believe in. The fans decide who moves forward.',
 submission_open:true
};

async function landingData(){
 const db=battleDb();
 const [{data:setting},{data:contests}]=await Promise.all([
  db.from('site_settings').select('setting_value').eq('setting_key','admin_battle_landing').maybeSingle(),
  db.from('battle_contests').select('id,title,slug,status,updated_at').in('status',['qualifying','scheduled','live']).order('updated_at',{ascending:false}).limit(1)
 ]);
 let saved:any={};try{saved=JSON.parse(setting?.setting_value||'{}')}catch{}
 const contest=contests?.[0]||null;
 let entries:any[]=[];
 if(contest){
  const [{data:entryRows},{data:votes}]=await Promise.all([
   db.from('battle_entries').select('id,artist_name,slug,genre,city,image_url,track_title,track_cover_url').eq('contest_id',contest.id).eq('active',true).order('created_at',{ascending:true}),
   db.from('battle_votes').select('entry_id').eq('contest_id',contest.id)
  ]);
  const counts=new Map<string,number>();
  for(const vote of votes||[])counts.set(String(vote.entry_id),Number(counts.get(String(vote.entry_id))||0)+1);
  entries=(entryRows||[]).map((entry:any)=>({...entry,votes:Number(counts.get(String(entry.id))||0)})).sort((a:any,b:any)=>b.votes-a.votes);
 }
 return {content:{...defaults,...saved},contest,entries};
}

export default async function BattlesLandingPage(){
 const {content,contest,entries}=await landingData();
 const voteHref=contest?.slug?`/battles/${contest.slug}`:'/battles/rankings';
 return <main className="battle-public-page">
  <PublicHeader/>
  <div className="battle-public-layout">
   <div className="battle-public-main">
    <section className="battle-hero">
     <div className="battle-eyebrow">INDIE CUT LIVE BATTLES</div>
     <h1>{content.headline}</h1>
     <p>{content.subheadline}</p>
     <div className="battle-actions">
      <a className="battle-btn battle-btn-dark" href={voteHref}>VOTE NOW</a>
      <a className="battle-btn battle-btn-light" href="/battles/rankings">VIEW RANKINGS</a>
     </div>
     {content.submission_open&&<a className="battle-artist-link" href="/battles/submit">ARTISTS: ENTER THE NEXT BATTLE →</a>}
    </section>

    {contest&&<section className="battle-current">
     <div className="battle-section-head">
      <div>
       <span className="battle-small-label">CURRENT BATTLE</span>
       <h2>{contest.title}</h2>
      </div>
      <a href="/battles/rankings">FULL RANKINGS →</a>
     </div>
     <div className="battle-rule">Listen first. Vote once for every artist you support. You cannot vote for the same artist twice.</div>
     <div className="battle-artists">
      {entries.map((entry:any,index:number)=>{
       const image=entry.image_url||entry.track_cover_url;
       return <a className="battle-artist-row" href={`/battles/${contest.slug}/artists/${entry.slug}`} key={entry.id}>
        <div className="battle-rank">{String(index+1).padStart(2,'0')}</div>
        <div className="battle-thumb">{image?<img src={image} alt={entry.artist_name||'Independent artist'}/>:<div className="battle-thumb-fallback">IC</div>}</div>
        <div className="battle-artist-copy">
         <strong>{entry.artist_name}</strong>
         <span>{entry.track_title||'Original song'}{entry.genre?` · ${entry.genre}`:''}{entry.city?` · ${entry.city}`:''}</span>
        </div>
        <div className="battle-vote-count"><b>{entry.votes}</b><span>VOTES</span></div>
        <div className="battle-row-link">LISTEN & VOTE →</div>
       </a>
      })}
      {!entries.length&&<div className="battle-empty">Approved artists will appear here when voting opens.</div>}
     </div>
    </section>}

    <section className="battle-promo">
     <span className="battle-small-label">MORE THAN A TROPHY</span>
     <h2>The winner gets the push.</h2>
     <p>Indie Cut will use its platform to help put the winning artist in front of more people through editorial coverage, social promotion, featured placement and audience marketing.</p>
    </section>

    <section className="battle-how">
     <div className="battle-section-head"><div><span className="battle-small-label">HOW IT WORKS</span><h2>Simple. Fan-powered. Artist-first.</h2></div></div>
     <div className="battle-steps">
      <div><b>01</b><h3>Artists submit</h3><p>Independent artists send in an original song. Indie Cut reviews every submission before it goes public.</p></div>
      <div><b>02</b><h3>Fans listen & vote</h3><p>Approved artists get a public profile and shareable voting page. Fans can support multiple artists, once each.</p></div>
      <div><b>03</b><h3>The winner gets promoted</h3><p>Top artists advance through the competition, and the winner receives an Indie Cut marketing push.</p></div>
     </div>
    </section>

    {content.submission_open&&<section className="battle-submit-cta">
     <div><span className="battle-small-label">FOR ARTISTS</span><h2>Think your record can win?</h2><p>Submit privately. Nothing appears publicly until Indie Cut approves it.</p></div>
     <a className="battle-btn battle-btn-dark" href="/battles/submit">SUBMIT YOUR SONG</a>
    </section>}
   </div>
   <div className="battle-ad-column"><SitewideAd/></div>
  </div>
  <PublicFooter/>
  <style>{`
   .battle-public-page{background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;min-height:100vh}
   .battle-public-layout{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:42px;padding:34px 24px 70px;align-items:start}
   .battle-public-main{min-width:0}
   .battle-ad-column{position:sticky;top:18px;align-self:start}
   .battle-ad-column .ic-article-ad-rail{padding-top:0!important}
   .battle-hero{padding:58px 0 48px;border-bottom:1px solid #dedede}
   .battle-eyebrow,.battle-small-label{font-size:11px;font-weight:900;letter-spacing:.14em;color:#e744bd;text-transform:uppercase}
   .battle-hero h1{font-size:clamp(48px,7vw,92px);line-height:.94;letter-spacing:-.055em;max-width:850px;margin:16px 0 22px;font-weight:900;text-transform:uppercase}
   .battle-hero p{font-size:18px;line-height:1.55;color:#4a4a4a;max-width:650px;margin:0 0 28px}
   .battle-actions{display:flex;gap:10px;flex-wrap:wrap}
   .battle-btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 18px;text-decoration:none;font-size:12px;font-weight:900;letter-spacing:.04em;border:1px solid #111;transition:.18s ease}
   .battle-btn-dark{background:#111;color:#fff}.battle-btn-dark:hover{background:#e744bd;border-color:#e744bd}
   .battle-btn-light{background:#fff;color:#111}.battle-btn-light:hover{background:#f5f5f5}
   .battle-artist-link{display:inline-block;margin-top:20px;color:#111;font-size:11px;font-weight:900;text-decoration:none;border-bottom:1px solid #111;padding-bottom:3px}
   .battle-current,.battle-how{padding:48px 0;border-bottom:1px solid #dedede}
   .battle-section-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:20px}
   .battle-section-head h2,.battle-promo h2,.battle-submit-cta h2{font-size:clamp(28px,4vw,46px);line-height:1;letter-spacing:-.04em;margin:8px 0 0}
   .battle-section-head>a{font-size:11px;font-weight:900;color:#111;text-decoration:none;white-space:nowrap}
   .battle-rule{font-size:13px;color:#666;margin-bottom:22px}
   .battle-artists{border-top:2px solid #111}
   .battle-artist-row{display:grid;grid-template-columns:44px 88px minmax(0,1fr) 74px 126px;gap:16px;align-items:center;padding:16px 0;border-bottom:1px solid #ddd;color:#111;text-decoration:none}
   .battle-artist-row:hover .battle-row-link{color:#e744bd}
   .battle-rank{font-size:12px;font-weight:900;color:#777}
   .battle-thumb{width:88px;height:88px;background:#eee;overflow:hidden}.battle-thumb img{width:100%;height:100%;object-fit:cover;display:block}.battle-thumb-fallback{width:100%;height:100%;display:grid;place-items:center;font-weight:900;color:#777}
   .battle-artist-copy{display:flex;flex-direction:column;gap:6px;min-width:0}.battle-artist-copy strong{font-size:22px;letter-spacing:-.025em}.battle-artist-copy span{font-size:12px;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
   .battle-vote-count{text-align:right}.battle-vote-count b{display:block;font-size:21px}.battle-vote-count span{font-size:9px;font-weight:900;color:#888;letter-spacing:.08em}
   .battle-row-link{text-align:right;font-size:10px;font-weight:900;letter-spacing:.04em}
   .battle-empty{padding:28px 0;color:#777;font-size:13px}
   .battle-promo{background:#111;color:#fff;margin:48px 0 0;padding:46px 48px}.battle-promo .battle-small-label{color:#fff;opacity:.65}.battle-promo h2{font-size:clamp(38px,5vw,60px);max-width:650px}.battle-promo p{font-size:16px;line-height:1.6;color:#d8d8d8;max-width:680px;margin:18px 0 0}
   .battle-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}.battle-steps>div{padding-top:18px;border-top:2px solid #111}.battle-steps b{font-size:11px;color:#e744bd}.battle-steps h3{font-size:20px;margin:16px 0 8px}.battle-steps p{font-size:13px;line-height:1.55;color:#666;margin:0}
   .battle-submit-cta{display:flex;justify-content:space-between;align-items:center;gap:28px;padding:48px 0}.battle-submit-cta p{font-size:14px;color:#666;margin:10px 0 0}.battle-submit-cta .battle-btn{flex:0 0 auto}
   @media(max-width:1100px){.battle-public-layout{grid-template-columns:minmax(0,1fr) 220px;gap:28px}.battle-ad-column .ic-article-ad-rail{width:220px!important}.battle-artist-row{grid-template-columns:36px 72px minmax(0,1fr) 62px}.battle-thumb{width:72px;height:72px}.battle-row-link{display:none}}
   @media(max-width:900px){.battle-public-layout{display:block;padding:20px 18px 50px}.battle-ad-column{display:none}.battle-hero{padding:38px 0}.battle-hero h1{font-size:clamp(44px,11vw,72px)}.battle-steps{grid-template-columns:1fr}.battle-promo{padding:36px 28px}.battle-submit-cta{align-items:flex-start;flex-direction:column}}
   @media(max-width:620px){.battle-public-layout{padding:14px 14px 42px}.battle-hero h1{font-size:43px;line-height:.96;max-width:360px}.battle-hero p{font-size:15px}.battle-actions{display:grid;grid-template-columns:1fr 1fr}.battle-btn{width:100%;box-sizing:border-box;padding:0 12px}.battle-section-head{align-items:flex-start;flex-direction:column}.battle-current,.battle-how{padding:36px 0}.battle-artist-row{grid-template-columns:30px 64px minmax(0,1fr) 52px;gap:10px;padding:13px 0}.battle-thumb{width:64px;height:64px}.battle-artist-copy strong{font-size:17px}.battle-artist-copy span{font-size:10px}.battle-vote-count b{font-size:17px}.battle-promo{margin-top:36px;padding:30px 22px}.battle-promo h2{font-size:36px}.battle-promo p{font-size:14px}.battle-submit-cta{padding:36px 0}.battle-submit-cta h2{font-size:34px}}
   @media(max-width:390px){.battle-hero h1{font-size:38px}.battle-actions{grid-template-columns:1fr}.battle-artist-row{grid-template-columns:26px 56px minmax(0,1fr) 44px}.battle-thumb{width:56px;height:56px}.battle-artist-copy strong{font-size:15px}}
  `}</style>
 </main>
}
