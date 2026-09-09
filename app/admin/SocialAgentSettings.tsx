'use client';

import {useEffect,useMemo,useState} from 'react';

type Settings={enabled:boolean;auto_post_on_publish:boolean;facebook:boolean;instagram:boolean;tiktok:boolean;caption_style:string;include_link:boolean;include_hashtags:boolean};
const defaults:Settings={enabled:false,auto_post_on_publish:false,facebook:true,instagram:true,tiktok:false,caption_style:'Write a concise, energetic entertainment caption in Indie Cut voice. No clickbait, no rumors, no invented claims.',include_link:true,include_hashtags:true};

export default function SocialAgentSettings(){
 const [settings,setSettings]=useState<Settings>(defaults);
 const [status,setStatus]=useState<any>(null);
 const [articles,setArticles]=useState<any[]>([]);
 const [articleId,setArticleId]=useState('');
 const [packResult,setPackResult]=useState<any>(null);
 const [busy,setBusy]=useState(false);
 const [posting,setPosting]=useState('');
 const [message,setMessage]=useState('');

 const published=useMemo(()=>articles.filter((a:any)=>a.status==='published'),[articles]);

 async function refresh(){
  const [s,c,a]=await Promise.all([fetch('/api/admin/data?section=social-agent'),fetch('/api/social-agent/status'),fetch('/api/admin/data?section=articles')]);
  const sj=await s.json().catch(()=>({}));const cj=await c.json().catch(()=>({}));const aj=await a.json().catch(()=>({}));
  if(s.ok&&sj.rows?.[0])setSettings({...defaults,...sj.rows[0]});
  if(c.ok)setStatus(cj);
  if(a.ok){const list=aj.rows||[];setArticles(list);const first=list.find((x:any)=>x.status==='published');if(first)setArticleId((current:string)=>current||first.id)}
 }

 useEffect(()=>{refresh();const p=new URLSearchParams(window.location.search);if(p.get('meta')==='connected')setMessage('Meta connected successfully. Facebook and any linked Instagram professional account are ready.');if(p.get('meta_error'))setMessage(`Meta connection failed: ${p.get('meta_error')}`)},[]);

 async function save(){setBusy(true);setMessage('');try{const r=await fetch('/api/admin/data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({section:'social-agent',data:settings})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to save social settings');setMessage('Social Media Agent settings saved.');}catch(e:any){setMessage(e.message)}finally{setBusy(false)}}
 function connectMeta(){window.location.href='/api/social-agent/meta/connect'}

 async function generatePack(){
  if(!articleId)return;
  setBusy(true);setPackResult(null);setMessage('Generating platform-specific hooks from the published article…');
  try{
   const r=await fetch('/api/social-agent/pack',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({article_id:articleId})});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(j.error||'Unable to generate Social Pack');
   setPackResult(j);setMessage(j.generated_by==='ai'?'Social Pack ready. Review or edit each platform version before distributing.':'Social Pack ready using the built-in fallback copy. Add OPENAI_API_KEY to Vercel for AI-written platform variants.');
  }catch(e:any){setMessage(e.message)}finally{setBusy(false)}
 }

 function edit(platform:string,field:string,value:string){setPackResult((prev:any)=>({...prev,pack:{...prev.pack,[platform]:{...prev.pack[platform],[field]:value}}}))}
 async function copy(text:string,label:string){try{await navigator.clipboard.writeText(text);setMessage(`${label} copied.`)}catch{setMessage('Copy failed on this browser. Select the text and copy it manually.')}}
 function openX(){const text=packResult?.pack?.x?.post||'';if(!text)return;window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer')}

 async function directPost(platform:'facebook'|'instagram'){
  if(!packResult)return;
  const caption=platform==='facebook'?packResult.pack.facebook.post:packResult.pack.instagram.caption;
  setPosting(platform);setMessage(`Publishing to ${platform==='facebook'?'Facebook':'Instagram'}…`);
  try{
   const r=await fetch('/api/social-agent/manual-publish',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({article_id:packResult.article_id,platform,caption})});
   const j=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(j.error||'Publish failed');
   setMessage(`Published to ${platform==='facebook'?'Facebook':'Instagram'} successfully.`);
  }catch(e:any){setMessage(e.message)}finally{setPosting('')}
 }

 const cardStyle={border:'1px solid #ddd',padding:16,borderRadius:8,display:'grid',gap:10} as const;
 const textareaStyle={width:'100%',minHeight:120} as const;

 return <>
  <section className="ic-module-panel"><h2>Social Media Agent</h2><p>Automatically turn published Indie Cut stories into platform-ready social posts. The article stays the source of truth; the agent only promotes published content.</p>
   <label className="ic-check"><input type="checkbox" checked={settings.enabled} onChange={e=>setSettings({...settings,enabled:e.target.checked})}/> Enable Social Media Agent</label>
   <label className="ic-check"><input type="checkbox" checked={settings.auto_post_on_publish} onChange={e=>setSettings({...settings,auto_post_on_publish:e.target.checked})}/> Automatically post when an article is published</label>
   <div className="ic-two"><label className="ic-check"><input type="checkbox" checked={settings.facebook} onChange={e=>setSettings({...settings,facebook:e.target.checked})}/> Facebook</label><label className="ic-check"><input type="checkbox" checked={settings.instagram} onChange={e=>setSettings({...settings,instagram:e.target.checked})}/> Instagram</label></div>
   <label className="ic-check"><input type="checkbox" checked={settings.tiktok} onChange={e=>setSettings({...settings,tiktok:e.target.checked})}/> TikTok</label>
   <label>Caption instructions<textarea rows={5} value={settings.caption_style} onChange={e=>setSettings({...settings,caption_style:e.target.value})}/></label>
   <div className="ic-two"><label className="ic-check"><input type="checkbox" checked={settings.include_link} onChange={e=>setSettings({...settings,include_link:e.target.checked})}/> Include article link</label><label className="ic-check"><input type="checkbox" checked={settings.include_hashtags} onChange={e=>setSettings({...settings,include_hashtags:e.target.checked})}/> Add relevant hashtags</label></div>
   <button onClick={save} disabled={busy}>{busy?'SAVING…':'SAVE SOCIAL AGENT'}</button>
   <div className="ic-agent-results"><h3>Platform connections</h3>
    <p><strong>Facebook:</strong> {status?.facebook?`Connected${status.facebook_name?` — ${status.facebook_name}`:''}`:'Not connected'}</p>
    <p><strong>Instagram:</strong> {status?.instagram?`Connected${status.instagram_username?` — @${status.instagram_username}`:''}`:'Not connected / no linked professional Instagram account found'}</p>
    {!status?.facebook&&<><button type="button" onClick={connectMeta}>CONNECT FACEBOOK & INSTAGRAM</button><p><small>Sign in with Meta, choose the Facebook Page that owns Indie Cut, and approve Page/Instagram publishing access.</small></p></>}
    {status?.facebook&&<button type="button" className="ic-secondary" onClick={connectMeta}>RECONNECT META</button>}
    <p><strong>X:</strong> Social Pack creates an X-ready post and opens the X composer for review.</p>
    <p><strong>TikTok:</strong> Social Pack creates the hook, caption and short-video script. Direct posting still requires TikTok Content Posting authorization/app approval.</p>
    <small>Meta tokens are stored server-side in Indie Cut’s Supabase settings and are never returned to this screen. The Meta App ID and App Secret stay in Vercel environment variables.</small>
   </div>
  </section>

  <section className="ic-module-panel">
   <div className="ic-admin-eyebrow">ORGANIC DISTRIBUTION</div><h2>Breaking News Social Pack</h2>
   <p>Publish the story on Indie Cut first. Then choose it here and generate separate hooks for Instagram, X, Facebook, Threads and TikTok. The copy is grounded in the article so the system does not invent new facts.</p>
   <label>Published story<select value={articleId} onChange={e=>{setArticleId(e.target.value);setPackResult(null)}}><option value="">Choose a published article…</option>{published.map((a:any)=><option key={a.id} value={a.id}>{a.headline}</option>)}</select></label>
   {published.length===0&&<p><strong>No published articles yet.</strong> Publish a story in Articles first.</p>}
   <button onClick={generatePack} disabled={busy||!articleId}>{busy?'GENERATING SOCIAL PACK…':'GENERATE SOCIAL PACK'}</button>
   {message&&<div className="ic-message">{message}</div>}

   {packResult&&<div className="ic-agent-results" style={{display:'grid',gap:14}}>
    <div><span className="ic-status-pill">READY TO DISTRIBUTE</span><h3 style={{marginBottom:4}}>{packResult.headline}</h3><small>{packResult.article_url}</small></div>

    <article style={cardStyle}><h3>Instagram</h3><label>Hook<input value={packResult.pack.instagram.hook} onChange={e=>edit('instagram','hook',e.target.value)}/></label><label>Caption<textarea style={textareaStyle} value={packResult.pack.instagram.caption} onChange={e=>edit('instagram','caption',e.target.value)}/></label><div className="ic-actions"><button onClick={()=>copy(packResult.pack.instagram.caption,'Instagram caption')}>COPY INSTAGRAM</button>{status?.instagram&&<button disabled={posting==='instagram'} onClick={()=>directPost('instagram')}>{posting==='instagram'?'POSTING…':'POST TO INSTAGRAM'}</button>}</div><small>Direct Instagram publishing uses the article’s featured image. Video/Reel publishing can be added after the TikTok/Reels media workflow is connected.</small></article>

    <article style={cardStyle}><h3>X</h3><label>Post<textarea style={textareaStyle} value={packResult.pack.x.post} onChange={e=>edit('x','post',e.target.value)}/></label><small>{packResult.pack.x.post.length}/280 characters</small><div className="ic-actions"><button onClick={()=>copy(packResult.pack.x.post,'X post')}>COPY X</button><button onClick={openX}>OPEN X COMPOSER ↗</button></div></article>

    <article style={cardStyle}><h3>Facebook</h3><label>Hook<input value={packResult.pack.facebook.hook} onChange={e=>edit('facebook','hook',e.target.value)}/></label><label>Post<textarea style={textareaStyle} value={packResult.pack.facebook.post} onChange={e=>edit('facebook','post',e.target.value)}/></label><div className="ic-actions"><button onClick={()=>copy(packResult.pack.facebook.post,'Facebook post')}>COPY FACEBOOK</button>{status?.facebook&&<button disabled={posting==='facebook'} onClick={()=>directPost('facebook')}>{posting==='facebook'?'POSTING…':'POST TO FACEBOOK'}</button>}</div></article>

    <article style={cardStyle}><h3>Threads</h3><label>Post<textarea style={textareaStyle} value={packResult.pack.threads.post} onChange={e=>edit('threads','post',e.target.value)}/></label><div className="ic-actions"><button onClick={()=>copy(packResult.pack.threads.post,'Threads post')}>COPY THREADS</button></div></article>

    <article style={cardStyle}><h3>TikTok / Vertical Short</h3><label>On-screen hook<input value={packResult.pack.tiktok.hook} onChange={e=>edit('tiktok','hook',e.target.value)}/></label><label>Caption<textarea rows={4} value={packResult.pack.tiktok.caption} onChange={e=>edit('tiktok','caption',e.target.value)}/></label><label>20–35 second script<textarea style={{...textareaStyle,minHeight:180}} value={packResult.pack.tiktok.script} onChange={e=>edit('tiktok','script',e.target.value)}/></label><div className="ic-actions"><button onClick={()=>copy(`${packResult.pack.tiktok.caption}\n\n${packResult.pack.tiktok.script}`,'TikTok package')}>COPY TIKTOK PACKAGE</button></div></article>
   </div>}
  </section>
 </>;
}
