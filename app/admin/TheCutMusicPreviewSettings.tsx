'use client';

import {useEffect,useState} from 'react';
import {createClient} from '../../lib/supabase/browser';

const DEFAULT_FONT='-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
const FONT_PRESETS=[
  ['Modern System',DEFAULT_FONT],
  ['Avenir','"Avenir Next", Avenir, "Helvetica Neue", Arial, sans-serif'],
  ['Helvetica','Helvetica, "Helvetica Neue", Arial, sans-serif'],
  ['Arial','Arial, Helvetica, sans-serif'],
  ['Trebuchet','"Trebuchet MS", Arial, sans-serif'],
  ['Georgia','Georgia, "Times New Roman", serif'],
] as const;

export default function TheCutMusicPreviewSettings(){
  const[seconds,setSeconds]=useState(10);
  const[font,setFont]=useState(DEFAULT_FONT);
  const[savingPreview,setSavingPreview]=useState(false);
  const[savingFont,setSavingFont]=useState(false);
  const[message,setMessage]=useState('');
  const[fontMessage,setFontMessage]=useState('');

  useEffect(()=>{
    (async()=>{
      try{
        const supabase=createClient();
        const[{data:preview,error:previewError},{data:roomFont,error:fontError}]=await Promise.all([
          supabase.rpc('cut_music_preview_seconds'),
          supabase.rpc('cut_room_title_font'),
        ]);
        if(!previewError)setSeconds(Number(preview)||10);
        if(!fontError&&roomFont)setFont(String(roomFont));
      }catch{}
    })();
  },[]);

  async function savePreview(){
    setSavingPreview(true);setMessage('');
    try{
      const supabase=createClient();
      const{data,error}=await supabase.rpc('cut_admin_set_music_preview_seconds',{p_seconds:seconds});
      if(error)throw error;
      setSeconds(Number(data)||seconds);
      setMessage(`Music previews are now ${Number(data)||seconds} seconds.`);
    }catch(err:any){setMessage(err?.message||'Could not save preview length.');}
    finally{setSavingPreview(false)}
  }

  async function saveFont(){
    setSavingFont(true);setFontMessage('');
    try{
      const supabase=createClient();
      const{data,error}=await supabase.rpc('cut_admin_set_room_title_font',{p_font:font});
      if(error)throw error;
      const saved=String(data||font);
      setFont(saved);
      setFontMessage('Room title font saved.');
    }catch(err:any){setFontMessage(err?.message||'Could not save room title font.');}
    finally{setSavingFont(false)}
  }

  return <>
    <div className="panel" style={{padding:24,marginBottom:20}}>
      <div className="kicker">ROOM TYPOGRAPHY</div>
      <h2>Room name font</h2>
      <p>Change the font used for room names in The Cut hallway and inside the live room. The default is now a clean system font instead of the old serif style.</p>
      <div style={{display:'grid',gap:14,maxWidth:760}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{FONT_PRESETS.map(([label,value])=><button key={label} type="button" onClick={()=>setFont(value)} style={{fontWeight:800}}>{label}</button>)}</div>
        <label><b>Font family / custom font stack</b><input value={font} onChange={e=>setFont(e.target.value)} placeholder={DEFAULT_FONT}/></label>
        <div style={{padding:'18px 20px',border:'1px solid #ddd',borderRadius:14,background:'#fafafa'}}><small style={{display:'block',fontWeight:800,marginBottom:6}}>LIVE PREVIEW</small><div style={{fontFamily:font,fontSize:30,fontWeight:700,lineHeight:1.05}}>What independent creators need right now</div></div>
        <div><button type="button" onClick={saveFont} disabled={savingFont}>{savingFont?'SAVING…':'SAVE ROOM FONT'}</button></div>
      </div>
      {fontMessage&&<p style={{fontWeight:800,marginBottom:0}}>{fontMessage}</p>}
    </div>

    <div className="panel" style={{padding:24,marginBottom:20}}>
      <div className="kicker">MUSIC PROMO PREVIEW</div>
      <h2>Song preview length</h2>
      <p>Set how much of an uploaded song listeners can hear when they open a music promotion. This setting only applies to music. Brand / merch promos stay image-only, and movie trailers play in full.</p>
      <div style={{display:'flex',gap:12,alignItems:'end',flexWrap:'wrap',maxWidth:620}}>
        <label style={{minWidth:220}}><b>Preview seconds</b><input type="number" min={5} max={120} step={1} value={seconds} onChange={e=>setSeconds(Math.max(5,Math.min(120,Number(e.target.value)||10)))}/></label>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{[10,15,20,30,45,60].map(v=><button key={v} type="button" onClick={()=>setSeconds(v)} style={{fontWeight:800}}>{v}s</button>)}</div>
        <button type="button" onClick={savePreview} disabled={savingPreview}>{savingPreview?'SAVING…':'SAVE MUSIC PREVIEW'}</button>
      </div>
      {message&&<p style={{fontWeight:800,marginBottom:0}}>{message}</p>}
    </div>
  </>;
}
