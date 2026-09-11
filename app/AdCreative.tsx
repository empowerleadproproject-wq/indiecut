'use client';

function isVideoSrc(src:string,mediaType:string){
 if(String(mediaType||'').startsWith('video/'))return true;
 return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(String(src||''));
}

export default function AdCreative({src,alt='',mediaType=''}:{src:string;alt?:string;mediaType?:string}){
 if(isVideoSrc(src,mediaType))return <video src={src} autoPlay muted loop playsInline controls={false} preload="metadata"/>;
 return <img src={src} alt={alt}/>;
}
