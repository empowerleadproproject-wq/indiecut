'use client';

import {useEffect,useState} from 'react';

const TARGET_BYTES=45*1024*1024;

async function compressVideoForUpload(file:File,onStatus:(s:string)=>void){
  if(file.size<=TARGET_BYTES)return file;
  const sourceUrl=URL.createObjectURL(file);
  const video=document.createElement('video');
  video.src=sourceUrl;
  video.preload='auto';
  video.muted=true;
  video.playsInline=true;
  video.style.position='fixed';
  video.style.left='-10000px';
  video.style.width='1px';
  video.style.height='1px';
  document.body.appendChild(video);
  try{
    await new Promise<void>((resolve,reject)=>{
      video.onloadedmetadata=()=>resolve();
      video.onerror=()=>reject(new Error('Could not read this video file.'));
    });
    const duration=Math.max(1,Number(video.duration)||1);
    const capture=(video as any).captureStream?.bind(video)||(video as any).mozCaptureStream?.bind(video);
    if(!capture)throw new Error('Chrome could not prepare this video for compression.');
    const maxBitsPerSecond=Math.floor((TARGET_BYTES*8/duration)*0.88);
    const videoBitsPerSecond=Math.max(550000,Math.min(3500000,maxBitsPerSecond-128000));
    const mimeTypes=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
    const mimeType=mimeTypes.find(x=>MediaRecorder.isTypeSupported(x))||'';
    const stream=capture();
    const chunks:BlobPart[]=[];
    const recorder=new MediaRecorder(stream,{mimeType:mimeType||undefined,videoBitsPerSecond,audioBitsPerSecond:96000});
    recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
    const stopped=new Promise<void>((resolve,reject)=>{
      recorder.onstop=()=>resolve();
      recorder.onerror=()=>reject(new Error('Video compression failed.'));
    });
    video.currentTime=0;
    recorder.start(1000);
    onStatus(`Compressing video for upload… ${Math.round(duration)} seconds`);
    await video.play();
    await new Promise<void>((resolve,reject)=>{
      video.onended=()=>resolve();
      video.onerror=()=>reject(new Error('Video compression failed during playback.'));
    });
    if(recorder.state!=='inactive')recorder.stop();
    await stopped;
    stream.getTracks().forEach((t:MediaStreamTrack)=>t.stop());
    const blob=new Blob(chunks,{type:mimeType||'video/webm'});
    if(!blob.size)throw new Error('Compressed video was empty.');
    if(blob.size>TARGET_BYTES)throw new Error('Video is still too large after compression. Please trim it shorter.');
    const base=file.name.replace(/\.[^.]+$/,'')||'ad-video';
    return new File([blob],`${base}-web.webm`,{type:blob.type||'video/webm',lastModified:Date.now()});
  } finally {
    URL.revokeObjectURL(sourceUrl);
    video.pause();
    video.remove();
  }
}

export default function VideoUploadGuard(){
  const [status,setStatus]=useState('');
  useEffect(()=>{
    const handler=async(event:Event)=>{
      const input=event.target as HTMLInputElement;
      if(!(input instanceof HTMLInputElement)||input.type!=='file'||input.dataset.indiecutCompressed==='1')return;
      const file=input.files?.[0];
      if(!file||!file.type.startsWith('video/')||file.size<=TARGET_BYTES)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      try{
        setStatus('Your video is over the storage limit. IndieCut is compressing it automatically…');
        const compressed=await compressVideoForUpload(file,setStatus);
        const dt=new DataTransfer();
        dt.items.add(compressed);
        input.files=dt.files;
        input.dataset.indiecutCompressed='1';
        setStatus(`Video optimized: ${Math.round(file.size/1024/1024)} MB → ${Math.round(compressed.size/1024/1024)} MB. Uploading now…`);
        input.dispatchEvent(new Event('change',{bubbles:true}));
        setTimeout(()=>{delete input.dataset.indiecutCompressed;setStatus('')},8000);
      }catch(e:any){
        delete input.dataset.indiecutCompressed;
        setStatus(e?.message||'Unable to compress this video.');
      }
    };
    document.addEventListener('change',handler,true);
    return()=>document.removeEventListener('change',handler,true);
  },[]);
  if(!status)return null;
  return <div style={{position:'fixed',left:20,right:20,top:20,zIndex:10000,background:'#111',color:'#fff',padding:'14px 18px',fontWeight:700,boxShadow:'0 4px 20px rgba(0,0,0,.25)'}}>{status}</div>;
}
