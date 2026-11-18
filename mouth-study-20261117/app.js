import {CameraTracking,drawSkeleton,interpretHands,recognizePhoto} from './tracking.mjs?v=alpha-v18';
import {selectSubject,autoCrop,projectSubject,frameworkCanvas,drawCameraGuide,drawLines,reliable} from './capture-guide.mjs?v=alpha-v18';
import {createBody,DEFAULT_LIP_TINT} from './body.mjs?v=shake-default-10-v1';
import {FleshSound} from './sound.mjs?v=alpha-v18';
import {createMouthProfile,selectMouth} from './mouth-profile.mjs';
import {ParticipantVoices} from './participant-voices.mjs?v=audio-import-v1';
import {waitForCameraFrame} from './camera-preview.mjs?v=alpha-v18';
import {SculptureRecorder,saveVideo,downloadBlob} from './video-recorder.mjs?v=motion-pr-v1';
import {DEFAULT_MOUTH_EXPRESSION} from './mouth-expression.mjs?v=expression-light-v1';
import {VoiceRhythm} from './voice-rhythm.mjs?v=voice-rhythm-v1';
import {finalizePremiere} from './premiere-export.mjs?v=motion-pr-v1';
const $=id=>document.getElementById(id);
const sound=new FleshSound(),voices=new ParticipantVoices(),participants=new Map();
const voiceRhythm=new VoiceRhythm();
const mouthId='mouth';
let audioIntent='auto',fusionPhase='',pageClosing=false,audioImportError='';
sound.preload().catch(()=>{});
let statusTimer,body,facing='user',source=null,photo=null,cropDrag=null;
let cropState={zoom:1,x:0,y:0},photoRequest=0,captureBusy=false,recognitionCompleted=false,sourceSubject=null;
let mouthDraft=null,mouthMode=false;
let photoController=null,photoPending=false,photoTarget='face',photoOrigin='camera';
let cameraRequest=0,previewController=null,cameraPreviewReady=false;const dialogRuns=new WeakMap();
function report(message,sticky=false){clearTimeout(statusTimer);$('status').textContent=message;if(!sticky)statusTimer=setTimeout(()=>$('status').textContent='',4500)}
function syncSound(){const own=voices.hasVoices;const enabled=own?voices.enabled&&voices.context?.state==='running':sound.enabled&&sound.context?.state==='running'&&!sound.loading;const audible=enabled&&!voices.tracks.get(mouthId)?.muted&&!body?.paused&&!voices.capture&&!$('videoPreview').open;$('sound').setAttribute('aria-pressed',String(voices.tracks.get(mouthId)?.fileName?audible:enabled));$('sound').dataset.sound=audible?'on':'off';$('sound').textContent=voices.tracks.get(mouthId)?.fileName?(audible?'暂停音频':'播放音频'):sound.loading?'正在载入人声…':enabled?(body?.paused?'人声已暂停':'关闭人声'):'开启人声'}
sound.onchange=syncSound;
async function startVoice(){
 if(audioIntent==='muted'||sound.loading)return;
 try{if(voices.hasVoices){voices.setEnabled(true);await voices.unlock()}else await sound.enable();syncSound()}catch(e){syncSound();report(e.message||'人声未能载入，请重试。')}
}
// The first intentional model interaction unlocks audio; an explicit mute persists.
document.addEventListener('pointerdown',e=>{if(e.target.closest('#stage canvas,[data-state],#press,#join,#replayFusion')&&audioIntent!=='muted')startVoice()},true);

body=createBody($('stage'),()=>report('轻触它，看它回应。'),message=>report(message,true));
const videoRecorder=new SculptureRecorder(body?.canvas,()=>[sound.getOutputStream(),voices.getOutputStream()],(...args)=>body.copyTransparentFrame(...args));
let previewURL=null,previewBlob=null,premiereBlob=null,previewExportFormat='webm',conversionController=null,conversionBusy=false;
function syncMotionControls(){
 const enabled=$('rotationToggle').getAttribute('aria-pressed')==='true';
 $('rotationToggle').textContent=enabled?'暂停逆时针旋转':'开启逆时针旋转';
 const speed=Number($('rotationSpeed').value);
 $('rotationSpeedValue').textContent=speed+'°/s';$('rotationSpeedLive').value=String(speed);$('rotationSpeedLiveValue').textContent=speed+'°/s';
 $('shakeStrengthValue').textContent=Math.round(Number($('shakeStrength').value)*100)+'%';
 body?.setMotion({enabled,speed,irregular:$('rotationIrregular').checked,shakeEnabled:$('speechShake').checked,strength:Number($('shakeStrength').value)});
}
$('rotationToggle').onclick=()=>{$('rotationToggle').setAttribute('aria-pressed',String($('rotationToggle').getAttribute('aria-pressed')!=='true'));syncMotionControls()};
for(const id of ['rotationSpeed','rotationIrregular','speechShake','shakeStrength'])$(id).oninput=syncMotionControls;
$('rotationSpeedLive').oninput=()=>{$('rotationSpeed').value=$('rotationSpeedLive').value;syncMotionControls()};
syncMotionControls();
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
function updateSplit(){const split=!mouthMode&&(tracker.active||!!photo);body?.setSplit(split);$('poseStage').hidden=!split;if(!tracker.active){latestPose=null;$('poseEmpty').hidden=false;$('poseEmpty').textContent='开启摄像头，查看实时骨架'}}
body?.onTick(s=>{const own=voices.hasVoices||!!voices.capture;
 const paused=s.paused||$('videoPreview').open;
 sound.update({...s,paused:paused||own});
 const levels=voices.update({...s,paused}),originalMouth=sound.sampleMouth(paused||own);
 body.reactToVoice($('bodyVoiceEnabled').checked?(own?voices.sampleMotion(paused):sound.sampleMotion(paused)):{high:0,low:0});
 // The original artwork speaks through the captured lips until personal voices exist.
 // A personal recording replaces the original voice as the mouth driver.
 if(!own)for(const id of participants.keys())levels.set(id,originalMouth);
 body.setMouthLevel(levels.get(mouthId));updateParticipantActivity(levels);updateAudioProgress(levels.get(mouthId)||0);
 const track=voices.tracks.get(mouthId),voiceActive=!paused&&!document.hidden&&$('bodyVoiceEnabled').checked&&(voices.capture?.state==='recording'||(own?voices.enabled&&!track?.muted&&voices.context?.state==='running':sound.enabled&&sound.context?.state==='running'));
 const articulation=voiceRhythm.update(own?(levels.get(mouthId)||0):originalMouth,s.dt,voiceActive);
 body.reactToSpeech(articulation);
 const turnText=s.turnDegrees.toFixed(1)+'°/s';if($('rotationActual').textContent!==turnText)$('rotationActual').textContent=turnText;
 $('speechPace').value=articulation.pace;
 if(photo){const phase=s.fusing?(s.fusionProgress<.32?'forming':'joining'):'fused';if(phase!==fusionPhase){fusionPhase=phase;$('sourceNote').textContent=(mouthMode?{forming:'嘴唇正在浮现',joining:'同一种皮肤 · 共享一次呼吸',fused:'嘴唇成为形体的一部分'}:{forming:'照片正在形成另一半',joining:'两半正在靠拢 · 共享一次呼吸',fused:'左 · AI 肉体　／　右 · 你的身体'})[phase]}}
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
 if(dialogRuns.get(dialog)!==run)return;dialog.close();if(dialog.id==='videoPreview')syncSound();
}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeDialog($(b.dataset.close)));
document.querySelectorAll('dialog').forEach(d=>{
 d.addEventListener('cancel',e=>{e.preventDefault();closeDialog(d)});
 d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(d)});
});
$('aboutOpen').onclick=()=>openDialog($('about'));
$('sound').onclick=()=>{
 const imported=voices.tracks.get(mouthId);
 if(imported?.fileName){
  const playing=voices.enabled&&voices.context?.state==='running'&&!body?.paused&&!imported.muted;
  if(playing){audioIntent='muted';voices.setEnabled(false)}
  else{audioIntent='on';voices.setMuted(mouthId,false);body?.setPaused(false);voices.setEnabled(true);startVoice()}
  syncPause();return;
 }
 const running=voices.hasVoices?voices.enabled&&voices.context?.state==='running':sound.enabled&&sound.context?.state==='running';
 if(running||sound.loading){audioIntent='muted';sound.off();voices.setEnabled(false);syncSound();return}
 audioIntent='on';voices.setEnabled(true);startVoice();
};
function audioTime(seconds){const value=Math.floor(seconds||0);return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`}
function syncAudioImport(){
 const t=voices.tracks.get(mouthId),imported=!!t?.fileName;
 $('importAudio').disabled=!!voices.capture||!!t?.loading;
 $('importAudio').textContent=t?.loading?'正在读取声音…':imported?'更换声音':'导入声音';
 $('audioImport').setAttribute('aria-busy',String(!!t?.loading));
 $('audioDetails').hidden=!imported;
 $('audioFileName').textContent=t?.fileName||'';
 $('restartAudio').disabled=!imported||!!voices.capture||!!t?.loading;
 $('clearAudio').hidden=!imported&&!t?.loading;
 $('audioImportStatus').textContent=audioImportError||(t?.loading?'正在分析声音与停顿…':imported?(participants.has(mouthId)?'嘴巴正跟随声音强弱和停顿开合。音频循环播放。':'声音已导入。拍照或选择照片生成嘴部后，会自动跟随。'):'导入 MP3、WAV 或 M4A，让嘴巴跟随声音开合。');
 updateAudioProgress(t?.level||0);
}
function updateAudioProgress(level){
 const t=voices.tracks.get(mouthId);if(!t?.fileName)return;
 const position=voices.position(mouthId),duration=t.buffer.duration,text=`${audioTime(position)} / ${audioTime(duration)}`;
 if($('audioTime').textContent!==text)$('audioTime').textContent=text;
 $('audioProgress').value=position/duration;
 $('audioLevel').value=level;
}
// Unlock on the button gesture as well as on selection for mobile browsers.
$('importAudio').onclick=()=>{try{voices.unlock().catch(()=>{})}catch{}$('audioFile').click()};
$('audioFile').onchange=async e=>{
 const file=e.target.files?.[0];e.target.value='';if(!file)return;
 audioImportError='';voices.add(mouthId);
 try{
  const loaded=await voices.importAudio(mouthId,file);if(!loaded||pageClosing)return;
  audioIntent='on';sound.off();voices.setEnabled(true);body?.setPaused(false);syncPause();await startVoice();
 }catch(error){audioImportError=error.message||'无法读取这个声音文件，请尝试 MP3、WAV 或 M4A。'}
 syncAudioImport();syncSound();
};
$('restartAudio').onclick=()=>{voices.restart(mouthId);voices.setMuted(mouthId,false);audioIntent='on';body?.setPaused(false);syncPause();startVoice()};
$('clearAudio').onclick=()=>{audioImportError='';voices.clearAudio(mouthId);if(audioIntent!=='muted')startVoice()};
function stopCamera(){cameraRequest++;previewController?.abort();cameraPreviewReady=false;cancelPhotoRecognition();captureBusy=false;tracker.stop();$('camera').srcObject=null;$('shutter').disabled=true;$('flip').disabled=false}
function showCameraError(message){cameraPreviewReady=false;$('shutter').disabled=true;$('flip').disabled=false;$('cameraStatus').textContent=message;$('cameraStatus').hidden=false;$('cameraRetry').hidden=false}
async function startCamera(){
 const request=++cameraRequest;previewController?.abort();const controller=previewController=new AbortController();cameraPreviewReady=false;
 $('shutter').disabled=true;$('flip').disabled=true;$('cameraRetry').hidden=true;captureBusy=false;
 drawCameraGuide($('cameraGuide'),null,0,0,false);$('captureHint').textContent='让脸正对镜头，露出完整嘴唇';$('cameraStatus').textContent='正在开启摄像头…';$('cameraStatus').hidden=false;
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
$('takePhoto').onclick=()=>{cancelPhotoRecognition();captureBusy=false;keepTracking=tracker.active||tracker.starting;openDialog($('cameraDialog'));startCamera()};
$('flip').onclick=()=>{facing=facing==='user'?'environment':'user';startCamera()};
$('cameraRetry').onclick=()=>{stopCamera();startCamera()};
const targetLabels={mouth:'已识别嘴部',hand:'已识别手部',body:'已识别身体姿态'};
function captureSubject(result,target){
 if(target==='face')return selectMouth(result);
 const subject=selectSubject(result,target);return subject?.kind==='face'?selectMouth(result):subject;
}
function updateCameraGuide(result=latestPose){
 const subject=captureSubject(result,$('captureTarget').value),v=$('camera');
 drawCameraGuide($('cameraGuide'),subject,v.videoWidth,v.videoHeight,facing==='user');
 $('captureHint').textContent=subject?targetLabels[subject.kind]:'让脸正对镜头，露出完整嘴唇';
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
 const file=e.target.files[0];e.target.value='';if(!file)return;
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
 source=canvas;photoOrigin=origin;photoTarget=target;recognitionCompleted=false;sourceSubject=null;mouthDraft=null;photoPending=true;
 beginCrop();
 // A frozen face is recognized as an IMAGE, independently of live pose/hand tracking.
 let result=null;try{result=await recognizePhoto(canvas,{target,signal:controller.signal,timeout:30000})}catch{}
 if(request!==photoRequest||controller.signal.aborted||!$('cropDialog').open)return;
 photoPending=false;photoController=null;recognitionCompleted=!!result;sourceSubject=captureSubject(result,target);
 try{mouthDraft=createMouthProfile(sourceSubject,source.width,source.height)}catch{mouthDraft=null}
 beginCrop();
}
$('retryRecognition').onclick=()=>{if(source&&!photoPending)processPhoto(source,photoOrigin,photoTarget)};
$('retake').onclick=async()=>{if(photoOrigin==='file'){closeDialog($('cropDialog'));$('file').click();return}await closeDialog($('cropDialog'));$('takePhoto').click()};
function syncCropStatus(){
 const mouth=sourceSubject?.kind==='mouth'||photoTarget==='face';
 $('cropDialog').setAttribute('aria-busy',String(photoPending));
 $('recognitionNote').textContent=photoPending?'正在识别照片，请稍候…':!body?'3D 暂不可用，请刷新后重试。':mouth?(mouthDraft?'已提取嘴唇轮廓':!recognitionCompleted?'识别暂未完成，可以重新识别或重拍。':'没有识别到完整嘴唇，请正对镜头并调整光线后重拍。'):(sourceSubject?targetLabels[sourceSubject.kind]:'未识别到清晰结构，可手动选择范围。');
 $('join').disabled=photoPending||!body||(mouth&&!mouthDraft);
 $('join').textContent=photoPending?'识别中…':mouth?(participants.size?'替换嘴部':'生成大嘴'):'生成另一半并融合';
 $('retryRecognition').hidden=photoPending||!mouth||!!mouthDraft;
 $('retake').textContent=photoOrigin==='camera'?'重拍':'换一张照片';
}
function beginCrop(){
 const mouth=sourceSubject?.kind==='mouth'||photoTarget==='face';
 cropState=autoCrop(sourceSubject,source.width,source.height);$('zoom').value=cropState.zoom;$('zoomValue').textContent=cropState.zoom.toFixed(1)+'×';
 $('cropTitle').textContent=mouth?'确认嘴部':'保留哪一部分？';
 $('cropCopy').textContent=mouth?'只取嘴唇轮廓。确认后可给它录音。':'选择你想保留的画面。它会形成另一半，再与原有肉体慢慢融合。';
 syncCropStatus();
 $('zoom').hidden=mouth;$('zoomLabel').hidden=mouth;$('crop').style.cursor=mouth?'default':'move';$('crop').tabIndex=mouth?-1:0;
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
$('crop').onpointerdown=e=>{if(mouthDraft||$('captureTarget').value==='face')return;cropDrag={id:e.pointerId,x:e.clientX,y:e.clientY};$('crop').setPointerCapture(e.pointerId)};
$('crop').onpointermove=e=>{if(!cropDrag||cropDrag.id!==e.pointerId)return;const scale=$('crop').width/$('crop').clientWidth;cropState.x+=(e.clientX-cropDrag.x)*scale;cropState.y+=(e.clientY-cropDrag.y)*scale;cropDrag.x=e.clientX;cropDrag.y=e.clientY;drawCrop()};
$('crop').onpointerup=$('crop').onpointercancel=()=>{cropDrag=null};
$('crop').onkeydown=e=>{if(mouthDraft||$('captureTarget').value==='face')return;const direction={ArrowLeft:[-15,0],ArrowRight:[15,0],ArrowUp:[0,-15],ArrowDown:[0,15]}[e.key];if(direction){e.preventDefault();cropState.x+=direction[0];cropState.y+=direction[1];drawCrop()}};
$('join').onclick=()=>{
 if(!source||!body||photoPending||((photoTarget==='face'||sourceSubject?.kind==='mouth')&&!mouthDraft))return;
 if(!mouthDraft&&participants.size){report('先移除大嘴，再添加身体照片。');return}
 mouthMode=!!mouthDraft;
 if(mouthMode){
  const id=mouthId;body.setMouth(mouthDraft);
  participants.set(id,{id});voices.add(id);photo=true;body.setFramework(false);renderParticipants();
  source=null;recognitionCompleted=false;sourceSubject=null;mouthDraft=null;
  $('crop').getContext('2d').clearRect(0,0,768,768);$('cropGuide').getContext('2d').clearRect(0,0,768,768);
  $('photoInfo').hidden=true;$('photoMaterialNote').hidden=true;
  report('大嘴已生成。点击录音，让它跟着你的声音动。');
 }else{
  photo=document.createElement('canvas');photo.width=photo.height=768;photo.getContext('2d').drawImage($('crop'),0,0);
  const projected=projectSubject(sourceSubject,source.width,source.height,cropState);const found=projected?.edges.some(([a,b])=>reliable(projected.points[a])&&reliable(projected.points[b]));const frame=found?frameworkCanvas(projected):null;
  $('showFramework').disabled=!found;$('showFramework').checked=!!found;body.setFramework(!!found);body.setPhoto(photo,frame);
  $('showFramework').closest('label').hidden=false;$('originTitle').textContent='真实照片';$('originDetail').textContent='保留衣服与遮挡';$('recrop').textContent='调整照片';$('erase').textContent='清除照片';
  $('thumb').src=photo.toDataURL('image/jpeg',.7);$('photoInfo').hidden=false;$('photoMaterialNote').hidden=false;report('正在融合。');
 }
 fusionPhase='';$('takePhoto').textContent='拍照';syncPause();if(audioIntent!=='muted')startVoice();updateSplit();closeDialog($('cropDialog'));
};
function renderParticipants(){
 $('participants').hidden=!participants.size;
 const list=$('participantList');list.replaceChildren();
 for(const [id,participant] of participants){
  const row=document.createElement('div');row.className='participant-row';row.dataset.participant=id;
  const focus=document.createElement('button');focus.className='participant-focus';focus.textContent='01';focus.setAttribute('aria-label','转向嘴部');focus.onclick=()=>{body.gesture(null);$('gestureEnabled').checked=false;body.focusMouth()};
  const record=document.createElement('button');record.dataset.action='record';record.textContent='录音';record.onclick=async()=>{
   if(voices.recording===id){voices.stopRecording();return}
   body.setPaused(false);syncPause();body.focusMouth();$('gestureEnabled').checked=false;body.gesture(null);sound.sleep();
   try{await voices.startRecording(id)}catch(e){report(e.message)}
  };
  const mute=document.createElement('button');mute.dataset.action='mute';mute.textContent='静音';mute.onclick=()=>{const t=voices.tracks.get(id);voices.setMuted(id,!t.muted);if(!t.muted&&audioIntent!=='muted')startVoice()};
  const remove=document.createElement('button');remove.dataset.action='remove';remove.textContent='×';remove.setAttribute('aria-label','移除嘴部');remove.onclick=()=>{
   participants.delete(id);voices.remove(id);body.clearPhoto();mouthMode=!!participants.size;photo=mouthMode;renderParticipants();updateSplit();syncSound();
  };
  row.append(focus,record,mute,remove);list.append(row);participant.row=row;
 }
 $('captureTarget').disabled=participants.size>0;if(participants.size)$('captureTarget').value='face';syncParticipants();
}
function syncParticipants(){
 for(const [id,p] of participants){const t=voices.tracks.get(id),active=voices.capture?.id===id,state=voices.capture?.state;
  const record=p.row.querySelector('[data-action=record]');record.disabled=!!t?.loading||!!voices.capture&&!active||active&&state==='processing';record.textContent=active?(state==='permission'?'取消':state==='processing'?'处理中…':'结束'):t?.buffer?'重录':'录音';
  const mute=p.row.querySelector('[data-action=mute]');mute.disabled=!t?.buffer||!!voices.capture;mute.textContent=t?.muted?'播放':'静音';mute.setAttribute('aria-pressed',String(!!t?.buffer&&!t.muted));
 }
 const state=voices.capture?.state;$('recordingStatus').textContent=state==='permission'?'等待麦克风权限…':state==='processing'?'正在处理录音…':state==='recording'?'正在录音，最长 20 秒。':'';syncSound();syncAudioImport();
}
function updateParticipantActivity(levels){for(const [id,p] of participants)p.row.style.setProperty('--voice',String(levels.get(id)||0))}
voices.onchange=()=>{syncParticipants();if(!pageClosing&&!document.hidden&&!voices.capture&&!voices.hasVoices&&participants.size&&audioIntent!=='muted')startVoice()};voices.onerror=message=>report(message);
$('replayFusion').onclick=()=>{body?.replayFusion();fusionPhase='';syncPause();if(audioIntent!=='muted'&&!sound.enabled)startVoice()};
$('recrop').onclick=()=>{if(source)beginCrop()};
$('erase').onclick=()=>{
 photoRequest++;photo=null;source=null;recognitionCompleted=false;sourceSubject=null;mouthDraft=null;mouthMode=false;$('cropGuide').getContext('2d').clearRect(0,0,768,768);body?.clearPhoto();$('thumb').removeAttribute('src');$('photoInfo').hidden=true;
 $('sourceNote').textContent='AI 材质预览 · 拍照后加入你的身体';$('takePhoto').textContent='拍照';
 fusionPhase='';$('photoMaterialNote').hidden=true;$('crop').getContext('2d').clearRect(0,0,768,768);updateSplit();report('照片已清除。');
};
document.querySelectorAll('[data-state]').forEach(b=>b.onclick=()=>{
 $('gestureEnabled').checked=false;body?.gesture(null);body?.setState(b.dataset.state);document.querySelectorAll('[data-state]').forEach(x=>{x.setAttribute('aria-pressed',String(x===b));x.classList.toggle('selected',x===b)});
 if(body?.paused){body.setPaused(false);syncPause()}
});
function syncPause(){$('pause').setAttribute('aria-pressed',String(!!body?.paused));$('pause').textContent=body?.paused?'继续蠕动':'暂停蠕动';syncSound()}
for(const [id,key] of [['motion','movement'],['moisture','wet'],['volume','size'],['normalIntensity','relief'],['bruiseIntensity','bruise'],['sweatIntensity','sweat'],['lipTint','lipTint'],['mouthExpression','mouthExpression'],['lightingContrast','lightingContrast']]){
 $(id).oninput=e=>{if(id==='volume'){$('gestureEnabled').checked=false;latestGesture=null;body?.gesture(null)}const value=+e.target.value;body?.set(key,value);$(id+'Value').textContent=Math.round(value*100)+'%'};
}
$('press').onclick=()=>{body?.press();report('一次触碰，沿着表面传开。')};
$('pause').onclick=()=>{if(!body?.paused&&voices.capture)voices.stopRecording();body?.setPaused(!body.paused);syncPause()};
$('restore').onclick=()=>{
 $('gestureEnabled').checked=false;body?.reset();syncPause();
 $('rotationSpeed').value=5;$('shakeStrength').value=.1;syncMotionControls();
 for(const [id,val] of [['motion',.45],['moisture',.65],['volume',1],['normalIntensity',2.5],['bruiseIntensity',1],['sweatIntensity',1],['lipTint',DEFAULT_LIP_TINT],['mouthExpression',DEFAULT_MOUTH_EXPRESSION],['lightingContrast',1]]){$(id).value=val;$(id+'Value').textContent=Math.round(val*100)+'%'}
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
 $('recordingBackground').disabled=active||processing||starting;
 $('recordingCodec').disabled=active||processing||starting;
 $('recordVideo').textContent=processing?(videoRecorder.transparent?'正在生成透明视频…':'正在生成 MP4…'):starting?'正在准备录制…':'录制视频';
 $('recordingToolbar').hidden=!active;
 $('videoPause').textContent=videoRecorder.state==='paused'?'继续录制':'暂停录制';
 $('videoPause').setAttribute('aria-pressed',String(videoRecorder.state==='paused'));
 const secs=Math.floor(videoRecorder.seconds),clock=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
 if($('videoTime').textContent!==clock)$('videoTime').textContent=clock;
 $('videoState').textContent=videoRecorder.state==='paused'?'录制已暂停':'录制中';
 if(videoRecorder.state==='ready'&&videoRecorder.blob!==previewBlob){
  previewBlob=videoRecorder.blob;premiereBlob=null;$('videoConversionStatus').textContent='';if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(previewBlob);
  const transparent=previewBlob.type.startsWith('video/webm');
  $('recordedVideo').dataset.transparent=String(transparent);$('videoSave').textContent=transparent?(previewExportFormat==='premiere'?'保存 PR 透明 MOV':'保存透明 WebM'):'保存 MP4';
  $('videoFormatHint').textContent=transparent?(previewExportFormat==='premiere'?'导出为 ProRes 4444 MOV，保留透明背景和声音，可导入 Premiere Pro。':'棋盘格仅用于预览，导出的视频为透明背景。'):'MP4 · 保留场景背景';
  $('recordedVideo').src=previewURL;openDialog($('videoPreview'));syncSound();
 }
}
function syncRecordingFormat(){const transparent=$('recordingBackground').value==='transparent';$('recordingCodecLabel').hidden=!transparent;$('recordingCodec').hidden=!transparent;$('recordingFormat').textContent=transparent?($('recordingCodec').value==='premiere'?'MOV · ProRes 4444 · PR 透明剪辑':'WebM · 保留透明通道'):'MP4 · 保留场景背景'}
$('recordingBackground').onchange=syncRecordingFormat;$('recordingCodec').onchange=syncRecordingFormat;
videoRecorder.onchange=syncVideo;
videoRecorder.onerror=e=>report(e.message||'录制失败，请重试。',true);
$('recordVideo').onclick=async()=>{
 try{if(conversionBusy)throw Error('请等待 MOV 转换完成。');previewExportFormat=$('recordingCodec').value;if(audioIntent!=='muted')startVoice();await videoRecorder.start({transparent:$('recordingBackground').value==='transparent'})}catch(e){report(e.message||'录制失败，请重试。',true)}
};
$('videoPause').onclick=()=>{if(videoRecorder.state==='paused')videoRecorder.resume().catch(e=>report(e.message));else videoRecorder.pause()};
$('videoFinish').onclick=()=>videoRecorder.finish()?.catch(()=>{});
$('videoSave').onclick=async()=>{
 if(!previewBlob)return;
 $('videoSave').disabled=true;
 const transparent=previewBlob.type.startsWith('video/webm');
 const premiere=transparent&&previewExportFormat==='premiere';
 try{
  if(premiere&&!premiereBlob){
   conversionBusy=true;conversionController=new AbortController();$('videoSave').textContent='正在转换为 PR 透明 MOV…';$('videoConversionStatus').textContent='正在本机转换，请保留此页面。透明背景和声音会一起保存。';$('cancelConversion').hidden=false;
   premiereBlob=await finalizePremiere(previewBlob,{signal:conversionController.signal});
   conversionBusy=false;$('cancelConversion').hidden=true;$('videoSave').disabled=false;$('videoSave').textContent='保存 PR 透明 MOV';$('videoConversionStatus').textContent='MOV 已准备好，请再次点击保存。';return;
  }
  const result=await saveVideo(premiere?premiereBlob:previewBlob,'Between-Bodies-'+new Date().toISOString().replace(/[:.]/g,'-')+(premiere?'-ProRes4444.mov':transparent?'.webm':'.mp4'));
  if(result==='saved'||result==='downloaded')report(premiere?'PR 透明 MOV 已保存。':transparent?'透明视频已保存。':'MP4 已保存。');
 }catch(error){$('videoConversionStatus').textContent=error.name==='AbortError'?'转换已取消，可以重试。':error.message||'保存失败，请再次点击保存。'}
 finally{conversionBusy=false;conversionController=null;$('cancelConversion').hidden=true;$('videoSave').disabled=false;$('videoSave').textContent=premiere?'保存 PR 透明 MOV':transparent?'保存透明 WebM':'保存 MP4'}
};
$('cancelConversion').onclick=()=>conversionController?.abort();
syncRecordingFormat();
$('fullscreen').onclick=async()=>{try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen()}catch{report('这个浏览器暂不支持全屏。')}};
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){videoRecorder.pause();stopCamera();if($('cameraDialog').open)showCameraError('镜头已暂停，返回页面后会重新开启。');sound.sleep();voices.sleep()}
 else {if($('cameraDialog').open)startCamera();if(audioIntent!=='muted'){if(voices.hasVoices)voices.unlock().then(syncSound).catch(syncSound);else if(sound.enabled)sound.context?.resume().then(syncSound).catch(syncSound)}}
});
addEventListener('pagehide',event=>{pageClosing=true;conversionController?.abort();videoRecorder.dispose();if(previewURL)URL.revokeObjectURL(previewURL);stopCamera();sound.close();voices.close();if(!event.persisted)body?.dispose()});
addEventListener('pageshow',()=>{pageClosing=false});

$('nightView').onclick=()=>{const night=document.documentElement.dataset.view!=='night';document.documentElement.dataset.view=night?'night':'day';$('nightView').setAttribute('aria-pressed',String(night));body?.setNight(night)};

syncAudioImport();
import "./language.mjs?v=softbox-touch-v1";

