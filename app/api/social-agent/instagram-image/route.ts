import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';

export const dynamic='force-dynamic';
export const maxDuration=60;

export async function GET(request:Request){
 const {searchParams}=new URL(request.url);
 const articleId=String(searchParams.get('article_id')||'');
 if(!articleId)return NextResponse.json({error:'Missing article_id'},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:'Server configuration missing'},{status:503});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:article}=await db.from('articles').select('featured_media_url,status').eq('id',articleId).eq('status','published').maybeSingle();
 const source=String(article?.featured_media_url||'');
 if(!article||!/^https?:\/\//i.test(source)||/\.(mp4|webm|mov|m4v)(\?|$)/i.test(source))return NextResponse.json({error:'Published article image not found'},{status:404});
 try{
  const sourceUrl=new URL(source);
  if(!['http:','https:'].includes(sourceUrl.protocol))throw new Error('Unsupported image URL');
  const r=await fetch(sourceUrl,{redirect:'follow'});
  if(!r.ok)throw new Error('Could not fetch source image');
  const type=r.headers.get('content-type')||'';
  if(!type.startsWith('image/'))throw new Error('Source is not an image');
  const input=Buffer.from(await r.arrayBuffer());
  const output=await sharp(input).rotate().resize(1080,1350,{fit:'contain',position:'centre',background:{r:0,g:0,b:0,alpha:1},withoutEnlargement:false}).jpeg({quality:92,mozjpeg:true}).toBuffer();
  return new NextResponse(output,{status:200,headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=3600, s-maxage=86400','Content-Disposition':'inline; filename="indie-cut-instagram.jpg"'}});
 }catch(error:any){return NextResponse.json({error:error?.message||'Image preparation failed'},{status:502})}
}
