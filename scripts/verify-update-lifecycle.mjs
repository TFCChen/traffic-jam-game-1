import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source=readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8');
async function run(fail=false){
  const listeners={},deleted=[];let activated=0,claimed=0;
  const context={self:{location:{origin:'https://test.invalid'},
    addEventListener:(type,handler)=>listeners[type]=handler,
    skipWaiting:async()=>{activated++;},clients:{claim:async()=>{claimed++;}}},
    caches:{open:async()=>({addAll:async()=>{if(fail)throw Error('offline');}}),
      keys:async()=>['traffic-jam-old','unrelated-cache'],delete:async key=>deleted.push(key)},Request:class{}};
  runInNewContext(source,context);
  let work;listeners.install({waitUntil:promise=>work=promise});
  if(fail){await assert.rejects(work,/offline/);assert.equal(deleted.length,1);assert.notEqual(deleted[0],'traffic-jam-old');}
  else{
    await work;assert.equal(activated,0,'Downloading an update must not interrupt gameplay/editor');
    listeners.message({data:'IGNORED'});assert.equal(activated,0);
    listeners.message({data:'ACTIVATE_UPDATE'});assert.equal(activated,1,'Only an explicit update request activates immediately');
    listeners.activate({waitUntil:promise=>work=promise});await work;
    assert.equal(claimed,1);assert.deepEqual(deleted,['traffic-jam-old']);
  }
}
await run();await run(true);
console.log('PWA update waits for consent; explicit activation, scoped cleanup and failed-download rollback passed.');
