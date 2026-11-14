const unsupported='此浏览器不支持透明录制，请使用新版 Chrome，或选择保留背景。';

// A separate alpha-capable encoder: native MediaRecorder/AVC must never be used
// for transparent export. Mediabunny encodes color and alpha as WebM side data.
export async function createTransparentCapture(canvas,audioTrack){
 const M=await import('./vendor/mediabunny-1.65.2.mjs');
 const {width,height}=canvas;
 const options={width,height,frameRate:30,alpha:'keep',quality:new M.Quality({quantizer:0,bitrate:4500000})};
 let codec=null;
 for(const candidate of ['vp9','vp8'])if(await M.canEncodeVideo(candidate,options)){codec=candidate;break}
 if(!codec||!await M.canEncodeAudio('opus',{numberOfChannels:2,sampleRate:48000}))throw Error(unsupported);
 const output=new M.Output({format:new M.WebMOutputFormat(),target:new M.BufferTarget()});
 // Read RGBA directly. A canvas MediaStream can be converted to opaque I420 by
 // the browser, even when the original canvas contains transparent pixels.
 const video=new M.CanvasSource(canvas,{codec,alpha:'keep',quality:options.quality});
 const audio=new M.MediaStreamAudioTrackSource(audioTrack,{codec:'opus',quality:new M.Quality({bitrate:128000})});
 output.addVideoTrack(video,{canBeTransparent:true});output.addAudioTrack(audio);
 let disposed=false,pending=null,firstFrame=true;
 const capture={
  onerror:()=>{},
  get busy(){return !!pending},
  start:()=>output.start(),
  addFrame(timestamp){
   if(disposed||pending)return;
   pending=video.add(firstFrame?0:timestamp,1/30).catch(error=>{if(!disposed)capture.onerror(error)}).finally(()=>{pending=null});firstFrame=false;
  },
  pause(){audio.pause()},
  resume(){audio.resume()},
  async finish(){
   await pending;
   video.close();audio.close();await output.finalize();
   const blob=new Blob([output.target.buffer],{type:'video/webm'});
   const input=new M.Input({source:new M.BlobSource(blob),formats:M.ALL_FORMATS});
   try{
    const track=await input.getPrimaryVideoTrack(),packet=track&&await new M.EncodedPacketSink(track).getFirstPacket();
    if(!packet?.sideData.alpha?.length||!await track.canBeTransparent())throw Error('透明通道未能保存，请重新录制。');
   }finally{input.dispose()}
   return blob;
  },
  dispose(){disposed=true;video.close();audio.close();if(output.state!=='finalized'&&output.state!=='canceled')output.cancel().catch(()=>{})}
 };
 audio.errorPromise.catch(error=>{if(!disposed)capture.onerror(error)});
 return capture;
}
