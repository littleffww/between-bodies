/** Record the rendered scene locally, without camera, microphone or uploads. */
export function installSceneRecorder({canvas,controls,getAudioStream} = {}) {
 if (!canvas || !controls) throw new TypeError('A canvas and its controls are required.');
 const MAX_DURATION=5*60*1000;
 const button=document.createElement('button');
 button.id='scene-record';
 button.type='button';
 button.textContent='录制视频';
 button.setAttribute('aria-pressed','false');
 button.title='录制当前场景，最长 5 分钟';
 const originalWrap=controls.style.flexWrap,originalJustify=controls.style.justifyContent;
 controls.style.flexWrap='wrap';
 controls.style.justifyContent='flex-end';
 controls.append(button);

 const panel=document.createElement('section');
 panel.id='scene-recording-panel';
 panel.setAttribute('aria-label','场景视频录制');
 panel.hidden=true;
 panel.style.cssText='width:min(310px,calc(100vw - 24px));padding:12px 14px;background:#182019f4;border:1px solid #f7f0d953;border-radius:3px;color:#fcf7e9';
 const row=document.createElement('div');
 row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px';
 const status=document.createElement('span');
 status.setAttribute('role','status');
 status.setAttribute('aria-live','polite');
 const timer=document.createElement('time');
 timer.textContent='00:00';
 timer.setAttribute('aria-label','录制时长');
 timer.style.cssText='font-variant-numeric:tabular-nums;white-space:nowrap';
 row.append(status,timer);
 const save=document.createElement('a');
 save.id='scene-video-save';
 save.hidden=true;
 save.style.cssText='display:inline-block;margin-top:10px;color:#e0e8b7;text-underline-offset:3px';
 // An explicit display rule must not override the native hidden state.
 save.style.display='';
 panel.append(row,save);
 controls.parentElement.insertBefore(panel,controls);

 let state='idle',active=null,outputURL=null,disposed=false,generation=0;
 const supported=typeof MediaRecorder!=='undefined' && typeof canvas.captureStream==='function';

 const show=(message) => {panel.hidden=false;status.textContent=message;};
 const setState=(next) => {
  state=next;
  button.disabled=next==='preparing'||next==='stopping';
  button.textContent=next==='recording'?'停止并导出':next==='preparing'?'正在准备…':next==='stopping'?'正在导出…':'录制视频';
  button.setAttribute('aria-pressed',String(next==='recording'));
  button.style.borderColor=next==='recording'?'#e69483':'';
 };
 const elapsed=(milliseconds) => {
  const seconds=Math.min(300,Math.floor(milliseconds/1000));
  timer.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
 };
 const revokeOutput=() => {
  if(outputURL) URL.revokeObjectURL(outputURL);
  outputURL=null;
  save.hidden=true;
  save.removeAttribute('href');
  save.removeAttribute('download');
 };
 const cleanupSession=session => {
  if(!session) return;
  clearInterval(session.clock);
  clearTimeout(session.limit);
  // Audio source tracks belong to the host. Only our cloned tracks are stopped.
  for(const track of session.ownedTracks) {
   try {track.stop();} catch {}
  }
  session.ownedTracks.length=0;
 };
 const formatFor=mime => /mp4/i.test(mime)?{label:'MP4',extension:'mp4'}:{label:'WebM',extension:'webm'};
 const filename=extension => {
  const date=new Date();
  const stamp=date.getFullYear()+String(date.getMonth()+1).padStart(2,'0')+String(date.getDate()).padStart(2,'0')+'-'+
   String(date.getHours()).padStart(2,'0')+String(date.getMinutes()).padStart(2,'0')+String(date.getSeconds()).padStart(2,'0');
  return 'Between-Bodies-'+stamp+'.'+extension;
 };

 function createRecorder(stream) {
  const pixels=Math.max(1,canvas.width*canvas.height);
  const videoBitsPerSecond=Math.round(Math.min(10000000,Math.max(3000000,pixels*30*.11)));
  const options={videoBitsPerSecond,audioBitsPerSecond:128000};
  const candidates=[
   'video/mp4',
   'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
   'video/mp4;codecs=avc1,mp4a.40.2',
   'video/webm;codecs=vp9,opus',
   'video/webm;codecs=vp8,opus',
   'video/webm'
  ];
  for(const mimeType of candidates) {
   if(MediaRecorder.isTypeSupported && !MediaRecorder.isTypeSupported(mimeType)) continue;
   try {return new MediaRecorder(stream,{...options,mimeType});} catch {}
  }
  return new MediaRecorder(stream,options);
 }

 function finish(session) {
  cleanupSession(session);
  if(active===session) active=null;
  if(disposed || session.generation!==generation) return;
  setState('idle');
  elapsed(performance.now()-session.started);
  if(session.error || !session.chunks.some(chunk=>chunk.size)) {
   show(session.error?'录制中断了，请重新录制。':'没有录到画面，请重新录制。');
   return;
  }
  const actualType=session.chunks.find(chunk=>chunk.type)?.type || session.recorder.mimeType || 'video/webm';
  const format=formatFor(actualType);
  const blob=new Blob(session.chunks,{type:actualType});
  session.chunks.length=0;
  revokeOutput();
  outputURL=URL.createObjectURL(blob);
  save.href=outputURL;
  save.download=filename(format.extension);
  save.textContent='保存 '+format.label+' 视频';
  save.hidden=false;
  show('视频已生成 · '+format.label);
  // The stop button is the user's export action. Keep the same link available
  // in case the browser asks them to click once more to save the download.
  save.click();
 }

 async function start() {
  if(disposed || state!=='idle') return;
  if(!supported) {
   show('当前浏览器无法录制，请用 Chrome 或 Edge 打开这个场景。');
   return;
  }
  const currentGeneration=++generation;
  setState('preparing');
  revokeOutput();
  timer.textContent='00:00';
  show('正在准备录制…');
  const session={generation:currentGeneration,ownedTracks:[],chunks:[],clock:null,limit:null,recorder:null,started:performance.now(),error:null};
  try {
   const picture=canvas.captureStream(30);
   const videoTracks=picture.getVideoTracks();
   if(!videoTracks.length) throw new Error('No video track.');
   session.ownedTracks.push(...picture.getTracks());
   const tracks=[...videoTracks];
   let noAudio=false;
   if(getAudioStream) {
    try {
     const audio=await getAudioStream();
     for(const track of audio?.getAudioTracks?.() || []) {
      if(track.readyState!=='live') continue;
      const copy=track.clone();
      session.ownedTracks.push(copy);
      tracks.push(copy);
     }
    } catch {noAudio=true;}
   }
   if(disposed || currentGeneration!==generation) {cleanupSession(session);return;}
   const stream=new MediaStream(tracks);
   const recorder=createRecorder(stream);
   session.recorder=recorder;
   active=session;
   recorder.ondataavailable=event=>{if(event.data?.size)session.chunks.push(event.data);};
   recorder.onerror=event=>{
    session.error=event.error || new Error('Recording stopped.');
    clearInterval(session.clock);clearTimeout(session.limit);
    if(recorder.state!=='inactive') {
     try {recorder.stop();} catch {finish(session);}
    }
   };
   recorder.onstop=()=>finish(session);
   recorder.start(1000);
   session.started=performance.now();
   setState('recording');
   const format=formatFor(recorder.mimeType);
   show('录制中 · '+format.label+(noAudio?' · 仅画面':''));
   session.clock=setInterval(()=>elapsed(performance.now()-session.started),250);
   session.limit=setTimeout(stop,MAX_DURATION);
  } catch {
   cleanupSession(session);
   if(active===session)active=null;
   if(disposed || currentGeneration!==generation) return;
   setState('idle');
   show('没有开始录制，请重试；也可以用 Chrome 或 Edge 打开。');
  }
 }

 function stop() {
  if(state!=='recording' || !active) return;
  setState('stopping');
  show('正在生成视频…');
  clearInterval(active.clock);clearTimeout(active.limit);
  if(active.recorder.state==='inactive') {finish(active);return;}
  try {active.recorder.stop();} catch {active.error=new Error('Cannot stop recorder.');finish(active);}
 }
 const onClick=()=>{if(state==='recording')stop();else if(state==='idle')void start();};
 button.addEventListener('click',onClick);
 if(!supported) {
  button.title='请用 Chrome 或 Edge 打开以录制视频';
 }

 function dispose() {
  if(disposed)return;
  disposed=true;generation++;
  const session=active;active=null;
  if(session?.recorder && session.recorder.state!=='inactive') {
   session.recorder.onstop=null;
   try {session.recorder.stop();} catch {}
  }
  cleanupSession(session);
  revokeOutput();
  button.removeEventListener('click',onClick);
  button.remove();panel.remove();
  controls.style.flexWrap=originalWrap;
  controls.style.justifyContent=originalJustify;
  window.removeEventListener('pagehide',dispose);
 }
 window.addEventListener('pagehide',dispose,{once:true});
 return {button,panel,start,stop,dispose,get state(){return state;}};
}
