/**
 * Sculpted eyes and pinnae for the photographed Between Bodies head.
 * No imported renderer, textures, browser permissions or network access.
 * The host passes the same THREE constructors as its existing scene.
 */
export function createReferenceFeatures(THREE, skinMaterial, options = {}) {
 const opts = {
  eyeX:.20, eyeY:.342, eyeZ:1.095, eyeWidth:.15, eyeHeight:.068, eyeYaw:.13, eyePitch:0,
  earX:.43, earY:.12, earZ:.55, earWidth:.105, earHeight:.20,
  ...options
 };
 const root = new THREE.Group();
 root.name = 'reference-face-features';
 const eyes = [], ears = [];
 const TAU = Math.PI*2;

 const skin = (tint = 1, roughness = .54) => {
  const material = skinMaterial.clone();
  // The body injects head coordinates into its shader. These are independent
  // sculpted surfaces, and use the original physical skin material instead.
  material.onBeforeCompile = () => {};
  material.customProgramCacheKey = () => 'reference-feature-skin';
  material.color.multiplyScalar(tint);
  material.roughness = roughness;
  material.clearcoat = .24;
  material.clearcoatRoughness = .30;
  if (material.normalScale) material.normalScale.set(.25,.25);
  return material;
 };
 const flesh = skin(1);
 const lidSkin = skin(.98,.54);
 const foldSkin = skin(.92,.60);
 const earSkin = skin(.985,.56);
 const conchaSkin = skin(.82,.60);
 const tearSkin = new THREE.MeshPhysicalMaterial({
  color:'#ae6f68', roughness:.46, clearcoat:.24, clearcoatRoughness:.30
 });
 const scleraMaterial = new THREE.MeshPhysicalMaterial({
  color:'#eee5dc', vertexColors:true, roughness:.31,
  clearcoat:.65, clearcoatRoughness:.07
 });
 const irisMaterial = new THREE.MeshPhysicalMaterial({
  color:'#ffffff', vertexColors:true, roughness:.35,
  clearcoat:.6, clearcoatRoughness:.06
 });
 const pupilMaterial = new THREE.MeshPhysicalMaterial({
  color:'#080d10', roughness:.18, clearcoat:1, clearcoatRoughness:.04
 });
 const corneaMaterial = new THREE.MeshPhysicalMaterial({
  color:'#ffffff', transparent:true, opacity:.10, roughness:.025,
  clearcoat:1, clearcoatRoughness:.025, depthWrite:false
 });

 const geometry = (positions, indices, uvs, colors) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  if (uvs) g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  if (colors) g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
 };
 const mesh = (g, material, name) => {
  const m = new THREE.Mesh(g,material);
  m.name=name;
  m.castShadow=true;
  m.receiveShadow=true;
  return m;
 };

 // A radial surface, including one shared centre vertex. The exposed eyeball
 // is only an almond-shaped cap, so a complete white sphere cannot protrude.
 const disk = (surface, radial=12, angular=64, colorAt) => {
  const positions=[],uvs=[],colors=[],indices=[];
  const append = (r,a) => {
   const p=surface(r,a);
   positions.push(...p);
   uvs.push(.5+.48*r*Math.cos(a),.5+.48*r*Math.sin(a));
   if(colorAt) colors.push(...colorAt(r,a));
  };
  append(0,0);
  for(let ring=1;ring<=radial;ring++) {
   for(let j=0;j<=angular;j++) append(ring/radial,j/angular*TAU);
  }
  const id=(ring,j)=>1+(ring-1)*(angular+1)+j;
  for(let j=0;j<angular;j++) indices.push(0,id(1,j),id(1,j+1));
  for(let ring=1;ring<radial;ring++) for(let j=0;j<angular;j++) {
   const a=id(ring,j),b=id(ring+1,j),c=id(ring+1,j+1),d=id(ring,j+1);
   indices.push(a,b,c,a,c,d);
  }
  return geometry(positions,indices,uvs,colorAt?colors:undefined);
 };

 const ellipsoid = (rx,ry,rz,material,name) => {
  const positions=[],uvs=[],indices=[],rows=20,cols=36;
  for(let v=0;v<=rows;v++) {
   const phi=v/rows*Math.PI;
   for(let u=0;u<=cols;u++) {
    const theta=u/cols*TAU;
    positions.push(rx*Math.sin(phi)*Math.cos(theta),ry*Math.cos(phi),rz*Math.sin(phi)*Math.sin(theta));
    uvs.push(u/cols,v/rows);
   }
  }
  for(let v=0;v<rows;v++) for(let u=0;u<cols;u++) {
   const a=v*(cols+1)+u,b=a+cols+1;
   indices.push(a,a+1,b,b,a+1,b+1);
  }
  return mesh(geometry(positions,indices,uvs),material,name);
 };

 // Cubic interpolation keeps helix and lid surfaces continuous at joins.
 const cubic = (a,b,c,d,t) => .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
 const spline = (points,t,closed=false) => {
  const max=closed?points.length:points.length-1;
  const s=Math.min(t,1-1e-10)*max,i=Math.floor(s),f=s-i;
  const get=n=>points[closed?(n+points.length*3)%points.length:Math.max(0,Math.min(points.length-1,n))];
  const p=[get(i-1),get(i),get(i+1),get(i+2)];
  return [0,1,2].map(c=>cubic(p[0][c],p[1][c],p[2][c],p[3][c],f));
 };

 const tube = (curve,radius,material,name,segments=72,sides=9) => {
  const positions=[],uvs=[],indices=[];
  for(let i=0;i<=segments;i++) {
   const t=i/segments,p=curve(t);
   const a=curve(Math.max(0,t-.0005)),b=curve(Math.min(1,t+.0005));
   const tx=b[0]-a[0],ty=b[1]-a[1],norm=Math.hypot(tx,ty)||1;
   const nx=-ty/norm,ny=tx/norm;
   const r=typeof radius==='function'?radius(t):radius;
   for(let j=0;j<=sides;j++) {
    const theta=j/sides*TAU,c=Math.cos(theta),s=Math.sin(theta);
    positions.push(p[0]+nx*c*r,p[1]+ny*c*r,p[2]+s*r);
    uvs.push(t,j/sides);
   }
  }
  for(let i=0;i<segments;i++) for(let j=0;j<sides;j++) {
   const a=i*(sides+1)+j,b=a+sides+1;
   indices.push(a,a+1,b,b,a+1,b+1);
  }
  return mesh(geometry(positions,indices,uvs),material,name);
 };

 for(const side of [-1,1]) {
  const eye=new THREE.Group();
  eye.name=side<0?'reference-eye-left':'reference-eye-right';
  eye.position.set(side*opts.eyeX,opts.eyeY,opts.eyeZ);
  eye.rotation.order='YXZ';
  eye.rotation.x=opts.eyePitch;
  eye.rotation.y=side*opts.eyeYaw;
  eye.rotation.z=-side*.025;
  const a=opts.eyeWidth*.5,b=opts.eyeHeight*.5;
  const bulge=opts.eyeWidth*.095;
  const edge=(angle) => {
   const sn=Math.sin(angle),cs=Math.cos(angle);
   return [a*cs,b*sn*Math.pow(Math.abs(sn),.30),.001+bulge*.20*Math.abs(sn)];
  };
  const globe = disk((r,angle)=>{
   const p=edge(angle);
   return [p[0]*r,p[1]*r,bulge*(1-r*r)+p[2]*r*r];
  },14,72,(r,angle)=>{
   const corner=Math.pow(Math.abs(Math.cos(angle)),6)*Math.pow(r,5);
   return [1,.99-.075*corner,.97-.075*corner];
  });
  eye.add(mesh(globe,scleraMaterial,'exposed-almond-sclera'));

  // Broad upper lid skin retreats into the orbital rim, rather than a tube
  // floating above a full sphere. The lower lid is deliberately finer.
  for(const upper of [true,false]) {
   const positions=[],uvs=[],indices=[],segments=52,rows=7;
   for(let j=0;j<=segments;j++) {
    const t=j/segments,theta=(upper?0:Math.PI)+t*Math.PI;
    const e=edge(theta), fullness=Math.pow(Math.sin(t*Math.PI),.6);
    for(let k=0;k<=rows;k++) {
     const r=k/rows;
     const stretch=upper?.044:.030;
     positions.push(e[0]*(1+r*.20),e[1]+(upper?1:-1)*stretch*r*fullness,
      e[2]+.006*Math.sin(r*Math.PI)-.010*r*r);
     uvs.push(.41+e[0]*2,.43+e[1]*3+r*.10);
    }
   }
   for(let j=0;j<segments;j++) for(let k=0;k<rows;k++) {
    const p=j*(rows+1)+k,q=p+rows+1;
    indices.push(p,p+1,q,q,p+1,q+1);
   }
   eye.add(mesh(geometry(positions,indices,uvs),lidSkin,upper?'upper-eyelid-sculpture':'lower-eyelid-sculpture'));
   const curve=t=>edge((upper?0:Math.PI)+Math.PI*t);
   eye.add(tube(curve,t=>(upper?.0064:.0046)*(.40+.60*Math.pow(Math.sin(Math.PI*t),.55)),
    upper?lidSkin:tearSkin,upper?'upper-lid-rim':'lower-lid-wet-margin',52,8));
   if(upper) {
    eye.add(tube(t=>{
     const p=edge(Math.PI*t),f=Math.sin(Math.PI*t);
     return [p[0]*1.03,p[1]+.020*f,p[2]-.008];
    },t=>.0022*Math.pow(Math.sin(Math.PI*t),.55),foldSkin,'upper-lid-fold',44,7));
   }
  }
  const irisRadius=opts.eyeWidth*.16;
  const iris = disk((r,angle)=>[irisRadius*r*Math.cos(angle),irisRadius*r*Math.sin(angle),
    bulge+.0015-.003*r*r],12,96,(r,angle)=>{
   const streak=.5+.5*Math.sin(angle*81+Math.sin(angle*13)*2+r*11);
   const fibre=.5+.5*Math.sin(angle*47-r*17);
   const halo=.5+.5*Math.sin(angle*19+r*29);
   let light=.78+.28*streak+.15*fibre;
   if(r>.88)light*=.36+.64*(1-r)/.12;
   if(r<.40)light*=.58;
   return [(.25+.035*halo)*light,(.355+.045*halo)*light,(.405+.050*halo)*light];
  });
  eye.add(mesh(iris,irisMaterial,'blue-grey-fibred-iris'));
  eye.add(mesh(disk((r,angle)=>[irisRadius*.445*r*Math.cos(angle),irisRadius*.445*r*Math.sin(angle),
   bulge+.0027+.0005*(1-r*r)],6,48),pupilMaterial,'dark-pupil'));
  const cornea=mesh(disk((r,angle)=>[irisRadius*r*Math.cos(angle),irisRadius*r*Math.sin(angle),
   bulge+.0045+.003*(1-r*r)],10,64),corneaMaterial,'clear-corneal-surface');
  cornea.castShadow=false;
  eye.add(cornea);
  const tear=ellipsoid(.006,.005,.0035,tearSkin,'inner-tear-duct');
  tear.position.set(-side*a*.91,-.001,.0045);
  eye.add(tear);
  root.add(eye);eyes.push(eye);
 }

 for(const side of [-1,1]) {
  const ear=new THREE.Group();
  ear.name=side<0?'reference-ear-left':'reference-ear-right';
  ear.position.set(side*opts.earX,opts.earY,opts.earZ);
  ear.rotation.y=side*Math.PI*.50;
  ear.rotation.z=side*.08;
  ear.scale.set(opts.earWidth/.105,opts.earHeight/.20,1);
  // The anterior edge is less convex, the helix rounded and the lobule full.
  const outline=[
   [.002,-.092,.006],[.029,-.079,.012],[.046,-.033,.019],
   [.049,.025,.023],[.033,.077,.021],[.003,.099,.017],
   [-.028,.088,.014],[-.045,.049,.009],[-.043,.009,.005],
   [-.028,-.023,.003],[-.025,-.066,.004]
  ];
  const contour=t=>spline(outline,t,true);
  // Rounded cartilage behind the conchal bowl supplies actual pinna volume
  // when viewed from the front or rear, rather than a paper-thin silhouette.
  const backing=ellipsoid(.042,.088,.024,earSkin,'rounded-ear-cartilage');
  backing.position.set(.001,.006,-.044);ear.add(backing);
  const pinna=disk((r,angle)=>{
   const p=contour(angle/TAU);
   return [p[0]*r,p[1]*r,p[2]*r*r-.018*(1-r*r)];
  },15,88);
  ear.add(mesh(pinna,earSkin,'concave-pinna'));
  ear.add(tube(contour,t=>.010+.0025*(.5+.5*Math.sin(t*TAU)),earSkin,'rounded-helix',96,10));
  const concha=mesh(disk((r,a)=>[-.013+.020*r*Math.cos(a),-.009+.039*r*Math.sin(a),
   -.016+.010*r*r],10,52),conchaSkin,'recessed-concha');
  ear.add(concha);
  const antihelix=[[-.009,-.046,.002],[.010,-.017,.006],[.016,.013,.010],[.013,.044,.015],[.001,.068,.016]];
  ear.add(tube(t=>spline(antihelix,t),t=>.0055*(.6+.4*Math.sin(Math.PI*t)),earSkin,'antihelix',64,9));
  const fork=[[.015,.015,.010],[-.003,.039,.009],[-.019,.054,.011]];
  ear.add(tube(t=>spline(fork,t),t=>.0048*(1-.35*t),earSkin,'antihelix-superior-crus',32,9));
  const tragus=ellipsoid(.011,.020,.012,earSkin,'tragus');
  tragus.position.set(-.031,-.012,.009);ear.add(tragus);
  const antiTragus=ellipsoid(.009,.012,.009,earSkin,'antitragus');
  antiTragus.position.set(-.006,-.043,.007);ear.add(antiTragus);
  const lobe=ellipsoid(.027,.031,.019,flesh,'soft-earlobe');
  lobe.position.set(.001,-.076,.006);ear.add(lobe);
  root.add(ear);ears.push(ear);
 }
 root.userData.referenceFeatures={eyes,ears,options:opts};
 return root;
}
