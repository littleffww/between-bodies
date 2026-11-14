// MediaPipe lip contours, ordered from one corner to the other.
const upper=[61,185,40,39,37,0,267,269,270,409,291];
const lower=[61,146,91,181,84,17,314,405,321,375,291];
const innerUpper=[78,191,80,81,82,13,312,311,310,415,308];
const innerLower=[78,95,88,178,87,14,317,402,318,324,308];
const contours=[upper,lower,innerUpper,innerLower];
const indices=[...new Set(contours.flat())];
const edges=contours.flatMap(line=>line.slice(1).map((i,n)=>[line[n],i]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
export const MOUTH_SAMPLES=256;

export function selectMouth(result){
 const source=result?.face;
 if(!indices.every(i=>valid(source?.[i])))return null;
 const points=[];for(const i of indices)points[i]={x:source[i].x,y:source[i].y};
 const xs=indices.map(i=>points[i].x),ys=indices.map(i=>points[i].y);
 const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
 if(Math.hypot(points[61].x-points[291].x,points[61].y-points[291].y)<.025||h<.004)return null;
 return {kind:'mouth',points,edges,box:{x,y,w,h}};
}

export function createMouthProfile(subject,width,height){
 if(subject?.kind!=='mouth'||!(width>0&&height>0))return null;
 const pixels=i=>({x:subject.points[i].x*width,y:subject.points[i].y*height});
 const a=pixels(61),b=pixels(291),span=Math.hypot(b.x-a.x,b.y-a.y);
 if(span<18)return null;
 const dx=(b.x-a.x)/span,dy=(b.y-a.y)/span;
 const line=ids=>ids.map(i=>{const p=pixels(i),x=p.x-a.x,y=p.y-a.y;return {x:(x*dx+y*dy)/span,y:(x*dy-y*dx)/span}}).sort((a,b)=>a.x-b.x);
 const [top,bottom,insideTop,insideBottom]=contours.map(line);
 function sample(points,x){
  const i=points.findIndex(p=>p.x>=x);
  if(i<=0)return points[i===0?0:points.length-1].y;
  const a=points[i-1],b=points[i];return a.y+(b.y-a.y)*(x-a.x)/Math.max(1e-6,b.x-a.x);
 }
 const center=(sample(insideTop,.5)+sample(insideBottom,.5))*.5;
 const data=new Uint8Array(MOUTH_SAMPLES*4);
 for(let i=0;i<MOUTH_SAMPLES;i++){
  const u=i/(MOUTH_SAMPLES-1),a=sample(insideTop,u),b=sample(insideBottom,u),seam=(a+b)*.5;
  // Store the seam, upper/lower lip thicknesses and the original aperture.
  // Repose an open photo into a mostly closed resting mouth without losing its contour.
  const taper=Math.pow(Math.max(0,1-(2*u-1)**2),.65);
  const values=[.5+clamp((seam-center)*1.55,-.21,.21)/.42,
   clamp((sample(top,u)-a)*2.2,.022*taper,.18)/.18,
   clamp((b-sample(bottom,u))*2.2,.024*taper,.19)/.19,
   clamp((a-b)*.24,0,.065)/.065];
  for(let j=0;j<4;j++)data[i*4+j]=Math.round(clamp(values[j],0,1)*255);
 }
 return {data};
}
