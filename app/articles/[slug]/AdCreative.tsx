'use client';

function isVideoUrl(src:string){
 return /\.(mp4|webm|mov|m4v)(?:\?|#|$)/i.test(src);
}

export default function AdCreative({src,alt='',mediaType='',isVideo=false}:{src:string;alt?:string;mediaType?:string;isVideo?:boolean}){
 const type=String(mediaType||'').toLowerCase();
 const shouldRenderVideo=isVideo||type.startsWith('video/')||isVideoUrl(src);
 if(shouldRenderVideo){
  return <video src={src} autoPlay muted loop playsInline controls={false} preload="metadata" style={{width:'100%',height:'auto'}}/>;
 }
 return <img src={src} alt={alt}/>;
}
