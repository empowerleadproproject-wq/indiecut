import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';
export const maxDuration=120;

const SITE_URL=(process.env.NEXT_PUBLIC_SITE_URL||'https://indiecut.vercel.app').replace(/\/$/,'');

function responseText(json:any){
 if(typeof json?.output_text==='string')return json.output_text;
 const parts:string[]=[];
 for(const item of json?.output||[])for(const c of item?.content||[])if(typeof c?.text==='string')parts.push(c.text);
 return parts.join('\n').trim();
}

function cleanJson(text:string){
 const trimmed=String(text||'').replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
 const start=trimmed.indexOf('{'),end=trimmed.lastIndexOf('}');
 if(start<0||end<start)throw new Error('No JSON object returned');
 return JSON.parse(trimmed.slice(start,end+1));
}

function clip(input:string,max:number){
 const s=String(input||'').trim();
 return s.length<=max?s:`${s.slice(0,Math.max(0,max-1)).trimEnd()}…`;
}

function fallbackPack(article:any,link:string){
 const headline=String(article.headline||'Breaking entertainment news').trim();
 const sub=String(article.subheadline||'').trim();
 const subject=String(article.subject_name||'').trim();
 const base=clip(`${headline}${sub?` — ${sub}`:''}`,210);
 const tags=[article.category,subject].filter(Boolean).flatMap((v:any)=>String(v).split(/\s+/)).map((v:string)=>v.replace(/[^a-z0-9]/gi,'')).filter((v:string)=>v.length>2).slice(0,4);
 const hashtags=(tags.length?tags:['EntertainmentNews','IndieCut']).map((x:string)=>`#${x}`).join(' ');
 return {
  instagram:{hook:headline,caption:`${base}\n\nRead the full story on Indie Cut.\n${link}\n\n${hashtags}`},
  x:{post:clip(`${headline}${sub?` — ${sub}`:''}\n\n${link}`,275)},
  facebook:{hook:headline,post:`${base}\n\nRead the full story: ${link}`},
  threads:{post:clip(`${headline}\n\n${sub||'Here’s what we know so far.'}\n\nFull story on Indie Cut: ${link}`,480)},
  tiktok:{hook:headline,caption:`${clip(headline,110)} ${hashtags}`.trim(),script:`HOOK: ${headline}\n\nWHAT HAPPENED: ${sub||'Break down the verified details from the Indie Cut article.'}\n\nCTA: Follow Indie Cut for verified entertainment news and read the full story on Indie Cut.`}
 };
}

function normalizePack(raw:any,fallback:any){
 return {
  instagram:{hook:String(raw?.instagram?.hook||fallback.instagram.hook),caption:String(raw?.instagram?.caption||fallback.instagram.caption)},
  x:{post:clip(String(raw?.x?.post||fallback.x.post),280)},
  facebook:{hook:String(raw?.facebook?.hook||fallback.facebook.hook),post:String(raw?.facebook?.post||fallback.facebook.post)},
  threads:{post:clip(String(raw?.threads?.post||fallback.threads.post),500)},
  tiktok:{hook:String(raw?.tiktok?.hook||fallback.tiktok.hook),caption:String(raw?.tiktok?.caption||fallback.tiktok.caption),script:String(raw?.tiktok?.script||fallback.tiktok.script)}
 };
}

export async function POST(request:Request){
 const auth=createClient();
 const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});

 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:'Supabase admin credentials missing'},{status:503});
 const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const input=await request.json().catch(()=>({}));
 const articleId=String(input.article_id||'');
 if(!articleId)return NextResponse.json({error:'Missing article_id'},{status:400});

 const [{data:article},{data:setting}]=await Promise.all([
  db.from('articles').select('*').eq('id',articleId).eq('status','published').maybeSingle(),
  db.from('site_settings').select('setting_value').eq('setting_key','admin_social_agent').maybeSingle()
 ]);
 if(!article)return NextResponse.json({error:'Published article not found. Publish the story first, then generate its Social Pack.'},{status:404});

 let settings:any={include_hashtags:true,caption_style:''};
 try{if(setting?.setting_value)settings={...settings,...JSON.parse(setting.setting_value)}}catch{}
 const link=`${SITE_URL}/articles/${encodeURIComponent(article.slug)}`;
 const fallback=fallbackPack(article,link);
 let pack=fallback;
 let generatedBy='fallback';

 const apiKey=process.env.OPENAI_API_KEY;
 if(apiKey){
  const articleBody=clip(String(article.body||'').replace(/\s+/g,' '),5000);
  const prompt=`You are Indie Cut's breaking-news social editor. Turn ONE already-published entertainment article into a platform-specific organic distribution pack. The goal is discovery, shares, follows and click-throughs without misleading clickbait.\n\nSTRICT RULES:\n- Use ONLY facts contained in the article below. Never invent, speculate, embellish or turn uncertainty into fact.\n- Every platform needs a strong first-line hook, but it must stay accurate.\n- Do not simply repeat the same copy on every platform. Adapt to how people consume each platform.\n- X must be 280 characters or fewer INCLUDING the supplied article URL.\n- Instagram should have a strong hook, short readable caption, the article URL, and ${settings.include_hashtags===false?'no hashtags':'3-5 focused hashtags'}.\n- Facebook should be conversational, informative and include the article URL.\n- Threads should feel conversational and curiosity-driven, not spammy.\n- TikTok should provide: a short on-screen hook, a caption, and a 20-35 second vertical-video script with Hook / What happened / Why it matters / CTA.\n- TikTok should tell viewers to follow Indie Cut and read the full story on Indie Cut; do not pretend a TikTok video exists yet.\n- Voice: ${settings.caption_style||'fast, credible, culture-aware Indie Cut entertainment newsroom'}.\n- Return ONLY valid JSON with this exact shape: {"instagram":{"hook":"","caption":""},"x":{"post":""},"facebook":{"hook":"","post":""},"threads":{"post":""},"tiktok":{"hook":"","caption":"","script":""}}\n\nARTICLE URL: ${link}\nHEADLINE: ${article.headline}\nSUBHEADLINE: ${article.subheadline||''}\nCATEGORY: ${article.category||'entertainment'}\nSUBJECT: ${article.subject_name||''}\nARTICLE: ${articleBody}`;
  try{
   const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model:'gpt-5.6-luna',input:prompt,max_output_tokens:1800})});
   const j=await r.json().catch(()=>({}));
   if(r.ok){pack=normalizePack(cleanJson(responseText(j)),fallback);generatedBy='ai'}
  }catch{}
 }

 const payload={article_id:article.id,headline:article.headline,slug:article.slug,article_url:link,featured_media_url:article.featured_media_url||'',generated_at:new Date().toISOString(),generated_by:generatedBy,pack};
 await db.from('site_settings').upsert({setting_key:`social_pack_${article.id}`,setting_value:JSON.stringify(payload),updated_at:new Date().toISOString()},{onConflict:'setting_key'});
 return NextResponse.json({ok:true,...payload});
}
