const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
export function voicePitch(samples,sampleRate){
 // Average down to ~12 kHz, then use a normalized difference (YIN-style) period test.
 const stride=Math.max(1,Math.floor(sampleRate/12000)),rate=sampleRate/stride,n=Math.floor(samples.length/stride);
 const data=new Float32Array(n);let square=0,mean=0;
 for(let i=0;i<n;i++){let v=0;for(let j=0;j<stride;j++)v+=samples[i*stride+j];v/=stride;data[i]=v;mean+=v;square+=v*v}
 mean/=n;const rms=Math.sqrt(Math.max(0,square/n-mean*mean));
 if(rms<.0006)return {pitch:0,confidence:0,rms};
 const min=Math.floor(rate/850),max=Math.min(Math.floor(rate/70),Math.floor(n/3)),window=n-max;
 const difference=new Float32Array(max+1);let cumulative=0;
 for(let lag=1;lag<=max;lag++){let sum=0;for(let i=0;i<window;i++){const d=data[i]-data[i+lag];sum+=d*d}cumulative+=sum;difference[lag]=sum*lag/Math.max(cumulative,1e-12)}
 for(let lag=min;lag<max-1;lag++)if(difference[lag]<.18){
  while(lag<max-1&&difference[lag+1]<difference[lag])lag++;
  const a=difference[lag-1],b=difference[lag],c=difference[lag+1],den=a-2*b+c;
  const refined=lag+(Math.abs(den)>1e-9?clamp((a-c)/(2*den),-.5,.5):0);
  return {pitch:rate/refined,confidence:1-b,rms};
 }
 return {pitch:0,confidence:0,rms};
}
export function pitchRange(buffer){
 const pitches=[],data=buffer.getChannelData(0),rate=buffer.sampleRate;
 for(let t=.2;t<buffer.duration-.1;t+=.38){const start=Math.floor(t*rate),sample=data.subarray(start,start+4096);if(sample.length<4096)continue;const p=voicePitch(sample,rate);if(p.confidence>.86&&p.rms>.004)pitches.push(p.pitch)}
 if(pitches.length<8)return [95,420];pitches.sort((a,b)=>a-b);
 let low=pitches[Math.floor(pitches.length*.18)],high=pitches[Math.floor(pitches.length*.82)];
 if(high/low<1.8){const centre=Math.sqrt(low*high);low=centre/Math.sqrt(1.8);high=centre*Math.sqrt(1.8)}
 return [Math.max(70,low),Math.min(850,high)];
}
export function motionFromVoice(features,range=[95,420],bands={low:0,high:0}){
 const level=clamp(Math.sqrt(features.rms/.022))*smooth(.0006,.0025,features.rms);
 if(!level)return {high:0,low:0,level:0,pitch:0};
 if(features.pitch&&features.confidence>.82){
  const position=clamp(Math.log(features.pitch/range[0])/Math.log(range[1]/range[0]));
  return {high:smooth(.3,.95,position)*level,low:(1-smooth(.05,.7,position))*level,level,pitch:features.pitch};
 }
 // Unpitched breaths/consonants use actual low/upper-band energy, at gentler strength.
 return {high:clamp(bands.high*1.5)*level*.6,low:clamp(bands.low*1.25)*level*.65,level,pitch:0};
}
export class AudioMotion {
 constructor(context,output,range){
  this.context=context;this.range=range;this.analyser=context.createAnalyser();this.analyser.fftSize=4096;this.analyser.smoothingTimeConstant=0;
  output.connect(this.analyser);this.wave=new Float32Array(4096);this.spectrum=new Float32Array(2048);this.last=-Infinity;this.value={high:0,low:0,level:0,pitch:0};
 }
 read(active){
  if(!active){this.last=-Infinity;return this.value={high:0,low:0,level:0,pitch:0}}
  const now=this.context.currentTime;if(now-this.last<1/25)return this.value;this.last=now;
  this.analyser.getFloatTimeDomainData(this.wave);this.analyser.getFloatFrequencyData(this.spectrum);
  let low=0,high=0,total=0;const width=this.context.sampleRate/4096;
  for(let i=Math.ceil(70/width);i<this.spectrum.length&&i*width<=5000;i++){const power=10**(this.spectrum[i]/10);total+=power;if(i*width<320)low+=power;if(i*width>700)high+=power}
  this.value=motionFromVoice(voicePitch(this.wave,this.context.sampleRate),this.range,{low:low/Math.max(total,1e-15),high:high/Math.max(total,1e-15)});return this.value;
 }
}
