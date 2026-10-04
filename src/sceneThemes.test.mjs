import assert from 'node:assert/strict';
import { completedOfficialLevels, availableTheme } from './sceneThemes.js';
const fixture=Object.fromEntries(Array.from({length:20},(_,i)=>[i+1,{completed:true}]));
assert.equal(completedOfficialLevels({...fixture,'custom-a':{completed:true},'41':{completed:true},'01':{completed:true},'21':{completed:false}}),20);
for(const [count,theme,expected]of [[0,'day','day'],[9,'sunset','day'],[10,'sunset','sunset'],[19,'neon','day'],[20,'neon','neon'],[40,'invalid','day']])assert.equal(availableTheme(theme,count),expected);
console.log('Official progress and theme unlock thresholds passed');
