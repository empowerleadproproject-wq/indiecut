'use client';

import {useState} from 'react';

export default function ShareButtons({headline}:{headline:string}){
 const [copied,setCopied]=useState(false);
 const url=typeof window!=='undefined'?window.location.href:'';
 const encUrl=encodeURIComponent(url);const encText=encodeURIComponent(headline);
 function popup(href:string){window.open(href,'indiecut-share','width=720,height=620,noopener,noreferrer')}
 async function copy(){await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1800)}
 async function nativeShare(){if(navigator.share){await navigator.share({title:headline,url}).catch(()=>{})}else await copy()}
 return <div className="ic-share-bar" aria-label="Share this article">
   <span>SHARE</span>
   <button onClick={()=>popup(`https://www.facebook.com/sharer/sharer.php?u=${encUrl}`)}>Facebook</button>
   <button onClick={()=>popup(`https://twitter.com/intent/tweet?url=${encUrl}&text=${encText}`)}>X</button>
   <button onClick={()=>popup(`https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`)}>LinkedIn</button>
   <a href={`mailto:?subject=${encText}&body=${encodeURIComponent(headline+'\n\n'+url)}`}>Email</a>
   <button onClick={copy}>{copied?'Copied':'Copy Link'}</button>
   <button onClick={nativeShare}>More</button>
 </div>
}
