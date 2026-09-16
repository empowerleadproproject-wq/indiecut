import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const revalidate=900;
const SITE_URL='https://indiecut.info';

function clean(value:any){return String(value||'').replace(/\s+/g,' ').trim()}

export async function GET(){
  let rows:any[]=[];
  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(supabaseUrl&&serviceKey){
    try{
      const db=createServiceClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
      const {data}=await db.from('articles')
        .select('headline,slug,subheadline,category,published_at,updated_at')
        .eq('status','published')
        .eq('verification_status','verified')
        .order('published_at',{ascending:false})
        .limit(100);
      rows=data||[];
    }catch{}
  }

  const latest=rows.filter(row=>row?.slug&&row?.headline).map(row=>{
    const description=clean(row.subheadline).slice(0,220);
    const date=String(row.published_at||row.updated_at||'').slice(0,10);
    return `- [${clean(row.headline)}](${SITE_URL}/articles/${encodeURIComponent(row.slug)})${date?` — ${date}`:''}${row.category?` — ${clean(row.category)}`:''}${description?` — ${description}`:''}`;
  }).join('\n');

  const body=`# IndieCut\n\n> IndieCut publishes verified entertainment journalism covering film, television, music, culture, celebrity news and independent creators, with strong attention to Black entertainment and independent voices.\n\n## Canonical site\n- ${SITE_URL}\n\n## Discovery\n- Sitemap: ${SITE_URL}/sitemap.xml\n- RSS: ${SITE_URL}/rss.xml\n- All articles: ${SITE_URL}/articles\n\n## Sections\n- Music: ${SITE_URL}/music\n- Movies: ${SITE_URL}/movies\n- Television: ${SITE_URL}/tv\n- Culture: ${SITE_URL}/culture\n- Independent: ${SITE_URL}/independent\n- Video: ${SITE_URL}/videos\n\n## Editorial signals\n- Published newsroom articles are marked verified before appearing publicly.\n- Article pages expose canonical URLs, publication dates, authorship, structured NewsArticle data and source links when available.\n- IndieCut avoids republishing the same underlying story unless there is a material factual update or a genuinely different angle.\n\n## Latest verified articles\n${latest||'- No recent article index is available at this moment.'}\n`;

  return new NextResponse(body,{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, s-maxage=900, stale-while-revalidate=3600'}});
}
