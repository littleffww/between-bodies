// A local, bounded sculptural impression of measured facial landmarks.
// No photograph colors, iris/teeth textures, identity lookup or unseen anatomy.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z);
const valid=p=>finite(p)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
const NOSE=[168,6,197,195,5,4,1];
export function createFaceRelief(subject,size=384){
 if(subject?.kind!=='face')return null;
 const source=subject.points;
 // Require the features that become the relief, not an entirely in-frame head oval.
 // A slightly cropped chin/forehead must not discard valid eyes, nose and lips.
 if(![1,4,98,327,33,133,263,362,61,291,13,14,0,17].every(i=>valid(source?.[i])))return null;
 if(![10,152,234,454].every(i=>finite(source?.[i])))return null;
 const a=source[33],b=source[263],span=distance(a,b);if(span<.035)return null;
 const dx=(b.x-a.x)/span,dy=(b.y-a.y)/span,cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
 const aligned=source.map(p=>finite(p)?{x:(p.x-cx)*dx+(p.y-cy)*dy,y:-(p.x-cx)*dy+(p.y-cy)*dx,z:p.z}:null);
 const left=Math.min(aligned[234].x,aligned[454].x),right=Math.max(aligned[234].x,aligned[454].x),top=aligned[10].y,bottom=aligned[152].y;
 const width=right-left,height=bottom-top;if(width<.06||height<.08)return null;
 const fit=Math.min(.76/width,.84/height);
 // Outline estimates may set the scale, but out-of-frame details are not sculpted.
 const points=aligned.map((p,i)=>valid(source[i])?{x:.5+(p.x-(left+right)/2)*fit,y:.5+(p.y-(top+bottom)/2)*fit,z:p.z}:null);
 const field=new Float32Array(size*size),w=width*fit,h=height*fit;
 // Elliptic mounds make soft tissue; narrow measured curves make eyelids/lips.
 function mound(p,sx,sy,amount){
  if(!p||!Number.isFinite(p.x+p.y))return;
  sx=Math.max(.003,sx);sy=Math.max(.003,sy);
  const x0=Math.max(0,Math.floor((p.x-3*sx)*size)),x1=Math.min(size-1,Math.ceil((p.x+3*sx)*size));
  const y0=Math.max(0,Math.floor((p.y-3*sy)*size)),y1=Math.min(size-1,Math.ceil((p.y+3*sy)*size));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const d=((x/(size-1)-p.x)/sx)**2+((y/(size-1)-p.y)/sy)**2;
   field[y*size+x]+=amount*Math.exp(-d*.5);
  }
 }
 function ridge(indices,radius,amount){
  const layer=new Float32Array(size*size);
  for(let i=1;i<indices.length;i++){
   const p=points[indices[i-1]],q=points[indices[i]];if(!p||!q)continue;
   const vx=q.x-p.x,vy=q.y-p.y,len=vx*vx+vy*vy;
   const x0=Math.max(0,Math.floor((Math.min(p.x,q.x)-radius*3)*size)),x1=Math.min(size-1,Math.ceil((Math.max(p.x,q.x)+radius*3)*size));
   const y0=Math.max(0,Math.floor((Math.min(p.y,q.y)-radius*3)*size)),y1=Math.min(size-1,Math.ceil((Math.max(p.y,q.y)+radius*3)*size));
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const u=x/(size-1)-p.x,v=y/(size-1)-p.y,t=clamp((u*vx+v*vy)/Math.max(len,1e-8),0,1);
    const value=Math.exp(-((u-vx*t)**2+(v-vy*t)**2)/(2*radius*radius));
    layer[y*size+x]=Math.max(layer[y*size+x],value);
   }
  }
  for(let i=0;i<field.length;i++)field[i]+=layer[i]*amount;
 }
 // Broad facial mass fades into the original sphere, without an outline seam.
 mound({x:.5,y:.5},w*.39,h*.38,.018);
 const eyeDepth=(source[33].z+source[263].z)/2;
 const noseDepth=clamp((eyeDepth-source[1].z)/width,.025,.45);
 const noseHeight=.12+noseDepth*.29;
 ridge(NOSE,w*.052,noseHeight*.55);
 mound(points[1],Math.max(w*.045,distance(points[98],points[327])*.28),h*.035,noseHeight*.66);
 mound(points[98],w*.038,h*.024,.035);mound(points[327],w*.038,h*.024,.035);
 ridge([98,97,2,326,327],w*.013,-.021);
 for(const [corners,upper,lower,brow] of [
  [[33,133],[33,160,159,158,133],[33,144,145,153,133],[70,63,105,66,107]],
  [[362,263],[362,385,386,387,263],[362,380,374,373,263],[336,296,334,293,300]]
 ]){
  const p=points[corners[0]],q=points[corners[1]],ew=distance(p,q),centre={x:(p.x+q.x)/2,y:(p.y+q.y)/2};
  mound(centre,ew*.60,h*.048,-.028);
  // A skin-covered eye mound, never a separate eye sphere or painted eyeball.
  mound(centre,ew*.29,h*.019,.018);
  ridge(upper,w*.011,.038);ridge(lower,w*.010,.024);ridge(brow,w*.027,.028);
 }
 mound(points[50],w*.11,h*.10,.028);mound(points[280],w*.11,h*.10,.028);
 ridge([234,93,132,58,172,136,150],w*.048,.014);
 ridge([454,323,361,288,397,365,379],w*.048,.014);
 const mouthWidth=distance(points[61],points[291]),open=distance(points[13],points[14]);
 const mouthCentre={x:(points[13].x+points[14].x)/2,y:(points[13].y+points[14].y)/2};
 mound(mouthCentre,mouthWidth*.37,Math.max(h*.012,open*.38),-.028);
 ridge([61,40,37,0,267,270,291],w*.018,.045);
 ridge([61,146,91,181,84,17,314,405,321,375,291],w*.020,.042);
 ridge([61,78,81,13,311,308,291],w*.006,-.014);
 mound(points[175],w*.13,h*.065,.028);
 // Encode signed displacement in two channels: smooth interpolation, no float-texture extension.
 const data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/(size-1),v=y/(size-1),fade=smooth(u/.09)*smooth((1-u)/.09)*smooth(v/.07)*smooth((1-v)/.07);
  const i=y*size+x,value=clamp(field[i]*fade,-.07,.29);field[i]=value;
  const encoded=Math.round((value+1)*.5*65535);data[i*4]=encoded>>8;data[i*4+1]=encoded&255;data[i*4+3]=255;
 }
 const noseEdges=NOSE.slice(1).map((n,i)=>[NOSE[i],n]);
 const lipHeight=Math.max(.035,...[61,40,37,0,267,270,291,146,91,181,84,17,314,405,321,375].map(i=>points[i]).filter(Boolean).map(p=>Math.abs(p.y-mouthCentre.y)*2));
 return {size,data,field,points,preview:{...subject,points,edges:[...subject.edges,...noseEdges]},noseHeight,mouth:{x:mouthCentre.x,y:mouthCentre.y,width:mouthWidth,height:lipHeight}};
}
