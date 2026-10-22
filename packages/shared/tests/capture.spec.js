import {describe,it,expect} from 'vitest';
import {CaptureMachine,qualityGate} from '../src/capture.js';
const face=yaw=>({faceCount:1,faceArea:.2,centerOffset:0,brightness:134,sharpness:99,yaw,pitch:0,roll:0,eyesClosed:false});
describe('no false captures',()=>{
 it('cannot capture LEFT from a stationary forward face',()=>{const m=new CaptureMachine({target:'LEFT'});let r;for(let t=0;t<2000;t+=40)r=m.step(face(0),t);expect(r.captured).toBe(false)});
 it('does not accept static side photo',()=>{const m=new CaptureMachine({target:'RIGHT'});let r;for(let t=0;t<2000;t+=40)r=m.step(face(38),t);expect(r.captured).toBe(false)});
 it('never captures blurry frames',()=>expect(qualityGate({...face(30),sharpness:1})).toBeTruthy());
});
