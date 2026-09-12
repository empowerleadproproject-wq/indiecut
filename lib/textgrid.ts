export function textGridConfigured(){
 return Boolean(process.env.TEXTGRID_ACCOUNT_SID&&process.env.TEXTGRID_AUTH_TOKEN&&process.env.TEXTGRID_FROM_NUMBER);
}

export async function sendTextGridSms(to:string,body:string){
 const sid=String(process.env.TEXTGRID_ACCOUNT_SID||'').trim();
 const token=String(process.env.TEXTGRID_AUTH_TOKEN||'').trim();
 const from=String(process.env.TEXTGRID_FROM_NUMBER||'').trim();
 if(!sid||!token||!from)throw new Error('TextGrid is not connected yet. Add TEXTGRID_ACCOUNT_SID, TEXTGRID_AUTH_TOKEN, and TEXTGRID_FROM_NUMBER in Vercel.');
 const endpoint=`https://api.textgrid.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
 const payload=new URLSearchParams({To:to,From:from,Body:body});
 const auth=Buffer.from(`${sid}:${token}`).toString('base64');
 const response=await fetch(endpoint,{method:'POST',headers:{authorization:`Basic ${auth}`,'content-type':'application/x-www-form-urlencoded'},body:payload.toString(),cache:'no-store'});
 const json=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(String(json?.message||json?.error_message||json?.error||'TextGrid SMS send failed.'));
 return {id:String(json?.sid||json?.id||''),raw:json};
}
