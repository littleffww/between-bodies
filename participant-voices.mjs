import {speechReference,speechLevel} from './speech-envelope.mjs?v=voice-lips-v14';
import {AudioMotion} from './audio-motion.mjs?v=audio-motion-v9';
export class ParticipantVoices{
 constructor(){this.context=null;this.tracks=new Map();this.capture=null;this.epoch=0;this.enabled=true;this.paused=false;this.onchange=()=>{};this.onerror=()=>{};this.last=0}
 get hasVoices(){return [...this.tracks.values()].some(t=>t.buffer)}
 get recording(){return this.capture?.id??null}
 unlock(){
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('此浏览器无法播放声音。');
  if(!this.context){const c=this.context=new Audio();this.master=c.createGain();this.master.gain.value=.75;const limiter=this.limiter=c.createDynamicsCompressor();limiter.threshold.value=-10;limiter.ratio.value=10;this.master.connect(limiter).connect(c.destination);this.motion=new AudioMotion(c,limiter,[95,420]);c.onstatechange=()=>this.onchange()}
  return this.context.resume();
 }
 add(id){this.tracks.set(id,{id,buffer:null,nodes:null,position:0,muted:false,level:0,normalization:1,reference:.13})}
 stopTrack(t){
  if(!t.nodes)return;const c=this.context,n=t.nodes;t.position=(t.position+c.currentTime-n.started)%t.buffer.duration;
  n.gain.gain.cancelScheduledValues(c.currentTime);n.gain.gain.setTargetAtTime(0,c.currentTime,.012);try{n.source.stop(c.currentTime+.05)}catch{}
  n.source.onended=()=>{n.source.disconnect();n.gain.disconnect();n.pan.disconnect();n.analyser.disconnect()};t.nodes=null;
 }
 remove(id){if(this.capture?.id===id)this.cancelRecording();const t=this.tracks.get(id);if(t)this.stopTrack(t);this.tracks.delete(id);this.onchange()}
 setMuted(id,muted){const t=this.tracks.get(id);if(!t)return;t.muted=muted;if(muted)this.stopTrack(t);this.onchange()}
 setEnabled(value){this.enabled=value;if(!value)for(const t of this.tracks.values())this.stopTrack(t);this.onchange()}
 async startRecording(id){
  if(!this.tracks.has(id)||this.capture)return;
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw Error('此浏览器暂不支持录音。');
  try{if(navigator.audioSession)navigator.audioSession.type='auto'}catch{}
  const resumed=this.unlock(),request=++this.epoch;
  const capture=this.capture={id,request,state:'permission',stream:null,recorder:null,chunks:[],started:0};
  for(const t of this.tracks.values())this.stopTrack(t);this.onchange();
  try{
   const pending=navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});
   pending.then(stream=>{if(this.capture!==capture||request!==this.epoch)stream.getTracks().forEach(t=>t.stop())},()=>{});
   const stream=await Promise.race([pending,new Promise((_,reject)=>{capture.permissionTimer=setTimeout(()=>reject(Error('麦克风未开启，请重试。')),25000)})]);clearTimeout(capture.permissionTimer);
   if(this.capture!==capture||request!==this.epoch){stream.getTracks().forEach(t=>t.stop());return}
   capture.stream=stream;await resumed;if(this.capture!==capture)return;
   const type=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
   const recorder=capture.recorder=new MediaRecorder(stream,type?{mimeType:type}:undefined);
   const c=this.context;capture.source=c.createMediaStreamSource(stream);capture.analyser=c.createAnalyser();capture.analyser.fftSize=1024;capture.samples=new Float32Array(1024);capture.source.connect(capture.analyser);capture.motion=new AudioMotion(c,capture.source,[95,420]);
   recorder.ondataavailable=e=>{if(e.data.size)capture.chunks.push(e.data)};
   recorder.onerror=()=>{this.cancelRecording();this.onerror('录音失败，请重试。')};
   recorder.onstop=()=>this.finishRecording(capture);
   for(const track of stream.getTracks())track.addEventListener('ended',()=>{if(this.capture===capture&&capture.state==='recording')this.stopRecording()},{once:true});
   capture.state='recording';capture.started=performance.now();recorder.start(200);
   capture.timer=setTimeout(()=>this.stopRecording(),20000);this.onchange();
  }catch(e){if(this.capture===capture){this.cancelRecording();throw Error(e.name==='NotAllowedError'?'麦克风未获允许，可以点录音重试。':e.message||'录音失败，请重试。')}}
 }
 releaseCapture(capture){clearTimeout(capture.timer);clearTimeout(capture.permissionTimer);capture.source?.disconnect();capture.analyser?.disconnect();capture.stream?.getTracks().forEach(t=>t.stop());try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch{}}
 stopRecording(){
  const capture=this.capture;if(!capture)return;
  if(capture.state==='permission'){this.cancelRecording();return}
  if(capture.state!=='recording')return;
  capture.state='processing';clearTimeout(capture.timer);capture.recorder.stop();this.releaseCapture(capture);this.context?.resume().catch(()=>{});this.onchange();
 }
 async finishRecording(capture){
  this.releaseCapture(capture);if(this.capture!==capture||capture.request!==this.epoch)return;
  try{
   const blob=new Blob(capture.chunks,{type:capture.recorder.mimeType}),bytes=await blob.arrayBuffer();
   const buffer=await this.context.decodeAudioData(bytes);if(this.capture!==capture||!this.tracks.has(capture.id))return;
   if(buffer.duration<1)throw Error('请至少录一秒声音。');
   // Bounded, mono playback buffers with a short fade at each loop boundary.
   const length=Math.min(buffer.length,Math.floor(buffer.sampleRate*20)),clean=this.context.createBuffer(1,length,buffer.sampleRate),out=clean.getChannelData(0);
   for(let ch=0;ch<buffer.numberOfChannels;ch++){const input=buffer.getChannelData(ch);for(let i=0;i<length;i++)out[i]+=input[i]/buffer.numberOfChannels}
   let sum=0,peak=0;const ramp=Math.max(1,Math.round(buffer.sampleRate*.025));
   for(let i=0;i<length;i++){out[i]*=Math.min(1,i/ramp,(length-1-i)/ramp);sum+=out[i]*out[i];peak=Math.max(peak,Math.abs(out[i]))}
   if(peak<.002)throw Error('没有录到声音，请靠近麦克风重录。');
   const t=this.tracks.get(capture.id);this.stopTrack(t);t.buffer=clean;t.position=0;t.muted=false;t.normalization=Math.min(3,.18/Math.max(.01,Math.sqrt(sum/length)),.85/peak);t.reference=speechReference(clean)*t.normalization;t.level=0;
  }catch(e){if(this.capture===capture)this.onerror(e.message||'录音无法读取，请重试。')}
  finally{if(this.capture===capture){this.capture=null;this.onchange()}}
 }
 cancelRecording(){
  const capture=this.capture;++this.epoch;this.capture=null;if(!capture)return;
  if(capture.recorder){capture.recorder.onstop=null;capture.recorder.ondataavailable=null;if(capture.recorder.state!=='inactive')capture.recorder.stop()}
  this.releaseCapture(capture);capture.chunks=[];this.onchange();
 }
 measure(analyser,samples,reference){analyser.getFloatTimeDomainData(samples);return speechLevel(samples,reference)}
 update({paused=false}={}){
  const c=this.context,now=performance.now(),dt=Math.min(.1,(now-(this.last||now))/1000);this.last=now;this.paused=paused;
  const playing=c?.state==='running'&&this.enabled&&!paused&&!document.hidden&&!this.capture;
  const count=[...this.tracks.values()].filter(t=>t.buffer&&!t.muted).length;
  if(c)this.master.gain.setTargetAtTime(.72/Math.sqrt(Math.max(1,count)),c.currentTime,.15);
  const levels=new Map();
  for(const t of this.tracks.values()){
   let target=0;
   if(playing&&t.buffer&&!t.muted){
    if(!t.nodes){const source=c.createBufferSource(),gain=c.createGain(),pan=c.createStereoPanner(),analyser=c.createAnalyser();source.buffer=t.buffer;source.loop=true;gain.gain.value=0;gain.gain.setTargetAtTime(t.normalization,c.currentTime,.015);pan.pan.value=t.pan||0;analyser.fftSize=1024;source.connect(gain).connect(analyser).connect(pan).connect(this.master);source.start(0,t.position);t.nodes={source,gain,pan,analyser,samples:new Float32Array(1024),started:c.currentTime}}
    target=this.measure(t.nodes.analyser,t.nodes.samples,t.reference);
   }else this.stopTrack(t);
   if(this.capture?.id===t.id&&this.capture.state==='recording'&&!paused)target=this.measure(this.capture.analyser,this.capture.samples);
   t.level+=(target-t.level)*(1-Math.exp(-dt/(target>t.level?.035:.11)));if(paused)t.level=0;
   levels.set(t.id,t.level);
  }
  return levels;
 }
 async sleep(){this.cancelRecording();for(const t of this.tracks.values())this.stopTrack(t);await this.context?.suspend()}
 sampleMotion(paused=false){const active=!paused&&!document.hidden&&this.context?.state==='running';if(this.capture?.state==='recording')return this.capture.motion.read(active);return this.motion?.read(active&&this.enabled&&!this.capture)||{high:0,low:0}}
 getOutputStream(){if(!this.context)return null;if(!this.outputTap){this.outputTap=this.context.createMediaStreamDestination();this.limiter.connect(this.outputTap)}return this.outputTap.stream}
 async close(){this.cancelRecording();for(const t of this.tracks.values())this.stopTrack(t);this.tracks.clear();this.outputTap?.stream.getTracks().forEach(t=>t.stop());this.outputTap=null;await this.context?.close();this.context=null}
}
