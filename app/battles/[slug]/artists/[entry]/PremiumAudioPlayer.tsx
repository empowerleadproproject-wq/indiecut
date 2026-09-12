'use client';

import {useEffect,useRef,useState} from 'react';
import styles from './ArtistProfile.module.css';

function formatTime(value:number){
 if(!Number.isFinite(value)||value<0)return'0:00';
 const minutes=Math.floor(value/60);const seconds=Math.floor(value%60);
 return `${minutes}:${String(seconds).padStart(2,'0')}`;
}

export default function PremiumAudioPlayer({src}:{src:string}){
 const ref=useRef<HTMLAudioElement|null>(null);
 const [playing,setPlaying]=useState(false);const [current,setCurrent]=useState(0);const [duration,setDuration]=useState(0);
 useEffect(()=>{const audio=ref.current;if(!audio)return;const time=()=>setCurrent(audio.currentTime||0);const meta=()=>setDuration(audio.duration||0);const ended=()=>setPlaying(false);audio.addEventListener('timeupdate',time);audio.addEventListener('loadedmetadata',meta);audio.addEventListener('durationchange',meta);audio.addEventListener('ended',ended);return()=>{audio.removeEventListener('timeupdate',time);audio.removeEventListener('loadedmetadata',meta);audio.removeEventListener('durationchange',meta);audio.removeEventListener('ended',ended)}},[src]);
 async function toggle(){const audio=ref.current;if(!audio)return;if(audio.paused){await audio.play();setPlaying(true)}else{audio.pause();setPlaying(false)}}
 function seek(value:number){const audio=ref.current;if(!audio)return;audio.currentTime=value;setCurrent(value)}
 return <div className={styles.player}>
  <audio ref={ref} src={src} preload="metadata"/>
  <button className={styles.playButton} type="button" onClick={toggle} aria-label={playing?'Pause track':'Play track'}>{playing?'Ⅱ':'▶'}</button>
  <div className={styles.progressWrap}><input className={styles.progress} type="range" min="0" max={duration||0} step="0.1" value={Math.min(current,duration||0)} onChange={e=>seek(Number(e.target.value))} aria-label="Track progress"/></div>
  <div className={styles.time}>{formatTime(current)} / {formatTime(duration)}</div>
 </div>
}
