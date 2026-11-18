const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class SculptureMotion{
 constructor(){this.time=0;this.speed=5;this.enabled=true;this.irregular=true;this.shakeEnabled=true;this.strength=1;this.velocity=0;this.shakePhase=0}
 configure(values){
  if('speed' in values)this.speed=clamp(Number(values.speed)||0,0,90);
  for(const key of ['enabled','irregular','shakeEnabled'])if(key in values)this[key]=!!values[key];
  if('strength' in values)this.strength=clamp(Number(values.strength)||0,0,2);
 }
 update(dt,{paused=false,pace=0,activity=0}={}){
  dt=clamp(Number(dt)||0,0,.1);
  if(paused)return {rotation:0,degrees:0,shakePhase:this.shakePhase,shakeAmount:0};
  this.time+=dt;
  // Smooth incommensurate curves vary the speed without ever reversing it.
  const variation=this.irregular?1+.46*Math.sin(this.time*.71)+.25*Math.sin(this.time*1.93+1.7)+.12*Math.sin(this.time*.29+.4):1;
  const target=this.enabled?this.speed*variation:0;
  this.velocity+=(target-this.velocity)*(1-Math.exp(-dt*4));
  if(!this.enabled||!this.speed)this.velocity=0;
  pace=clamp(pace,0,1);activity=clamp(activity,0,1);
  if(this.shakeEnabled&&activity>.001)this.shakePhase=(this.shakePhase+dt*Math.PI*2*(3+pace*9))%(Math.PI*2*100);
  return {rotation:this.velocity*Math.PI/180*dt,degrees:this.velocity,shakePhase:this.shakePhase,shakeAmount:this.shakeEnabled?activity*(.025+.025*pace)*this.strength:0};
 }
}
