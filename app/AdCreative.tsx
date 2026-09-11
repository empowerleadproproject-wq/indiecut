'use client';

function isVideoUrl(src:string){
 return /\.(mp4|webm|mov|m4v)(?:\?|#|$)/i.test(src);
}

export default function AdCreative({src,alt='',mediaType=''}:{src:string;alt?:string;mediaType?:string}){
 const type=String(mediaType||'').toLowerCase();
 const shouldRenderVideo=type.startsWith('video/')||isVideoUrl(src);
 if(shouldRenderVideo){
  return <video src={src} autoPlay muted loop playsInline controls={false} preload="metadata"/>;
 }
 return <img src={src} alt={alt}/>;
}
