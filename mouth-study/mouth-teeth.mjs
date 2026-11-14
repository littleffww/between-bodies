import * as T from './vendor/three.module.js';
import {mouthSurfaceGLSL} from './mouth-surface.mjs?v=lip-gradient';

// Each crown has its own size, rotation, color, and position along the upper arch.
const crowns = [
 {x:-.398, width:.112, height:.084, depth:.058, tilt:.17, setback:.026, shift:-.006, color:0xb8a68e},
 {x:-.257, width:.152, height:.110, depth:.069, tilt:-.12, setback:.011, shift:.008, color:0xc0ad94},
 {x:-.087, width:.178, height:.132, depth:.079, tilt:.075, setback:0, shift:.002, color:0xc8b69e},
 {x: .095, width:.166, height:.145, depth:.081, tilt:-.085, setback:.014, shift:-.008, color:0xc4b297},
 {x: .261, width:.140, height:.104, depth:.066, tilt:.16, setback:.021, shift:.004, color:0xbeaa90},
 {x: .402, width:.107, height:.093, depth:.066, tilt:-.20, setback:.034, shift:-.005, color:0xb5a188},
];

function createCrown({width, height, depth, tilt, x, setback, shift}) {
 const geometry = new T.SphereGeometry(1, 24, 16);
 const positions = geometry.attributes.position;
 const round = (value, exponent) => Math.sign(value) * Math.pow(Math.abs(value), exponent);
 for (let i = 0; i < positions.count; i++) {
  const y = positions.getY(i);
  const taper = .92 - .11 * y;
  positions.setXYZ(i, round(positions.getX(i), .62) * width * .5 * taper,
   round(y, .59) * height * .5, round(positions.getZ(i), .83) * depth * .5);
 }
 geometry.rotateY(x * .62);
 geometry.rotateZ(tilt);
 geometry.translate(shift, .031 - height * .5, -.088 - setback);
 geometry.computeVertexNormals();
 return geometry;
}

export function createUpperTeeth(uniforms, vertexPrelude) {
 const teeth = new T.Group();
 teeth.visible = false;
 for (const crown of crowns) {
  const material = new T.MeshLambertMaterial({color:crown.color, fog:true});
  material.onBeforeCompile = shader => {
   Object.assign(shader.uniforms, uniforms, {crownAcross:{value:crown.x}});
   shader.vertexShader = vertexPrelude + '\nuniform float crownAcross;\nvarying vec3 crownWindow;\n' + shader.vertexShader;
   shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
    vec4 profile=lipProfile(crownAcross);
    float theta=crownAcross*mouthWidth();
    float upperEdge=lipsCenter(crownAcross,profile)+lipAperture(crownAcross,profile)*.53*mouthVerticalScale();
    vec3 anchor=vec3(sin(theta)*sqrt(1.-upperEdge*upperEdge),upperEdge,cos(theta)*sqrt(1.-upperEdge*upperEdge));
    vec3 transformed=fleshBase(anchor)+position;
    crownWindow=normalize(anchor+vec3(position.x/(2.+stretch),position.y,0.));
   `);
   shader.fragmentShader = mouthSurfaceGLSL + '\nvarying vec3 crownWindow;\n' + shader.fragmentShader;
   shader.fragmentShader = shader.fragmentShader.replace('void main() {', `
    void main() {
     if(mouthSurface(crownWindow).z<.20)discard;
   `);
  };
  const mesh = new T.Mesh(createCrown(crown), material);
  mesh.frustumCulled = false;
  teeth.add(mesh);
 }
 return teeth;
}
