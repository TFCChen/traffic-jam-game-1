import assert from 'node:assert/strict';
import { placementAt, legalPlacements, placementBetween, drawingCells } from './editorPlacement.js';
const tool={dir:'V',len:3,color:'#2563eb'};
assert.equal(legalPlacements([],tool).length,5);
assert.equal(placementAt([],tool,{row:0,col:0}).valid,false);
assert.deepEqual(placementAt([],tool,{row:2,col:4}).cells,[{row:2,col:4},{row:2,col:5}]);
const cars=[{id:'target',row:2,col:0,dir:'H',len:2}];
assert.equal(placementAt(cars,tool,{row:0,col:0}).valid,false,'Footprint crosses occupied cell');
assert.equal(placementAt(cars,tool,{row:4,col:3}).valid,false,'Footprint extends past edge');
assert.equal(placementAt(cars,tool,{row:1,col:3}).valid,true);
assert.equal(placementAt(cars,{...tool,dir:'H'},{row:0,col:4}).valid,false);
assert.equal(legalPlacements(cars,tool).length,18);
console.log('Editor placement respects exit lane, orientation, full footprint and grid bounds.');
assert.equal(drawingCells([]).length,6,'Red car can start from either end of a pair on the exit lane');
for(const [start,end,dir,len,row,col] of [
  [{row:0,col:3},{row:0,col:1},'H',3,0,1],
  [{row:5,col:4},{row:4,col:4},'V',2,4,4],
  [{row:0,col:2},{row:2,col:2},'V',3,0,2],
]) {
  const p=placementBetween(cars,start,end);assert.equal(p.valid,true);assert.deepEqual([p.dir,p.len,p.row,p.col],[dir,len,row,col]);
}
assert.equal(placementBetween(cars,{row:0,col:0},{row:1,col:1}).valid,false);
assert.equal(placementBetween(cars,{row:0,col:0},{row:3,col:0}).valid,false);
assert.equal(placementBetween(cars,{row:0,col:0},{row:2,col:0}).valid,false);
assert.equal(placementBetween([],{row:2,col:5},{row:2,col:4}).valid,true);
assert.equal(placementBetween([],{row:2,col:0},{row:2,col:2}).valid,false);
console.log('Automatic two-point drawing works in both directions, with 2/3-cell lengths and conflict rejection.');
