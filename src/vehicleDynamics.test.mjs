import assert from 'node:assert/strict';
import {stepSuspension,contactImpulse,SUSPENSION_PROFILES} from './vehicleDynamics.js';
const initial=()=>({speed:0,pitch:0,rate:0,heave:0,heaveRate:0});
for(const fps of [30,60,120]){
  let state=initial(),peak=0;
  for(let i=0;i<fps*3;i++){
    state=stepSuspension(state,i<fps?12:0,1/fps);peak=Math.max(peak,Math.abs(state.pitch));
    assert.ok(Number.isFinite(state.pitch));assert.ok(Math.abs(state.pitch)<=.02);
    assert.ok(Number.isFinite(state.heave)&&state.heave>=-.006&&state.heave<=0,'Compression stays bounded and never floats.');
  }
  assert.ok(peak>.0001,'Chassis responds to acceleration.');
  assert.ok(Math.abs(state.pitch)<.000001,'Chassis settles without perpetual rocking.');
  assert.ok(Math.abs(state.heave)<.000001,'Vertical spring must settle.');
}
let stationary=initial();for(let i=0;i<120;i++)stationary=stepSuspension(stationary,0,1/60);
assert.deepEqual(stationary,initial(),'A blocked stationary car must not oscillate.');
for(const direction of [-1,1]){
  let state=contactImpulse(initial(),direction),peak=0;
  for(let i=0;i<90;i++){state=stepSuspension(state,0,1/60);peak=Math.max(peak,Math.abs(state.pitch));assert.ok(state.pitch*direction<=0,'Contact settles from one side without alternating shake.');}
  assert.ok(peak>.012&&peak<=.02,'Contact is perceptible but bounded.');assert.ok(Math.abs(state.pitch)<.000001);
  assert.ok(Math.abs(state.heave)<.000001,'Contact compression returns to rest.');
}
console.log('Bounded chassis suspension, stationary stability and 30/60/120 Hz settling passed.');
for(const [name,profile]of Object.entries(SUSPENSION_PROFILES))for(const fps of [30,60,120]){
  let state=contactImpulse(initial(),1),compressed=false;
  for(let i=0;i<fps*2;i++){
    state=stepSuspension(state,0,1/fps,profile);
    assert.ok(state.pitch<=0&&state.pitch>=-.02,`${name}: contact remains single-sided and bounded`);
    assert.ok(state.heave<=0&&state.heave>=-.006,`${name}: vertical spring stays grounded`);
    compressed||=state.heave<-.0005;
  }
  assert.ok(compressed);assert.ok(Math.abs(state.pitch)<.000001&&Math.abs(state.heave)<.000001,`${name}: independent springs settle`);
}
