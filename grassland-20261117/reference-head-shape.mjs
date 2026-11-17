/** Long, softly sculpted human head based on IMG_0113.JPG. Local +Z is forward. */
export const referenceHeadShape = /* glsl */`
vec3 ovalFace(vec3 p){
 float face=smoothstep(.025,.72,p.z);
 float cheek=headField(vec2(abs(p.x),p.y),vec2(.46,-.015),vec2(.27,.34));
 float chin=headField(p.xy,vec2(.015,-.67),vec2(.44,.27));
 float forehead=headField(p.xy,vec2(-.025,.66),vec2(.64,.32));
 float muzzle=headField(p.xy,vec2(.015,-.39),vec2(.43,.20));
 float bridge=headField(p.xy,vec2(-.015,.29),vec2(.135,.28));
 float nose=headField(p.xy,vec2(-.015,.015),vec2(.20,.15));
 float sockets=headField(vec2(abs(p.x),p.y),vec2(.40,.34),vec2(.19,.14));
 float brow=headField(vec2(abs(p.x),p.y),vec2(.40,.50),vec2(.25,.10));
 float x=p.x*(.38+.12*face)+.006*p.y*face;
 float y=p.y*(.285+.25*face)+.16*face;
 float z=.98*p.z+.28*p.z*p.z;
 z+=face*(.100*cheek+.240*chin+.180*forehead+.049*muzzle+
          .075*bridge+.125*nose-.025*sockets+.028*brow);
 // A broad orbital region gives the eyes a human frontal plane; the cheeks,
 // nose and jaw retain their continuous rounded volumes.
 float orbitalPlate=exp(-pow((p.y-.34)/.25,2.))*(1.-smoothstep(.55,.88,abs(p.x)));
 z+=face*(.70*p.x*p.x+.35*(p.y-.34))*orbitalPlate;
 float at=p.x/oralWidth();
 float taper=1.-smoothstep(.56,1.06,abs(at));
 float jaw=voiceMotion.x*.065*face*taper;
 y-=jaw*(1.-smoothstep(-.52,-.14,p.y));
 return vec3(x,y,z);
}
`;

const smooth = (a,b,x) => { const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t); };
const field = (x,y,cx,cy,rx,ry) => Math.exp(-(((x-cx)/rx)**2+((y-cy)/ry)**2));

/** CPU counterpart anchors sculpted eyes and nose details to the same surface. */
export function referenceHeadPoint(px,py) {
 const pz=Math.sqrt(Math.max(0,1-px*px-py*py));
 const f=smooth(.025,.72,pz);
 const cheek=field(Math.abs(px),py,.46,-.015,.27,.34);
 const chin=field(px,py,.015,-.67,.44,.27);
 const forehead=field(px,py,-.025,.66,.64,.32);
 const muzzle=field(px,py,.015,-.39,.43,.20);
 const bridge=field(px,py,-.015,.29,.135,.28);
 const nose=field(px,py,-.015,.015,.20,.15);
 const sockets=field(Math.abs(px),py,.40,.34,.19,.14);
 const brow=field(Math.abs(px),py,.40,.50,.25,.10);
 const orbitalPlate=Math.exp(-Math.pow((py-.34)/.25,2))*(1-smooth(.55,.88,Math.abs(px)));
 return [px*(.38+.12*f)+.006*py*f,py*(.285+.25*f)+.16*f,
  .98*pz+.28*pz*pz+f*(.100*cheek+.240*chin+.180*forehead+.049*muzzle+
  .075*bridge+.125*nose-.025*sockets+.028*brow)+f*(.70*px*px+.35*(py-.34))*orbitalPlate];
}

export function referenceHeadNormal(px,py) {
 const e=.0001,a=referenceHeadPoint(px+e,py),b=referenceHeadPoint(px-e,py);
 const c=referenceHeadPoint(px,py+e),d=referenceHeadPoint(px,py-e);
 const u=a.map((v,i)=>v-b[i]),v=c.map((q,i)=>q-d[i]);
 const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const length=Math.hypot(...n);
 return n.map(value=>value/length);
}
