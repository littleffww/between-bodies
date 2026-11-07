import {CameraTracking,drawSkeleton,interpretHands,recognizePhoto} from './tracking.mjs?v=export-v17';
import {selectSubject,autoCrop,projectSubject,frameworkCanvas,drawCameraGuide,drawLines,reliable} from './capture-guide.mjs?v=export-v17';
import {createBody} from './body.mjs?v=export-v17';
import {FleshSound} from './sound.mjs?v=export-v17';
import {createFaceRelief} from './face-relief.mjs?v=export-v17';
import {ParticipantVoices} from './participant-voices.mjs?v=export-v17';
import {MAX_PARTICIPANTS} from './face-layout.mjs?v=export-v17';
import {waitForCameraFrame} from './camera-preview.mjs?v=export-v17';
import {SculptureRecorder,saveVideo,downloadBlob} from './video-recorder.mjs?v=export-v17';
const $=id=>document.getElementById(id);
const sound=new FleshSound(),voices=new ParticipantVoices(),participants=new Map();
let nextParticipant=1;
let audioIntent='auto',fusionPhase='',pageClosing=false;
sound.preload().catch(()=>{});
let statusTimer,body,facing='user',source=null,photo=null,cropDrag=null;
let cropState={zoom:1,x:0,y:0},photoRequest=0,captureBusy=false,sourceRecognition=null,sourceSubject=null;
let reliefDraft=null,portraitMode=false;
let photoController=null,photoPending=false,photoTarget='face',photoOrigin='camera';
let cameraRequest=0,previewController=null,cameraPreviewReady=false;const dialogRuns=new WeakMap();
function report(message,sticky=false){clearTimeout(statusTimer);$('status').textContent=message;if(!sticky)statusTimer=setTimeout(()=>$('status').textContent='',4500)}
function syncSound(){const own=voices.hasVoices;const enabled=own?voices.enabled&&voices.context?.state==='running':sound.enabled&&sound.context?.state==='running'&&!sound.loading;const audible=enabled&&!body?.paused&&!voices.capture&&!$('videoPreview').open;$('sound').setAttribute('aria-pressed',String(enabled));$('sound').dataset.sound=audible?'on':'off';$('sound').textContent=sound.loading?'正在载入人声…':enabled?(body?.paused?'人声已暂停':'关闭人声'):'开启人声'}
sound.onchange=syncSound;
async function startVoice(){
 if(audioIntent==='muted'||sound.loading)return;
 try{if(voices.hasVoices){voices.setEnabled(true);await voices.unlock()}else await sound.enable();syncSound()}catch(e){syncSound();report(e.message||'人声未能载入，请重试。')}
}
// The first intentional model interaction unlocks audio; an explicit mute persists.
document.addEventListener('pointerdown',e=>{if(e.target.closest('#stage canvas,[data-state],#press,#join,#replayFusion')&&audioIntent!=='muted')startVoice()},true);

body=createBody($('stage'),()=>report('轻触它，看它回应。'),message=>report(message,true));
const videoRecorder=new SculptureRecorder(body?.canvas,()=>[sound.getOutputStream(),voices.getOutputStream()]);
let previewURL=null,previewBlob=null;
let latestPose=null,latestGesture=null,keepTracking=false;
const tracker=new CameraTracking($('trackingVideo'),{
 onState(state){
  const active=state==='camera'||state==='tracking';
  $('trackingToggle').setAttribute('aria-pressed',String(active));
  $('trackingToggle').textContent=state==='starting'?'取消开启':active?'关闭摄像头':'开启手势与骨架';
  $('trackingStatus').textContent=state==='starting'?'等待摄像头权限…':state==='camera'?'正在加载手势与姿态识别…':state==='tracking'?'摄像头已开启 · 本机识别':'';
  if(state==='off'){$('camera').srcObject=null;$('shutter').disabled=true;body?.gesture(null)}
  updateSplit();
 },
 onError(message){$('trackingStatus').textContent=message;report(message,true);if($('cameraDialog').open&&(!tracker.active||!cameraPreviewReady))showCameraError(message)},
 onResult(result){
  if($('cameraDialog').open&&!captureBusy)updateCameraGuide(result);
  latestPose=result;if(!result)drawSkeleton($('poseCanvas'),null);
  const seen=!!selectSubject(result);
  $('poseEmpty').hidden=seen;
  $('poseEmpty').textContent=tracker.active?'让肩膀和手臂进入画面':'开启摄像头，查看实时骨架';
  const gesture=$('gestureEnabled').checked?interpretHands(result?.hands,tracker.facing==='user'):null;
  latestGesture=gesture;body?.gesture(gesture);
  $('gestureReadout').textContent=gesture?({open:'张开手掌 · 旋转',fist:'握拳 · 蜷缩',pinch:'捏合 · 轻压',two:'双手 · 伸缩'}[gesture.kind]):'';
 }
});
function updateSplit(){const split=!portraitMode&&(tracker.active||!!photo);body?.setSplit(split);$('poseStage').hidden=!split;if(!tracker.active){latestPose=null;$('poseEmpty').hidden=false;$('poseEmpty').textContent='开启摄像头，查看实时骨架'}}
body?.onTick(s=>{const own=voices.hasVoices||!!voices.capture;
 const paused=s.paused||$('videoPreview').open;
 sound.update({...s,paused:paused||own});
 const levels=voices.update({...s,paused}),originalMouth=sound.sampleMouth(paused||own);
 body.reactToVoice($('bodyVoiceEnabled').checked?(own?voices.sampleMotion(paused):sound.sampleMotion(paused)):{high:0,low:0});
 // The original artwork speaks through the captured lips until personal voices exist.
 // Once recorded, each participant keeps an independent voice; muted faces stay silent.
 if(!own)for(const id of participants.keys())levels.set(id,originalMouth);
 body.setFaceLevels(levels);updateParticipantActivity(levels);
 if(photo){const phase=s.fusing?(s.fusionProgress<.32?'forming':'joining'):'fused';if(phase!==fusionPhase){fusionPhase=phase;$('sourceNote').textContent=(portraitMode?{forming:'你的特征正在浮现',joining:'同一种皮肤 · 共享一次呼吸',fused:'你的轮廓，成为它的一部分'}:{forming:'照片正在形成另一半',joining:'两半正在靠拢 · 共享一次呼吸',fused:'左 · AI 肉体　／　右 · 你的身体'})[phase]}}
if(latestGesture?.kind==='two'&&$('gestureEnabled').checked){$('volume').value=s.size;const value=Math.round(s.size*100)+'%';if($('volumeValue').textContent!==value)$('volumeValue').textContent=value;}if(!$('poseStage').hidden)drawSkeleton($('poseCanvas'),latestPose,tracker.facing==='user',($('trackingVideo').videoWidth||4)/($('trackingVideo').videoHeight||3))});
$('trackingToggle').onclick=async()=>{if(tracker.active||tracker.starting){keepTracking=false;stopCamera();return}keepTracking=true;await tracker.start(facing)};
$('gestureEnabled').onchange=()=>{if(!$('gestureEnabled').checked)body?.gesture(null)};
$('pause').setAttribute('aria-pressed',String(!!body?.paused));
$('pause').textContent=body?.paused?'继续蠕动':'暂停蠕动';
async function openDialog(dialog){const run=(dialogRuns.get(dialog)||0)+1;dialogRuns.set(dialog,run);if(!dialog.open)dialog.showModal();requestAnimationFrame(()=>{if(dialog.open&&dialogRuns.get(dialog)===run)dialog.classList.add('revealed')})}
async function closeDialog(dialog){
 const run=(dialogRuns.get(dialog)||0)+1;dialogRuns.set(dialog,run);
 if(dialog.id==='cropDialog')cancelPhotoRecognition();
 if(dialog.id==='videoPreview')$('recordedVideo').pause();
 if(dialog.id==='cameraDialog'){
  cameraRequest++;previewController?.abort();cameraPreviewReady=false;photoRequest++;captureBusy=false;$('shutter').disabled=true;$('flip').disabled=false;
  if(keepTracking)tracker.useVideo($('trackingVideo'));else stopCamera();
 }
 dialog.classList.remove('revealed');await Promise.allSettled(dialog.getAnimations().map(a=>a.finished));
 if(dialogRuns.get(dialog)!==run)return;dialog.close();
}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeDialog($(b.dataset.close)));
document.querySelectorAll('dialog').forEach(d=>{
 d.addEventListener('cancel',e=>{e.preventDefault();closeDialog(d)});
 d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(d)});
});
$('aboutOpen').onclick=()=>openDialog($('about'));
$('sound').onclick=()=>{
 const running=voices.hasVoices?voices.enabled&&voices.context?.state==='running':sound.enabled&&sound.context?.state==='running';
 if(running||sound.loading){audioIntent='muted';sound.off();voices.setEnabled(false);syncSound();return}
 audioIntent='on';voices.setEnabled(true);startVoice();
};
function stopCamera(){cameraRequest++;previewController?.abort();cameraPreviewReady=false;cancelPhotoRecognition();captureBusy=false;tracker.stop();$('camera').srcObject=null;$('shutter').disabled=true;$('flip').disabled=false}
function showCameraError(message){cameraPreviewReady=false;$('shutter').disabled=true;$('flip').disabled=false;$('cameraStatus').textContent=message;$('cameraStatus').hidden=false;$('cameraRetry').hidden=false}
async function startCamera(){
 const request=++cameraRequest;previewController?.abort();const controller=previewController=new AbortController();cameraPreviewReady=false;
 $('shutter').disabled=true;$('flip').disabled=true;$('cameraRetry').hidden=true;captureBusy=false;
 drawCameraGuide($('cameraGuide'),null,0,0,false);$('captureHint').textContent='让脸、手或身体进入画面';$('cameraStatus').textContent='正在开启摄像头…';$('cameraStatus').hidden=false;
 const success=await tracker.start(facing,$('camera'));
 if(request!==cameraRequest||!$('cameraDialog').open||controller.signal.aborted)return;
 if(!success){$('flip').disabled=false;$('cameraRetry').hidden=false;return}
 const stream=tracker.stream;$('camera').classList.toggle('front',facing==='user');
 try{
  await waitForCameraFrame($('camera'),stream,{signal:controller.signal});
  if(request!==cameraRequest||!$('cameraDialog').open||tracker.stream!==stream)return;
  cameraPreviewReady=true;$('shutter').disabled=false;$('flip').disabled=false;$('cameraStatus').hidden=true;$('cameraRetry').hidden=true;
 }catch(e){if(request!==cameraRequest||controller.signal.aborted)return;showCameraError('摄像头没有传来画面，请重试。')}
}
$('takePhoto').onclick=()=>{if(participants.size>=MAX_PARTICIPANTS){report('最多保留六张脸，可先移除一位。');return}cancelPhotoRecognition();captureBusy=false;keepTracking=tracker.active||tracker.starting;openDialog($('cameraDialog'));startCamera()};
$('flip').onclick=()=>{facing=facing==='user'?'environment':'user';startCamera()};
$('cameraRetry').onclick=()=>{stopCamera();startCamera()};
const targetLabels={face:'已识别脸部',hand:'已识别手部',body:'已识别身体姿态'};
function updateCameraGuide(result=latestPose){
 const subject=selectSubject(result,$('captureTarget').value),v=$('camera');
 drawCameraGuide($('cameraGuide'),subject,v.videoWidth,v.videoHeight,facing==='user');
 $('captureHint').textContent=subject?targetLabels[subject.kind]:'让脸、手或身体进入画面';
}
$('captureTarget').onchange=()=>updateCameraGuide();
$('showFramework').onchange=()=>body?.setFramework($('showFramework').checked);
$('shutter').onclick=async()=>{
 const video=$('camera');if(!cameraPreviewReady||video.readyState<2||!video.videoWidth||!tracker.active||captureBusy)return;
 captureBusy=true;$('shutter').disabled=true;$('flip').disabled=true;
 const canvas=document.createElement('canvas'),scale=Math.min(1,1280/video.videoWidth);
 canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);const ctx=canvas.getContext('2d');
 if(facing==='user'){ctx.translate(canvas.width,0);ctx.scale(-1,1)}ctx.drawImage(video,0,0,canvas.width,canvas.height);
 captureBusy=false;$('flip').disabled=false;
 keepTracking=true;cameraRequest++;previewController?.abort();cameraPreviewReady=false;tracker.useVideo($('trackingVideo'));$('cameraDialog').close();$('cameraDialog').classList.remove('revealed');
 processPhoto(canvas,'camera');
};
$('upload').onclick=()=>$('file').click();
$('file').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;if(participants.size>=MAX_PARTICIPANTS){report('最多保留六张脸，可先移除一位。');return}
 cancelPhotoRecognition();const request=photoRequest;
 if(file.size>30*1024*1024){report('照片太大，请选择小于 30 MB 的图片。');return}
 const url=URL.createObjectURL(file),image=new Image();image.src=url;
 try{
  await image.decode();if(request!==photoRequest)return;
  const canvas=document.createElement('canvas');const scale=Math.min(1,2400/Math.max(image.width,image.height));
  canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  processPhoto(canvas,'file');
 }catch{report('这张照片暂时无法读取。请换成 JPG、PNG 或 WebP。')}
 finally{URL.revokeObjectURL(url)}
};
function cancelPhotoRecognition(){
 photoRequest++;photoController?.abort();photoController=null;
 if(photoPending){photoPending=false;if($('cropDialog').open)syncCropStatus()}
}
async function processPhoto(canvas,origin,target=$('captureTarget').value){
 cancelPhotoRecognition();const request=photoRequest,controller=photoController=new AbortController();
 source=canvas;photoOrigin=origin;photoTarget=target;sourceRecognition=null;sourceSubject=null;reliefDraft=null;photoPending=true;
 beginCrop();
 // A frozen face is recognized as an IMAGE, independently of live pose/hand tracking.
 let result=null;try{result=await recognizePhoto(canvas,{target,signal:controller.signal,timeout:30000})}catch{}
 if(request!==photoRequest||controller.signal.aborted||!$('cropDialog').open)return;
 photoPending=false;photoController=null;sourceRecognition=result;sourceSubject=selectSubject(result,target);
 try{reliefDraft=createFaceRelief(sourceSubject)}catch{reliefDraft=null}
 beginCrop();
}
$('retryRecognition').onclick=()=>{if(source&&!photoPending)processPhoto(source,photoOrigin,photoTarget)};
$('retake').onclick=async()=>{if(photoOrigin==='file'){closeDialog($('cropDialog'));$('file').click();return}await closeDialog($('cropDialog'));$('takePhoto').click()};
function syncCropStatus(){
 const face=sourceSubject?.kind==='face'||photoTarget==='face';
 $('cropDialog').setAttribute('aria-busy',String(photoPending));
 $('recognitionNote').textContent=photoPending?'正在识别照片，请稍候…':!body?'3D 暂不可用，请刷新后重试。':face?(reliefDraft?'已提取五官比例':!sourceRecognition?'识别暂未完成，可以重新识别或重拍。':'需要清楚识别双眼、鼻子和嘴唇，请调整角度或光线后重拍。'):(sourceSubject?targetLabels[sourceSubject.kind]:'未识别到清晰结构，可手动选择范围。');
 $('join').disabled=photoPending||!body||(face&&!reliefDraft);
 $('join').textContent=photoPending?'识别中…':face?'加入':'生成另一半并融合';
 $('retryRecognition').hidden=photoPending||!face||!!reliefDraft;
 $('retake').textContent=photoOrigin==='camera'?'重拍':'换一张照片';
}
function beginCrop(){
 const face=sourceSubject?.kind==='face'||photoTarget==='face';
 cropState=autoCrop(sourceSubject,source.width,source.height);$('zoom').value=cropState.zoom;$('zoomValue').textContent=cropState.zoom.toFixed(1)+'×';
 $('cropTitle').textContent=face?'确认人脸':'保留哪一部分？';
 $('cropCopy').textContent=face?'加入后可为这张脸录音。':'选择你想保留的画面。它会形成另一半，再与原有肉体慢慢融合。';
 syncCropStatus();
 $('zoom').hidden=face;$('zoomLabel').hidden=face;$('crop').style.cursor=face?'default':'move';$('crop').tabIndex=face?-1:0;
 drawCrop();openDialog($('cropDialog'));
}
function drawCrop(){
 if(!source)return;
 const c=$('crop'),ctx=c.getContext('2d'),scale=Math.max(c.width/source.width,c.height/source.height)*cropState.zoom;
 const w=source.width*scale,h=source.height*scale;
 cropState.x=Math.max(-Math.max(0,(w-c.width)/2),Math.min(Math.max(0,(w-c.width)/2),cropState.x));
 cropState.y=Math.max(-Math.max(0,(h-c.height)/2),Math.min(Math.max(0,(h-c.height)/2),cropState.y));
 ctx.fillStyle='#f4f3ef';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(source,(c.width-w)/2+cropState.x,(c.height-h)/2+cropState.y,w,h);
 const guide=$('cropGuide').getContext('2d');guide.clearRect(0,0,768,768);drawLines(guide,projectSubject(sourceSubject,source.width,source.height,cropState),p=>[p.x*768,p.y*768]);
}
$('zoom').oninput=e=>{cropState.zoom=+e.target.value;$('zoomValue').textContent=cropState.zoom.toFixed(1)+'×';drawCrop()};
$('crop').onpointerdown=e=>{if(reliefDraft||$('captureTarget').value==='face')return;cropDrag={id:e.pointerId,x:e.clientX,y:e.clientY};$('crop').setPointerCapture(e.pointerId)};
$('crop').onpointermove=e=>{if(!cropDrag||cropDrag.id!==e.pointerId)return;const scale=$('crop').width/$('crop').clientWidth;cropState.x+=(e.clientX-cropDrag.x)*scale;cropState.y+=(e.clientY-cropDrag.y)*scale;cropDrag.x=e.clientX;cropDrag.y=e.clientY;drawCrop()};
$('crop').onpointerup=$('crop').onpointercancel=()=>{cropDrag=null};
$('crop').onkeydown=e=>{if(reliefDraft||$('captureTarget').value==='face')return;const direction={ArrowLeft:[-15,0],ArrowRight:[15,0],ArrowUp:[0,-15],ArrowDown:[0,15]}[e.key];if(direction){e.preventDefault();cropState.x+=direction[0];cropState.y+=direction[1];drawCrop()}};
$('join').onclick=()=>{
 if(!source||!body||photoPending||((photoTarget==='face'||sourceSubject?.kind==='face')&&!reliefDraft))return;
 portraitMode=!!reliefDraft;
 if(portraitMode){
  if(participants.size>=MAX_PARTICIPANTS){report('最多保留六张脸，可先移除一位。');return}
  const id=String(nextParticipant++);if(!body.addFace(id,reliefDraft))return;
  participants.set(id,{id});voices.add(id);photo=true;body.setFramework(false);renderParticipants();
  source=null;sourceRecognition=null;sourceSubject=null;reliefDraft=null;
  $('crop').getContext('2d').clearRect(0,0,768,768);$('cropGuide').getContext('2d').clearRect(0,0,768,768);
  $('photoInfo').hidden=true;$('photoMaterialNote').hidden=true;
  report('已加入。嘴唇跟随人声，也可录下自己的声音。');
 }else{
  if(participants.size){report('先移除人脸，再添加身体照片。');return}
  photo=document.createElement('canvas');photo.width=photo.height=768;photo.getContext('2d').drawImage($('crop'),0,0);
  const projected=projectSubject(sourceSubject,source.width,source.height,cropState);const found=projected?.edges.some(([a,b])=>reliable(projected.points[a])&&reliable(projected.points[b]));const frame=found?frameworkCanvas(projected):null;
  $('showFramework').disabled=!found;$('showFramework').checked=!!found;body.setFramework(!!found);body.setPhoto(photo,frame);
  $('showFramework').closest('label').hidden=false;$('originTitle').textContent='真实照片';$('originDetail').textContent='保留衣服与遮挡';$('recrop').textContent='调整照片';$('erase').textContent='清除照片';
  $('thumb').src=photo.toDataURL('image/jpeg',.7);$('photoInfo').hidden=false;$('photoMaterialNote').hidden=false;report('正在融合。');
 }
 fusionPhase='';$('takePhoto').textContent='拍照';syncPause();if(audioIntent!=='muted')startVoice();updateSplit();closeDialog($('cropDialog'));
};
function renderParticipants(){
 $('participants').hidden=!participants.size;$('participantCount').textContent=participants.size+'/'+MAX_PARTICIPANTS;
 const list=$('participantList');list.replaceChildren();
 for(const [id,participant] of participants){
  const row=document.createElement('div');row.className='participant-row';row.dataset.participant=id;
  const focus=document.createElement('button');focus.className='participant-focus';focus.textContent=id.padStart(2,'0');focus.setAttribute('aria-label','转向这张脸');focus.onclick=()=>{body.gesture(null);$('gestureEnabled').checked=false;body.focusFace(id)};
  const record=document.createElement('button');record.dataset.action='record';record.textContent='录音';record.onclick=async()=>{
   if(voices.recording===id){voices.stopRecording();return}
   body.setPaused(false);syncPause();body.focusFace(id);$('gestureEnabled').checked=false;body.gesture(null);sound.sleep();
   try{await voices.startRecording(id)}catch(e){report(e.message)}
  };
  const mute=document.createElement('button');mute.dataset.action='mute';mute.textContent='静音';mute.onclick=()=>{const t=voices.tracks.get(id);voices.setMuted(id,!t.muted);if(!t.muted&&audioIntent!=='muted')startVoice()};
  const remove=document.createElement('button');remove.dataset.action='remove';remove.textContent='×';remove.setAttribute('aria-label','移除这位参与者');remove.onclick=()=>{
   voices.remove(id);body.removeFace(id);participants.delete(id);portraitMode=!!participants.size;photo=portraitMode;renderParticipants();updateSplit();syncSound();
  };
  row.append(focus,record,mute,remove);list.append(row);participant.row=row;
 }
 $('captureTarget').disabled=participants.size>0;if(participants.size)$('captureTarget').value='face';syncParticipants();
}
function syncParticipants(){
 for(const [id,p] of participants){const t=voices.tracks.get(id),active=voices.capture?.id===id,state=voices.capture?.state;
  const record=p.row.querySelector('[data-action=record]');record.disabled=!!voices.capture&&!active||active&&state==='processing';record.textContent=active?(state==='permission'?'取消':state==='processing'?'处理中…':'结束'):t?.buffer?'重录':'录音';
  const mute=p.row.querySelector('[data-action=mute]');mute.disabled=!t?.buffer||!!voices.capture;mute.textContent=t?.muted?'播放':'静音';mute.setAttribute('aria-pressed',String(!!t?.buffer&&!t.muted));
 }
 const state=voices.capture?.state;$('recordingStatus').textContent=state==='permission'?'等待麦克风权限…':state==='processing'?'正在处理录音…':state==='recording'?'正在录音，最长 20 秒。':'';syncSound();
}
function updateParticipantActivity(levels){for(const [id,p] of participants)p.row.style.setProperty('--voice',String(levels.get(id)||0))}
voices.onchange=()=>{syncParticipants();if(!pageClosing&&!document.hidden&&!voices.capture&&!voices.hasVoices&&participants.size&&audioIntent!=='muted')startVoice()};voices.onerror=message=>report(message);
$('replayFusion').onclick=()=>{body?.replayFusion();fusionPhase='';syncPause();if(audioIntent!=='muted'&&!sound.enabled)startVoice()};
$('recrop').onclick=()=>{if(source)beginCrop()};
$('erase').onclick=()=>{
 photoRequest++;photo=null;source=null;sourceRecognition=null;sourceSubject=null;reliefDraft=null;portraitMode=false;$('cropGuide').getContext('2d').clearRect(0,0,768,768);body?.clearPhoto();$('thumb').removeAttribute('src');$('photoInfo').hidden=true;
 $('sourceNote').textContent='AI 材质预览 · 拍照后加入你的身体';$('takePhoto').textContent='拍照';
 fusionPhase='';$('photoMaterialNote').hidden=true;$('crop').getContext('2d').clearRect(0,0,768,768);updateSplit();report('照片已清除。');
};
document.querySelectorAll('[data-state]').forEach(b=>b.onclick=()=>{
 $('gestureEnabled').checked=false;body?.gesture(null);body?.setState(b.dataset.state);document.querySelectorAll('[data-state]').forEach(x=>{x.setAttribute('aria-pressed',String(x===b));x.classList.toggle('selected',x===b)});
 if(body?.paused){body.setPaused(false);syncPause()}
});
function syncPause(){$('pause').setAttribute('aria-pressed',String(!!body?.paused));$('pause').textContent=body?.paused?'继续蠕动':'暂停蠕动';syncSound()}
for(const [id,key] of [['motion','movement'],['moisture','wet'],['volume','size'],['normalIntensity','relief'],['bruiseIntensity','bruise'],['sweatIntensity','sweat']]){
 $(id).oninput=e=>{if(id==='volume'){$('gestureEnabled').checked=false;latestGesture=null;body?.gesture(null)}const value=+e.target.value;body?.set(key,value);$(id+'Value').textContent=Math.round(value*100)+'%'};
}
$('press').onclick=()=>{body?.press();report('一次触碰，沿着表面传开。')};
$('pause').onclick=()=>{if(!body?.paused&&voices.capture)voices.stopRecording();body?.setPaused(!body.paused);syncPause()};
$('restore').onclick=()=>{
 $('gestureEnabled').checked=false;body?.reset();syncPause();
 for(const [id,val] of [['motion',.45],['moisture',.65],['volume',1],['normalIntensity',1],['bruiseIntensity',3],['sweatIntensity',1]]){$(id).value=val;$(id+'Value').textContent=Math.round(val*100)+'%'}
 document.querySelectorAll('[data-state]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.state==='breathe'));b.classList.toggle('selected',b.dataset.state==='breathe')});
 report('慢慢回到最初的呼吸。');
};
async function savePNG(){
 try{const blob=await body?.capture();if(!blob)throw Error('画面保存失败，请重试。');downloadBlob(blob,'Between-Bodies-'+Date.now()+'.png');report('透明 PNG 已生成。')}catch(e){report(e.message)}
}
$('save').onclick=savePNG;$('saveMobile').onclick=savePNG;
function syncVideo(){
 const active=videoRecorder.active,processing=videoRecorder.state==='processing',starting=videoRecorder.state==='starting';
 $('recordVideo').disabled=active||processing||starting;
 $('recordVideo').textContent=processing?'正在生成 MP4…':starting?'正在准备录制…':'录制视频';
 $('recordingToolbar').hidden=!active;
 $('videoPause').textContent=videoRecorder.state==='paused'?'继续录制':'暂停录制';
 $('videoPause').setAttribute('aria-pressed',String(videoRecorder.state==='paused'));
 const secs=Math.floor(videoRecorder.seconds),clock=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
 if($('videoTime').textContent!==clock)$('videoTime').textContent=clock;
 $('videoState').textContent=videoRecorder.state==='paused'?'录制已暂停':'录制中';
 if(videoRecorder.state==='ready'&&videoRecorder.blob!==previewBlob){
  previewBlob=videoRecorder.blob;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(previewBlob);
  $('recordedVideo').src=previewURL;openDialog($('videoPreview'));syncSound();
 }
}
videoRecorder.onchange=syncVideo;
videoRecorder.onerror=e=>report(e.message||'录制失败，请重试。',true);
$('recordVideo').onclick=async()=>{
 try{if(audioIntent!=='muted')startVoice();await videoRecorder.start()}catch(e){report(e.message||'录制失败，请重试。',true)}
};
$('videoPause').onclick=()=>{if(videoRecorder.state==='paused')videoRecorder.resume().catch(e=>report(e.message));else videoRecorder.pause()};
$('videoFinish').onclick=()=>videoRecorder.finish()?.catch(()=>{});
$('videoSave').onclick=async()=>{
 if(!previewBlob)return;
 $('videoSave').disabled=true;
 try{const result=await saveVideo(previewBlob,'Between-Bodies-'+new Date().toISOString().replace(/[:.]/g,'-')+'.mp4');if(result==='saved')report('MP4 已保存。');else if(result==='downloaded')report('MP4 已交给浏览器下载。')}
 catch{report('保存失败，可再次点击保存 MP4。',true)}finally{$('videoSave').disabled=false}
};
$('fullscreen').onclick=async()=>{try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen()}catch{report('这个浏览器暂不支持全屏。')}};
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){videoRecorder.pause();stopCamera();if($('cameraDialog').open)showCameraError('镜头已暂停，返回页面后会重新开启。');sound.sleep();voices.sleep()}
 else {if($('cameraDialog').open)startCamera();if(audioIntent!=='muted'){if(voices.hasVoices)voices.unlock().then(syncSound).catch(syncSound);else if(sound.enabled)sound.context?.resume().then(syncSound).catch(syncSound)}}
});
addEventListener('pagehide',event=>{pageClosing=true;videoRecorder.dispose();if(previewURL)URL.revokeObjectURL(previewURL);stopCamera();sound.close();voices.close();if(!event.persisted)body?.dispose()});
addEventListener('pageshow',()=>{pageClosing=false});

$('nightView').onclick=()=>{const night=document.documentElement.dataset.view!=='night';document.documentElement.dataset.view=night?'night':'day';$('nightView').setAttribute('aria-pressed',String(night));body?.setNight(night)};

import "./language.mjs?v=export-v17";
