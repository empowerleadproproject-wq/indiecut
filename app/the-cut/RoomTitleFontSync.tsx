'use client';

import {useEffect} from 'react';
import {createClient} from '../../lib/supabase/browser';

const DEFAULT_FONT='-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';

export default function RoomTitleFontSync(){
  useEffect(()=>{
    let active=true;
    (async()=>{
      try{
        const supabase=createClient();
        const{data,error}=await supabase.rpc('cut_room_title_font');
        if(error)throw error;
        if(active)document.documentElement.style.setProperty('--cut-room-title-font',String(data||DEFAULT_FONT));
      }catch{
        if(active)document.documentElement.style.setProperty('--cut-room-title-font',DEFAULT_FONT);
      }
    })();
    return()=>{active=false};
  },[]);
  return null;
}
