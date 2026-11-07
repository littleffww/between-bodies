let pose,hands,face,faceEdges=[],lastTime=0,facePhoto=false;
self.onmessage=async({data})=>{
 if(data.type==='init'){
  try{
   const {FilesetResolver,PoseLandmarker,HandLandmarker,FaceLandmarker}=await import('./vendor/vision_bundle.mjs');
   const files=await FilesetResolver.forVisionTasks(new URL('./vendor/wasm',self.location.href).href);
   facePhoto=data.target==='face';
   if(!facePhoto){
   pose=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./vendor/pose_landmarker_lite.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.6,minPosePresenceConfidence:.6,minTrackingConfidence:.6,outputSegmentationMasks:false});
   hands=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./vendor/hand_landmarker.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.6});
   }
   face=await FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./vendor/face_landmarker.task',self.location.href).href,delegate:'CPU'},runningMode:facePhoto?'IMAGE':'VIDEO',numFaces:1,minFaceDetectionConfidence:.6,minFacePresenceConfidence:.6,minTrackingConfidence:.6,outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false});
   faceEdges=FaceLandmarker.FACE_LANDMARKS_CONTOURS.map(e=>[e.start,e.end]);
   self.postMessage({type:'ready'});
  }catch(e){self.postMessage({type:'error',message:e.message})}
 }else if(data.type==='frame'||data.type==='snapshot'){
  try{
   const time=lastTime=Math.max(lastTime+.1,data.time||performance.now());
   const p=facePhoto?{landmarks:[]}:pose.detectForVideo(data.image,time),h=facePhoto?{landmarks:[]}:hands.detectForVideo(data.image,time),f=facePhoto?face.detect(data.image):face.detectForVideo(data.image,time);
   self.postMessage({type:data.type==='snapshot'?'snapshotResult':'result',requestId:data.requestId,pose:p.landmarks[0]||[],hands:(h.landmarks||[]).map(points=>points.map(({x,y,z})=>({x,y,z}))),face:(f.faceLandmarks[0]||[]).map(({x,y,z})=>({x,y,z})),faceEdges,time});
  }catch(e){self.postMessage({type:data.type==='snapshot'?'snapshotError':'error',requestId:data.requestId,message:e.message})}
  finally{data.image.close()}
 }
};
