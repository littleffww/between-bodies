import {AudioMotion,pitchRange} from './audio-motion.mjs?v=audio-motion-v9';
import {speechReference,speechLevel} from './speech-envelope.mjs?v=voice-lips-v14';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
function roomResponse(c){
 const b=c.createBuffer(2,Math.ceil(c.sampleRate*2.6),c.sampleRate);let seed=82;
 for(let channel=0;channel<2;channel++){let smooth=0;const data=b.getChannelData(channel);for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;smooth=.6*smooth+.4*(2*seed/4294967296-1);const t=i/c.sampleRate;data[i]=smooth*Math.min(1,t/.025)*Math.exp(-2.6*t)}}return b;
}
export class FleshSound {
 constructor(){this.context=null;this.enabled=false;this.loading=false;this.epoch=0;this.position=0;this.rate=1;this.nodes=null;this.onchange=()=>{}}
 preload(){
  if(!this.fetching)this.fetching=fetch(new URL('./audio/human-voice.m4a',import.meta.url)).then(r=>{if(!r.ok)throw Error('人声未能载入，请重试。');return r.arrayBuffer()}).catch(e=>{this.fetching=null;throw e});
  return this.fetching;
 }
 async enable(){
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('这个浏览器暂不支持作品声音。');
  const request=++this.epoch;this.enabled=true;this.loading=!this.recording;
  if(!this.context){
   try{if(navigator.audioSession)navigator.audioSession.type='playback'}catch{}
   const c=this.context=new Audio();
   this.master=c.createGain();this.master.gain.value=0;
   this.limiter=c.createDynamicsCompressor();this.limiter.threshold.value=-12;this.limiter.knee.value=12;this.limiter.ratio.value=8;this.limiter.attack.value=.004;this.limiter.release.value=.2;
   this.master.connect(this.limiter).connect(c.destination);
   this.envelope=c.createGain();this.envelope.gain.value=0;
   // Read the audible sources before the room effect; echoes must not keep lips open.
   this.voiceInput=c.createGain();this.voiceInput.connect(this.envelope);
   this.lipAnalyser=c.createAnalyser();this.lipAnalyser.fftSize=1024;this.voiceInput.connect(this.lipAnalyser);this.lipSamples=new Float32Array(1024);this.lipLevel=0;this.lipTime=0;
   const highpass=c.createBiquadFilter();highpass.type='highpass';highpass.frequency.value=85;
   this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.Q.value=.55;
   this.direct=c.createGain();this.reflection=c.createGain();
   const delay=c.createDelay();delay.delayTime.value=.045;const room=c.createConvolver();room.buffer=roomResponse(c);
   this.envelope.connect(highpass).connect(this.filter);this.filter.connect(this.direct).connect(this.master);this.filter.connect(this.reflection).connect(delay).connect(room).connect(this.master);
   c.onstatechange=()=>this.onchange();
  }
  // Resume in the actual pointer/click event, before any fetch/decode awaits (mobile).
  const c=this.context,resuming=c.resume();this.onchange();
  try{
   if(!this.recording){if(!this.decoding)this.decoding=this.preload().then(bytes=>c.decodeAudioData(bytes.slice(0))).then(buffer=>{
    let sum=0,count=0,peak=0;for(let ch=0;ch<buffer.numberOfChannels;ch++){const d=buffer.getChannelData(ch);for(let i=0;i<d.length;i+=4){sum+=d[i]*d[i];peak=Math.max(peak,Math.abs(d[i]));count++}}
    this.normalization=Math.min(2,.18/Math.max(.01,Math.sqrt(sum/count)),.8/Math.max(.01,peak));this.lipReference=speechReference(buffer);return buffer;
   }).catch(e=>{this.decoding=null;throw e});this.recording=await this.decoding;}
   await resuming;if(request!==this.epoch||!this.enabled||this.context!==c)return false;
   if(c.state!=='running')throw Error('点一下声音按钮，再试一次。');if(!this.motion)this.motion=new AudioMotion(c,this.limiter,pitchRange(this.recording));this.loading=false;this.onchange();return true;
  }catch(e){if(request===this.epoch){this.off();throw e}return false}
 }
 stopSources(){
  const c=this.context;if(!c||!this.nodes)return;
  this.position=(this.position+(c.currentTime-this.lastAudioTime)*this.rate)%this.recording.duration;
  for(const n of this.nodes){n.gain.gain.cancelScheduledValues(c.currentTime);n.gain.gain.setTargetAtTime(0,c.currentTime,.02);n.source.stop(c.currentTime+.1);n.source.onended=()=>{n.source.disconnect();n.gain.disconnect();n.pan.disconnect()}}
  this.nodes=null;
 }
 off(){++this.epoch;this.enabled=false;this.loading=false;this.stopSources();if(this.context)this.master.gain.setTargetAtTime(0,this.context.currentTime,.06);this.onchange()}
 sleep(){this.stopSources();if(this.context){this.master.gain.setTargetAtTime(0,this.context.currentTime,.04);return this.context.suspend().catch(()=>{})}}
 update(s){
  const c=this.context;if(!c||!this.recording)return;const now=c.currentTime;
  const active=this.enabled&&!this.loading&&!s.paused&&!document.hidden&&c.state==='running';
  if(!active){this.stopSources();this.master.gain.setTargetAtTime(0,now,.07);return}
  if(!this.nodes){this.nodes=[0,.37].map(offset=>{const source=c.createBufferSource(),gain=c.createGain(),pan=c.createStereoPanner();source.buffer=this.recording;source.loop=true;source.playbackRate.value=this.rate;gain.gain.value=0;source.connect(gain).connect(pan).connect(this.voiceInput);source.start(now,(this.position+offset*this.recording.duration)%this.recording.duration);return{source,gain,pan}});this.lastAudioTime=now;this.onchange()}
  this.position=(this.position+(now-this.lastAudioTime)*this.rate)%this.recording.duration;this.lastAudioTime=now;
  const fusion=s.fusing?1-clamp(s.fusionProgress):0;
  const space=clamp(s.stretch*.68+Math.max(0,s.size-1)*1.1+fusion*.85);
  const breath=.5+.5*Math.sin(s.time*1.45),tremolo=1-s.shiver*.68*(.5+.5*Math.sin(s.time*18));
  this.rate=clamp(1-s.stretch*.14-s.curl*.12-Math.max(0,s.size-1)*.12,.72,1.08);
  this.master.gain.setTargetAtTime(.72*this.normalization,now,.1);
  this.envelope.gain.setTargetAtTime((.38+breath*.25*s.breath+s.pressure*.18+fusion*.12+clamp(s.rotationSpeed)*.08)*tremolo,now,.035);
  this.filter.frequency.setTargetAtTime(6900-space*2200-s.curl*3000,now,.12);
  this.direct.gain.setTargetAtTime(.88-space*.43,now,.15);
  this.reflection.gain.setTargetAtTime(.18+space*.95+s.pressure*.25,now,.15);
  this.nodes.forEach((n,i)=>{n.source.playbackRate.setTargetAtTime(this.rate,now,.14);n.gain.gain.setTargetAtTime(i?fusion*.42:1-fusion*.16,now,.12);n.pan.pan.setTargetAtTime((i?1:-1)*fusion*.62,now,.2)});
 }
 sampleMotion(paused=false){return this.motion?.read(this.enabled&&!this.loading&&!paused&&!document.hidden&&this.context?.state==='running'&&!!this.nodes)||{high:0,low:0,level:0,pitch:0}}
 getOutputStream(){if(!this.context)return null;if(!this.outputTap){this.outputTap=this.context.createMediaStreamDestination();this.limiter.connect(this.outputTap)}return this.outputTap.stream}
 sampleMouth(paused=false){
  const c=this.context;
  if(!c||!this.enabled||this.loading||paused||document.hidden||c.state!=='running'||!this.nodes){this.lipLevel=0;this.lipTime=c?.currentTime||0;return 0}
  const dt=Math.min(.1,Math.max(0,c.currentTime-this.lipTime));this.lipTime=c.currentTime;
  this.lipAnalyser.getFloatTimeDomainData(this.lipSamples);const target=speechLevel(this.lipSamples,this.lipReference);
  this.lipLevel+=(target-this.lipLevel)*(1-Math.exp(-dt/(target>this.lipLevel?.025:.075)));return this.lipLevel;
 }
 async close(){this.off();this.outputTap?.stream.getTracks().forEach(t=>t.stop());this.outputTap=null;const c=this.context;this.context=null;this.decoding=null;this.recording=null;this.motion=null;await c?.close()}
}
