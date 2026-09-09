'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/browser';

export default function AdminClient(){
 const router=useRouter();
 const [topic,setTopic]=useState('trending entertainment stories involving Black culture, film, television, music, celebrities and independent creators');
 const [count,setCount]=useState(3);
 const [result,setResult]=useState<any>(null);
 const [loading,setLoading]=useState(false);
 const [signingOut,setSigningOut]=useState(false);
 async function run(){setLoading(true);setResult(null);try{const res=await fetch('/api/content-agent/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({topic,count})});setResult(await res.json())}finally{setLoading(false)}}
 async function logout(){setSigningOut(true);try{const supabase=createClient();await supabase.auth.signOut();router.replace('/admin/login');router.refresh()}finally{setSigningOut(false)}}
 return <main className="admin"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16}}><h1>Indie Cut Back Office</h1><button onClick={logout} disabled={signingOut}>{signingOut?'SIGNING OUT…':'SIGN OUT'}</button></div><div className="panel"><h2>Entertainment Research Agent</h2><p>Searches current entertainment news, rejects rumors, and only creates drafts when sourcing passes verification rules.</p><label>Assignment</label><textarea rows={6} value={topic} onChange={e=>setTopic(e.target.value)}/><label>Draft count</label><input type="number" min={1} max={5} value={count} onChange={e=>setCount(Number(e.target.value)||1)}/><button onClick={run} disabled={loading}>{loading?'RESEARCHING…':'RUN VERIFIED RESEARCH'}</button>{result&&<pre style={{whiteSpace:'pre-wrap',marginTop:20}}>{JSON.stringify(result,null,2)}</pre>}</div><div className="panel"><h2>Publishing rule</h2><p>Stories produced by the agent are saved as drafts. Only verified stories should be moved to published status after editorial review.</p></div></main>
}
