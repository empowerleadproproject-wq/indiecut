'use client';

import {useEffect,useMemo,useState} from 'react';

type Artist=any;
type Contest=any;

async function upload(file?:File){
  if(!file)return'';
  const form=new FormData();form.append('file',file);
  const r=await fetch('/api/admin/upload',{method:'POST',body:form});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(j.error||'Upload failed');
  return String(j.publicUrl||'');
}

export default function BattleArtistEditor(){
  const [contests,setContests]=useState<Contest[]>([]);
  const [editing,setEditing]=useState('');
  const [drafts,setDrafts]=useState<Record<string,any>>({});
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');

  async function load(){
    try{
      const r=await fetch('/api/admin/battles',{cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||'Unable to load artists.');
      setContests(j.contests||[]);
    }catch(e:any){setMessage(e.message)}
  }
  useEffect(()=>{load()},[]);

  const artists=useMemo(()=>contests.flatMap((contest:any)=>(contest.entries||[]).map((entry:any)=>({...entry,contest_title:contest.title,contest_slug:contest.slug,contest_genre:contest.genre}))),[contests]);

  function begin(artist:Artist){
    setDrafts(x=>({...x,[artist.id]:{
      artist_name:artist.artist_name||'',city:artist.city||'',bio:artist.bio||'',
      image_url:artist.image_url||'',track_title:artist.track_title||'',track_url:artist.track_url||'',
      track_cover_url:artist.track_cover_url||'',active:artist.active!==false
    }}));
    setEditing(artist.id);setMessage('');
  }

  function patch(id:string,key:string,value:any){setDrafts(x=>({...x,[id]:{...(x[id]||{}),[key]:value}}))}

  async function media(id:string,key:'image_url'|'track_url'|'track_cover_url',file?:File){
    if(!file)return;setBusy(`${id}-${key}`);setMessage('Uploading…');
    try{const url=await upload(file);patch(id,key,url);setMessage('Upload complete. Click SAVE ARTIST CHANGES.')}catch(e:any){setMessage(e.message)}finally{setBusy('')}
  }

  async function save(artist:Artist){
    const payload=drafts[artist.id];if(!payload)return;
    setBusy(`save-${artist.id}`);setMessage('Saving artist profile…');
    try{
      const r=await fetch('/api/admin/battle-artists',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({entryId:artist.id,payload})});
      const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Unable to save artist.');
      setMessage(`${j.entry.artist_name} updated. The live voting page now uses the new profile information.`);setEditing('');await load();
    }catch(e:any){setMessage(e.message)}finally{setBusy('')}
  }

  if(!artists.length)return null;

  return <section className="ic-module-panel" style={{marginBottom:24}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'start',flexWrap:'wrap'}}>
      <div><h2 style={{margin:'0 0 6px'}}>Approved Artist Profiles</h2><p style={{margin:0,maxWidth:820}}>Fully edit the public voting profiles after approval — artist name, location, bio, photo, song title, music file, cover art and whether the profile is active. The genre stays locked to the competition so artists cannot cross genres.</p></div>
      <strong>{artists.length} ARTIST{artists.length===1?'':'S'}</strong>
    </div>
    {message&&<div className="ic-message" style={{marginTop:14}}>{message}</div>}
    <div style={{display:'grid',gap:12,marginTop:18}}>
      {artists.map((artist:any)=>{
        const open=editing===artist.id;const d=drafts[artist.id]||{};const fanPath=`/battles/${artist.contest_slug}/artists/${artist.slug}`;
        return <article key={artist.id} style={{border:'1px solid #ddd',background:'#fff',padding:16}}>
          <div style={{display:'grid',gridTemplateColumns:artist.image_url?'92px 1fr auto':'1fr auto',gap:14,alignItems:'center'}}>
            {artist.image_url&&<img src={artist.image_url} alt="" style={{width:92,height:92,objectFit:'cover',borderRadius:8}}/>}
            <div><div style={{fontSize:20,fontWeight:900}}>{artist.artist_name}</div><div style={{fontSize:13,color:'#666',marginTop:4}}>{artist.city||'Location not set'} · {artist.contest_genre||artist.genre||'Genre not set'} · {artist.qualifying_votes||0} qualifying votes</div><div style={{fontSize:12,color:'#888',marginTop:4}}>{artist.contest_title}</div></div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'end'}}><a href={fanPath} target="_blank" rel="noreferrer" style={{padding:'10px 12px',border:'1px solid #bbb',fontWeight:900,fontSize:12}}>OPEN PAGE ↗</a><button type="button" onClick={()=>open?setEditing(''):begin(artist)} style={{margin:0}}>{open?'CLOSE EDITOR':'EDIT ARTIST'}</button></div>
          </div>
          {open&&<div style={{marginTop:18,paddingTop:18,borderTop:'1px solid #ddd',display:'grid',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
              <label>Artist / stage name<input value={d.artist_name||''} onChange={e=>patch(artist.id,'artist_name',e.target.value)}/></label>
              <label>Location / city, state<input value={d.city||''} onChange={e=>patch(artist.id,'city',e.target.value)} placeholder="New Jersey"/></label>
              <label>Genre<input value={artist.contest_genre||artist.genre||''} readOnly/></label>
              <label>Song title<input value={d.track_title||''} onChange={e=>patch(artist.id,'track_title',e.target.value)}/></label>
            </div>
            <label>Artist bio<textarea rows={4} value={d.bio||''} onChange={e=>patch(artist.id,'bio',e.target.value)}/></label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
              <div><strong style={{fontSize:13}}>Artist photo</strong>{d.image_url&&<img src={d.image_url} alt="" style={{display:'block',width:160,height:160,objectFit:'cover',margin:'8px 0',border:'1px solid #ddd'}}/>}<input type="file" accept="image/*" onChange={e=>media(artist.id,'image_url',e.target.files?.[0])}/></div>
              <div><strong style={{fontSize:13}}>Music track</strong>{d.track_url&&<audio controls preload="none" src={d.track_url} style={{display:'block',width:'100%',margin:'8px 0'}}/>}<input type="file" accept="audio/*" onChange={e=>media(artist.id,'track_url',e.target.files?.[0])}/></div>
              <div><strong style={{fontSize:13}}>Track cover</strong>{d.track_cover_url&&<img src={d.track_cover_url} alt="" style={{display:'block',width:160,height:160,objectFit:'cover',margin:'8px 0',border:'1px solid #ddd'}}/>}<input type="file" accept="image/*" onChange={e=>media(artist.id,'track_cover_url',e.target.files?.[0])}/></div>
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={d.active!==false} onChange={e=>patch(artist.id,'active',e.target.checked)}/> Public profile active</label>
            <div style={{fontSize:12,color:'#777'}}>Public URL: {fanPath} — changing the artist name does not change this URL, so links already shared with fans keep working.</div>
            <button type="button" onClick={()=>save(artist)} disabled={!!busy||!String(d.artist_name||'').trim()} style={{margin:0,width:'fit-content'}}>{busy===`save-${artist.id}`?'SAVING…':'SAVE ARTIST CHANGES'}</button>
          </div>}
        </article>
      })}
    </div>
  </section>
}
