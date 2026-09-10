import {NextResponse} from 'next/server';
import {createClient as createServiceClient} from '@supabase/supabase-js';
import {createClient} from '../../../../lib/supabase/server';
import {isAdminEmail} from '../../../../lib/admin';

export const dynamic='force-dynamic';
const GRAPH='https://graph.facebook.com/v23.0';

type MetaConnection={facebook_page_id?:string;facebook_page_name?:string;facebook_page_access_token?:string;instagram_user_id?:string;instagram_username?:string};

async function graph(path:string,token:string){
 const joiner=path.includes('?')?'&':'?';
 const r=await fetch(`${GRAPH}/${path}${joiner}access_token=${encodeURIComponent(token)}`,{cache:'no-store'});
 const j=await r.json().catch(()=>({}));
 return {ok:r.ok,status:r.status,json:j};
}

function insightMap(payload:any){
 const out:Record<string,number>={};
 for(const row of Array.isArray(payload?.data)?payload.data:[]){
  const value=row?.values?.[0]?.value ?? row?.total_value?.value ?? row?.value;
  if(typeof value==='number')out[String(row.name)]=value;
 }
 return out;
}

export async function GET(){
 const auth=createClient();
 const {data:{user}}=await auth.auth.getUser();
 if(!user||!isAdminEmail(user.email))return NextResponse.json({error:'Unauthorized'},{status:401});

 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:'Supabase admin credentials missing'},{status:503});
 const db=createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:metaSetting,error:metaError}=await db.from('site_settings').select('setting_value').eq('setting_key','social_meta_connection').maybeSingle();
 if(metaError)return NextResponse.json({error:metaError.message},{status:500});
 let connection:MetaConnection={};
 try{if(metaSetting?.setting_value)connection=JSON.parse(metaSetting.setting_value)||{}}catch{}

 const token=connection.facebook_page_access_token||process.env.META_PAGE_ACCESS_TOKEN||'';
 const ig=connection.instagram_user_id||process.env.INSTAGRAM_USER_ID||'';
 const pageId=connection.facebook_page_id||process.env.META_PAGE_ID||'';
 if(!token)return NextResponse.json({error:'Meta is not connected. Reconnect Facebook & Instagram first.'},{status:400});

 const result:any={generated_at:new Date().toISOString(),facebook:null,instagram:null,warnings:[]};

 if(pageId){
  const page=await graph(`${encodeURIComponent(pageId)}?fields=id,name,fan_count,followers_count`,token);
  if(page.ok)result.facebook={id:page.json.id,name:page.json.name,followers:page.json.followers_count??page.json.fan_count??null};
  else result.warnings.push(`Facebook analytics: ${page.json?.error?.message||'unable to read Page metrics'}`);
 }

 if(ig){
  const profile=await graph(`${encodeURIComponent(ig)}?fields=id,username,name,followers_count,follows_count,media_count,profile_picture_url`,token);
  if(!profile.ok){
   const msg=profile.json?.error?.message||'Unable to read Instagram professional account.';
   return NextResponse.json({error:msg,code:profile.json?.error?.code,details:profile.json?.error}, {status:400});
  }

  const media=await graph(`${encodeURIComponent(ig)}/media?fields=id,caption,media_type,permalink,timestamp,like_count,comments_count&limit=25`,token);
  const items=Array.isArray(media.json?.data)?media.json.data:[];
  let likes=0,comments=0;
  for(const item of items){likes+=Number(item.like_count||0);comments+=Number(item.comments_count||0)}

  let accountInsights:Record<string,number>={};
  const accountMetricSets=[
   'reach,profile_views,website_clicks',
   'reach,profile_views',
   'reach'
  ];
  let insightsError:any=null;
  for(const metrics of accountMetricSets){
   const r=await graph(`${encodeURIComponent(ig)}/insights?metric=${encodeURIComponent(metrics)}&period=day&metric_type=total_value`,token);
   if(r.ok){accountInsights=insightMap(r.json);insightsError=null;break}
   insightsError=r.json?.error;
  }
  if(insightsError)result.warnings.push(`Instagram insights: ${insightsError.message||'insights permission or metric access is unavailable'}`);

  const recent=[];
  for(const item of items.slice(0,10)){
   let metrics:Record<string,number>={};
   const metricSets=item.media_type==='VIDEO'||item.media_type==='REELS'
    ? ['reach,saved,shares,views,total_interactions','reach,saved,shares,total_interactions','reach,saved']
    : ['reach,saved,shares,total_interactions','reach,saved,shares','reach,saved'];
   for(const set of metricSets){
    const r=await graph(`${encodeURIComponent(item.id)}/insights?metric=${encodeURIComponent(set)}`,token);
    if(r.ok){metrics=insightMap(r.json);break}
   }
   recent.push({...item,insights:metrics});
  }

  result.instagram={
   id:profile.json.id,
   username:profile.json.username||connection.instagram_username||'',
   name:profile.json.name||'',
   followers:Number(profile.json.followers_count||0),
   following:Number(profile.json.follows_count||0),
   media_count:Number(profile.json.media_count||0),
   recent_25:{posts:items.length,likes,comments,engagements:likes+comments},
   insights:accountInsights,
   recent_media:recent
  };
 }else{
  result.warnings.push('No Instagram professional account ID is stored. Reconnect Meta and select the Instagram account.');
 }

 // Persist a point-in-time snapshot when the optional analytics table exists.
 const snapshot={captured_at:result.generated_at,platform:'instagram',account_id:result.instagram?.id||ig||null,account_name:result.instagram?.username||connection.instagram_username||null,followers:result.instagram?.followers??null,following:result.instagram?.following??null,media_count:result.instagram?.media_count??null,reach:result.instagram?.insights?.reach??null,profile_views:result.instagram?.insights?.profile_views??null,website_clicks:result.instagram?.insights?.website_clicks??null,recent_posts:result.instagram?.recent_25?.posts??null,recent_likes:result.instagram?.recent_25?.likes??null,recent_comments:result.instagram?.recent_25?.comments??null,raw_data:result};
 const {error:snapshotError}=await db.from('social_analytics_snapshots').insert(snapshot);
 if(snapshotError){
  if(String(snapshotError.message||'').toLowerCase().includes('social_analytics_snapshots'))result.schema_missing=true;
  else result.warnings.push(`Analytics snapshot not saved: ${snapshotError.message}`);
 }

 return NextResponse.json(result);
}
