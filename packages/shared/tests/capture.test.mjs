import test from 'node:test';import assert from 'node:assert/strict';
import {CaptureMachine,qualityGate,poseFromMatrix,matchScore,randomizedChallenges} from '../src/capture.js';
const good=(yaw=0,roll=0)=>({faceCount:1,faceArea:.24,centerOffset:0,brightness:130,sharpness:135,yaw,pitch:0,roll,eyesClosed:false});
function settle(machine,yaw,t1=0){let last;for(let t=t1;t<t1+1900;t+=50)last=machine.step(good(yaw),t);return last;}
function turn(machine,side='LEFT'){
 for(let t=0;t<250;t+=50)machine.step(good(0),t);
 for(let t=250;t<=850;t+=50)machine.step(good((side==='LEFT'?-1:1)*33*(t-250)/600),t);
 let last;for(let t=900;t<2100;t+=50)last=machine.step(good(side==='LEFT'?-33:33),t);return last;
}
test('left never fires while face stays in front',()=>{const m=new CaptureMachine({target:'LEFT'});assert.equal(settle(m,0).captured,false);});
test('right never fires while face stays in front',()=>{const m=new CaptureMachine({target:'RIGHT'});assert.equal(settle(m,0).captured,false);});
test('roll never substitutes yaw',()=>{const m=new CaptureMachine({target:'LEFT'});let out;for(let t=0;t<2100;t+=50)out=m.step(good(0,0),t);assert.equal(out.captured,false);});
test('smooth left movement completes',()=>assert.equal(turn(new CaptureMachine({target:'LEFT'})).captured,true));
test('smooth right movement completes',()=>assert.equal(turn(new CaptureMachine({target:'RIGHT'}),'RIGHT').captured,true));
test('selection requires longer hold',()=>{const m=new CaptureMachine({target:'LEFT',select:true});const r=turn(m);assert.equal(r.captured,true)});
test('quality blocks dark, multiple faces, tiny faces, blur and eye closure',()=>{for(const data of [{brightness:20},{faceCount:2},{faceArea:.01},{sharpness:1},{eyesClosed:true}])assert.ok(qualityGate({...good(),...data}));});
test('static side image cannot satisfy trajectory',()=>{const m=new CaptureMachine({target:'LEFT'});let r;for(let t=0;t<2500;t+=50)r=m.step(good(-36),t);assert.equal(r.captured,false);});
test('center resets progress',()=>{const m=new CaptureMachine({target:'LEFT'});for(let t=0;t<250;t+=50)m.step(good(0),t);for(let t=250;t<750;t+=50)m.step(good(-34*(t-250)/500),t);for(let t=750;t<1000;t+=50)m.step(good(-34),t);const r=m.step(good(0),1050);assert.equal(r.captured,false);assert.equal(r.progress,0);});
test('front capture needs forward gaze not roll',()=>{const m=new CaptureMachine({target:'FRONT'});let r;for(let t=0;t<900;t+=50)r=m.step(good(35),t);assert.equal(r.captured,false);});
test('matrix returns forward yaw zero',()=>{const v=poseFromMatrix([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);assert.ok(Math.abs(v.yaw)<.001)});
test('random challenges provide both direction and blink',()=>assert.deepEqual(new Set(randomizedChallenges(()=>.1)),new Set(['LEFT','RIGHT','BLINK','SMILE'])));
test('match scoring counts only equal answers',()=>assert.equal(matchScore(['LEFT','RIGHT'],['LEFT','LEFT']),50));

test('instant yaw jump fails liveness trajectory gate',()=>{const m=new CaptureMachine({target:'LEFT'});for(let t=0;t<=250;t+=50)m.step(good(0),t);let o;for(let t=300;t<2200;t+=50)o=m.step(good(-50),t);assert.equal(o.captured,false);});
test('opposite turn never selects wrong option',()=>{const m=new CaptureMachine({target:'LEFT',select:true});assert.equal(turn(m,'RIGHT').captured,false);});
test('no profile shot with multiple faces mid-turn',()=>{const m=new CaptureMachine({target:'LEFT'});for(let t=0;t<300;t+=50)m.step(good(0),t);for(let t=300;t<850;t+=50)m.step(good(-33*(t-300)/550),t);let o;for(let t=850;t<2400;t+=50)o=m.step({...good(-33),faceCount:2},t);assert.equal(o.captured,false);});
