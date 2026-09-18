'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '../../lib/supabase/browser';

type BannerAd={_id:string;advertiser?:string;title?:string;creative_url:string;destination_url?:string};

function clientId(){
 const key='indiecut_cut_client_id';
 let id=localStorage.getItem(key);
 if(!id){id=typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():`cut-${Date.now()}-${Math.random().toString(36).slice(2)}`;localStorage.setItem(key,id)}
 return id;
}
export default function CutBannerAds(){
 const[ads,setAds]=useState<BannerAd[]>([]);
 const[index,setIndex]=useState(0);
 const seen=useRef(new Set<string>());
 const roomSlug=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('room')||'hallway':'hallway';

 useEffect(()=>{let dead=false;fetch(`/api/public/ads?placement=cut-room-banner&t=${Date.now()}`,{cache:'no-store'}).then(r=>r.json()).then(j=>{if(!dead)setAds((Array.isArray(j?.ads)?j.ads:[]).filter((a:any)=>a?._id&&a?.creative_url))}).catch(()=>{});return()=>{dead=true}},[]);
 useEffect(()=>{if(ads.length<2)return;const timer=window.setInterval(()=>setIndex(i=>(i+1)%ads.length),20000);return()=>window.clearInterval(timer)},[ads.length]);
 useEffect(()=>{const ad=ads[index];if(!ad||seen.current.has(ad._id))return;seen.current.add(ad._id);createClient().rpc('cut_track_banner_ad_event',{p_ad_id:ad._id,p_room_slug:roomSlug,p_event_type:'impression',p_client_id:clientId()}).then(()=>{})},[ads,index,roomSlug]);
 if(!ads.length)return null;
 const ad=ads[index];
 const click=()=>createClient().rpc('cut_track_banner_ad_event',{p_ad_id:ad._id,p_room_slug:roomSlug,p_event_type:'click',p_client_id:clientId()}).then(()=>{});
 const creative=<img src={ad.creative_url} alt={ad.advertiser||ad.title||'Advertisement'} style={{display:'block',width:'100%',height:'auto',aspectRatio:'6 / 1',objectFit:'cover'}}/>;
 return <div aria-label="Advertisement" style={{position:'fixed',left:'50%',transform:'translateX(-50%)',bottom:'calc(12px + env(safe-area-inset-bottom))',zIndex:190,width:'min(92vw,960px)',background:'#0d0f13',border:'1px solid rgba(255,255,255,.16)',borderRadius:12,overflow:'hidden',boxShadow:'0 12px 40px rgba(0,0,0,.5)'}}>
   <div style={{position:'absolute',top:5,left:7,zIndex:2,background:'rgba(0,0,0,.7)',color:'#ddd',fontSize:8,fontWeight:800,letterSpacing:'.08em',padding:'3px 5px',borderRadius:4}}>ADVERTISEMENT</div>
   {ad.destination_url?<a href={ad.destination_url} target="_blank" rel="noreferrer sponsored" onClick={click} style={{display:'block'}}>{creative}</a>:creative}
 </div>;
}
