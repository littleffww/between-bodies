const clamp=value=>Math.max(0,Math.min(1,value));
const follow=(current,target,dt,attack,release)=>current+(target-current)*(1-Math.exp(-dt/(target>current?attack:release)));

// Estimate articulation from envelope attacks, never the voice's fundamental
// frequency. Relative hysteresis works with both soft and loud syllables and
// does not turn one held vowel into rapid speech.
export class VoiceRhythm{
 constructor(){this.reset()}
 reset(){this.time=0;this.peak=0;this.previous=0;this.armed=true;this.attacks=[];this.pace=0;this.activity=0;return {pace:0,activity:0}}
 update(level,dt,active=true){
  if(!active)return this.reset();
  const step=Math.max(0,Math.min(.1,Number(dt)||0));
  if(!step)return {pace:this.pace,activity:this.activity};
  const value=clamp(Number(level)||0);this.time+=step;
  this.peak=Math.max(value,this.peak*Math.exp(-step/.8));
  const high=Math.max(.025,this.peak*.8),low=Math.max(.012,this.peak*.62);
  if(value<low)this.armed=true;
  const last=this.attacks.at(-1)??-Infinity;
  if(this.armed&&value>=high&&value>this.previous+.0005&&this.time-last>=.075){this.attacks.push(this.time);this.armed=false}
  this.previous=value;
  this.attacks=this.attacks.filter(t=>this.time-t<=2.8).slice(-20);
  const intervals=[];
  for(let i=1;i<this.attacks.length;i++){
   const interval=this.attacks[i]-this.attacks[i-1];
   if(interval>=.075&&interval<=1.6)intervals.push(interval);
  }
  let target=0;
  if(intervals.length){
   intervals.sort((a,b)=>a-b);
   const period=intervals[Math.floor(intervals.length/2)];
   const gap=this.time-this.attacks.at(-1),freshness=Math.exp(-Math.max(0,gap-Math.max(.28,period*1.5))/.35);
   target=clamp((1/period-.8)/5.2)*freshness;
  }
  this.pace=follow(this.pace,target,step,.15,.35);
  this.activity=follow(this.activity,clamp((value-.012)/.3),step,.035,.16);
  return {pace:this.pace,activity:this.activity};
 }
}
