import type { MetadataRoute } from 'next';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const revalidate=900;
const SITE_URL='https://indiecut.info';

const staticRoutes=[
  {path:'',priority:1,changeFrequency:'daily' as const},
  {path:'/articles',priority:0.9,changeFrequency:'daily' as const},
  {path:'/music',priority:0.8,changeFrequency:'daily' as const},
  {path:'/movies',priority:0.8,changeFrequency:'daily' as const},
  {path:'/tv',priority:0.8,changeFrequency:'daily' as const},
  {path:'/culture',priority:0.8,changeFrequency:'daily' as const},
  {path:'/independent',priority:0.8,changeFrequency:'daily' as const},
  {path:'/videos',priority:0.7,changeFrequency:'daily' as const}
];

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
  const now=new Date();
  const base:MetadataRoute.Sitemap=staticRoutes.map(route=>({
    url:`${SITE_URL}${route.path}`,
    lastModified:now,
    changeFrequency:route.changeFrequency,
    priority:route.priority
  }));

  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!supabaseUrl||!serviceKey)return base;

  try{
    const db=createServiceClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await db.from('articles')
      .select('slug,published_at,updated_at')
      .eq('status','published')
      .eq('verification_status','verified')
      .order('published_at',{ascending:false})
      .limit(5000);
    if(error)throw error;
    const articles:MetadataRoute.Sitemap=(data||[]).filter((row:any)=>row?.slug).map((row:any)=>({
      url:`${SITE_URL}/articles/${encodeURIComponent(row.slug)}`,
      lastModified:new Date(row.updated_at||row.published_at||Date.now()),
      changeFrequency:'weekly' as const,
      priority:0.8
    }));
    return [...base,...articles];
  }catch{
    return base;
  }
}
