import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const revalidate=900;
const SITE_URL='https://indiecut.info';

function xml(value:any){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function strip(value:any){return String(value||'').replace(/\s+/g,' ').trim()}

export async function GET(){
  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  let rows:any[]=[];
  if(supabaseUrl&&serviceKey){
    try{
      const db=createServiceClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
      const {data}=await db.from('articles')
        .select('headline,slug,subheadline,body,category,author_name,published_at,updated_at')
        .eq('status','published')
        .eq('verification_status','verified')
        .order('published_at',{ascending:false})
        .limit(50);
      rows=data||[];
    }catch{}
  }

  const items=rows.filter(row=>row?.slug&&row?.headline).map(row=>{
    const url=`${SITE_URL}/articles/${encodeURIComponent(row.slug)}`;
    const summary=strip(row.subheadline||row.body).slice(0,500);
    const date=row.published_at||row.updated_at||new Date().toISOString();
    return `<item><title>${xml(row.headline)}</title><link>${xml(url)}</link><guid isPermaLink="true">${xml(url)}</guid><description>${xml(summary)}</description><category>${xml(row.category||'Entertainment')}</category><author>${xml(row.author_name||'IndieCut Editorial')}</author><pubDate>${xml(new Date(date).toUTCString())}</pubDate></item>`;
  }).join('');

  const body=`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>IndieCut</title><link>${SITE_URL}</link><description>Verified entertainment, culture, film, television, music and independent creator coverage from IndieCut.</description><language>en-us</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
  return new NextResponse(body,{headers:{'content-type':'application/rss+xml; charset=utf-8','cache-control':'public, s-maxage=900, stale-while-revalidate=3600'}});
}
