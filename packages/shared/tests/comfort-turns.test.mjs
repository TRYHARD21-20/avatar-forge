import test from 'node:test';
import assert from 'node:assert/strict';
import {CaptureMachine,DEFAULTS} from '../src/capture.js';

const face=(yaw=0,add={})=>({faceCount:1,faceArea:.24,centerOffset:0,brightness:130,sharpness:130,yaw,pitch:0,roll:0,eyesClosed:false,...add});

/** Mimic a realistic low-frame-rate mobile webcam with a gradual head turn. */
function stream(target='LEFT',{easy=false,select=false,angle=24,mirror=false,jitter=0}={}){
 const m=new CaptureMachine({target,easy,select,mirror});
 let result;
 for(let t=0;t<=250;t+=50)result=m.step(face(0),t);
 const sign=target==='LEFT'?-1:1;
 for(let t=300;t<=750;t+=50)result=m.step(face(sign*angle*(t-250)/500),t);
 for(let t=800;t<=2700;t+=50)result=m.step(face(sign*(angle+((t/50)%2?jitter:0))),t);
 return result;
}

test('standard capture registers a modest gradual 24-degree LEFT turn',()=>assert.equal(stream('LEFT').captured,true));
test('standard capture registers a modest gradual 24-degree RIGHT turn',()=>assert.equal(stream('RIGHT').captured,true));
test('turn-to-select uses same softened thresholds with a hold',()=>assert.equal(stream('RIGHT',{select:true}).captured,true));
test('comfort mode registers a 19-degree LEFT turn',()=>assert.equal(stream('LEFT',{easy:true,angle:19}).captured,true));
test('comfort mode registers a 19-degree RIGHT selection',()=>assert.equal(stream('RIGHT',{easy:true,select:true,angle:19}).captured,true));
test('normal mode will not accept a tiny 12-degree turn',()=>assert.equal(stream('LEFT',{angle:12}).captured,false));
test('comfort mode still rejects a tiny 9-degree turn',()=>assert.equal(stream('RIGHT',{easy:true,angle:9}).captured,false));
test('a stationary frontal face cannot collect LEFT or RIGHT even in comfort mode',()=>{
 for(const target of ['LEFT','RIGHT']){
  const m=new CaptureMachine({target,easy:true,select:true});let r;
  for(let t=0;t<2700;t+=50)r=m.step(face(0),t);
  assert.equal(r.captured,false);
 }
});
test('static side photo cannot pass comfort mode center-first gate',()=>{
 const m=new CaptureMachine({target:'LEFT',easy:true});let r;
 for(let t=0;t<2700;t+=50)r=m.step(face(-24),t);
 assert.equal(r.captured,false);
});
test('roll-only tilt cannot count as turning in comfort mode',()=>{
 const m=new CaptureMachine({target:'RIGHT',easy:true});let r;
 for(let t=0;t<2700;t+=50)r=m.step(face(0,{roll:15}),t);
 assert.equal(r.captured,false);
});
test('reversed-direction toggle swaps only yaw choice, never the anti-spoof gate',()=>{
 const m=new CaptureMachine({target:'RIGHT',mirror:true});let r;
 for(let t=0;t<=250;t+=50)m.step(face(0),t);
 for(let t=300;t<=750;t+=50)m.step(face(-24*(t-250)/500),t);
 for(let t=800;t<=2100;t+=50)r=m.step(face(-24),t);
 assert.equal(r.captured,true);
 assert.equal(stream('RIGHT',{mirror:true}).captured,false);
});
test('small jitter near the threshold does not erase a valid side hold',()=>{
 const m=new CaptureMachine({target:'LEFT'});let r;
 for(let t=0;t<=250;t+=50)m.step(face(0),t);
 for(let t=300;t<=750;t+=50)m.step(face(-26*(t-250)/500),t);
 for(let t=800;t<=2000;t+=50){r=m.step(face(t%100===0?-19:-23),t);}
 assert.equal(r.captured,true);
});
test('returning to forward resets hold even with hysteresis',()=>{
 const m=new CaptureMachine({target:'RIGHT'});
 for(let t=0;t<=250;t+=50)m.step(face(0),t);
 for(let t=300;t<=750;t+=50)m.step(face(26*(t-250)/500),t);
 for(let t=800;t<=1150;t+=50)m.step(face(26),t);
 let r;for(let t=1200;t<=1500;t+=50)r=m.step(face(0),t);
 assert.equal(r.captured,false);assert.equal(r.progress,0);
});
test('a multiple-face interruption blocks capture',()=>{
 const m=new CaptureMachine({target:'LEFT'});
 for(let t=0;t<=250;t+=50)m.step(face(0),t);
 for(let t=300;t<=750;t+=50)m.step(face(-24*(t-250)/500),t);
 let r;for(let t=800;t<=2600;t+=50)r=m.step(face(-24,{faceCount:2}),t);
 assert.equal(r.captured,false);
});
test('reported thresholds match real settings',()=>{assert.equal(DEFAULTS.sideYaw,21);assert.equal(DEFAULTS.easySideYaw,16)});
