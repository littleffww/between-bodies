// The lip profile is evaluated in rest coordinates so it stays attached to the body.
export const mouthSurfaceGLSL=`
uniform sampler2D mouthProfile;
uniform float mouthGrowth, mouthVoice, stretch;
float mouthWidth(){return .54/(1.+stretch*.29);}
float mouthVerticalScale(){return 1.+stretch*.27;}
float mouthAcross(vec3 p){return atan(p.x,p.z)/mouthWidth();}
float lipSpan(float x){return pow(max(0.,1.-x*x),.61);}
vec4 lipProfile(float x){return texture2D(mouthProfile,vec2((clamp(x*.5+.5,0.,1.)*255.+.5)/256.,.5));}
float lipsCenter(float x,vec4 profile){
 return .135+((profile.r-.5)*.16-.025*pow(abs(x),2.))*mouthVerticalScale();
}
float lipAperture(float x,vec4 profile){
 return (.005+profile.a*.005+mouthVoice*.080)*lipSpan(x)*mouthGrowth;
}
float roundedLip(float distanceFromSeam,float width){
 float t=clamp(distanceFromSeam/width,0.,1.);
 return pow(max(0.,sin(t*3.14159265)),1.85);
}
vec4 mouthSurface(vec3 p){
 if(mouthGrowth<.001||p.z<.26)return vec4(0.);
 float x=mouthAcross(p);
 if(abs(x)>=1.)return vec4(0.);
 vec4 profile=lipProfile(x);
 float span=lipSpan(x);
 float fade=(1.-smoothstep(.65,1.,abs(x)))*mouthGrowth;
 float y=(p.y-lipsCenter(x,profile))/mouthVerticalScale();
 float aperture=lipAperture(x,profile);
 float above=y-aperture*.53;
 float below=-aperture*1.27-y;
 float bow=exp(-pow((abs(x)-.24)/.24,2.));
 float lowerFullness=exp(-pow((abs(x)-.28)/.38,2.));
 float lowerGroove=exp(-pow(x/.088,2.));
 float upperWidth=max(.012,span*(.195+.049*bow+profile.g*.067));
 float lowerWidth=max(.012,span*(.165+.059*lowerFullness+profile.b*.059-.015*lowerGroove));
 float upperLip=roundedLip(above+.018*span,upperWidth+.055*span);
 float lowerLip=roundedLip(below,lowerWidth);
 // Tint peaks just outside the opening and feathers toward the surrounding skin.
 float upperFromSeam=above/upperWidth;
 float lowerFromSeam=below/lowerWidth;
 float upperTint=smoothstep(.015,.20,upperFromSeam)*(1.-smoothstep(.22,.80,upperFromSeam));
 float lowerTint=smoothstep(.015,.22,lowerFromSeam)*(1.-smoothstep(.26,.84,lowerFromSeam));
 float inside=min(-above,-below);
 float cavity=smoothstep(-.017,.042,inside)*fade;
 float hollow=smoothstep(-.015,.071,inside)*fade;
 float height=(upperLip*(.170+.041*bow)+lowerLip*(.147+.055*lowerFullness-.024*lowerGroove))*span*fade;
 height-=hollow*(.074+mouthVoice*.212);
 height+=(exp(-pow((above-upperWidth*.70)/.173,2.))*.032+
          exp(-pow((below-lowerWidth*.68)/.152,2.))*.026)*span*fade;
 float lipArea=max(upperLip,lowerLip)*fade;
 return vec4(height,lipArea,cavity,clamp(upperTint*.93+lowerTint*.76,0.,1.)*fade);
}
`;
