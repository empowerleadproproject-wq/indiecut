'use client';

import {useEffect,useState} from 'react';

const hourLabel=(h:number)=>{const hour=h%12||12;return `${hour}:00 ${h<12?'AM':'PM'}`};
const dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export default function ContentAgentScheduler(){
 const [config,setConfig]=useState<any>({enabled:true,default_topic:'top current entertainment news involving Black culture, movies, television, music, celebrities and independent creators',default_count:3,frequency:'daily',cron_hour:9,cron_day:1,cron_timezone:'America/New_York'});
 const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 useEffect(()=>{(async()=>{const r=await fetch('/api/content-agent/config');const j=await r.json();if(r.ok&&j.config)setConfig(j.config);})()},[]);
 async function save(){setBusy(true);setMessage('');try{const r=await fetch('/api/content-agent/config',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(config)});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to save scheduler');setConfig(j.config);setMessage('Scheduler saved. The hourly cron will run this schedule automatically.');}catch(e:any){setMessage(e.message)}finally{setBusy(false)}}
 return <section className="ic-module-panel"><h2>Automatic News Scheduler</h2><p>Set when Indie Cut should automatically research fresh entertainment news and save verified stories into <strong>Articles → Drafts</strong>. Nothing is auto-published.</p>
  <label className="ic-check"><input type="checkbox" checked={config.enabled!==false} onChange={e=>setConfig({...config,enabled:e.target.checked})}/> Enable automatic scheduled research</label>
  <label>Scheduled assignment<textarea rows={4} value={config.default_topic||''} onChange={e=>setConfig({...config,default_topic:e.target.value})}/></label>
  <div className="ic-two"><label>Articles per scheduled run<input type="number" min="1" max="12" value={config.default_count||3} onChange={e=>setConfig({...config,default_count:Math.min(12,Math.max(1,Number(e.target.value)||1))})}/></label><label>Frequency<select value={config.frequency||'daily'} onChange={e=>setConfig({...config,frequency:e.target.value})}><option value="daily">Every day</option><option value="weekdays">Weekdays only</option><option value="weekly">Once a week</option></select></label></div>
  {config.frequency==='weekly'&&<label>Day of week<select value={Number(config.cron_day??1)} onChange={e=>setConfig({...config,cron_day:Number(e.target.value)})}>{dayNames.map((d,i)=><option key={d} value={i}>{d}</option>)}</select></label>}
  <div className="ic-two"><label>Run time<select value={Number(config.cron_hour??9)} onChange={e=>setConfig({...config,cron_hour:Number(e.target.value)})}>{Array.from({length:24},(_,h)=><option key={h} value={h}>{hourLabel(h)}</option>)}</select></label><label>Timezone<select value={config.cron_timezone||'America/New_York'} onChange={e=>setConfig({...config,cron_timezone:e.target.value})}><option value="America/New_York">Eastern Time</option><option value="America/Chicago">Central Time</option><option value="America/Denver">Mountain Time</option><option value="America/Los_Angeles">Pacific Time</option></select></label></div>
  <div className="ic-message"><strong>Current schedule:</strong> {config.enabled===false?'OFF':config.frequency==='weekly'?`${dayNames[Number(config.cron_day??1)]} at ${hourLabel(Number(config.cron_hour??9))}`:config.frequency==='weekdays'?`Weekdays at ${hourLabel(Number(config.cron_hour??9))}`:`Every day at ${hourLabel(Number(config.cron_hour??9))}`} ({String(config.cron_timezone||'America/New_York').replace('America/','').replace('_',' ')})</div>
  <button onClick={save} disabled={busy}>{busy?'SAVING…':'SAVE SCHEDULE'}</button>{message&&<div className="ic-message">{message}</div>}
 </section>;
}
