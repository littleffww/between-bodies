import * as T from './vendor/three.module.js';
import {MAX_PARTICIPANTS,FACE_ANGLES,FACE_TILE,makeFaceAtlas,writeFaceTile,clearFaceTile} from './face-layout.mjs?v=chorus-v12';

const vertexPrelude = `
uniform float bodyTime, breath, curl, stretch, shiver, movement, pressure, pressAge, halfSide, separation, audioHigh, audioLow;
uniform vec3 pressPoint;
uniform sampler2D faceRelief;
uniform float faceAmount;
uniform vec4 faceFrames[6],faceStates[6],mouthShapes[6];
varying vec3 skinPosition;
vec3 flesh(vec3 p) {
 float breathe = sin(bodyTime*1.45)*.5+.5;
 float wave = sin(p.x*3.4-bodyTime*1.6)*sin(p.y*2.6+bodyTime*.8);
 float mound = .10*sin(p.x*4.8+p.z*2.5)*sin(p.y*3.2+.4);
 vec3 q=p;
 q*=1.+mound;
 q.x*=2.0+stretch*.95-curl*.25;
 q.y*=.98-stretch*.2+curl*.45;
 q.z*=1.25+curl*.25-stretch*.12;
 float upper=smoothstep(-.7,.55,p.y);
 q.y+=upper*(breathe*.17*breath+wave*.10*movement);
 q.z+=upper*sin(p.x*4.-bodyTime*.9)*.09*movement;
 q.x+=curl*sin(p.y*2.+bodyTime*.6)*.17;
 q+=p*sin(bodyTime*16.+p.x*5.)*.025*shiver;
 float touch=exp(-dot(p-pressPoint,p-pressPoint)*7.);
 float ripple=sin(length(p-pressPoint)*13.-pressAge*7.)*exp(-pressAge*2.);
 q-=p*touch*pressure*.30;
 q+=p*ripple*pressure*.065;
 // High voices agitate the surface; low voices press a broad hollow inward.
 // This displacement is shared by both halves, hairs, normals and shadows.
 float mobileSurface=smoothstep(-.8,-.1,p.y);
 float agitation=sin(bodyTime*10.+p.x*5.+p.y*4.)*.105+sin(bodyTime*17.+p.z*6.)*.045;
 q+=p*agitation*audioHigh*mobileSurface;
 q.y+=upper*audioHigh*(.06+.065*sin(bodyTime*7.+p.x*3.));
 vec3 hollow=p-vec3(.05,.3,.88);
 float indentation=exp(-3.8*dot(hollow,hollow));
 q.z-=audioLow*indentation*.58;
 q.y-=audioLow*indentation*.14;
 // The captured face emerges inside the same skin, with a zero-slope boundary.
 for(int i=0;i<6;i++){
  if(faceStates[i].x<=0.)continue;
  vec4 frame=faceFrames[i];vec3 outward=vec3(frame.x,0.,frame.y),across=vec3(frame.y,0.,-frame.x);
  float front=dot(p,outward);vec2 uv=vec2(.5+dot(p,across)/frame.z,.5-p.y/frame.w);
  if(front<.3||uv.x<=0.||uv.x>=1.||uv.y<=0.||uv.y>=1.)continue;
  vec4 mouth=mouthShapes[i];vec2 delta=uv-mouth.xy;
  // Compact support ends at the lips: no voice-driven nose, cheek or jaw warp.
  vec2 lipRadius=vec2(max(.025,mouth.z*.58),max(.025,mouth.w*.67));
  float lipMask=1.-smoothstep(.65,1.,length(delta/lipRadius));
  float speaking=faceStates[i].y*lipMask;
  vec2 lookup=uv;lookup.y=mouth.y+delta.y/(1.+speaking*1.25);
  vec2 tile=vec2(float(i%3),floor(float(i)/3.));
  vec2 atlas=(tile+(clamp(lookup,0.,1.)*383.+.5)/384.)/vec2(3.,2.);
  vec2 sampleRG=texture2D(faceRelief,atlas).rg;
  float height=(sampleRG.r*256.+sampleRG.g)/257.*2.-1.;
  float opening=exp(-pow(delta.x/max(.025,mouth.z*.44),2.)-pow(delta.y/(.018+speaking*.035),2.));
  height-=speaking*.075*opening;
  float attached=smoothstep(.3,.65,front)*faceStates[i].x;
  q+=normalize(vec3(outward.x*.7,p.y*.12,outward.z))*height*attached;
  // Separate upper/lower lips visibly, with all movement inside the same lip mask.
  float lipSide=2.*smoothstep(-.009,.009,delta.y)-1.;
  q.y-=lipSide*speaking*min(.05,lipRadius.y*frame.w*.3)*attached;
 }
 q.y+=.94;
 q.x+=halfSide*separation;
 return q;
}
`;
export function createBody(host, onReady, onError) {
 let renderer;
 try { renderer = new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true}); }
 catch { onError('浏览器暂时无法显示 3D。请尝试使用 Safari 或 Chrome。'); return null; }
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
 renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.12;
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=T.PCFSoftShadowMap;
 host.append(renderer.domElement);
 const scene=new T.Scene();
 scene.background=new T.Color('#f4f3ef');
 scene.fog=new T.Fog('#f4f3ef',12,23);
 const camera=new T.PerspectiveCamera(31,1,.1,40);
 const group=new T.Group();
 scene.add(group);
 const floor=new T.Mesh(new T.PlaneGeometry(45,45),new T.MeshStandardMaterial({color:'#e4e3df',roughness:.86}));
 floor.rotation.x=-Math.PI/2;floor.position.y=-.12;floor.receiveShadow=true;scene.add(floor);
 const ambient=new T.HemisphereLight('#f7e8db','#313a53',1.3);scene.add(ambient);
 const key=new T.DirectionalLight('#fff4e6',3.2);key.position.set(-3,7,5);key.castShadow=true;
 key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.5,far:17});key.shadow.normalBias=.025;key.shadow.radius=5;scene.add(key);
 const edge=new T.DirectionalLight('#9ebce8',2.3);edge.position.set(4,2,-2);scene.add(edge);
 const warm=new T.DirectionalLight('#e5b39f',.65);warm.position.set(-4,1,-1);scene.add(warm);
 const studio=new T.Scene();studio.background=new T.Color('#3b3b41');
 for(const [x,y,z,w,h,strength] of [[-3,4,4,3,5,3],[4,2,-1,2,5,2.5],[0,6,1,5,1,1.3]]){
  const card=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color('white').multiplyScalar(strength),side:T.DoubleSide}));
  card.position.set(x,y,z);card.lookAt(0,0,0);studio.add(card);
 }
 const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.05);
 scene.environment=environment.texture;pmrem.dispose();studio.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});
 const parameters={breath:1,curl:0,stretch:0,shiver:0,movement:.45,wet:.65,size:1,relief:1,bruise:3,sweat:1};
 const targets={...parameters};
 const voiceTarget={high:0,low:0};
 const uniforms={bodyTime:{value:0},breath:{value:1},curl:{value:0},stretch:{value:0},shiver:{value:0},movement:{value:.45},pressure:{value:0},pressAge:{value:99},pressPoint:{value:new T.Vector3(0,.2,1)},photo:{value:null},framework:{value:null},hasFramework:{value:0},frameAlpha:{value:0},hasPhoto:{value:0},joinAmount:{value:0},hairBend:{value:new T.Vector2()},skinBruise:{value:3},skinSweat:{value:1},halfSide:{value:0},separation:{value:0},skinTint:{value:new T.Color('#fff4ee')},audioHigh:{value:0},audioLow:{value:0}};
 const material=new T.MeshPhysicalMaterial({color:'#fff4ee',roughness:.35,metalness:0,clearcoat:.7,clearcoatRoughness:.2,sheen:.26,sheenColor:new T.Color('#b96a60'),sheenRoughness:.7});
 const emptyRelief=new T.DataTexture(new Uint8Array([128,0,0,255]),1,1,T.RGBAFormat);emptyRelief.needsUpdate=true;
 uniforms.faceRelief={value:emptyRelief};uniforms.faceAmount={value:0};
 let reliefTexture=null,faceMode=false;
 const faceMembers=new Map(),atlasData=makeFaceAtlas();
 uniforms.faceFrames={value:FACE_ANGLES.map(a=>new T.Vector4(Math.sin(a),Math.cos(a),1.05,1.75))};
 uniforms.faceStates={value:Array.from({length:MAX_PARTICIPANTS},()=>new T.Vector4())};
 uniforms.mouthShapes={value:Array.from({length:MAX_PARTICIPANTS},()=>new T.Vector4(.5,.65,.25,.04))};
 function clearFaces(){faceMembers.clear();atlasData.set(makeFaceAtlas());for(const state of uniforms.faceStates.value)state.set(0,0,0,0);faceMode=false;reliefTexture?.dispose();reliefTexture=null;uniforms.faceRelief.value=emptyRelief;uniforms.faceAmount.value=0}
 function deformShader(shader,normal) {
  Object.assign(shader.uniforms,uniforms);
  shader.fragmentShader='varying vec3 skinPosition; uniform float halfSide;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('void main() {',`void main() {
   if(halfSide>.5 && skinPosition.x<0.)discard;
   if(halfSide<-.5 && skinPosition.x>=0.)discard;
  `);
  shader.vertexShader=vertexPrelude+shader.vertexShader;
  if(normal) shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`
    vec3 nn=normalize(normal);
    vec3 tangent=normalize(cross(abs(nn.y)<.9?vec3(0,1,0):vec3(1,0,0),nn));
    vec3 bitangent=normalize(cross(nn,tangent));
    vec3 origin=flesh(position);
    vec3 objectNormal=normalize(cross(flesh(position+tangent*.003)-origin,flesh(position+bitangent*.003)-origin));
  `);
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','skinPosition=position; vec3 transformed=flesh(position);');
 }
 function skinShader(shader){
  deformShader(shader,true);
  shader.fragmentShader='uniform sampler2D photo, framework; uniform vec3 skinTint; uniform float hasPhoto, joinAmount, skinBruise, skinSweat, hasFramework, frameAlpha;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   vec2 skinUV=skinPosition.xy*.5+.5;
   vec4 ai=texture2D(map,skinUV);
   // Separate broad pigment from fine skin detail; 1 preserves the source exactly.
   vec3 broad=textureLod(map,skinUV,5.).rgb;
   float coolPatch=smoothstep(.37,.70,broad.b/max(broad.r,.001));
   vec3 warmDetail=vec3(.68,.36,.25)*ai.rgb/max(broad,vec3(.001));
   vec3 neutral=mix(ai.rgb,warmDetail,coolPatch);
   ai.rgb=clamp(ai.rgb+(skinBruise-1.)*(ai.rgb-neutral),.015,1.);
   ai.rgb=mix(ai.rgb,vec3(dot(ai.rgb,vec3(.21,.72,.07))),.16);
   float mottling=sin(skinPosition.x*6.+skinPosition.z*2.)*sin(skinPosition.y*6.-skinPosition.z*3.);
   ai.rgb*=mix(vec3(.99,.97,.98),vec3(1.01,.95,.94),mottling*.5+.5);
   ai.rgb*=skinTint;
   vec2 photoUV=vec2(clamp(skinPosition.x,0.,1.),skinUV.y);
   vec4 own=texture2D(photo,photoUV);
   vec4 structure=texture2D(framework,photoUV);
   own.rgb=mix(own.rgb,structure.rgb,structure.a*hasFramework*frameAlpha);
   float edge=.025*sin(skinPosition.y*12.);
   float mask=hasPhoto*joinAmount*smoothstep(-.055,.055,skinPosition.x-edge);
   diffuseColor*=mix(ai,own,mask);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
   #include <roughnessmap_fragment>
   float sweatPatch=smoothstep(-.25,.65,sin(skinPosition.x*4.1+skinPosition.y*2.8)*cos(skinPosition.y*5.3-skinPosition.z*2.));
   roughnessFactor=mix(clamp(roughnessFactor*(1.-skinSweat*.247*sweatPatch),.22,1.),.72,mask);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
   #include <normal_fragment_maps>
   normal=normalize(mix(normal,nonPerturbedNormal,mask));
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <clearcoat_normal_fragment_maps>',`
   #include <clearcoat_normal_fragment_maps>
   #ifdef USE_CLEARCOAT
   clearcoatNormal=normalize(mix(clearcoatNormal,nonPerturbedNormal,mask));
   #endif
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>',`
   #include <lights_physical_fragment>
   #ifdef USE_CLEARCOAT
   material.clearcoat*=1.-mask;
   #endif
  `);
 };
 material.onBeforeCompile=skinShader;
 const geometry=new T.SphereGeometry(1,matchMedia('(pointer:coarse)').matches?192:256,matchMedia('(pointer:coarse)').matches?128:192);
 const body=new T.Mesh(geometry,material);body.castShadow=true;group.add(body);
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});depth.onBeforeCompile=s=>deformShader(s,false);body.customDepthMaterial=depth;
 const photoSide={value:1};
 const photoMaterial=material.clone();photoMaterial.onBeforeCompile=shader=>{skinShader(shader);shader.uniforms.halfSide=photoSide};
 const photoHalf=new T.Mesh(geometry,photoMaterial);photoHalf.visible=false;photoHalf.castShadow=true;group.add(photoHalf);
 const photoDepth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});photoDepth.onBeforeCompile=shader=>{deformShader(shader,false);shader.uniforms.halfSide=photoSide};photoHalf.customDepthMaterial=photoDepth;

 // Separate color, tangent-space microrelief and roughness. Material data stays linear.
 const loading=new T.TextureLoader();
 const surfaceMaps=[];
 let loadedMaps=0;
 function ready(){if(++loadedMaps===3)onReady()}
 function loadSurfaceMap(path){
  const texture=loading.load(path,ready,undefined,()=>onError('皮肤材质未能载入，请刷新重试。'));
  texture.colorSpace=T.NoColorSpace;
  texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.repeat.set(2,1);
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  surfaceMaps.push(texture);return texture;
 }
 const smallGPU=renderer.capabilities.maxTextureSize<4096 || (matchMedia('(pointer:coarse)').matches && Math.min(innerWidth,innerHeight)<700) || (navigator.deviceMemory && navigator.deviceMemory<4);
 const detailTier=smallGPU?'2k-mobile':'4k';
 material.normalMap=loadSurfaceMap(`assets/skin-normal-${detailTier}.webp?v=soft-v4`);
 material.normalMapType=T.TangentSpaceNormalMap;
 material.normalScale.setScalar(.89*3);
 material.roughnessMap=loadSurfaceMap(`assets/skin-roughness-${detailTier}.webp?v=soft-v4`);
 // The thin moisture film follows the same pores with softer relief.
 material.clearcoatNormalMap=material.normalMap;
 material.clearcoatNormalScale.setScalar(.17*3);
 const skin=loading.load('assets/ai-skin-mottled-v6.png',texture=>{
  texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  material.map=texture;material.needsUpdate=true;photoMaterial.map=texture;photoMaterial.needsUpdate=true;
  if(!photoTexture)uniforms.photo.value=texture;ready();
 },undefined,()=>onError('皮肤材质未能载入，请刷新重试。'));
 material.map=skin;uniforms.photo.value=skin;uniforms.framework.value=skin;
 photoMaterial.map=skin;photoMaterial.normalMap=material.normalMap;photoMaterial.normalMapType=material.normalMapType;photoMaterial.roughnessMap=material.roughnessMap;photoMaterial.clearcoatNormalMap=material.clearcoatNormalMap;

 let frameTexture=null,showFramework=true;
 let photoTexture=null,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,dead=false,time=0,last=0,pressClock=99,pressure=0,desiredPressure=0,photoBlend=0;
 let fusionTime=7.2;
 let rotateX=0,rotateY=-.08,pointer=null,moved=false,split=false,splitAmount=0,hoverX=null;
 let gestureKind=null,twoDistance=null;
 const hairMotion=new T.Vector2(),hairVelocity=new T.Vector2(),hairTarget=new T.Vector2();
 let lastRX=0,lastRY=0;
 const raycaster=new T.Raycaster(),ndc=new T.Vector2();
 const originalBounds=new T.Sphere(new T.Vector3(0,.9,0),2.8);
 geometry.boundingSphere=originalBounds;
 const hitPlane=new T.Plane(new T.Vector3(0,0,1),0),hit=new T.Vector3();
 function touch(x,y){
  const r=renderer.domElement.getBoundingClientRect();ndc.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);
  raycaster.setFromCamera(ndc,camera);
  if(raycaster.ray.intersectPlane(hitPlane,hit)){
   group.worldToLocal(hit);uniforms.pressPoint.value.set(T.MathUtils.clamp(hit.x/2,-.8,.8),T.MathUtils.clamp((hit.y-.94),-.65,.8),.8);
  }pressClock=0;desiredPressure=1;
 }
 const dom=renderer.domElement;dom.tabIndex=0;dom.setAttribute('aria-label','拖动旋转肉体，轻触施压');
 dom.onpointerdown=e=>{if(!e.isPrimary||e.button!==0)return;pointer={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,id:e.pointerId};moved=false;dom.setPointerCapture(e.pointerId)};
 dom.onpointermove=e=>{
  if(!pointer){
   if(e.pointerType==='mouse'){
    const r=dom.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(ndc,camera);
    const centre=new T.Vector3(0,.94,0).applyMatrix4(group.matrixWorld),radius=1.85*group.scale.x;
    if(hoverX!==null&&raycaster.ray.distanceToPoint(centre)<radius)rotateY+=T.MathUtils.clamp(e.clientX-hoverX,-60,60)*.003;
    hoverX=e.clientX;
   }return;
  }
  if(e.pointerId!==pointer.id)return;if(Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>6)moved=true;if(moved){rotateY+=(e.clientX-pointer.x)*.006;rotateX=T.MathUtils.clamp(rotateX+(e.clientY-pointer.y)*.003,-.18,.3)}pointer.x=e.clientX;pointer.y=e.clientY;
 };
 dom.onpointerleave=()=>{hoverX=null};
 dom.onpointerup=e=>{if(!pointer)return;if(!moved)touch(e.clientX,e.clientY);pointer=null;dom.releasePointerCapture(e.pointerId)};
 dom.onpointercancel=()=>{pointer=null};
 dom.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pressClock=0;desiredPressure=1}};
 function resize(){
  const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;
  if(w<700){const distance=4.7/(2*Math.tan(T.MathUtils.degToRad(15.5))*camera.aspect);scene.fog.near=distance*1.05;scene.fog.far=distance*1.8;camera.position.set(0,distance*.36,distance);camera.lookAt(0,.8,0);camera.setViewOffset(w,h,0,h*.08,w,h)}
  else {scene.fog.near=12;scene.fog.far=23;camera.position.set(0,3.5,10.3);camera.lookAt(0,.8,0);camera.setViewOffset(w,h,w*.045,0,w,h)}
  camera.updateProjectionMatrix();
 }
 addEventListener('resize',resize);resize();
 // Fine tapered vellus hairs share exactly the skin's GPU deformation.
 // One mesh replaces the former beads; roots remain attached under every pose.
 let seed=42;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const hairPositions=[],hairNormals=[],hairColors=[],hairIndices=[],hairProgress=[],hairPhases=[];
 const hairShade=new T.Color();
 for(let i=0;i<420;i++){
  const y=-.24+random()*1.22,phi=random()*Math.PI*2;
  const root=new T.Vector3(Math.sqrt(1-y*y)*Math.cos(phi),y,Math.sqrt(1-y*y)*Math.sin(phi));
  const along=new T.Vector3(0,-1,.25).addScaledVector(root,root.y-root.z*.25).normalize();
  const across=new T.Vector3().crossVectors(root,along).normalize();
  const direction=along.clone().addScaledVector(across,(random()-.5)*1.6).normalize();
  const length=.025+Math.pow(random(),1.4)*.075;
  const lift=.014+random()*.028,curve=(random()-.5)*.035;
  const points=[];
  for(let j=0;j<=5;j++){
   const t=j/5;
   points.push(root.clone().multiplyScalar(1-.0008+lift*Math.sin(t*Math.PI*.65))
    .addScaledVector(direction,length*t).addScaledVector(across,curve*t*t));
  }
  const strand=new T.TubeGeometry(new T.CatmullRomCurve3(points),7,.0019+random()*.00065,3,false);
  const positions=strand.getAttribute('position'),normals=strand.getAttribute('normal');
  const offset=hairPositions.length/3,shade=random();
  hairShade.setRGB(.12+shade*.16,.075+shade*.105,.045+shade*.06);
  for(let j=0;j<positions.count;j++){
   const t=Math.floor(j/4)/7;
   const center=strand.parameters.path.getPointAt(t);
   const tip=new T.Vector3().fromBufferAttribute(positions,j).sub(center).multiplyScalar(1-.89*t).add(center);
   hairPhases.push(i*2.399963);hairProgress.push(t);hairPositions.push(tip.x,tip.y,tip.z);hairNormals.push(normals.getX(j),normals.getY(j),normals.getZ(j));
   hairColors.push(hairShade.r,hairShade.g,hairShade.b);
  }
  for(const index of strand.index.array)hairIndices.push(offset+index);
  strand.dispose();
 }
 const hairGeometry=new T.BufferGeometry();
 hairGeometry.setAttribute('position',new T.Float32BufferAttribute(hairPositions,3));
 hairGeometry.setAttribute('normal',new T.Float32BufferAttribute(hairNormals,3));
 hairGeometry.setAttribute('color',new T.Float32BufferAttribute(hairColors,3));
 hairGeometry.setAttribute('hairProgress',new T.Float32BufferAttribute(hairProgress,1));
 hairGeometry.setAttribute('hairPhase',new T.Float32BufferAttribute(hairPhases,1));
 hairGeometry.setIndex(hairIndices);hairGeometry.boundingSphere=new T.Sphere(new T.Vector3(0,.9,0),3.3);
 const hairMaterial=new T.MeshStandardMaterial({color:'#c4ab8c',vertexColors:true,roughness:.56,metalness:0,side:T.DoubleSide});
 hairMaterial.onBeforeCompile=shader=>{
  deformShader(shader,true);
  shader.vertexShader='attribute float hairProgress, hairPhase; uniform vec2 hairBend;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('vec3 transformed=flesh(position);',`
   vec3 transformed=flesh(position);
   // Pinned roots, with soft tip motion driven by the same breathing clock.
   float airFlow=.25+.75*pow(abs(cos(bodyTime*1.45)),2.);
   float flutter=breath*(sin(bodyTime*1.45+hairPhase*.15)*.0045+sin(bodyTime*7.4+hairPhase)*airFlow*.0025);
   vec3 tipMotion=vec3(cos(hairPhase)*flutter,flutter*.3,sin(hairPhase)*flutter);
   transformed += (vec3(hairBend.x, 0., hairBend.y)+tipMotion)*pow(hairProgress,1.8);
  `);
 };
 const hairs=new T.Mesh(hairGeometry,hairMaterial);group.add(hairs);
 // Three light connections join the two observed surfaces during fusion.
 const bridgePositions=[],bridgeT=[];
 for(const y of [-.42,0,.42])for(let i=0;i<24;i++)for(const t of [i/24,(i+1)/24]){bridgePositions.push(0,y,Math.sqrt(1-y*y));bridgeT.push(t)}
 const bridgeGeometry=new T.BufferGeometry();bridgeGeometry.setAttribute('position',new T.Float32BufferAttribute(bridgePositions,3));bridgeGeometry.setAttribute('bridgeT',new T.Float32BufferAttribute(bridgeT,1));
 const bridgeMaterial=new T.LineBasicMaterial({color:'#777775',transparent:true,opacity:0,depthWrite:false});
 bridgeMaterial.onBeforeCompile=shader=>{deformShader(shader,false);shader.uniforms.halfSide={value:0};shader.vertexShader='attribute float bridgeT;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('vec3 transformed=flesh(position);','vec3 transformed=flesh(position); transformed.x+=(bridgeT*2.-1.)*separation; transformed.y+=sin(bridgeT*3.14159)*separation*.15;')};
 const bridges=new T.LineSegments(bridgeGeometry,bridgeMaterial);bridges.frustumCulled=false;group.add(bridges);

 let night=false,viewMix=0;
 const dayBackground=new T.Color('#f4f3ef'),nightBackground=new T.Color('#17191c'),dayFloor=new T.Color('#e4e3df'),nightFloor=new T.Color('#191f28');
 let tick=()=>{};
 function animate(now){
  if(dead)return;
  requestAnimationFrame(animate);
  const dt=last?Math.min(.06,(now-last)/1000):0;last=now;
  if(document.hidden)return;
  if(!paused){time+=dt;pressClock+=dt;rotateY+=dt*.13;if(photoBlend)fusionTime=Math.min(7.2,fusionTime+dt)}
  desiredPressure*=Math.exp(-dt*2.4);pressure+=(desiredPressure-pressure)*(1-Math.exp(-dt*12));
  for(const key in parameters)parameters[key]+=(targets[key]-parameters[key])*(1-Math.exp(-dt*4));
  for(const key of ['breath','curl','stretch','shiver','movement'])uniforms[key].value=parameters[key];
  uniforms.skinBruise.value=parameters.bruise;uniforms.skinSweat.value=parameters.sweat;uniforms.bodyTime.value=time;uniforms.pressAge.value=pressClock;uniforms.pressure.value=pressure;
  if(!paused)for(const [key,field] of [['high','audioHigh'],['low','audioLow']]){
   const current=uniforms[field].value,target=voiceTarget[key];
   const seconds=target>current?(key==='high'?.065:.14):.32;
   uniforms[field].value+=(target-current)*(1-Math.exp(-dt/seconds));
  }
  const fusionProgress=fusionTime/7.2;
  const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x)};
  uniforms.joinAmount.value=photoBlend?smooth(fusionProgress/.2):0;
  uniforms.faceAmount.value=faceMode?smooth((fusionProgress-.06)/.82):0;
  for(const member of faceMembers.values()){
   if(!paused)member.age=Math.min(7.2,member.age+dt);
   const state=uniforms.faceStates.value[member.slot];state.x=smooth((member.age/7.2-.06)/.82);
   if(!paused)state.y+=(member.level-state.y)*(1-Math.exp(-dt*16));
  }
  uniforms.frameAlpha.value=showFramework?1-.65*smooth((fusionProgress-.32)/.68):0;
  uniforms.separation.value=photoBlend&&!faceMode?.68*smooth(fusionProgress/.2)*(1-smooth((fusionProgress-.32)/.68)):0;
  bridges.visible=!!photoBlend&&!!frameTexture&&showFramework&&uniforms.separation.value>.015;bridgeMaterial.opacity=.48*(1-fusionProgress);
  // Extra sweat only affects the synthetic preview; keep photograph materials unchanged.
  const sweatDelta=parameters.sweat-1;
  material.roughness=.80-parameters.wet*.32;
  material.clearcoat=T.MathUtils.clamp(parameters.wet*.26+sweatDelta*.22,0,.7);
  material.clearcoatRoughness=T.MathUtils.clamp(.46-parameters.wet*.18-sweatDelta*.09,.1,.6);
  material.normalScale.setScalar((.99-parameters.wet*.15)*parameters.relief*3);
  material.clearcoatNormalScale.setScalar((.20-parameters.wet*.05)*parameters.relief*3);
  material.color.set('#ffffff');hairs.visible=true;
  photoMaterial.color.copy(material.color);photoMaterial.roughness=material.roughness;photoMaterial.clearcoat=material.clearcoat;photoMaterial.clearcoatRoughness=material.clearcoatRoughness;photoMaterial.normalScale.copy(material.normalScale);photoMaterial.clearcoatNormalScale.copy(material.clearcoatNormalScale);
  group.rotation.y+=(rotateY-group.rotation.y)*(1-Math.exp(-dt*6));group.rotation.x+=(rotateX-group.rotation.x)*(1-Math.exp(-dt*6));splitAmount+=((split?1:0)-splitAmount)*(1-Math.exp(-dt*4));
  group.position.x=-(innerWidth<700?1.16:1.22)*splitAmount;
  group.position.y=.2+Math.sin(time*.85)*.045;
  group.scale.setScalar(parameters.size*(1-splitAmount*(innerWidth<700?.48:.33))*(1-(innerWidth<700?.22:0)*uniforms.separation.value/.68));
  const angularX=(group.rotation.y-lastRY)/Math.max(dt,.001),angularY=(group.rotation.x-lastRX)/Math.max(dt,.001);
  lastRX=group.rotation.x;lastRY=group.rotation.y;
  if(!paused){
   hairTarget.set(T.MathUtils.clamp(-angularX*.026,-.075,.075),T.MathUtils.clamp(angularY*.03,-.06,.06));
   hairTarget.x+=Math.sin(time*16)*parameters.shiver*.022+Math.sin(time*13)*uniforms.audioHigh.value*.018;
   hairTarget.y+=Math.sin(time*1.45)*parameters.breath*.008+pressure*.022;
   for(let remaining=dt;remaining>0;){const h=Math.min(remaining,.012);remaining-=h;
    hairVelocity.addScaledVector(hairTarget.clone().sub(hairMotion),h*74).multiplyScalar(Math.exp(-h*9));
    hairMotion.addScaledVector(hairVelocity,h);hairMotion.clampScalar(-.11,.11);
   }
  }
  uniforms.hairBend.value.copy(hairMotion);
  tick({time,paused,pressure,hasPhoto:!!photoBlend,fusing:!!photoBlend&&fusionTime<7.2,fusionProgress,rotationSpeed:Math.hypot(angularX,angularY),...parameters});
  viewMix+=((night?1:0)-viewMix)*(1-Math.exp(-dt*5));
  scene.background.copy(dayBackground).lerp(nightBackground,viewMix);scene.fog.color.copy(scene.background);floor.material.color.copy(dayFloor).lerp(nightFloor,viewMix);
  renderer.render(scene,camera);
 }
 requestAnimationFrame(animate);
 return {
  get paused(){return paused},
  setSplit(value){split=value},
  reactToVoice(value){voiceTarget.high=T.MathUtils.clamp(Number(value?.high)||0,0,1);voiceTarget.low=T.MathUtils.clamp(Number(value?.low)||0,0,1)},
  gesture(input){
   if(!input){gestureKind=null;twoDistance=null;return}
   if(paused)return;
   if(input.kind==='two'){
    if(gestureKind!=='two')twoDistance=Math.max(.1,input.distance);
    const ratio=input.distance/twoDistance;
    targets.size=T.MathUtils.clamp(ratio,.65,1.35);targets.stretch=T.MathUtils.clamp((ratio-1)*2.5,0,1);targets.curl=T.MathUtils.clamp((1-ratio)*2.5,0,1);
   }else{
    twoDistance=null;rotateY=(input.x-.5)*2.4;rotateX=T.MathUtils.clamp((input.y-.5)*.4,-.18,.3);
    targets.curl=input.kind==='fist'?1:0;targets.stretch=0;targets.breath=input.kind==='fist'?.3:1;
    if(input.kind==='pinch'&&gestureKind!=='pinch'){pressClock=0;desiredPressure=1}
    if(input.kind==='pinch')uniforms.pressPoint.value.set((input.x-.5)*1.6,(.5-input.y)*1.4,.8);
   }
   gestureKind=input.kind;
  },
  setNight(value){night=value},
  setPaused(value){paused=value},
  set(key,value){targets[key]=value},
  setState(name){Object.assign(targets,{breath:name==='breathe'?1:.35,curl:name==='curl'?1:0,stretch:name==='stretch'?1:0,shiver:name==='shiver'?1:0})},
  press(){pressClock=0;desiredPressure=1},
  setFramework(value){showFramework=value},
  addFace(id,relief){
   if(faceMembers.has(id)||faceMembers.size>=MAX_PARTICIPANTS)return false;
   const used=new Set([...faceMembers.values()].map(m=>m.slot)),slot=FACE_ANGLES.findIndex((_,i)=>!used.has(i));
   writeFaceTile(atlasData,slot,relief);
   if(!reliefTexture){reliefTexture=new T.DataTexture(atlasData,FACE_TILE*3,FACE_TILE*2,T.RGBAFormat);reliefTexture.minFilter=reliefTexture.magFilter=T.LinearFilter}reliefTexture.needsUpdate=true;
   faceMembers.set(id,{slot,age:0,level:0});uniforms.faceStates.value[slot].set(0,0,0,0);uniforms.mouthShapes.value[slot].set(relief.mouth.x,relief.mouth.y,relief.mouth.width,relief.mouth.height);
   uniforms.faceRelief.value=reliefTexture;uniforms.faceAmount.value=0;faceMode=true;
   photoTexture?.dispose();photoTexture=null;frameTexture?.dispose();frameTexture=null;
   uniforms.photo.value=skin;uniforms.framework.value=skin;uniforms.hasPhoto.value=0;uniforms.hasFramework.value=0;
   uniforms.halfSide.value=0;uniforms.separation.value=0;photoHalf.visible=false;
   photoBlend=1;fusionTime=0;paused=false;
   rotateY=-FACE_ANGLES[slot]*.35;return true;
  },
  setFaceLevels(levels){for(const [id,member] of faceMembers)member.level=T.MathUtils.clamp(levels.get(id)||0,0,1)},
  focusFace(id){const m=faceMembers.get(id);if(m){rotateY=-FACE_ANGLES[m.slot];rotateX=0}},
  removeFace(id){const m=faceMembers.get(id);if(!m)return;uniforms.faceStates.value[m.slot].set(0,0,0,0);clearFaceTile(atlasData,m.slot);if(reliefTexture)reliefTexture.needsUpdate=true;faceMembers.delete(id);if(!faceMembers.size){clearFaces();photoBlend=0;fusionTime=7.2}},
  setPhoto(canvas,frame=null){clearFaces();const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());photoTexture?.dispose();photoTexture=texture;uniforms.photo.value=texture;uniforms.hasPhoto.value=1;uniforms.joinAmount.value=0;photoBlend=1;frameTexture?.dispose();frameTexture=frame?new T.CanvasTexture(frame):null;if(frameTexture)frameTexture.colorSpace=T.SRGBColorSpace;uniforms.framework.value=frameTexture||skin;uniforms.hasFramework.value=frameTexture?1:0;fusionTime=0;uniforms.halfSide.value=-1;photoHalf.visible=true;paused=false},
  replayFusion(){if(photoBlend){fusionTime=0;for(const m of faceMembers.values())m.age=0;paused=false}},
  clearPhoto(){clearFaces();frameTexture?.dispose();frameTexture=null;uniforms.hasFramework.value=0;uniforms.framework.value=skin;photoHalf.visible=false;uniforms.halfSide.value=0;uniforms.separation.value=0;fusionTime=7.2;photoBlend=0;uniforms.hasPhoto.value=0;uniforms.photo.value=skin;photoTexture?.dispose();photoTexture=null},
  reset(){Object.assign(targets,{breath:1,curl:0,stretch:0,shiver:0,movement:.45,wet:.65,size:1,relief:1,bruise:3,sweat:1});rotateX=0;rotateY=-.08;gestureKind=null;twoDistance=null;paused=false},
  capture(){
   // Render only the sculpture with its existing studio light, then restore the stage
   // synchronously so recording and the next on-screen frame keep their background.
   const background=scene.background,fog=scene.fog,groundVisible=floor.visible,bridgeVisible=bridges.visible,alpha=renderer.getClearAlpha();
   const copy=document.createElement('canvas');copy.width=dom.width;copy.height=dom.height;
   try{scene.background=null;scene.fog=null;floor.visible=false;bridges.visible=false;renderer.setClearAlpha(0);renderer.render(scene,camera);copy.getContext('2d').drawImage(dom,0,0)}
   finally{scene.background=background;scene.fog=fog;floor.visible=groundVisible;bridges.visible=bridgeVisible;renderer.setClearAlpha(alpha);renderer.render(scene,camera)}
   return new Promise((resolve,reject)=>copy.toBlob(blob=>blob?resolve(blob):reject(Error('画面保存失败，请重试。')),'image/png'));
  },
  get canvas(){return dom},
  onTick(callback){tick=callback},
  dispose(){dead=true;removeEventListener('resize',resize);geometry.dispose();material.dispose();depth.dispose();photoDepth.dispose();frameTexture?.dispose();photoTexture?.dispose();reliefTexture?.dispose();emptyRelief.dispose();skin.dispose();surfaceMaps.forEach(texture=>texture.dispose());environment.dispose();scene.traverse(o=>{if(o!==body){o.geometry?.dispose();o.material?.dispose()}});renderer.dispose();dom.remove()}
 };
}
