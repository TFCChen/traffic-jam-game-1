import assert from 'node:assert/strict';
import {stepSuspension,contactImpulse} from './vehicleDynamics.js';
const initial=()=>({speed:0,pitch:0,rate:0});
for(const fps of [30,60,120]){
  let state=initial(),peak=0;
  for(let i=0;i<fps*3;i++){
    state=stepSuspension(state,i<fps?12:0,1/fps);peak=Math.max(peak,Math.abs(state.pitch));
    assert.ok(Number.isFinite(state.pitch));assert.ok(Math.abs(state.pitch)<=.02);
  }
  assert.ok(peak>.0001,'Chassis responds to acceleration.');
  assert.ok(Math.abs(state.pitch)<.000001,'Chassis settles without perpetual rocking.');
}
let stationary=initial();for(let i=0;i<120;i++)stationary=stepSuspension(stationary,0,1/60);
assert.deepEqual(stationary,initial(),'A blocked stationary car must not oscillate.');
for(const direction of [-1,1]){
  let state=contactImpulse(initial(),direction),peak=0;
  for(let i=0;i<90;i++){state=stepSuspension(state,0,1/60);peak=Math.max(peak,Math.abs(state.pitch));assert.ok(state.pitch*direction<=0,'Contact settles from one side without alternating shake.');}
  assert.ok(peak>.012&&peak<=.02,'Contact is perceptible but bounded.');assert.ok(Math.abs(state.pitch)<.000001);
}
console.log('Bounded chassis suspension, stationary stability and 30/60/120 Hz settling passed.');
