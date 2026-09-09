'use client';

import {useState} from 'react';
import styles from './ShareButtons.module.css';

function FacebookIcon(){return <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.5 1.6-1.5h1.7V4.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V11H8v3h2.4v8h3.1z"/></svg>}
function LinkedInIcon(){return <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M6.5 8.1A1.8 1.8 0 1 0 6.5 4.5a1.8 1.8 0 0 0 0 3.6zM5 9.5h3v9.5H5V9.5zm4.8 0h2.9v1.3h.1c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.2 3.9 5V19h-3v-4.3c0-1 0-2.4-1.5-2.4s-1.7 1.1-1.7 2.3V19h-3V9.5z"/></svg>}
function MailIcon(){return <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>}
function ShareIcon(){return <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>}
function LinkIcon(){return <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></svg>}

export default function ShareButtons({headline}:{headline:string}){
 const [copied,setCopied]=useState(false);
 const url=typeof window!=='undefined'?window.location.href:'';
 const encUrl=encodeURIComponent(url);const encText=encodeURIComponent(headline);
 function popup(href:string){window.open(href,'indiecut-share','width=720,height=620,noopener,noreferrer')}
 async function copy(){await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1800)}
 async function nativeShare(){if(navigator.share){await navigator.share({title:headline,url}).catch(()=>{})}else await copy()}
 return <div className={styles.bar} aria-label="Share this article">
   <span className={styles.label}>Share</span>
   <button type="button" className={`${styles.btn} ${styles.facebook}`} aria-label="Share on Facebook" title="Facebook" onClick={()=>popup(`https://www.facebook.com/sharer/sharer.php?u=${encUrl}`)}><FacebookIcon/></button>
   <button type="button" className={`${styles.btn} ${styles.x}`} aria-label="Share on X" title="X" onClick={()=>popup(`https://twitter.com/intent/tweet?url=${encUrl}&text=${encText}`)}><span className={styles.xMark}>X</span></button>
   <button type="button" className={`${styles.btn} ${styles.linkedin}`} aria-label="Share on LinkedIn" title="LinkedIn" onClick={()=>popup(`https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`)}><LinkedInIcon/></button>
   <a className={`${styles.btn} ${styles.email}`} aria-label="Share by email" title="Email" href={`mailto:?subject=${encText}&body=${encodeURIComponent(headline+'\n\n'+url)}`}><MailIcon/></a>
   <button type="button" className={`${styles.btn} ${styles.copy}`} aria-label="Copy link" title="Copy link" onClick={copy}><LinkIcon/></button>
   <button type="button" className={`${styles.btn} ${styles.more}`} aria-label="More sharing options" title="More" onClick={nativeShare}><ShareIcon/></button>
   {copied&&<span className={styles.copied}>Link copied!</span>}
 </div>
}
