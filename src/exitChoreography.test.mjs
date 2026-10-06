import assert from 'node:assert/strict';
import {exitPose,EXIT_COMPLETE_MS} from './exitChoreography.js';
let prior=exitPose(0);let turned=false;
for(let age=16;age<=EXIT_COMPLETE_MS;age+=16){const p=exitPose(age);assert(p.distance>=prior.distance);assert(Math.hypot(p.x-prior.x,p.z-prior.z)<.06,'Motion is continuous at segment boundaries');if(p.yaw!==0){turned=true;assert(p.x-Math.abs(Math.cos(p.yaw))-.4*Math.abs(Math.sin(p.yaw))>6.05,'Rear/body stays clear of the exit fence');assert(p.x+Math.abs(Math.cos(p.yaw))+.4*Math.abs(Math.sin(p.yaw))<8.91,'Body remains inside widened street');}prior=p;}
assert(turned);assert.equal(exitPose(EXIT_COMPLETE_MS).visible,false);assert.equal(exitPose(EXIT_COMPLETE_MS).follow,0);assert.equal(exitPose(EXIT_COMPLETE_MS).complete,true);
assert.equal(exitPose(0,5,2.5,true).follow,0);assert.equal(exitPose(120,5,2.5,true).complete,true);
console.log('Exit path continuity, fence/street clearance, completion and reduced motion passed.');
