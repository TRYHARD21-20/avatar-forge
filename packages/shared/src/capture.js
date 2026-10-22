/** Privacy-first, dependency-free camera gate. All angles are degrees. */
export const DEFAULTS = Object.freeze({frontYaw:8,frontPitch:12,sideYaw:21,easySideYaw:16,holdMs:600,easyHoldMs:800,selectHoldMs:750,easySelectHoldMs:900,sideHysteresis:4,maxRoll:18,maxVelocity:220,minFaceArea:0.085,maxCenterOffset:.30,minSharpness:24,minBrightness:53,maxBrightness:218});
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const ema=(oldValue,next,alpha=.36)=>oldValue==null?next:oldValue*(1-alpha)+next*alpha;
export function poseFromMatrix(data){
 if(!data||data.length<16||!data.every(Number.isFinite))return null;
 // MediaPipe transform matrices are column-major. Yaw from forward vector,
 // pitch from forward elevation; this convention is verified visually in /dev.
 const yaw=Math.atan2(data[8],data[10])*180/Math.PI;
 const pitch=Math.atan2(-data[9],Math.hypot(data[8],data[10]))*180/Math.PI;
 const roll=Math.atan2(data[1],data[0])*180/Math.PI;
 return {yaw,pitch,roll,source:'matrix'};
}
export function poseFromLandmarks(points){
 if(!points||points.length<455)return null;
 const nose=points[1],left=points[234],right=points[454],a=points[33],b=points[263];
 if(!nose||!left||!right||!a||!b)return null;
 // Relative horizontal nose position compensates approximately for image scale.
 const mid=(left.x+right.x)/2, width=Math.max(.01,right.x-left.x);
 const yaw=clamp((nose.x-mid)/width*90,-65,65);
 const eyeCenterY=(a.y+b.y)/2, faceHeight=Math.max(.01,points[152].y-points[10].y);
 const pitch=clamp((nose.y-eyeCenterY)/faceHeight*65-15,-35,35);
 const roll=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
 return {yaw,pitch,roll,source:'landmarks'};
}
export function qualityGate(o,{easy=false,blinkTask=false}={}){
 if(!o||!o.faceCount)return 'No face found';
 if(o.faceCount!==1)return 'One face at a time';
 if((o.faceArea??0)<DEFAULTS.minFaceArea)return 'Move closer';
 if(Math.abs(o.centerOffset??1)>DEFAULTS.maxCenterOffset)return 'Center your face';
 if((o.brightness??0)<DEFAULTS.minBrightness)return 'More light please';
 if((o.brightness??255)>DEFAULTS.maxBrightness)return 'Too bright — find softer light';
 if((o.sharpness??0)<DEFAULTS.minSharpness)return 'Hold still for a sharper photo';
 if(!blinkTask&&(o.eyesClosed??false))return 'Keep your eyes open';
 if(Math.abs(o.roll??0)>DEFAULTS.maxRoll)return 'Keep your head upright';
 if(Math.abs(o.pitch??0)>(easy?25:23))return 'Keep your chin level';
 if(Math.abs(o.velocity??0)>DEFAULTS.maxVelocity)return 'Turn more slowly';
 return null;
}
export function qualityScore(o,target='FRONT',easy=false){
 const ideal=target==='FRONT'?0:easy?DEFAULTS.easySideYaw:DEFAULTS.sideYaw;
 const angle=target==='FRONT'?Math.abs(o.yaw):Math.abs(Math.abs(o.yaw)-ideal);
 const sharp=clamp((o.sharpness-24)/110,0,1);
 const exp=clamp(1-Math.abs(o.brightness-133)/95,0,1);
 const pose=clamp(1-angle/35,0,1);
 const size=clamp((o.faceArea-.08)/.2,0,1);
 const still=clamp(1-Math.abs(o.velocity||0)/170,0,1);
 return Math.round(100*(.26*sharp+.20*exp+.23*pose+.16*size+.15*still));
}
export function randomizedChallenges(random=Math.random){
 const a=['LEFT','RIGHT'];if(random()<.5)a.reverse();
 const b=random()<.5?['BLINK','SMILE']:['SMILE','BLINK'];
 return [...a,...b];
}
const DEFAULT_OBS={faceCount:0,faceArea:0,centerOffset:0,brightness:0,sharpness:0,yaw:0,pitch:0,roll:0,eyesClosed:false,velocity:0};
export class CaptureMachine {
 constructor({target='LEFT',easy=false,select=false,mirror=false}={}) {this.target=target;this.easy=easy;this.select=select;this.mirror=mirror;this.reset();}
 reset(){this.state='IDLE';this.smoothYaw=null;this.lastYaw=null;this.lastAt=null;this.holdFrom=null;this.startedCenter=false;this.primeAt=null;this.turnStart=null;this.turnDistance=0;this.samples=0;this.trajectorySamples=0;this.maxStep=0;this.captured=false;this.lastResult=null;return this;}
 step(observation,at=performanceNow()){
  if(this.captured)return this.lastResult;
  const o={...DEFAULT_OBS,...observation};
  this.smoothYaw=ema(this.smoothYaw,o.yaw,.60);
  const yaw=this.smoothYaw;
  const dt=this.lastAt===null?0:Math.max(1,at-this.lastAt);
  const delta=this.lastYaw===null?0:Math.abs(yaw-this.lastYaw);
  const vel=this.lastAt===null?0:delta/dt*1000;
  this.lastYaw=yaw;this.lastAt=at;
  o.velocity=Math.max(Math.abs(o.velocity||0),vel);
  const fail=qualityGate(o,{easy:this.easy,blinkTask:this.target==='BLINK'});
  if(fail){this.state='SEARCHING';this.holdFrom=null;this.primeAt=null;this.turnStart=null;this.startedCenter=false;this.turnDistance=0;this.trajectorySamples=0;return this.result(0,fail,o);}
  const front=Math.abs(yaw)<DEFAULTS.frontYaw&&Math.abs(o.pitch)<DEFAULTS.frontPitch;
  if(this.target==='FRONT'){
   if(!front){this.state='ALIGNING';this.holdFrom=null;return this.result(0,'Look straight at the camera',o);}
   return this.hold(o,at,'Hold that front pose');
  }
  if(this.target==='BLINK'||this.target==='SMILE'){
   const active=this.target==='BLINK'?!!o.eyesClosed:!!o.smiling;
   if(!active){this.holdFrom=null;this.state='ALIGNING';return this.result(0,this.target==='BLINK'?'Blink once':'Give us a smile',o);}
   return this.hold(o,at,this.target==='BLINK'?'Lovely blink!':'Great smile!',180);
  }
  // Never let a side capture start from a static profile image or roll-only pose.
  if(!this.startedCenter){
   this.state='ALIGNING';
   if(front){if(this.primeAt===null)this.primeAt=at;if(at-this.primeAt>=180){this.startedCenter=true;this.turnStart=at;this.trajectorySamples=0;this.maxStep=0;}}
   else this.primeAt=null;
   return this.result(0,'Look straight to start',o);
  }
  // Physical yaw is the only allowed movement. The Flip Directions control changes
  // the left/right interpretation, never roll or pitch. No simulated turn is accepted.
  const signed=this.mirror?-yaw:yaw;
  const towardsTarget=this.target==='LEFT'?-signed:signed;
  const enter=this.easy?DEFAULTS.easySideYaw:DEFAULTS.sideYaw;
  // Hysteresis: while already holding, a few degrees of harmless tracking jitter
  // must not erase progress. Returning to front or turning the wrong way always does.
  const release=enter-DEFAULTS.sideHysteresis;
  const onSide=towardsTarget>=(this.holdFrom===null?enter:release);
  if(front){this.turnDistance=0;this.turnStart=at;this.holdFrom=null;this.trajectorySamples=0;this.maxStep=0;this.state='ALIGNING';return this.result(0,'Now turn toward your choice',o);}
  this.turnDistance=Math.max(this.turnDistance,Math.max(0,towardsTarget));
  this.trajectorySamples++;this.maxStep=Math.max(this.maxStep,delta);
  const elapsed=at-(this.turnStart??at);
  if(!onSide){this.holdFrom=null;this.state='ALIGNING';return this.result(0,towardsTarget<0?'Turn the other way':`Turn a little more · ${Math.max(0,Math.round(towardsTarget))}°/${enter}°`,o);}
  // Require a continuous, gradual center-to-side trajectory. Merely showing a
  // profile photo or tilting your head never qualifies for a verified capture.
  if(elapsed<140||this.turnDistance<enter||this.trajectorySamples<4||this.maxStep>14){this.holdFrom=null;this.state='ALIGNING';return this.result(0,'Turn gradually, not instantly',o);}
  return this.hold(o,at,'Hold that angle');
 }
 hold(o,at,hint,overrideMs){
  this.samples++;
  if(this.holdFrom===null)this.holdFrom=at;
  const duration=overrideMs??(this.select?(this.easy?DEFAULTS.easySelectHoldMs:DEFAULTS.selectHoldMs):(this.easy?DEFAULTS.easyHoldMs:DEFAULTS.holdMs));
  const progress=clamp((at-this.holdFrom)/duration,0,1);
  this.state=progress===1?'CAPTURED':'HOLDING';
  if(progress===1)this.captured=true;
  return this.result(progress,progress===1?'Perfect! Shot locked':hint,o);
 }
 result(progress,hint,o){
  const enter=this.easy?DEFAULTS.easySideYaw:DEFAULTS.sideYaw;
  const signed=this.mirror?-(this.smoothYaw??0):(this.smoothYaw??0);
  const sideAngle=this.target==='LEFT'?-signed:this.target==='RIGHT'?signed:0;
  const turnProgress=this.target==='LEFT'||this.target==='RIGHT'?clamp((sideAngle-DEFAULTS.frontYaw)/(enter-DEFAULTS.frontYaw),0,1):0;
  const r={state:this.state,progress,turnProgress,requiredYaw:enter,hint,captured:this.captured,quality:this.captured?qualityScore(o,this.target,this.easy):null,yaw:this.smoothYaw??0,source:o.source||'unknown',target:this.target};this.lastResult=r;return r;
 }
}
function performanceNow(){return globalThis.performance?.now?.()??Date.now();}
export function entertainmentScore(seed,maximum=100){let h=2166136261;for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return Math.abs(h%maximum);}
export function matchScore(a,b){if(!a.length||!b.length)return 0;return Math.round(100*a.filter((v,i)=>v===b[i]).length/Math.min(a.length,b.length));}
