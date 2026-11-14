import {POSE_EDGES,HAND_EDGES} from './tracking.mjs?v=relief-v11';
export const reliable=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&(p.visibility??1)>.6&&(p.presence??1)>.6;
function candidate(kind,points,edges){
 const used=[...new Set(edges.flat())].map(i=>points[i]).filter(reliable);if(used.length<5)return null;
 const xs=used.map(p=>p.x),ys=used.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
 if(w<.025||h<.025)return null;return {kind,points,edges,box:{x,y,w,h},area:w*h};
}
export function selectSubject(result,preference='auto'){
 if(!result)return null;
 const face=candidate('face',result.face||[],result.faceEdges||[]);
 const hands=(result.hands||[]).map(p=>candidate('hand',p,HAND_EDGES)).filter(Boolean).sort((a,b)=>b.area-a.area);
 const pose=result.pose||[],body=[11,12,13,14,23,24].filter(i=>reliable(pose[i])).length>=3?candidate('body',pose,POSE_EDGES):null;
 if(preference==='face')return face;if(preference==='hand')return hands[0]||null;if(preference==='body')return body;
 if(hands[0]&&hands[0].area>.045&&hands[0].area>(face?.area||0)*1.2)return hands[0];
 if(face&&face.box.h>.23)return face;
 return body||face||hands[0]||null;
}
export function autoCrop(subject,width,height,size=768){
 if(!subject)return {zoom:1,x:0,y:0};const b=subject.box,padding=subject.kind==='face'?1.45:1.22;
 const edge=Math.max(b.w*width,b.h*height)*padding,base=Math.max(size/width,size/height);
 const zoom=Math.max(.5,Math.min(5,size/Math.max(80,edge)/base)),scale=base*zoom;
 return {zoom,x:(.5-b.x-b.w/2)*width*scale,y:(.5-b.y-b.h/2)*height*scale};
}
export function projectSubject(subject,width,height,crop,size=768){
 if(!subject)return null;const scale=Math.max(size/width,size/height)*crop.zoom;
 const ox=(size-width*scale)/2+crop.x,oy=(size-height*scale)/2+crop.y;
 return {...subject,points:subject.points.map(p=>({...p,x:(p.x*width*scale+ox)/size,y:(p.y*height*scale+oy)/size}))};
}
export function drawLines(ctx,subject,point,scale=1){
 if(!subject)return;ctx.lineCap='round';ctx.lineJoin='round';
 const path=()=>{ctx.beginPath();for(const [a,b] of subject.edges){const pa=subject.points[a],pb=subject.points[b];if(!reliable(pa)||!reliable(pb))continue;ctx.moveTo(...point(pa));ctx.lineTo(...point(pb))}};
 path();ctx.lineWidth=3*scale;ctx.strokeStyle='rgba(0,0,0,.6)';ctx.stroke();path();ctx.lineWidth=1.15*scale;ctx.strokeStyle='rgba(255,255,255,.93)';ctx.stroke();
 for(const i of new Set(subject.edges.flat())){const p=subject.points[i];if(!reliable(p))continue;ctx.beginPath();ctx.arc(...point(p),1.6*scale,0,Math.PI*2);ctx.fillStyle='white';ctx.fill()}
}
export function frameworkCanvas(subject,size=768){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;drawLines(canvas.getContext('2d'),subject,p=>[p.x*size,p.y*size],size/768);return canvas}
export function drawCameraGuide(canvas,subject,vw,vh,mirror){
 const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);if(!subject||!vw||!vh)return;
 const cover=Math.max(w/vw,h/vh),point=p=>[(w-vw*cover)/2+(mirror?1-p.x:p.x)*vw*cover,(h-vh*cover)/2+p.y*vh*cover];
 drawLines(ctx,subject,point,dpr*.65);const b=subject.box,a=point({x:b.x,y:b.y}),c=point({x:b.x+b.w,y:b.y+b.h});ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=dpr;ctx.setLineDash([6*dpr,5*dpr]);ctx.strokeRect(Math.min(a[0],c[0]),a[1],Math.abs(c[0]-a[0]),c[1]-a[1]);ctx.setLineDash([]);
}
