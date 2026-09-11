'use client';

import {useState} from 'react';

export default function AdCreative({src,alt='',mediaType=''}:{src:string;alt?:string;mediaType?:string}){
 const knownImage=String(mediaType).startsWith('image/');
 const [showImage,setShowImage]=useState(knownImage);
 if(showImage)return <img src={src} alt={alt}/>;
 return <video src={src} autoPlay muted loop playsInline controls preload="metadata" onError={()=>setShowImage(true)}/>;
}
