export function configureCameraVideo(video){
 video.muted=true;video.defaultMuted=true;video.autoplay=true;video.playsInline=true;
 video.setAttribute?.('muted','');video.setAttribute?.('playsinline','');video.setAttribute?.('webkit-playsinline','');
}
// A successful permission grant is not proof that the preview has a frame.
export function waitForCameraFrame(video,stream,{signal,timeout=8000}={}){
 configureCameraVideo(video);
 return new Promise((resolve,reject)=>{
  let done=false,frameID=null,poll,timer,receivedFrame=false;
  const hasFrameCallback=typeof video.requestVideoFrameCallback==='function';
  const finish=error=>{if(done)return;done=true;clearTimeout(timer);clearInterval(poll);if(frameID!==null)video.cancelVideoFrameCallback?.(frameID);for(const event of ['loadeddata','canplay','playing','resize'])video.removeEventListener(event,check);signal?.removeEventListener('abort',abort);error?reject(error):resolve(true)};
  const abort=()=>finish(new DOMException('Camera preview cancelled','AbortError'));
  const check=()=>{if(signal?.aborted)return abort();if(video.srcObject!==stream)return abort();if(video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0&&!video.paused&&(!hasFrameCallback||receivedFrame))finish()};
  if(signal?.aborted){abort();return}
  signal?.addEventListener('abort',abort,{once:true});
  for(const event of ['loadeddata','canplay','playing','resize'])video.addEventListener(event,check);
  timer=setTimeout(()=>finish(new Error('摄像头没有传来画面，请重试。')),timeout);
  poll=setInterval(check,80);
  if(hasFrameCallback)frameID=video.requestVideoFrameCallback(()=>{receivedFrame=true;check()});
  if(video.srcObject!==stream)video.srcObject=stream;
  try{Promise.resolve(video.play()).then(check,error=>finish(error))}catch(error){finish(error)}
  check();
 });
}
