import assert from 'node:assert/strict';
import {exitPose,EXIT_COMPLETE_MS} from './exitChoreography.js';
let prior=exitPose(0),turned=false,maxSteering=0;
for(let age=16;age<=EXIT_COMPLETE_MS;age+=16){
  const p=exitPose(age);
  assert(p.distance>=prior.distance);
  assert(Math.hypot(p.x-prior.x,p.z-prior.z)<.06,'Position remains continuous');
  assert(Math.abs(p.steering-prior.steering)<.04,'Steering must build and unwind smoothly');
  assert(Math.abs(p.yaw-prior.yaw)<.05,'Heading changes without a sudden turn');
  assert(p.bank<=0,'Body rolls gently toward the outside of the turn');
  if(p.yaw!==0){
    turned=true;
    assert(p.x-Math.abs(Math.cos(p.yaw))-.44*Math.abs(Math.sin(p.yaw))>6.05,'Rear/body clears exit fence');
    assert(p.x+Math.abs(Math.cos(p.yaw))+.44*Math.abs(Math.sin(p.yaw))<10.08,'Body stays inside integral street');
  }
  maxSteering=Math.max(maxSteering,Math.abs(p.steering));prior=p;
}
assert(turned&&maxSteering>.4&&maxSteering<.6);
const end=exitPose(EXIT_COMPLETE_MS);
assert.equal(end.visible,false,'Car departs beneath the street passage');
assert.equal(end.follow,0);assert.equal(end.complete,true);assert.equal(Math.abs(end.steering),0);
assert(end.z>9.27&&end.z+.67<10.25,'Car is inside the passage, still supported by asphalt');
const turning=exitPose(3000);
assert(Math.abs(turning.steeringPair[1])>Math.abs(turning.steeringPair[0]),'Inside wheel steers more sharply');
assert.equal(exitPose(0,5,2.5,true).follow,0);assert.equal(exitPose(120,5,2.5,true).complete,true);
console.log('Smooth steering, continuous heading, fence/street clearance and camera restoration passed.');
