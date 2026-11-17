const clamp=value=>Math.max(0,Math.min(1,value));

// Calibrate against speech-sized windows, so a quiet recording still articulates
// and a loud recording does not hold the mouth permanently open.
export function speechReference(buffer){
 const size=Math.max(1,Math.round(buffer.sampleRate*.02)),levels=[];
 const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
 for(let start=0;start<buffer.length;start+=size){
  const end=Math.min(buffer.length,start+size);let sum=0,mean=0;
  for(let i=start;i<end;i++){let sample=0;for(const data of channels)sample+=data[i]/channels.length;sum+=sample*sample;mean+=sample}
  const count=end-start,rms=Math.sqrt(Math.max(0,sum/count-(mean/count)**2));
  if(rms>.0005)levels.push(rms);
 }
 levels.sort((a,b)=>a-b);
 return Math.max(.002,levels[Math.floor(levels.length*.85)]||.13);
}

export function speechLevel(samples,reference=.13){
 let sum=0,mean=0;for(const sample of samples){sum+=sample*sample;mean+=sample}
 const rms=Math.sqrt(Math.max(0,sum/samples.length-(mean/samples.length)**2));
 const floor=Math.max(.00035,reference*.045);
 return Math.pow(clamp((rms-floor)/Math.max(.001,reference*1.25-floor)),.72);
}
