import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';

export const dynamic='force-dynamic';
export const maxDuration=60;

const WIDTH=1080;
const HEIGHT=1350;
const PHOTO_HEIGHT=940;

function esc(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]||c));}
function wrapHeadline(text:string,max=31){
 const words=text.trim().split(/\s+/);const lines:string[]=[];let line='';
 for(const word of words){const next=line?`${line} ${word}`:word;if(next.length>max&&line){lines.push(line);line=word}else line=next;if(lines.length===4)break;}
 if(line&&lines.length<4)lines.push(line);
 const used=lines.join(' ').length;if(used<text.trim().length&&lines.length)lines[lines.length-1]=lines[lines.length-1].replace(/[.,;:!?-]*$/,'')+'…';
 return lines;
}

export async function GET(request:Request){
 const {searchParams}=new URL(request.url);
 const articleId=String(searchParams.get('article_id')||'');
 if(!articleId)return NextResponse.json({error:'Missing article_id'},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:'Server configuration missing'},{status:503});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:article}=await db.from('articles').select('featured_media_url,status,headline,category').eq('id',articleId).eq('status','published').maybeSingle();
 const source=String(article?.featured_media_url||'');
 if(!article||!/^https?:\/\//i.test(source)||/\.(mp4|webm|mov|m4v)(\?|$)/i.test(source))return NextResponse.json({error:'Published article image not found'},{status:404});
 try{
  const sourceUrl=new URL(source);if(!['http:','https:'].includes(sourceUrl.protocol))throw new Error('Unsupported image URL');
  const r=await fetch(sourceUrl,{redirect:'follow'});if(!r.ok)throw new Error('Could not fetch source image');
  const type=r.headers.get('content-type')||'';if(!type.startsWith('image/'))throw new Error('Source is not an image');
  const input=Buffer.from(await r.arrayBuffer());

  // Editorial social card: strong full-width image plus a permanent headline panel.
  // This mirrors the readable publication-card approach used by entertainment trades
  // and avoids relying on Instagram to crop a raw landscape article photo attractively.
  const photo=await sharp(input).rotate().resize(WIDTH,PHOTO_HEIGHT,{fit:'cover',position:'attention'}).jpeg({quality:92,mozjpeg:true}).toBuffer();
  const lines=wrapHeadline(String(article.headline||'INDIE CUT'));
  const category=esc(String(article.category||'ENTERTAINMENT').toUpperCase());
  const tspans=lines.map((line,i)=>`<tspan x="64" dy="${i===0?0:66}">${esc(line)}</tspan>`).join('');
  const panel=Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT-PHOTO_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
   <rect width="100%" height="100%" fill="#0a0a0a"/>
   <rect x="64" y="42" width="92" height="6" fill="#e31b23"/>
   <text x="64" y="82" fill="#bdbdbd" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="700" letter-spacing="4">${category}</text>
   <text x="64" y="145" fill="#ffffff" font-family="Arial,Helvetica,sans-serif" font-size="53" font-weight="800">${tspans}</text>
   <text x="1016" y="372" text-anchor="end" fill="#ffffff" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="800" letter-spacing="2">INDIE <tspan fill="#e31b23">CUT</tspan></text>
  </svg>`);
  const output=await sharp({create:{width:WIDTH,height:HEIGHT,channels:3,background:'#0a0a0a'}})
   .composite([{input:photo,left:0,top:0},{input:panel,left:0,top:PHOTO_HEIGHT}])
   .jpeg({quality:93,mozjpeg:true}).toBuffer();
  return new NextResponse(output,{status:200,headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=300, s-maxage=300','Content-Disposition':'inline; filename="indie-cut-instagram.jpg"'}});
 }catch(error:any){return NextResponse.json({error:error?.message||'Image preparation failed'},{status:502})}
}
