'use client';

function isVideoUrl(src:string){
 return /\.(mp4|webm|mov|m4v)(?:\?|#|$)/i.test(src);
}

export default function AdCreative({src,alt='',mediaType='',isVideo=false}:{src:string;alt?:string;mediaType?:string;isVideo?:boolean}){
 const type=String(mediaType||'').toLowerCase();
 const shouldRenderVideo=isVideo||type==='video'||type.startsWith('video/')||isVideoUrl(src);
 if(shouldRenderVideo){
  return <video src={src} autoPlay muted loop playsInline controls preload="auto" style={{display:'block',width:'100%',aspectRatio:'16 / 9',objectFit:'contain',background:'#000'}}/>;
 }
 return <img src={src} alt={alt}/>;
}
