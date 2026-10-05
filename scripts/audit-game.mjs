// Read-only audit: solve/replay all official levels and probe data boundaries.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {solveLevel,validateLevel,applyMove,legalMovesForCar,isWon} from '../src/gameEngine.js';
import {loadCustomLevels,saveProgress} from '../src/storage.js';
const index=JSON.parse(readFileSync(new URL('../public/levels/index.json',import.meta.url)));
const levels=[];
for(const meta of index){
  const level=JSON.parse(readFileSync(new URL(`../public/levels/${meta.file}`,import.meta.url)));
  const start=performance.now(),solution=solveLevel(level.cars);
  assert.equal(solution.solvable,true,`Level ${meta.id} must have a solution`);
  let cars=level.cars;
  for(const move of solution.moves){
    assert.ok(legalMovesForCar(cars,move.carId).some(m=>m.delta===move.delta),`Level ${meta.id}: legal replay`);
    cars=applyMove(cars,move);
  }
  assert.equal(isWon(cars),true,`Level ${meta.id}: replay must exit`);
  levels.push({id:meta.id,moves:solution.moves.length,explored:solution.explored,solveAndReplayMs:Math.round(performance.now()-start)});
}
const target={id:'target',color:'#e53935',row:2,col:0,len:2,dir:'H'};
const probes=[];
for(const [name,cars]of [['non-array',{}],['null-car',[null]],['fractional-coordinate',[target,{id:'bad',row:.5,col:3,len:2,dir:'V'}]],['nonfinite-coordinate',[target,{id:'bad',row:NaN,col:3,len:2,dir:'V'}]]]){
  try{probes.push({name,result:validateLevel(cars)});}catch(error){probes.push({name,throws:error.message});}
}
// Mock storage only in this Node process, never touching browser progress.
globalThis.localStorage={getItem:()=> '{}',setItem:()=>{throw new DOMException('Quota exceeded','QuotaExceededError');}};
const storage={customObjectAccepted:!Array.isArray(loadCustomLevels())};
try{saveProgress({});storage.writeThrows=false;}catch(error){storage.writeThrows=error.name;}
delete globalThis.localStorage;
const result={levels,probes,storage};
writeFileSync(new URL('../docs/audit-2026-10-05/engine-evidence.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({officialLevels:levels.length,allSolvedAndReplayed:true,maxSolveAndReplayMs:Math.max(...levels.map(l=>l.solveAndReplayMs)),probes,storage},null,2));
