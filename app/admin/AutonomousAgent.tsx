'use client';

import {useEffect,useMemo,useState} from 'react';

type Vertical='artist'|'restaurant'|'general';
type Autonomy='guided'|'autopilot';

type AgentPayload={
 state?:any;
 integrations?:Record<string,boolean>;
 dashboard?:any;
 error?:string;
};

const shell:React.CSSProperties={background:'#0b0d10',color:'#f7f7f5',border:'1px solid #252a31',borderRadius:18,padding:22,margin:'0 0 28px',boxShadow:'0 18px 45px rgba(0,0,0,.14)'};
const panel:React.CSSProperties={background:'#12151a',border:'1px solid #272d35',borderRadius:14,padding:18};
const label:React.CSSProperties={display:'block',fontSize:12,fontWeight:900,letterSpacing:'.08em',textTransform:'uppercase',color:'#aeb6c2',marginBottom:8};
const input:React.CSSProperties={width:'100%',boxSizing:'border-box',background:'#0c0f13',color:'#fff',border:'1px solid #343b45',borderRadius:10,padding:'11px 12px',fontSize:14};
const primary:React.CSSProperties={border:0,borderRadius:10,padding:'11px 15px',background:'#fff',color:'#0b0d10',fontWeight:900,cursor:'pointer'};
const button:React.CSSProperties={border:'1px solid #3a424d',borderRadius:10,padding:'10px 13px',background:'#171b21',color:'#fff',fontWeight:800,cursor:'pointer'};
const danger:React.CSSProperties={...button,borderColor:'#73393f',color:'#ffb9be'};
const muted:React.CSSProperties={color:'#aeb6c2',lineHeight:1.55};

function money(v:any){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v||0))}
function when(v:any){if(!v)return '—';try{return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(v))}catch{return '—'}}
function statusTone(status:string){return status==='done'||status==='active'||status==='completed'?'#9ef0b0':status==='failed'||status==='stopped'?'#ff9ca4':status==='paused'||status==='skipped'?'#ffd58a':'#c9d2df'}

export default function AutonomousAgent(){
 const [payload,setPayload]=useState<AgentPayload>({});
 const [goal,setGoal]=useState('');
 const [vertical,setVertical]=useState<Vertical>('artist');
 const [autonomy,setAutonomy]=useState<Autonomy>('guided');
 const [cycleMinutes,setCycleMinutes]=useState(60);
 const [maxActions,setMaxActions]=useState(5);
 const [busy,setBusy]=useState('');
 const [message,setMessage]=useState('');

 async function load(){
  try{const r=await fetch('/api/admin/autonomous-agent',{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to load autonomous agent.');setPayload(j);if(j?.state?.config){setCycleMinutes(Number(j.state.config.cycle_minutes||60));setMaxActions(Number(j.state.config.max_actions_per_cycle||5))}}
  catch(e:any){setMessage(e.message)}
 }
 useEffect(()=>{load()},[]);

 async function act(key:string,action:string,extra:any={}){
  setBusy(key);setMessage('');
  try{const r=await fetch('/api/admin/autonomous-agent',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...extra})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Agent request failed.');setPayload(j);if(j?.state?.config){setCycleMinutes(Number(j.state.config.cycle_minutes||60));setMaxActions(Number(j.state.config.max_actions_per_cycle||5))}setMessage(action==='start'?'Mission started and the first autonomous cycle ran.':action==='run_now'?'Agent cycle completed.':'Agent updated.');return j}
  catch(e:any){setMessage(e.message)}finally{setBusy('')}
 }

 const state=payload.state||{};const mission=state.active_mission;const dashboard=payload.dashboard||{};const integrations=payload.integrations||{};const runs=Array.isArray(state.runs)?state.runs:[];
 const connectedCount=useMemo(()=>Object.values(integrations).filter(Boolean).length,[integrations]);
 const metrics=[
  ['CRM contacts',dashboard?.contacts?.total||0],
  ['Email opted in',dashboard?.contacts?.email_opted_in||0],
  ['SMS opted in',dashboard?.contacts?.sms_opted_in||0],
  ['Open tasks',dashboard?.tasks?.open||0],
  ['Pipeline',money(dashboard?.opportunities?.pipeline_value||0)]
 ];
 const ecosystem=[['AI Planner','ai'],['CRM','crm'],['Email','email'],['SMS / TextGrid','sms'],['GoHighLevel','ghl'],['Facebook','facebook'],['Instagram','instagram']];

 return <section style={shell}>
  <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
   <div style={{maxWidth:760}}><div style={{fontSize:12,fontWeight:950,letterSpacing:'.12em',color:'#9ef0b0'}}>AUTONOMOUS CRM AGENT</div><h2 style={{fontSize:32,margin:'8px 0 8px'}}>Give it an outcome. Let it work the CRM.</h2><p style={{...muted,margin:0}}>The agent inspects your CRM, chooses the next best actions, executes safe work, checks results again later and adjusts its strategy. The same engine can run artist, restaurant or general-business playbooks.</p></div>
   <div style={{background:'#151a20',border:'1px solid #2c333d',borderRadius:999,padding:'8px 12px',fontSize:13,fontWeight:850}}>{connectedCount}/{Object.keys(integrations).length||7} connections detected</div>
  </div>

  {message&&<div style={{marginTop:16,padding:'11px 13px',borderRadius:10,background:'#171d20',border:'1px solid #344149',fontWeight:750}}>{message}</div>}

  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginTop:18}}>{metrics.map(([k,v])=><div key={String(k)} style={{...panel,padding:14}}><div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.08em',color:'#929ba8',fontWeight:900}}>{k}</div><div style={{fontSize:24,fontWeight:950,marginTop:6}}>{v}</div></div>)}</div>

  {!mission&&<div style={{display:'grid',gridTemplateColumns:'minmax(0,1.45fr) minmax(280px,.75fr)',gap:14,marginTop:16}}>
   <div style={panel}><div style={label}>Mission</div><h3 style={{margin:'0 0 8px',fontSize:22}}>What do you want the agent to accomplish?</h3><p style={{...muted,marginTop:0}}>Use a business outcome, not a single task. The agent will break it into cycles and keep adapting.</p><textarea style={{...input,minHeight:126,resize:'vertical'}} value={goal} onChange={e=>setGoal(e.target.value)} placeholder="Example: Promote my new single for 30 days, nurture opted-in fans, create follow-up tasks, and move qualified opportunities forward."/>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:12}}><label><span style={label}>Business playbook</span><select style={input} value={vertical} onChange={e=>setVertical(e.target.value as Vertical)}><option value="artist">Artist / Music</option><option value="restaurant">Restaurant / Catering</option><option value="general">General Business</option></select></label><label><span style={label}>Autonomy</span><select style={input} value={autonomy} onChange={e=>setAutonomy(e.target.value as Autonomy)}><option value="guided">Guided — approve external actions</option><option value="autopilot">Autopilot — execute connected tools</option></select></label></div>
    <button style={{...primary,marginTop:14,opacity:busy||goal.trim().length<8?.55:1}} disabled={!!busy||goal.trim().length<8} onClick={()=>act('start','start',{goal,vertical,autonomy})}>{busy==='start'?'Starting & running first cycle…':'Start Mission'}</button>
   </div>
   <div style={panel}><div style={label}>How autonomy works</div><div style={{fontWeight:900,fontSize:17}}>Guided</div><p style={muted}>Tags, statuses, tasks and opportunities can run automatically. Proposed email, SMS and GoHighLevel actions become approval tasks.</p><div style={{fontWeight:900,fontSize:17,marginTop:14}}>Autopilot</div><p style={{...muted,marginBottom:0}}>The agent can also queue opted-in email, send opted-in SMS and sync selected contacts to GoHighLevel when those integrations are connected. Opt-in checks stay enforced.</p></div>
  </div>}

  {mission&&<div style={{marginTop:16,...panel}}>
   <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}><div><div style={label}>Current mission</div><div style={{display:'flex',alignItems:'center',gap:9,flexWrap:'wrap'}}><h3 style={{fontSize:24,margin:0}}>{mission.goal}</h3><span style={{border:`1px solid ${statusTone(mission.status)}`,color:statusTone(mission.status),borderRadius:999,padding:'4px 8px',fontSize:12,fontWeight:900,textTransform:'uppercase'}}>{mission.status}</span></div><div style={{...muted,marginTop:8,textTransform:'capitalize'}}>{mission.vertical} playbook · {mission.autonomy} mode · {mission.cycles||0} cycle(s)</div></div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button style={primary} disabled={!!busy||mission.status!=='active'} onClick={()=>act('run','run_now')}>{busy==='run'?'Running…':'Run now'}</button>{mission.status==='active'?<button style={button} disabled={!!busy} onClick={()=>act('pause','pause')}>Pause</button>:<button style={button} disabled={!!busy} onClick={()=>act('resume','resume')}>Resume</button>}<button style={danger} disabled={!!busy} onClick={()=>{if(confirm('Stop this autonomous mission?'))act('stop','stop')}}>Stop</button></div></div>

   <div style={{marginTop:18}}><div style={{display:'flex',justifyContent:'space-between',fontWeight:900,fontSize:13}}><span>Mission progress</span><span>{Math.round(Number(mission.progress||0))}%</span></div><div style={{height:9,background:'#252b33',borderRadius:999,overflow:'hidden',marginTop:7}}><div style={{height:'100%',width:`${Math.max(0,Math.min(100,Number(mission.progress||0)))}%`,background:'#9ef0b0'}}/></div></div>

   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:12,marginTop:16}}><div style={{background:'#0d1014',borderRadius:12,padding:14}}><div style={label}>Current strategy</div><p style={{...muted,color:'#e9edf1',margin:0}}>{mission.strategy||'The first cycle is establishing the strategy.'}</p></div><div style={{background:'#0d1014',borderRadius:12,padding:14}}><div style={label}>Last agent readout</div><p style={{...muted,color:'#e9edf1',margin:0}}>{mission.last_summary||'No cycle summary yet.'}</p></div><div style={{background:'#0d1014',borderRadius:12,padding:14}}><div style={label}>Schedule</div><div style={{fontWeight:800}}>Last: {when(mission.last_run_at)}</div><div style={{fontWeight:800,marginTop:6}}>Next: {when(mission.next_run_at)}</div></div></div>

   <div style={{display:'flex',alignItems:'end',gap:10,flexWrap:'wrap',marginTop:16}}><label style={{minWidth:250}}><span style={label}>Mission autonomy</span><select style={input} value={mission.autonomy} onChange={e=>act('autonomy','set_autonomy',{autonomy:e.target.value})} disabled={!!busy}><option value="guided">Guided</option><option value="autopilot">Autopilot</option></select></label><span style={{...muted,fontSize:13,maxWidth:620}}>Switching to Autopilot permits connected external tools to execute, but only for contacts that meet the CRM's opt-in and filter rules.</span></div>
  </div>}

  <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(300px,.7fr)',gap:14,marginTop:16}}>
   <div style={panel}><div style={label}>Agent activity</div><h3 style={{margin:'0 0 12px',fontSize:21}}>What the agent actually did</h3>{runs.length?runs.slice(0,8).map((run:any)=><div key={run.id} style={{borderTop:'1px solid #2a3038',padding:'14px 0'}}><div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><strong>{run.summary||'Agent cycle'}</strong><span style={{color:'#929ba8',fontSize:12}}>{when(run.completed_at)} · {run.source}</span></div>{Array.isArray(run.actions)&&run.actions.length?<div style={{display:'grid',gap:7,marginTop:10}}>{run.actions.map((a:any,i:number)=><div key={`${run.id}-${i}`} style={{display:'flex',gap:9,alignItems:'flex-start',fontSize:13}}><span style={{minWidth:58,color:statusTone(a.status),fontWeight:900,textTransform:'uppercase',fontSize:11,marginTop:2}}>{a.status}</span><span style={{color:'#d7dde4'}}><strong style={{textTransform:'replace'}}> {String(a.type||'action').replaceAll('_',' ')}</strong> — {a.detail}</span></div>)}</div>:<div style={{...muted,fontSize:13,marginTop:7}}>No executable actions were needed in this cycle.</div>}</div>):<div style={{...muted,padding:'8px 0'}}>No autonomous cycles yet. Start a mission to create the first run.</div>}</div>

   <div style={{display:'grid',gap:14}}><div style={panel}><div style={label}>Connected ecosystem</div><div style={{display:'grid',gap:8}}>{ecosystem.map(([name,key])=><div key={key} style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',padding:'8px 0',borderBottom:'1px solid #252b33'}}><strong>{name}</strong><span style={{color:integrations[key]?'#9ef0b0':'#ffb6bd',fontSize:12,fontWeight:900}}>{integrations[key]?'CONNECTED':'NOT CONNECTED'}</span></div>)}</div><p style={{...muted,fontSize:12,marginBottom:0}}>The current execution engine can act directly in CRM, email, SMS and GoHighLevel. Facebook and Instagram are shown here as connection visibility; social execution can be added as a later tool without changing the core agent architecture.</p></div>

    <div style={panel}><div style={label}>Cycle controls</div><label><span style={label}>Check cadence (minutes)</span><input style={input} type="number" min={15} max={1440} value={cycleMinutes} onChange={e=>setCycleMinutes(Number(e.target.value)||60)}/></label><label style={{display:'block',marginTop:12}}><span style={label}>Max actions per cycle</span><input style={input} type="number" min={1} max={8} value={maxActions} onChange={e=>setMaxActions(Number(e.target.value)||5)}/></label><button style={{...button,marginTop:12}} disabled={!!busy} onClick={()=>act('config','configure',{cycle_minutes:cycleMinutes,max_actions_per_cycle:maxActions})}>{busy==='config'?'Saving…':'Save cycle settings'}</button></div>
   </div>
  </div>
 </section>
}
