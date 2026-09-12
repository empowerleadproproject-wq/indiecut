'use client';

import {useEffect,useState} from 'react';

const empty={name:'',destination_url:'',image_url:'',active:true};

async function upload(file?:File){
 if(!file)return'';
 const form=new FormData();form.append('file',file);
 const r=await fetch('/api/admin/upload',{method:'POST',body:form});const j=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(j.error||'Sponsor upload failed');
 return String(j.publicUrl||'');
}

export default function BattleRoomSponsors(){
 const [rows,setRows]=useState<any[]>([]);const [form,setForm]=useState<any>({...empty});const [busy,setBusy]=useState('');const [message,setMessage]=useState('');
 async function load(){try{const r=await fetch('/api/admin/data?section=battle-room-sponsors',{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to load sponsors');setRows(j.rows||[])}catch(e:any){setMessage(e.message)}}
 useEffect(()=>{load()},[]);
 async function choose(file?:File){if(!file)return;setBusy('upload');setMessage('');try{const image_url=await upload(file);setForm((x:any)=>({...x,image_url}));setMessage('Sponsor creative uploaded. Add the sponsor name and destination link, then save.')}catch(e:any){setMessage(e.message)}finally{setBusy('')}}
 async function save(){if(!form.image_url||!form.destination_url)return setMessage('Upload sponsor creative and enter the sponsor link first.');setBusy('save');setMessage('');try{const r=await fetch('/api/admin/data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({section:'battle-room-sponsors',data:form})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to save sponsor');setForm({...empty});setMessage('Sponsor added to the Battle Room rotation.');await load()}catch(e:any){setMessage(e.message)}finally{setBusy('')}}
 async function remove(id:string){setBusy(id);setMessage('');try{const r=await fetch(`/api/admin/data?section=battle-room-sponsors&id=${encodeURIComponent(id)}`,{method:'DELETE'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to delete sponsor');setMessage('Sponsor removed from rotation.');await load()}catch(e:any){setMessage(e.message)}finally{setBusy('')}}
 return <section className="ic-module-panel" style={{marginBottom:24}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'start',flexWrap:'wrap'}}><div><h2 style={{margin:'0 0 6px'}}>Battle Room Sponsors</h2><p style={{margin:0,maxWidth:820}}>Upload sponsor ads for the Battle Room. Active sponsor creatives rotate automatically every 15 seconds. Sponsor clicks open in a new browser tab so viewers stay in the battle.</p></div><strong>{rows.filter(x=>x.active!==false).length} ACTIVE</strong></div>
  {message&&<div className="ic-message" style={{marginTop:14}}>{message}</div>}
  <div style={{marginTop:18,padding:18,border:'1px solid #ddd',background:'#fafafa',display:'grid',gap:12}}><h3 style={{margin:0}}>Add sponsor</h3><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}><label>Sponsor name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Sponsor / brand name"/></label><label>Destination link<input value={form.destination_url} onChange={e=>setForm({...form,destination_url:e.target.value})} placeholder="https://sponsor.com"/></label><label>Creative image<input type="file" accept="image/*" onChange={e=>choose(e.target.files?.[0])}/></label></div>{form.image_url&&<div style={{border:'1px solid #ddd',padding:10,background:'#fff'}}><img src={form.image_url} alt="Sponsor preview" style={{display:'block',width:'100%',maxHeight:180,objectFit:'contain'}}/></div>}<button onClick={save} disabled={!!busy||!form.image_url||!form.destination_url}>{busy==='save'?'SAVING…':'ADD TO 15-SECOND ROTATION'}</button></div>
  <div style={{display:'grid',gap:10,marginTop:16}}>{rows.length?rows.map((row:any,i:number)=><article key={row._id} style={{display:'grid',gridTemplateColumns:'150px 1fr auto',gap:14,alignItems:'center',border:'1px solid #ddd',background:'#fff',padding:12}}><img src={row.image_url} alt="" style={{width:150,height:80,objectFit:'contain',background:'#f5f5f5'}}/><div><strong>{row.name||`Sponsor ${i+1}`}</strong><div style={{fontSize:12,color:'#666',wordBreak:'break-all',marginTop:4}}>{row.destination_url}</div><div style={{fontSize:11,color:'#999',marginTop:5}}>Rotates every 15 seconds · opens in new tab</div></div><button onClick={()=>remove(row._id)} disabled={!!busy}>REMOVE</button></article>):<div style={{padding:22,border:'1px dashed #ccc',textAlign:'center',color:'#777'}}>No Battle Room sponsors yet.</div>}</div>
 </section>;
}
