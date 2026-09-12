'use client';

import {useEffect,useState} from 'react';
import {trackMarketingEvent} from '../../../../../lib/marketing-tracking';
import styles from './ArtistProfile.module.css';

function FacebookIcon(){return <svg className={styles.shareIcon} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.5 1.6-1.5h1.7V4.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V11H8v3h2.4v8h3.1z"/></svg>}
function LinkedInIcon(){return <svg className={styles.shareIcon} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M6.5 8.1A1.8 1.8 0 1 0 6.5 4.5a1.8 1.8 0 0 0 0 3.6zM5 9.5h3v9.5H5V9.5zm4.8 0h2.9v1.3h.1c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.2 3.9 5V19h-3v-4.3c0-1 0-2.4-1.5-2.4s-1.7 1.1-1.7 2.3V19h-3V9.5z"/></svg>}
function MailIcon(){return <svg className={styles.shareIcon} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>}
function ShareIcon(){return <svg className={styles.shareIcon} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>}
function LinkIcon(){return <svg className={styles.shareIcon} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>}

export default function ArtistVoteClient({battleSlug,entryId,artistName,votingOpen,initialVotes,rank}:{battleSlug:string;entryId:string;artistName:string;votingOpen:boolean;initialVotes:number;rank:number}){
 const [loading,setLoading]=useState(false);const [message,setMessage]=useState('');const [votes,setVotes]=useState(initialVotes||0);const [url,setUrl]=useState('');
 useEffect(()=>setUrl(window.location.href),[]);
 function recordShare(channel:string){trackMarketingEvent('ArtistShare',{channel,artist_name:artistName,battle_slug:battleSlug,entry_id:entryId})}
 async function vote(){setLoading(true);setMessage('');try{const res=await fetch(`/api/battles/${battleSlug}/vote`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entryId})});const body=await res.json();if(!res.ok)throw new Error(body.error||'Vote failed');setVotes(v=>v+1);trackMarketingEvent('BattleVote',{artist_name:artistName,battle_slug:battleSlug,entry_id:entryId});setMessage(`Your vote for ${artistName} has been counted.`)}catch(e:any){setMessage(e.message)}finally{setLoading(false)}}
 async function copy(){try{await navigator.clipboard.writeText(url||window.location.href);recordShare('copy_link');setMessage('Voting link copied.')}catch{}}
 async function nativeShare(){try{if(navigator.share){await navigator.share({title:`Vote for ${artistName} on Indie Cut`,text:'Think this artist should advance? Share this page and help them win.',url:url||window.location.href});recordShare('native_share')}else await copy()}catch{}}
 function popup(href:string,channel:string){recordShare(channel);window.open(href,'indiecut-artist-share','width=720,height=620,noopener,noreferrer')}
 const liveUrl=url||'';const encoded=encodeURIComponent(liveUrl);const text=encodeURIComponent(`Think ${artistName} should advance? Vote and help them win on Indie Cut.`);
 return <section className={styles.voteArea}>
  <div className={styles.stats}><div className={styles.stat}><strong>{votes}</strong><span>{votes===1?'Fan vote':'Fan votes'}</span></div><div className={styles.stat}><strong>#{rank}</strong><span>Current rank</span></div></div>
  {votingOpen?<button className={styles.voteButton} onClick={vote} disabled={loading}>{loading?'COUNTING YOUR VOTE…':`VOTE FOR ${artistName.toUpperCase()}`}</button>:<div className={styles.message}>Voting is currently closed.</div>}
  <p className={styles.rule}>Voting is limited to one qualifying vote per device and internet connection to help keep the competition fair.</p>
  {message&&<div className={styles.message}>{message}</div>}
  <div className={styles.shareBlock}>
   <h3 className={styles.shareTitle}>Think this artist should advance? Share this page and help them win.</h3>
   <div className={styles.shareButtons} aria-label="Share this artist voting page">
    <span className={styles.shareCaption}>Share</span>
    <button type="button" className={`${styles.shareCircle} ${styles.facebook}`} aria-label="Share on Facebook" title="Facebook" onClick={()=>liveUrl&&popup(`https://www.facebook.com/sharer/sharer.php?u=${encoded}`,'facebook')}><FacebookIcon/></button>
    <button type="button" className={`${styles.shareCircle} ${styles.x}`} aria-label="Share on X" title="X" onClick={()=>liveUrl&&popup(`https://twitter.com/intent/tweet?url=${encoded}&text=${text}`,'x')}><span className={styles.xMark}>X</span></button>
    <button type="button" className={`${styles.shareCircle} ${styles.linkedin}`} aria-label="Share on LinkedIn" title="LinkedIn" onClick={()=>liveUrl&&popup(`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,'linkedin')}><LinkedInIcon/></button>
    <a className={`${styles.shareCircle} ${styles.email}`} aria-label="Share by email" title="Email" onClick={()=>recordShare('email')} href={liveUrl?`mailto:?subject=${encodeURIComponent(`Vote for ${artistName} on Indie Cut`)}&body=${encodeURIComponent(`Think this artist should advance? Share this page and help them win.\n\n${liveUrl}`)}`:'#'}><MailIcon/></a>
    <button type="button" className={`${styles.shareCircle} ${styles.copy}`} aria-label="Copy link" title="Copy link" onClick={copy}><LinkIcon/></button>
    <button type="button" className={`${styles.shareCircle} ${styles.more}`} aria-label="More sharing options" title="More" onClick={nativeShare}><ShareIcon/></button>
   </div>
  </div>
 </section>;
}
