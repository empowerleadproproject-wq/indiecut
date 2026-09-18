'use client';

import {useEffect,useRef,useState} from 'react';

type RadioSettings={enabled:boolean;station_name:string;tagline:string;stream_url:string;now_playing:string;artwork_url:string;accent:string};
const defaults:RadioSettings={enabled:false,station_name:'Indie Cut Radio',tagline:'Independent music. Culture. Live voices.',stream_url:'',now_playing:'Indie Cut Radio',artwork_url:'',accent:'#d7ff38'};

export default function IndieCutRadioPlayer(){
 const [cfg,setCfg]=useState(defaults),[open,setOpen]=useState(false),[playing,setPlaying]=useState(false);const audio=useRef<HTMLAudioElement>(null);
 useEffect(()=>{fetch('/api/radio',{cache:'no-store'}).then(r=>r.json()).then(j=>setCfg({...defaults,...j})).catch(()=>{})},[]);
 useEffect(()=>{const a=audio.current;if(!a)return;const onPlay=()=>setPlaying(true),onPause=()=>setPlaying(false);a.addEventListener('play',onPlay);a.addEventListener('pause',onPause);return()=>{a.removeEventListener('play',onPlay);a.removeEventListener('pause',onPause)}},[cfg.stream_url]);
 if(!cfg.enabled)return null;
 const toggle=async()=>{const a=audio.current;if(!a||!cfg.stream_url)return;try{if(a.paused){await a.play();setOpen(true)}else a.pause()}catch{}};
 return <><audio ref={audio} src={cfg.stream_url||undefined} preload="none"/><div style={{position:'fixed',right:18,bottom:18,zIndex:9998,fontFamily:'Arial,sans-serif'}}>
  {open&&<div style={{width:330,maxWidth:'calc(100vw - 36px)',background:'#0b0b0b',color:'#fff',border:'1px solid #2a2a2a',boxShadow:'0 18px 55px rgba(0,0,0,.4)',padding:18,marginBottom:10}}>
   <div style={{display:'flex',gap:14,alignItems:'center'}}>{cfg.artwork_url?<img src={cfg.artwork_url} alt="" style={{width:64,height:64,objectFit:'cover'}}/>:<div style={{width:64,height:64,display:'grid',placeItems:'center',background:cfg.accent,color:'#111',fontWeight:950,fontSize:20}}>IC</div>}<div style={{minWidth:0}}><div style={{fontSize:11,fontWeight:900,letterSpacing:'.12em',color:cfg.accent}}>LIVE RADIO</div><strong style={{display:'block',fontSize:18,margin:'4px 0'}}>{cfg.station_name}</strong><span style={{fontSize:12,color:'#aaa'}}>{cfg.now_playing||cfg.tagline}</span></div></div>
   {!cfg.stream_url&&<div style={{fontSize:12,color:'#aaa',marginTop:14}}>Station stream is being configured.</div>}
  </div>}
  <div style={{display:'flex',justifyContent:'flex-end',gap:8}}><button onClick={()=>setOpen(v=>!v)} style={{border:'1px solid #333',background:'#111',color:'#fff',borderRadius:999,padding:'11px 15px',fontWeight:900,cursor:'pointer'}}>◉ {cfg.station_name}</button><button aria-label={playing?'Pause Indie Cut Radio':'Play Indie Cut Radio'} onClick={toggle} disabled={!cfg.stream_url} style={{width:44,height:44,borderRadius:'50%',border:0,background:cfg.accent,color:'#111',fontWeight:950,cursor:cfg.stream_url?'pointer':'not-allowed'}}>{playing?'Ⅱ':'▶'}</button></div>
 </div></>
}