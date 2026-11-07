const MP4_TYPES=['video/mp4;codecs=avc1.42E01F,mp4a.40.2','video/mp4'];
const WEBM_TYPES=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus'];
export function downloadBlob(blob,name){
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export async function saveVideo(blob,name){
 if(typeof window.showSaveFilePicker==='function'){
  let handle;
  try{handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'MP4 video',accept:{'video/mp4':['.mp4']}}]})}
  catch(e){if(e.name==='AbortError')return 'cancelled';if(e.name!=='SecurityError')throw e}
  if(handle){const file=await handle.createWritable();try{await file.write(blob);await file.close()}catch(e){await file.abort().catch(()=>{});throw e}return 'saved'}
 }
 downloadBlob(blob,name);return 'downloaded';
}
export async function finalizeMP4(blob){
 const {Input,BlobSource,ALL_FORMATS,Output,BufferTarget,Mp4OutputFormat,Conversion}=await import('./vendor/mediabunny-1.65.2.mjs');
 const input=new Input({source:new BlobSource(blob),formats:ALL_FORMATS});
 try{
  const output=new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target:new BufferTarget()});
  const conversion=await Conversion.init({input,output,video:{codec:'avc'},audio:{codec:'aac'}});
  if(!conversion.isValid||conversion.discardedTracks.length)throw Error('无法生成 MP4，请换用较新的 Chrome 或 Safari。');
  await conversion.execute();return new Blob([output.target.buffer],{type:'video/mp4'});
 }finally{input.dispose()}
}
export class SculptureRecorder{
 constructor(canvas,audioStreams){this.canvas=canvas;this.audioStreams=audioStreams;this.state='idle';this.blob=null;this.elapsed=0;this.epoch=0;this.onchange=()=>{};this.onerror=()=>{};this.inputs=new Map()}
 get active(){return this.state==='recording'||this.state==='paused'}
 syncAudio(){
  if(!this.context||!this.active)return;
  for(const stream of this.audioStreams())if(stream?.getAudioTracks().some(t=>t.readyState==='live')&&!this.inputs.has(stream.id)){
   const source=this.context.createMediaStreamSource(stream);source.connect(this.mix);this.inputs.set(stream.id,source);
  }
 }
 async start(){
  if(this.active||this.state==='processing'||this.state==='starting')return;
  if(!this.canvas?.captureStream||typeof MediaRecorder==='undefined')throw Error('此浏览器暂不支持视频录制。');
  const mp4=MP4_TYPES.find(t=>MediaRecorder.isTypeSupported(t));
  const mimeType=mp4||WEBM_TYPES.find(t=>MediaRecorder.isTypeSupported(t));
  if(!mimeType||(!mp4&&(!window.VideoEncoder||!window.AudioEncoder)))throw Error('无法生成 MP4，请换用较新的 Chrome 或 Safari。');
  const epoch=++this.epoch;this.state='starting';this.onchange();
  try{
   this.blob=null;this.chunks=[];this.elapsed=0;this.recordError=null;
   const canvas=this.output=document.createElement('canvas'),w=this.canvas.width,h=this.canvas.height;
   const scale=Math.min(1,1280/Math.max(w,h),Math.sqrt(1280*720/(w*h)));
   canvas.width=Math.max(2,Math.floor(w*scale/2)*2);canvas.height=Math.max(2,Math.floor(h*scale/2)*2);this.paint=canvas.getContext('2d',{alpha:false});
   const Audio=window.AudioContext||window.webkitAudioContext;this.context=new Audio();this.mix=this.context.createGain();
   const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-3;limiter.ratio.value=12;
   this.destination=this.context.createMediaStreamDestination();this.mix.connect(limiter).connect(this.destination);await this.context.resume();if(epoch!==this.epoch)return;
   this.videoStream=canvas.captureStream(30);
   const stream=new MediaStream([...this.videoStream.getVideoTracks(),...this.destination.stream.getAudioTracks()]);
   this.recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:4500000,audioBitsPerSecond:128000});
   this.finished=new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject});this.finished.catch(()=>{});
   this.recorder.ondataavailable=e=>{if(e.data.size)this.chunks.push(e.data)};
   this.recorder.onerror=e=>{this.recordError=e.error||Error('录制失败，请重试。');this.onerror(this.recordError);if(this.recorder.state!=='inactive')this.recorder.stop()};
   this.recorder.onstop=()=>this.complete();
   this.state='recording';this.started=performance.now();this.lastFrame=0;this.lastNotice=0;this.draw(this.started);this.recorder.start(1000);this.syncAudio();this.onchange();
  }catch(e){this.release();this.state='idle';this.onchange();throw e}
 }
 draw(now){
  if(!this.active)return;this.animation=requestAnimationFrame(t=>this.draw(t));
  this.syncAudio();
  if(this.state==='recording'&&now-this.lastFrame>=1000/30){
   this.lastFrame=now;const {width:w,height:h}=this.output,scale=Math.min(w/this.canvas.width,h/this.canvas.height),dw=this.canvas.width*scale,dh=this.canvas.height*scale;
   this.paint.fillStyle=document.documentElement.dataset.view==='night'?'#17191c':'#f4f3ef';this.paint.fillRect(0,0,w,h);this.paint.drawImage(this.canvas,(w-dw)/2,(h-dh)/2,dw,dh);
  }
  if(now-this.lastNotice>400){this.lastNotice=now;this.onchange()}
  if(this.seconds>=300)this.finish();
 }
 get seconds(){return (this.elapsed+(this.state==='recording'?performance.now()-this.started:0))/1000}
 pause(){if(this.state!=='recording')return;this.elapsed+=performance.now()-this.started;this.recorder.pause();this.state='paused';this.onchange()}
 async resume(){if(this.state!=='paused')return;await this.context.resume();this.recorder.resume();this.started=performance.now();this.state='recording';this.onchange()}
 finish(){
  if(!this.active)return this.finished;
  if(this.state==='recording')this.elapsed+=performance.now()-this.started;
  this.state='processing';this.onchange();this.recorder.stop();return this.finished;
 }
 async complete(){
  const raw=new Blob(this.chunks,{type:this.recorder.mimeType});this.chunks=[];this.release();this.state='processing';this.onchange();
  try{
   if(this.recordError)throw this.recordError;if(!raw.size)throw Error('没有录到画面，请重试。');
   // Remux native MP4 to write duration/seek metadata. WebM fallbacks are really
   // transcoded to AVC/AAC; changing an extension is never used as conversion.
   try{this.blob=await finalizeMP4(raw)}catch(e){if(raw.type.startsWith('video/mp4'))this.blob=raw;else throw e}
   this.state='ready';this.resolve(this.blob);
  }catch(e){this.state='idle';this.reject(e);this.onerror(e)}
  this.onchange();
 }
 release(){cancelAnimationFrame(this.animation);this.videoStream?.getTracks().forEach(t=>t.stop());this.destination?.stream.getTracks().forEach(t=>t.stop());for(const source of this.inputs.values())source.disconnect();this.inputs.clear();this.context?.close().catch(()=>{});this.context=null}
 dispose(){++this.epoch;if(this.recorder&&this.recorder.state!=='inactive'){this.recorder.onstop=null;this.recorder.ondataavailable=null;try{this.recorder.stop()}catch{}}this.release();this.chunks=[];this.blob=null;this.state='idle'}
}
