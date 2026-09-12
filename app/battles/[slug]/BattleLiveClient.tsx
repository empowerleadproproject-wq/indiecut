'use client';

import { useEffect,useMemo,useRef,useState } from 'react';
import ZoomStage from './ZoomStage';
import BattleSponsorRotator from '../room/BattleSponsorRotator';
import styles from '../battles.module.css';

type Props={slug:string;initialData:any;roomSponsors?:any[]};
const videoExt=/\.(mp4|webm|mov|m4v)(\?|$)/i;

export default function BattleLiveClient({slug,initialData,roomSponsors=[]}:Props){
 const [data,setData]=useState(initialData);const [message,setMessage]=useState('');const [voting,setVoting]=useState(false);const [sound,setSound]=useState(false);const [tick,setTick]=useState(Date.now());
 const trackRef=useRef<HTMLAudioElement>(null);const commercialRef=useRef<HTMLVideoElement>(null);
 const contest=data.contest;const round=data.currentRound;
 const entryA=useMemo(()=>data.entries.find((x:any)=>x.id===round?.entry_a_id)||data.finalists?.[0]||null,[data,round]);
 const entryB=useMemo(()=>data.entries.find((x:any)=>x.id===round?.entry_b_id)||data.finalists?.[1]||null,[data,round]);
 const currentTrack=contest.current_segment==='artist_a'?{url:round?.track_a_url||entryA?.track_url,title:round?.track_a_title||entryA?.track_title,artist:entryA}:contest.current_segment==='artist_b'?{url:round?.track_b_url||entryB?.track_url,title:round?.track_b_title||entryB?.track_title,artist:entryB}:null;

 async function refresh(){try{const res=await fetch(`/api/battles/${slug}`,{cache:'no-store'});if(res.ok)setData(await res.json())}catch{}}
 useEffect(()=>{const id=setInterval(refresh,3000);return()=>clearInterval(id)},[slug]);
 useEffect(()=>{const id=setInterval(()=>setTick(Date.now()),500);return()=>clearInterval(id)},[]);
 useEffect(()=>{
  const audio=trackRef.current;if(!audio)return;
  if(!sound||!currentTrack?.url){audio.pause();return}
  const elapsed=contest.segment_started_at?Math.max(0,(Date.now()-new Date(contest.segment_started_at).getTime())/1000):0;
  if(audio.src!==currentTrack.url)audio.src=currentTrack.url;
  try{if(Math.abs(audio.currentTime-elapsed)>2.5)audio.currentTime=elapsed}catch{}
  audio.play().catch(()=>{});
 },[sound,currentTrack?.url,contest.segment_started_at,contest.current_segment]);
 useEffect(()=>{
  const vid=commercialRef.current;if(!vid||contest.current_segment!=='commercial'||!sound)return;
  const elapsed=contest.segment_started_at?Math.max(0,(Date.now()-new Date(contest.segment_started_at).getTime())/1000):0;
  try{if(Math.abs(vid.currentTime-elapsed)>2.5)vid.currentTime=elapsed}catch{}
  vid.play().catch(()=>{});
 },[contest.current_segment,contest.segment_started_at,sound]);

 async function castVote(entryId:string){
  setVoting(true);setMessage('');
  try{const res=await fetch(`/api/battles/${slug}/vote`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entryId,roundId:round?.id})});const body=await res.json();if(!res.ok)throw new Error(body.error||'Vote failed');setMessage('Your vote is in.');await refresh()}catch(e:any){setMessage(e.message)}finally{setVoting(false)}
 }
 async function share(){const url=window.location.href;try{if(navigator.share)await navigator.share({title:contest.title,url});else{await navigator.clipboard.writeText(url);setMessage('Battle link copied.')}}catch{}}
 function enableSound(){setSound(true);if(trackRef.current&&currentTrack?.url){trackRef.current.src=currentTrack.url;trackRef.current.play().catch(()=>{})}}
 const voteCloses=round?.vote_closes_at?new Date(round.vote_closes_at).getTime():0;const seconds=voteCloses?Math.max(0,Math.ceil((voteCloses-tick)/1000)):0;
 const commercialVideo=videoExt.test(String(contest.commercial_url||''));
 const voteOpen=contest.current_segment==='voting'&&!!round&&seconds>0;
 const voteHeadline=voteOpen?'VOTE NOW':contest.current_segment==='artist_a'||contest.current_segment==='artist_b'?'VOTING OPENS AFTER BOTH TRACKS PLAY':contest.current_segment==='commercial'?'VOTING RESUMES AFTER THE SPONSOR BREAK':contest.current_segment==='results'?'ROUND VOTING IS CLOSED':'FAN VOTING OPENS WHEN THE ROUND BEGINS';

 if(contest.status==='qualifying')return <>
  <div className={styles.liveBar}><strong>Fan qualifying is open</strong><button className={styles.shareButton} onClick={share}>SHARE COMPETITION</button></div>
  <section className={styles.section}>
   <div className={styles.sectionHead}><div><div className={styles.eyebrow}>QUALIFYING</div><h2>Vote for the artists you want to see advance</h2></div></div>
   <div className={styles.leaderboard}>{data.entries.map((entry:any,index:number)=><div className={styles.rankRow} key={entry.id}><div className={styles.rank}>#{index+1}</div>{entry.image_url?<img className={styles.avatar} src={entry.image_url} alt=""/>:<div className={styles.avatar}/>}<div><a href={`/battles/${slug}/artists/${entry.slug}`} style={{color:'inherit',textDecoration:'none'}}><div className={styles.artistName}>{entry.artist_name}</div></a><div className={styles.small}>{entry.genre||'Independent artist'}{entry.city?` · ${entry.city}`:''}</div></div><div style={{textAlign:'right'}}><div className={styles.votes}>{entry.vote_count} votes</div><button className={styles.voteButton} disabled={voting} onClick={()=>castVote(entry.id)}>VOTE</button></div></div>)}</div>
   <p style={{margin:'18px 0 0',fontSize:13,lineHeight:1.5,opacity:.65}}>You can support more than one artist, but each artist can only receive one vote from the same device or internet connection during qualifying. Top artists advance to the live battle.</p>
   {message&&<div className={styles.notice}>{message}</div>}
  </section>
 </>;

 return <>
  <audio ref={trackRef} preload="auto"/>
  <div className={styles.liveBar}><div><strong>{contest.status==='live'?<><span className={styles.liveDot}/>LIVE NOW</>:contest.status==='completed'?'FINAL RESULTS':'BATTLE NIGHT'}</strong>{currentTrack?.title&&<div className={styles.small}>Now playing: {currentTrack.artist?.artist_name} — {currentTrack.title}</div>}</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{!sound&&<button className={styles.enterButton} onClick={enableSound}>TURN ON MUSIC</button>}<button className={styles.shareButton} onClick={share}>SHARE</button></div></div>
  <div style={{position:'relative'}}><ZoomStage slug={slug} artistA={entryA} artistB={entryB}/>{contest.current_segment==='commercial'&&contest.commercial_url&&<div className={styles.commercial}><span className={styles.commercialBadge}>SPONSOR BREAK</span>{commercialVideo?<video ref={commercialRef} src={contest.commercial_url} autoPlay={sound} muted={!sound} playsInline/>:<img src={contest.commercial_url} alt={contest.sponsor_name||'Sponsor'}/>}</div>}</div>
  {roomSponsors.length>0&&<BattleSponsorRotator sponsors={roomSponsors}/>} 
  <section className={styles.section} id="fan-voting"><div className={styles.sectionHead}><div><div className={styles.eyebrow}>FAN VOTING{round?` · ROUND ${round.round_number}`:''}</div><h2>{voteHeadline}</h2></div>{voteOpen&&<div className={styles.countdown}>{seconds}s left</div>}</div>
   {round&&entryA&&entryB?<div className={styles.votePanel}><div className={styles.voteChoice}><h3>{entryA.artist_name}</h3><p>{round.track_a_title||entryA.track_title||'Artist A track'}</p><button className={styles.voteButton} disabled={voting||!voteOpen} onClick={()=>castVote(entryA.id)}>{voteOpen?`VOTE ${entryA.artist_name.toUpperCase()}`:'VOTING NOT OPEN'}</button></div><div className={styles.voteChoice}><h3>{entryB.artist_name}</h3><p>{round.track_b_title||entryB.track_title||'Artist B track'}</p><button className={styles.voteButton} disabled={voting||!voteOpen} onClick={()=>castVote(entryB.id)}>{voteOpen?`VOTE ${entryB.artist_name.toUpperCase()}`:'VOTING NOT OPEN'}</button></div></div>:<div className={styles.notice}>The two artist voting buttons will appear here as soon as the first live round is loaded.</div>}
   {message&&<div className={styles.notice}>{message}</div>}
  </section>
  {contest.current_segment==='results'&&round&&<section className={styles.section}><div className={styles.sectionHead}><div><div className={styles.eyebrow}>ROUND {round.round_number} RESULTS</div><h2>{round.winner_entry_id?`${data.entries.find((x:any)=>x.id===round.winner_entry_id)?.artist_name||'Winner'} takes the round`:'This round is tied'}</h2></div></div><div className={styles.roundCard}><div className={styles.score}><div><span>{entryA?.artist_name}</span><br/><b>{round.votes_a}</b></div><strong>VS</strong><div><span>{entryB?.artist_name}</span><br/><b>{round.votes_b}</b></div></div></div></section>}
  {contest.status==='completed'&&data.winner&&<section className={styles.section}><div className={`${styles.roundCard} ${styles.champion}`} style={{textAlign:'center',padding:30}}><div className={styles.eyebrow}>INDIE CUT BATTLE CHAMPION</div><h2 style={{fontSize:42,margin:'8px 0'}}>{data.winner.artist_name}</h2><p>Fan votes and completed round results have been tallied.</p></div></section>}
  <section className={styles.section}><div className={styles.sectionHead}><div><div className={styles.eyebrow}>THE ROAD TO THE WINNER</div><h2>Battle bracket</h2></div></div><Bracket data={data}/></section>
  <section className={styles.section}><div className={styles.sectionHead}><div><div className={styles.eyebrow}>ROUNDS</div><h2>Battle scorecard</h2></div></div><div style={{display:'grid',gap:12}}>{data.rounds.map((r:any)=><div className={styles.roundCard} key={r.id}><div className={styles.roundTop}><h3>{r.title||`Round ${r.round_number}`}</h3><span className={styles.small}>{r.status.toUpperCase()}</span></div><div className={styles.score}><div><span>{data.entries.find((x:any)=>x.id===r.entry_a_id)?.artist_name}</span><br/><b>{r.status==='voting'?'—':r.votes_a}</b></div><strong>VS</strong><div><span>{data.entries.find((x:any)=>x.id===r.entry_b_id)?.artist_name}</span><br/><b>{r.status==='voting'?'—':r.votes_b}</b></div></div></div>)}</div></section>
 </>;
}

function Bracket({data}:{data:any}){
 const finalists=data.finalists||[];const winner=data.winner;
 return <div className={styles.bracket}><div className={styles.bracketColumn}><div className={styles.bracketTitle}>Qualifiers</div>{data.entries.slice(0,4).map((e:any,i:number)=><div className={styles.bracketNode} key={e.id}><strong>#{i+1} {e.artist_name}</strong><span className={styles.small}>{e.vote_count} fan votes</span></div>)}</div><div className={styles.bracketArrow}>→</div><div className={styles.bracketColumn}><div className={styles.bracketTitle}>Finalists</div>{finalists.length?finalists.map((e:any)=><div className={styles.bracketNode} key={e.id}><strong>{e.artist_name}</strong><span className={styles.small}>Live battle finalist</span></div>):<div className={styles.bracketNode}><strong>TBD</strong><span className={styles.small}>Top two qualify</span></div>}</div><div className={styles.bracketArrow}>→</div><div className={styles.bracketColumn}><div className={styles.bracketTitle}>Champion</div><div className={`${styles.bracketNode} ${winner?styles.champion:''}`}><strong>{winner?.artist_name||'TBD'}</strong><span className={styles.small}>{winner?'Indie Cut battle winner':'Winner revealed live'}</span></div></div></div>
}
