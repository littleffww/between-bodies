const clamp=value=>Math.max(0,Math.min(1,value));

// Independent channel energy avoids cancelling a stereo recording whose
// channels have opposite phase. The original playback buffer is never edited.
export function analyzeImportedAudio(buffer){
 if(!Number.isFinite(buffer.duration)||buffer.duration<.05)throw Error('音频太短，请选择完整的声音文件。');
 if(buffer.duration>600)throw Error('请选择 10 分钟以内的音频。');
 const size=Math.max(1,Math.round(buffer.sampleRate*.02));
 const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
 const energy=new Float32Array(Math.ceil(buffer.length/size));let peak=0;
 for(let frame=0;frame<energy.length;frame++){
  const start=frame*size,end=Math.min(buffer.length,start+size),count=end-start;let power=0;
  for(const data of channels){
   let sum=0,mean=0;
   for(let i=start;i<end;i++){const sample=data[i];if(!Number.isFinite(sample))throw Error('音频文件已损坏，请换一个文件。');sum+=sample*sample;mean+=sample;peak=Math.max(peak,Math.abs(sample))}
   power+=Math.max(0,sum/count-(mean/count)**2)/channels.length;
  }
  energy[frame]=Math.sqrt(power);
 }
 const audible=Array.from(energy).filter(x=>x>.0005).sort((a,b)=>a-b);
 if(!audible.length)throw Error('这个文件没有可识别的声音，请换一个文件。');
 const reference=Math.max(.002,audible[Math.floor(audible.length*.85)]),floor=Math.max(.00035,reference*.045);
 const envelope=energy.map(rms=>Math.pow(clamp((rms-floor)/Math.max(.001,reference*1.25-floor)),.72));
 return {envelope,windowSeconds:size/buffer.sampleRate,normalization:Math.min(1,.95/peak)};
}

export function importedAudioLevel(analysis,seconds){
 const frame=Math.max(0,seconds)/analysis.windowSeconds,index=Math.min(analysis.envelope.length-1,Math.floor(frame));
 const a=analysis.envelope[index]||0,b=analysis.envelope[Math.min(index+1,analysis.envelope.length-1)]||0;
 return a+(b-a)*(frame-Math.floor(frame));
}
