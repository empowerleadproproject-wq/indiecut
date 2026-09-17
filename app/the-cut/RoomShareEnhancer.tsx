'use client';

import {useEffect} from 'react';

export default function RoomShareEnhancer(){
  useEffect(()=>{
    const handler=async(event:MouseEvent)=>{
      const target=event.target as HTMLElement|null;
      const button=target?.closest('button');
      if(!button||button.textContent?.trim()!=='Share')return;

      const params=new URLSearchParams(window.location.search);
      const slug=params.get('room');
      if(!slug)return;

      const title=(document.querySelector('main section h1')?.textContent||'').trim();
      if(!title)return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const url=`${window.location.origin}/the-cut?room=${encodeURIComponent(slug)}`;
      const text=`Join me on The Cut. We're talking about ${title}.`;

      try{
        if(navigator.share){
          await navigator.share({title,text,url});
          return;
        }
        await navigator.clipboard.writeText(`${text}\n${url}`);
        const old=button.textContent;
        button.textContent='Copied';
        window.setTimeout(()=>{button.textContent=old},1400);
      }catch(err:any){
        if(err?.name==='AbortError')return;
        try{
          await navigator.clipboard.writeText(`${text}\n${url}`);
          const old=button.textContent;
          button.textContent='Copied';
          window.setTimeout(()=>{button.textContent=old},1400);
        }catch{}
      }
    };

    document.addEventListener('click',handler,true);
    return()=>document.removeEventListener('click',handler,true);
  },[]);

  return null;
}
