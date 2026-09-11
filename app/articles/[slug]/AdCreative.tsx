'use client';

import {useState} from 'react';

export default function AdCreative({src,alt='',mediaType='',isVideo=false}:{src:string;alt?:string;mediaType?:string;isVideo?:boolean}){
 const knownImage=String(mediaType).startsWith('image/');
 const [fallbackToImage,setFallbackToImage]=useState(knownImage);
 if(fallbackToImage)return <img src={src} alt={alt}/>;
 return <video src={src} autoPlay muted loop playsInline controls preload="metadata" onError={()=>setFallbackToImage(true)} style={{width:'100%',height:'auto'}}/>;
}
