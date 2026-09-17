'use client';

import {useEffect,useState} from 'react';
import {createClient} from '../../lib/supabase/browser';

export default function TheCutMusicPreviewSettings(){
  const[seconds,setSeconds]=useState(10);
  const[saving,setSaving]=useState(false);
  const[message,setMessage]=useState('');

  useEffect(()=>{
    (async()=>{
      try{
        const supabase=createClient();
        const{data,error}=await supabase.rpc('cut_music_preview_seconds');
        if(error)throw error;
        setSeconds(Number(data)||10);
      }catch{}
    })();
  },[]);

  async function save(){
    setSaving(true);setMessage('');
    try{
      const supabase=createClient();
      const{data,error}=await supabase.rpc('cut_admin_set_music_preview_seconds',{p_seconds:seconds});
      if(error)throw error;
      setSeconds(Number(data)||seconds);
      setMessage(`Music previews are now ${Number(data)||seconds} seconds.`);
    }catch(err:any){setMessage(err?.message||'Could not save preview length.');}
    finally{setSaving(false)}
  }

  return <div className="panel" style={{padding:24,marginBottom:20}}>
    <div className="kicker">MUSIC PROMO PREVIEW</div>
    <h2>Song preview length</h2>
    <p>Set how much of an uploaded song listeners can hear when they open a music promotion. This setting only applies to music. Brand / merch promos stay image-only, and movie trailers play in full.</p>
    <div style={{display:'flex',gap:12,alignItems:'end',flexWrap:'wrap',maxWidth:620}}>
      <label style={{minWidth:220}}><b>Preview seconds</b><input type="number" min={5} max={120} step={1} value={seconds} onChange={e=>setSeconds(Math.max(5,Math.min(120,Number(e.target.value)||10)))}/></label>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{[10,15,20,30,45,60].map(v=><button key={v} type="button" onClick={()=>setSeconds(v)} style={{fontWeight:800}}>{v}s</button>)}</div>
      <button type="button" onClick={save} disabled={saving}>{saving?'SAVING…':'SAVE MUSIC PREVIEW'}</button>
    </div>
    {message&&<p style={{fontWeight:800,marginBottom:0}}>{message}</p>}
  </div>;
}
