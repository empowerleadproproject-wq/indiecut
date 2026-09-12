'use client';

import {useEffect,useMemo,useState} from 'react';
import styles from './rankings.module.css';

type Board={genre:string;contest:any;artists:any[]};

function initials(name:string){return String(name||'?').split(/\s+/).map(x=>x[0]||'').join('').slice(0,2).toUpperCase()||'?'}
function statusLabel(value:string){const v=String(value||'').toLowerCase();if(v==='qualifying')return 'FAN VOTING OPEN';if(v==='live')return 'LIVE BATTLE';if(v==='scheduled')return 'UPCOMING';return 'PHASE ONE';}

export default function LeaderboardClient({initialBoards=[]}:{initialBoards?:Board[]}){
  const [boards,setBoards]=useState<Board[]>(initialBoards);
  const [selected,setSelected]=useState(initialBoards[0]?.genre||'');
  const [updatedAt,setUpdatedAt]=useState('');

  async function refresh(){
    try{
      const r=await fetch('/api/battles/rankings',{cache:'no-store'});const j=await r.json();if(!r.ok)return;
      const next=j.genres||[];setBoards(next);setUpdatedAt(j.updated_at||'');
      setSelected(current=>next.some((b:Board)=>b.genre===current)?current:(next[0]?.genre||''));
    }catch{}
  }

  useEffect(()=>{const id=setInterval(refresh,15000);return()=>clearInterval(id)},[]);
  const board=useMemo(()=>boards.find(x=>x.genre===selected)||boards[0]||null,[boards,selected]);
  const top=board?.artists?.slice(0,3)||[];
  const rest=board?.artists?.slice(3)||[];

  if(!boards.length)return <div className={styles.emptyState}><div className={styles.emptyIcon}>★</div><h2>No active rankings yet.</h2><p>As soon as approved artists enter a genre competition, their live fan rankings will appear here.</p><a href="/battles/submit">SUBMIT YOUR MUSIC →</a></div>;

  return <>
    <div className={styles.genreStrip}>
      {boards.map(item=><button key={item.genre} className={`${styles.genreButton} ${item.genre===board?.genre?styles.genreActive:''}`} onClick={()=>setSelected(item.genre)}>{item.genre}</button>)}
    </div>

    {board&&<section className={styles.board}>
      <div className={styles.boardHeader}>
        <div><div className={styles.liveLabel}><span></span>{statusLabel(board.contest?.status)}</div><h2>{board.genre} Rankings</h2><p>{board.contest?.title}</p></div>
        <div className={styles.refreshNote}>LIVE FAN RANKINGS<br/><span>Updates automatically{updatedAt?' · refreshed just now':''}</span></div>
      </div>

      <div className={styles.podium}>
        {[top[1],top[0],top[2]].map((artist:any,index:number)=>{
          if(!artist)return <div key={index} className={styles.podiumEmpty}/>;
          const rank=index===1?1:index===0?2:3;
          return <a key={artist.id} href={artist.fan_path} className={`${styles.podiumCard} ${rank===1?styles.first:''}`}>
            <div className={styles.crown}>{rank===1?'♛':`#${rank}`}</div>
            {artist.image_url?<img src={artist.image_url} alt={artist.artist_name}/>:<div className={styles.avatarFallback}>{initials(artist.artist_name)}</div>}
            <strong>{artist.artist_name}</strong>
            <span className={styles.track}>{artist.track_title||'Track coming soon'}</span>
            <div className={styles.voteNumber}>{artist.votes.toLocaleString()}</div>
            <small>FAN VOTES</small>
            <div className={styles.viewLink}>VIEW • LISTEN • VOTE →</div>
          </a>
        })}
      </div>

      {rest.length>0&&<div className={styles.rankList}>
        {rest.map((artist:any)=><a key={artist.id} href={artist.fan_path} className={styles.rankRow}>
          <div className={styles.rankNumber}>#{artist.rank}</div>
          <div className={styles.artistPhoto}>{artist.image_url?<img src={artist.image_url} alt=""/>:<span>{initials(artist.artist_name)}</span>}</div>
          <div className={styles.artistMeta}><strong>{artist.artist_name}</strong><span>{artist.track_title||'Track coming soon'}{artist.city?` · ${artist.city}`:''}</span></div>
          <div className={styles.rowVotes}><strong>{artist.votes.toLocaleString()}</strong><span>votes</span></div>
          <div className={styles.rowArrow}>→</div>
        </a>)}
      </div>}

      <div className={styles.bottomNote}>Tap any artist to hear their song, vote, and share their page to help them climb the rankings.</div>
    </section>}
  </>;
}
