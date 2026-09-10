import {ImageResponse} from 'next/og';
import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import React from 'react';

export const runtime='edge';
export const dynamic='force-dynamic';

const WIDTH=1080;
const HEIGHT=1350;

function wrapHeadline(text:string,max=28){
 const words=String(text||'INDIE CUT').trim().split(/\s+/);const lines:string[]=[];let line='';
 for(const word of words){const next=line?`${line} ${word}`:word;if(next.length>max&&line){lines.push(line);line=word}else line=next;if(lines.length===4)break;}
 if(line&&lines.length<4)lines.push(line);
 const joined=lines.join(' ');
 if(joined.length<text.trim().length&&lines.length)lines[lines.length-1]=lines[lines.length-1].replace(/[.,;:!?-]*$/,'')+'…';
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

 const lines=wrapHeadline(String(article.headline||'INDIE CUT'));
 const category=String(article.category||'ENTERTAINMENT').toUpperCase();
 const e=React.createElement;
 const headlineChildren=lines.flatMap((line,i)=>[
  e('div',{key:`line-${i}`,style:{display:'flex'}},line)
 ]);

 return new ImageResponse(
  e('div',{style:{width:'100%',height:'100%',display:'flex',position:'relative',background:'#090909',fontFamily:'Arial, Helvetica, sans-serif',overflow:'hidden'}},[
   e('img',{key:'photo',src:source,style:{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:'center'}}),
   e('div',{key:'shade',style:{position:'absolute',left:0,right:0,bottom:0,height:'58%',display:'flex',background:'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.72) 36%, rgba(0,0,0,.96) 100%)'}}),
   e('div',{key:'content',style:{position:'absolute',left:64,right:64,bottom:66,display:'flex',flexDirection:'column',alignItems:'flex-start'}},[
    e('div',{key:'accent',style:{display:'flex',width:112,height:7,background:'#e21b23',marginBottom:18}}),
    e('div',{key:'category',style:{display:'flex',fontSize:24,fontWeight:700,letterSpacing:4,color:'#d0d0d0',marginBottom:18}},category),
    e('div',{key:'headline',style:{display:'flex',flexDirection:'column',fontSize:58,lineHeight:1.05,fontWeight:900,color:'#fff',textShadow:'0 2px 12px rgba(0,0,0,.75)',maxWidth:930}},headlineChildren),
    e('div',{key:'brand',style:{display:'flex',marginTop:28,fontSize:27,fontWeight:900,letterSpacing:2,color:'#fff'}},[
      e('span',{key:'b1'},'INDIE '),e('span',{key:'b2',style:{color:'#e21b23'}},'CUT')
    ])
   ])
  ]),
  {width:WIDTH,height:HEIGHT,headers:{'Cache-Control':'public, max-age=60, s-maxage=60'}}
 );
}
