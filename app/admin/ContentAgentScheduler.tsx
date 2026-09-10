'use client';

import {useEffect,useState} from 'react';

const hourLabel=(h:number)=>{const hour=h%12||12;return `${hour}:00 ${h<12?'AM':'PM'}`};
const dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export default function ContentAgentScheduler(){
 const [config,setConfig]=useState<any>({enabled:true,default_topic:'top current entertainment news involving Black culture, movies, television, music, celebrities and independent creators',default_count:3,frequency:'daily',cron_hour:9,cron_day:1,cron_timezone:'America/New_York'});
 const [diag,setDiag]=useState<any>(null);
 const [busy,setBusy]=useState(false);const [running,setRunning]=useState(false);const [message,setMessage]=useState('');

 async function loadDiagnostics(){const r=await fetch('/api/content-agent/diagnostics');const j=await r.json().catch(()=>({}));if(r.ok)setDiag(j)}
 useEffect(()=>{(async()=>{const [r]=await Promise.all([fetch('/api/content-agent/config')]);const j=await r.json();if(r.ok&&j.config)setConfig(j.config);await loadDiagnostics()})()},[]);

 async function save(){setBusy(true);setMessage('');try{const r=await fetch('/api/content-agent/config',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(config)});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to save scheduler');setConfig(j.config);setMessage('Scheduler saved.');await loadDiagnostics()}catch(e:any){setMessage(e.message)}finally{setBusy(false)}}
 async function runNow(){setRunning(true);setMessage('Running the scheduled assignment now…');try{const r=await fetch('/api/content-agent/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({topic:config.default_topic,count:config.default_count})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Research run failed');setMessage(`${(j.created||[]).length} article draft(s) created now${(j.rejected||[]).length?` · ${(j.rejected||[]).length} rejected` :''}.`);await loadDiagnostics()}catch(e:any){setMessage(e.message)}finally{setRunning(false)}}

 const env=diag?.env||{};const healthy=env.cron_secret&&env.openai&&env.supabase_url&&env.supabase_service_role;const last=diag?.last_status;
 return <section className="ic-module-panel"><h2>Automatic News Scheduler</h2><p>Set when Indie Cut should automatically research fresh entertainment news and save verified stories into <strong>Articles → Drafts</strong>. Nothing is auto-published.</p>
  <label className="ic-check"><input type="checkbox" checked={config.enabled!==false} onChange={e=>setConfig({...config,enabled:e.target.checked})}/> Enable automatic scheduled research</label>
  <label>Scheduled assignment<textarea rows={4} value={config.default_topic||''} onChange={e=>setConfig({...config,default_topic:e.target.value})}/></label>
  <div className="ic-two"><label>Articles per scheduled run<input type="number" min="1" max="12" value={config.default_count||3} onChange={e=>setConfig({...config,default_count:Math.min(12,Math.max(1,Number(e.target.value)||1))})}/></label><label>Frequency<select value={config.frequency||'daily'} onChange={e=>setConfig({...config,frequency:e.target.value})}><option value="daily">Every day</option><option value="weekdays">Weekdays only</option><option value="weekly">Once a week</option></select></label></div>
  {config.frequency==='weekly'&&<label>Day of week<select value={Number(config.cron_day??1)} onChange={e=>setConfig({...config,cron_day:Number(e.target.value)})}>{dayNames.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label>}
  <div className="ic-two"><label>Run time<select value={Number(config.cron_hour??9)} onChange={e=>setConfig({...config,cron_hour:Number(e.target.value)})}>{Array.from({length:24},(_,h)=><option key={h} value={h}>{hourLabel(h)}</option>)}</select></label><label>Timezone<select value={config.cron_timezone||'America/New_York'} onChange={e=>setConfig({...config,cron_timezone:e.target.value})}><option value="America/New_York">Eastern Time</option><option value="America/Chicago">Central Time</option><option value="America/Denver">Mountain Time</option><option value="America/Los_Angeles">Pacific Time</option></select></label></div>
  <div className="ic-message"><strong>Current schedule:</strong> {config.enabled===false?'OFF':config.frequency==='weekly'?`${dayNames[Number(config.cron_day??1)]} at ${hourLabel(Number(config.cron_hour??9))}`:config.frequency==='weekdays'?`Weekdays at ${hourLabel(Number(config.cron_hour??9))}`:`Every day at ${hourLabel(Number(config.cron_hour??9))}`} ({String(config.cron_timezone||'America/New_York').replace('America/','').replace('_',' ')})</div>
  <div className="ic-actions"><button onClick={save} disabled={busy}>{busy?'SAVING…':'SAVE SCHEDULE'}</button><button className="ic-secondary" onClick={runNow} disabled={running}>{running?'RUNNING RESEARCH…':'RUN SCHEDULED RESEARCH NOW'}</button></div>{message&&<div className="ic-message">{message}</div>}

  <div className="ic-agent-results" style={{marginTop:18}}><h3>Automation health</h3>
   {!diag&&<p>Checking scheduler configuration…</p>}
   {diag&&<><p><strong>Overall:</strong> {healthy?'READY':'NEEDS ATTENTION'}</p>
    <p><strong>CRON_SECRET:</strong> {env.cron_secret?'Configured':'MISSING — Vercel cannot authenticate the scheduled job'}</p>
    <p><strong>OpenAI key:</strong> {env.openai?'Configured':'MISSING'}</p>
    <p><strong>Supabase URL:</strong> {env.supabase_url?'Configured':'MISSING'}</p>
    <p><strong>Supabase service key:</strong> {env.supabase_service_role?'Configured':'MISSING'}</p>
    {last?<div><p><strong>Last scheduler status:</strong> {String(last.status||'unknown').replaceAll('_',' ')}</p>{last.updated_at&&<p><strong>Last checked:</strong> {new Date(last.updated_at).toLocaleString()}</p>}{typeof last.created_count==='number'&&<p><strong>Drafts created:</strong> {last.created_count} · <strong>Rejected:</strong> {last.rejected_count||0}</p>}{last.reason&&<p><strong>Reason:</strong> {last.reason}</p>}{Array.isArray(last.rejected)&&last.rejected.length>0&&<details><summary>See rejected stories</summary>{last.rejected.map((x:any,i:number)=><p key={i}><strong>{x.headline||'Story'}:</strong> {x.reason||'Rejected'}</p>)}</details>}</div>:<p><strong>Last scheduler status:</strong> No successful scheduled attempt has been recorded yet.</p>}
   </>}
  </div>
 </section>;
}
