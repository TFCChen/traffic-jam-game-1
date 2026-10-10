import assert from 'node:assert/strict';
import { groundSample, groundMaps, PUDDLES, STREET_PUDDLES, streetGroundMap, courtyardWear } from './groundSurface.js';
for(let x=.1;x<6;x+=.2)for(let z=.1;z<6;z+=.2)assert.equal(courtyardWear(x,z),0,'Sidewalk patina must not dirty puzzle cells');
for(let x=-2.2;x<10.2;x+=.13)for(let z=-2.15;z<10.25;z+=.13){
  const s=groundSample(x,z),next=groundSample(x+.001,z);
  for(const key of ['grime','dampness','puddle']){
    assert(s[key]>=0&&s[key]<=1&&Number.isFinite(s[key]));
    assert(Math.abs(s[key]-next[key])<.035,'Dry/wet boundaries must feather without abrupt colour steps');
  }
}
for(const[x,z]of PUDDLES)assert(groundSample(x,z).puddle>.98,'Low spots contain standing water');
for(let x=1;x<5;x+=.2)for(let z=1;z<4;z+=.2)assert(groundSample(x,z).puddle<.01,'Central puzzle area must remain free of large mirror puddles');
assert.deepEqual(groundSample(5.6,5.83),groundSample(5.6,5.83));
const first=groundMaps(32),second=groundMaps(32);
assert.deepEqual(first,second,'Material maps must be seeded and stable across reloads');
assert.equal(first.macro.length,32*32*4);assert.equal(first.grain.length,256*256*4);
assert(new Set(first.grain.filter((_,i)=>i%4===0)).size>70,'Fine aggregate must have meaningful tonal variation');
for(const [x,z] of STREET_PUDDLES) assert(groundSample(x,z).puddle>.98,'Street approaches share natural low spots');
assert.equal(streetGroundMap(16,128).length,16*128*4);
console.log('World-aligned ground masks, soft wet edges, bounded puddles and deterministic aggregate passed');
