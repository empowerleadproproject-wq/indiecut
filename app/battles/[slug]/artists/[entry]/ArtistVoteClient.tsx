'use client';

import { useState } from 'react';
import styles from '../../../battles.module.css';

export default function ArtistVoteClient({battleSlug,entryId,artistName,votingOpen}:{battleSlug:string;entryId:string;artistName:string;votingOpen:boolean}){
 const [loading,setLoading]=useState(false);const [message,setMessage]=useState('');
 async function vote(){setLoading(true);setMessage('');try{const res=await fetch(`/api/battles/${battleSlug}/vote`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entryId})});const body=await res.json();if(!res.ok)throw new Error(body.error||'Vote failed');setMessage(`Vote counted for ${artistName}.`)}catch(e:any){setMessage(e.message)}finally{setLoading(false)}}
 async function share(){const url=window.location.href;try{if(navigator.share)await navigator.share({title:`Vote for ${artistName} on Indie Cut`,text:`Help ${artistName} reach the Indie Cut Live Battle.`,url});else{await navigator.clipboard.writeText(url);setMessage('Artist voting link copied.')}}catch{}}
 return <><div className={styles.shareRow}>{votingOpen?<button className={styles.voteButton} style={{width:'auto'}} onClick={vote} disabled={loading}>{loading?'COUNTING…':`VOTE FOR ${artistName.toUpperCase()}`}</button>:<span className={styles.notice}>Voting is currently closed.</span>}<button className={styles.shareButton} onClick={share}>SHARE WITH FANS</button></div>{message&&<div className={styles.notice}>{message}</div>}</>;
}
