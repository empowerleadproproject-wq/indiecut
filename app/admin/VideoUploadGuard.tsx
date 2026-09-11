'use client';

const TARGET_BYTES=45*1024*1024;

export async function compressVideoForUpload(file:File,onStatus:(s:string)=>void){
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
    onStatus(`Video optimized: ${Math.round(file.size/1024/1024)} MB → ${Math.round(blob.size/1024/1024)} MB. Uploading…`);
    return new File([blob],`${base}-web.webm`,{type:blob.type||'video/webm',lastModified:Date.now()});
  } finally {
    URL.revokeObjectURL(sourceUrl);
    video.pause();
    video.remove();
  }
}

export default function VideoUploadGuard(){return null;}
