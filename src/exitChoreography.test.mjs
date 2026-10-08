import assert from 'node:assert/strict';
import {exitPose,exitSceneFade,EXIT_COMPLETE_MS} from './exitChoreography.js';
let prior=exitPose(0),turned=false,maxSteering=0;
for(let age=16;age<=EXIT_COMPLETE_MS;age+=16){
  const p=exitPose(age);
  assert(p.distance>=prior.distance);
  assert(Math.hypot(p.x-prior.x,p.z-prior.z)<.06,'Position remains continuous');
  assert(Math.abs(p.steering-prior.steering)<.04,'Steering must build and unwind smoothly');
  assert(Math.abs(p.yaw-prior.yaw)<.05,'Heading changes without a sudden turn');
  assert(p.bank<=0,'Body rolls gently toward the outside of the turn');
  if(p.visible)assert(p.z+1<10.15,'Visible car stays on the supported road');
  if(!p.visible&&!p.complete)assert.equal(exitSceneFade(age),1,'No car disappearance is exposed on an open street');
  if(p.yaw!==0){
    turned=true;
    assert(p.x-Math.abs(Math.cos(p.yaw))-.44*Math.abs(Math.sin(p.yaw))>6.05,'Rear/body clears exit fence');
    assert(p.x+Math.abs(Math.cos(p.yaw))+.44*Math.abs(Math.sin(p.yaw))<10.08,'Body stays inside integral street');
  }
  maxSteering=Math.max(maxSteering,Math.abs(p.steering));prior=p;
}
assert(turned&&maxSteering>.4&&maxSteering<.6);
const end=exitPose(EXIT_COMPLETE_MS);
assert.equal(end.visible,false,'Departing car is removed behind the cinematic cut');
assert.equal(end.follow,0);assert.equal(end.complete,true);assert.equal(Math.abs(end.steering),0);
assert.equal(exitPose(5250).follow,1,'Camera must not move back while the departing car is still visible');
assert(exitPose(5470).follow<1&&exitSceneFade(5470)===1,'Camera restoration belongs behind the opaque cut');
for(let age=300;age<5300;age+=17){
 const a=exitPose(age),b=exitPose(age+1);
 assert(Number.isFinite(a.speed)&&a.speed>=0);
 assert(Math.abs(a.speed-b.speed)<.02,'Speed must vary continuously instead of jumping at animation phases');
 assert(Math.abs(a.bank)<=.016,'Cornering load must remain subtle');
}
assert(exitPose(5350).z>exitPose(5200).z,'Car keeps moving as the shot fades');
assert.equal(exitSceneFade(5400),1);assert.equal(exitSceneFade(6300),0);assert.equal(exitSceneFade(5400,true),0);
const turning=exitPose(3000);
assert(Math.abs(turning.steeringPair[1])>Math.abs(turning.steeringPair[0]),'Inside wheel steers more sharply');
assert.equal(exitPose(0,5,2.5,true).follow,0);assert.equal(exitPose(120,5,2.5,true).complete,true);
// Verify the rendered wheel heading against the derivative of its own world
// trajectory, rather than only checking that its angle changes continuously.
const wheelPoint=(p,x,z)=>[p.x+x*Math.cos(p.yaw)+z*Math.sin(p.yaw),p.z-x*Math.sin(p.yaw)+z*Math.cos(p.yaw)];
let maxReturnRate=0;
for(let age=1200;age<4900;age+=2){
 const p=exitPose(age),before=exitPose(age-1),after=exitPose(age+1);
 for(const [x,z,index]of [[.66,-.405,0],[.66,.405,1],[-.67,-.43,-1],[-.67,.43,-1]]){
  const a=wheelPoint(before,x,z),b=wheelPoint(after,x,z),dx=b[0]-a[0],dz=b[1]-a[1];
  const heading=-p.yaw-(index<0?0:p.steeringPair[index]);
  const error=Math.atan2(dz*Math.cos(heading)-dx*Math.sin(heading),dx*Math.cos(heading)+dz*Math.sin(heading));
  assert(Math.abs(error)<.012,'Each wheel must point along its actual travel direction, without visual steering lag');
 }
 for(let i=0;i<2;i++)maxReturnRate=Math.max(maxReturnRate,(after.steeringPair[i]-before.steeringPair[i])/.002);
}
assert(maxReturnRate<1.2,'Unwinding must stay below 69 degrees per second through the whole visible turn');
console.log('Smooth steering, continuous heading, fence/street clearance and camera restoration passed.');
