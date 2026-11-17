import {configureCameraVideo} from './camera-preview.mjs?v=lips-camera-v13';
export const POSE_EDGES=[[0,2],[0,5],[2,7],[5,8],[9,10],[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[27,31],[28,30],[30,32],[28,32]];
export const HAND_EDGES=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
const visible=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&(p.visibility??1)>.6&&(p.presence??1)>.6;
export function drawSkeleton(canvas,result,mirror=true,aspect=4/3){
 const c=canvas.getContext('2d'),r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);
 const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
 c.clearRect(0,0,w,h);if(!result){canvas.poseSmoothed=null;canvas.poseBox=null;return}
 const smooth=(prior,points)=>points.map((p,i)=>{const old=prior?.[i];return old&&visible(old)&&visible(p)?{...p,x:old.x+(p.x-old.x)*.28,y:old.y+(p.y-old.y)*.28}:p});
 const previous=canvas.poseSmoothed;
 result={face:smooth(previous?.face,result.face||[]),faceEdges:result.faceEdges||[],pose:smooth(previous?.pose,result.pose||[]),hands:(result.hands||[]).map((h,i)=>smooth(previous?.hands?.[i],h))};canvas.poseSmoothed=result;
 let reliable=(result.pose||[]).filter(visible);if(reliable.length<5)reliable=[...(result.face||[]),...(result.hands||[]).flat()].filter(visible);
 let cx=.5,cy=.5,rx=1,ry=1;
 if(reliable.length>=5){const xs=reliable.map(p=>p.x),ys=reliable.map(p=>p.y);cx=(Math.min(...xs)+Math.max(...xs))/2;cy=(Math.min(...ys)+Math.max(...ys))/2;rx=Math.max(.3,Math.max(...xs)-Math.min(...xs));ry=Math.max(.4,Math.max(...ys)-Math.min(...ys))}
 const desired=[cx,cy,rx,ry];canvas.poseBox ||= desired;
 canvas.poseBox=canvas.poseBox.map((v,i)=>v+(desired[i]-v)*.08);[cx,cy,rx,ry]=canvas.poseBox;
 const width=Math.min(w/rx,h*aspect/ry)*.8,height=width/aspect;
 const point=p=>[w/2+(mirror?-1:1)*(p.x-cx)*width,h/2+(p.y-cy)*height];
 c.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()||'#333';c.fillStyle=c.strokeStyle;c.lineWidth=1.35*dpr;c.lineCap='round';
 const draw=(landmarks,edges,alpha)=>{c.globalAlpha=alpha;c.beginPath();for(const [a,b] of edges){if(!visible(landmarks[a])||!visible(landmarks[b]))continue;c.moveTo(...point(landmarks[a]));c.lineTo(...point(landmarks[b]))}c.stroke();for(const index of new Set(edges.flat())){const p=landmarks[index];if(!visible(p))continue;c.beginPath();c.arc(...point(p),1.9*dpr,0,Math.PI*2);c.fill()}};
 draw(result.pose||[],POSE_EDGES,.83);draw(result.face||[],result.faceEdges||[],.55);for(const h of result.hands||[])draw(h,HAND_EDGES,.7);c.globalAlpha=1;
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function interpretHands(landmarks,mirror=true){
 if(!landmarks?.length)return null;
 const h=landmarks[0];if(h.length<21)return null;
 const span=Math.max(.035,distance(h[0],h[9]));
 const pinch=distance(h[4],h[8])/span;
 const open=[8,12,16,20].filter(i=>distance(h[i],h[0])>distance(h[i-2],h[0])*1.15).length;
 if(landmarks.length>1&&landmarks[1].length>=21)return {kind:'two',distance:distance(h[9],landmarks[1][9]),x:(h[9].x+landmarks[1][9].x)/2,y:(h[9].y+landmarks[1][9].y)/2};
 return {kind:pinch<.35?'pinch':open<=1?'fist':'open',x:mirror?1-h[9].x:h[9].x,y:h[9].y};
}
export class CameraTracking{
 constructor(video,{onResult,onState,onError}){Object.assign(this,{video,onResult,onState,onError});this.backgroundVideo=video;this.epoch=0;this.stream=null;this.worker=null;this.starting=false;this.pending=null;this.busy=false;this.ready=false;this.lastVideo=-1;this.lastSent=0;this.frameId=0;this.resultTime=0;this.facing='user';this.snapshots=new Map();this.snapshotID=0}
 get active(){return !!this.stream?.getVideoTracks().some(t=>t.readyState==='live')}
 useVideo(video){
  if(this.video!==video){this.video.pause();this.video.srcObject=null;this.video=video;this.lastVideo=-1}
  configureCameraVideo(video);
  if(this.active){if(video.srcObject!==this.stream)video.srcObject=this.stream;try{Promise.resolve(video.play()).catch(()=>{})}catch{}}
 }
 stop(){for(const resolve of this.snapshots.values())resolve(null);this.snapshots.clear();this.epoch++;this.starting=false;this.pending=null;this.ready=false;this.busy=false;clearTimeout(this.timeout);clearTimeout(this.requestTimeout);cancelAnimationFrame(this.frameId);this.worker?.terminate();this.worker=null;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;for(const video of new Set([this.video,this.backgroundVideo])){video.pause();video.srcObject=null}this.lastVideo=-1;this.lastSent=0;this.resultTime=0;this.onResult(null);this.onState('off')}
 start(facing=this.facing,video=this.backgroundVideo){
  if(this.starting&&facing===this.facing&&this.pending){this.useVideo(video);return this.pending}
  if(this.active&&facing===this.facing){this.useVideo(video);return Promise.resolve(true)}
  this.stop();const id=this.epoch;this.facing=facing;this.video=video;this.starting=true;this.onState('starting');
  const pending=this.acquire(id);this.pending=pending;pending.finally(()=>{if(this.pending===pending)this.pending=null});return pending;
 }
 async acquire(id){
  let requestTimeout;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('camera unavailable');
   const media=navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:this.facing},width:{ideal:960},height:{ideal:720}},audio:false});
   media.then(s=>{if(id!==this.epoch)s.getTracks().forEach(t=>t.stop())},()=>{});
   const stream=await Promise.race([media,new Promise((_,reject)=>{requestTimeout=setTimeout(()=>reject(new Error('camera timeout')),25000);this.requestTimeout=requestTimeout})]);clearTimeout(requestTimeout);
   if(id!==this.epoch){stream.getTracks().forEach(t=>t.stop());return false}
   this.stream=stream;if(!this.active)throw new Error('camera track ended');
   // Never await a hidden video's play() before attaching the visible preview.
   this.useVideo(this.video);this.starting=false;this.onState('camera');
   for(const track of stream.getTracks())track.addEventListener('ended',()=>{if(id===this.epoch){this.stop();this.onError('摄像头已断开，请重新开启。')}},{once:true});
   this.initialize(id);return true;
  }catch(e){clearTimeout(requestTimeout);if(id!==this.epoch)return false;this.stop();this.onError(e.name==='NotAllowedError'?'摄像头未获允许。关闭此窗口后可以选择照片。':'摄像头暂不可用。请检查镜头，或选择一张照片。');return false}
 }
 initialize(id){
  if(typeof Worker==='undefined'||typeof createImageBitmap==='undefined'){this.onError('此浏览器暂不支持姿态识别，仍可拍照和使用鼠标。');return}
  try{
   this.worker=new Worker(new URL('./tracking-worker.js?v=photo-ready-v15',import.meta.url));
   this.timeout=setTimeout(()=>this.failTracking(id),45000);
   this.worker.onmessage=({data})=>{
    if(id!==this.epoch)return;
    if(data.type==='snapshotResult'||data.type==='snapshotError'){this.snapshots.get(data.requestId)?.(data.type==='snapshotResult'?data:null);this.snapshots.delete(data.requestId);return}
    if(data.type==='ready'){clearTimeout(this.timeout);this.ready=true;this.onState('tracking');this.loop(id)}
    if(data.type==='result'){this.busy=false;this.resultTime=performance.now();this.onResult(data)}
    if(data.type==='error')this.failTracking(id);
   };
   this.worker.onerror=()=>this.failTracking(id);this.worker.postMessage({type:'init'});
  }catch{this.failTracking(id)}
 }
 async snapshot(canvas){
  const epoch=this.epoch,start=performance.now();
  while(!this.ready&&this.active&&this.worker&&epoch===this.epoch&&performance.now()-start<45000)await new Promise(r=>setTimeout(r,60));
  if(!this.ready||epoch!==this.epoch)return null;
  const image=await createImageBitmap(canvas,{resizeWidth:640,resizeHeight:Math.round(640*canvas.height/canvas.width)});
  if(epoch!==this.epoch||!this.worker){image.close();return null}
  const requestId=++this.snapshotID;
  return new Promise(resolve=>{const timer=setTimeout(()=>{this.snapshots.delete(requestId);resolve(null)},15000);this.snapshots.set(requestId,result=>{clearTimeout(timer);resolve(result)});this.worker.postMessage({type:'snapshot',image,requestId,time:performance.now()},[image])});
 }
 failTracking(id){if(id!==this.epoch)return;for(const resolve of this.snapshots.values())resolve(null);this.snapshots.clear();clearTimeout(this.timeout);this.worker?.terminate();this.worker=null;this.ready=false;this.busy=false;this.onResult(null);this.onError('姿态识别暂不可用，仍可拍照和使用鼠标。')}
 loop(id){
  if(id!==this.epoch||!this.ready)return;
  const now=performance.now();
  if(this.resultTime&&now-this.resultTime>650){this.onResult(null);this.resultTime=0}
  if(!this.busy&&this.video.readyState>=2&&now-this.lastSent>120&&this.video.currentTime!==this.lastVideo){
   this.busy=true;this.lastSent=now;this.lastVideo=this.video.currentTime;
   createImageBitmap(this.video,{resizeWidth:640,resizeHeight:Math.round(640*this.video.videoHeight/this.video.videoWidth)}).then(image=>{
    if(id!==this.epoch||!this.worker){image.close();return}
    this.worker.postMessage({type:'frame',image,time:now},[image]);
   }).catch(()=>{if(id===this.epoch)this.busy=false});
  }
  this.frameId=requestAnimationFrame(()=>this.loop(id));
 }
}

// Image recognition can run without opening a camera or asking for microphone access.
export async function recognizePhoto(canvas,{target='auto',signal,timeout=45000}={}){
 if(signal?.aborted||typeof Worker==='undefined'||typeof createImageBitmap==='undefined')return null;
 let worker;try{worker=new Worker(new URL('./tracking-worker.js?v=photo-ready-v15',import.meta.url))}catch{return null}
 return new Promise(resolve=>{let finished=false;const abort=()=>finish(null);const finish=result=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.terminate();resolve(result)};
  const timer=setTimeout(()=>finish(null),timeout);signal?.addEventListener('abort',abort,{once:true});worker.onerror=()=>finish(null);
  worker.onmessage=async({data})=>{if(data.type==='ready'){try{const image=await createImageBitmap(canvas,{resizeWidth:640,resizeHeight:Math.round(640*canvas.height/canvas.width)});if(finished){image.close();return}worker.postMessage({type:'snapshot',image,requestId:1,time:performance.now()},[image])}catch{finish(null)}}else if(data.type==='snapshotResult')finish(data);else if(data.type==='error'||data.type==='snapshotError')finish(null)};
  try{worker.postMessage({type:'init',target})}catch{finish(null)}
 });
}
