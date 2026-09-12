'use client';

import {useEffect,useState} from 'react';
import styles from './ArtistProfile.module.css';

export default function ArtistVoteClient({battleSlug,entryId,artistName,votingOpen,initialVotes,rank}:{battleSlug:string;entryId:string;artistName:string;votingOpen:boolean;initialVotes:number;rank:number}){
 const [loading,setLoading]=useState(false);const [message,setMessage]=useState('');const [votes,setVotes]=useState(initialVotes||0);const [url,setUrl]=useState('');
 useEffect(()=>setUrl(window.location.href),[]);
 async function vote(){setLoading(true);setMessage('');try{const res=await fetch(`/api/battles/${battleSlug}/vote`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entryId})});const body=await res.json();if(!res.ok)throw new Error(body.error||'Vote failed');setVotes(v=>v+1);setMessage(`Your vote for ${artistName} has been counted.`)}catch(e:any){setMessage(e.message)}finally{setLoading(false)}}
 async function copy(){try{await navigator.clipboard.writeText(url||window.location.href);setMessage('Voting link copied.')}catch{}}
 async function nativeShare(){try{if(navigator.share)await navigator.share({title:`Vote for ${artistName} on Indie Cut`,text:`Think this artist should advance? Share this page and help them win.`,url:url||window.location.href});else await copy()}catch{}}
 const encoded=encodeURIComponent(url);const text=encodeURIComponent(`Think ${artistName} should advance? Vote and help them win on Indie Cut.`);
 return <section className={styles.voteArea}>
  <div className={styles.stats}><div className={styles.stat}><strong>{votes}</strong><span>{votes===1?'Fan vote':'Fan votes'}</span></div><div className={styles.stat}><strong>#{rank}</strong><span>Current rank</span></div></div>
  {votingOpen?<button className={styles.voteButton} onClick={vote} disabled={loading}>{loading?'COUNTING YOUR VOTE…':`VOTE FOR ${artistName.toUpperCase()}`}</button>:<div className={styles.message}>Voting is currently closed.</div>}
  <p className={styles.rule}>Voting is limited to one qualifying vote per device and internet connection to help keep the competition fair.</p>
  {message&&<div className={styles.message}>{message}</div>}
  <div className={styles.shareBlock}>
   <h3 className={styles.shareTitle}>Think this artist should advance? Share this page and help them win.</h3>
   <div className={styles.shareButtons} aria-label="Share this artist voting page">
    <a className={styles.shareLink} href={url?`https://www.facebook.com/sharer/sharer.php?u=${encoded}`:'#'} target="_blank" rel="noreferrer" aria-label="Share on Facebook"><span>f</span><span className={styles.shareLabel}>Facebook</span></a>
    <a className={styles.shareLink} href={url?`https://twitter.com/intent/tweet?url=${encoded}&text=${text}`:'#'} target="_blank" rel="noreferrer" aria-label="Share on X"><span>𝕏</span><span className={styles.shareLabel}>X</span></a>
    <a className={styles.shareLink} href={url?`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`:'#'} target="_blank" rel="noreferrer" aria-label="Share on LinkedIn"><span>in</span><span className={styles.shareLabel}>LinkedIn</span></a>
    <a className={styles.shareLink} href={url?`mailto:?subject=${encodeURIComponent(`Vote for ${artistName} on Indie Cut`)}&body=${text}%0A%0A${encoded}`:'#'} aria-label="Share by email"><span>✉</span><span className={styles.shareLabel}>Email</span></a>
    <button className={styles.shareButton} type="button" onClick={copy} aria-label="Copy link"><span>↗</span><span className={styles.shareLabel}>Copy link</span></button>
    <button className={styles.shareButton} type="button" onClick={nativeShare} aria-label="Open share menu"><span>•••</span><span className={styles.shareLabel}>Share</span></button>
   </div>
  </div>
 </section>;
}
