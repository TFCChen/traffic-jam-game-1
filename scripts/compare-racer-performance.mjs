import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {connect} from './cdp-test.mjs';
const c=await connect(process.argv[2]),oldBody=readFileSync(process.argv[3]).toString('base64'),out=process.argv[4];
const saved=await c.evaluate(`Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('traffic-jam-')).map(k=>[k,localStorage.getItem(k)]))`),results=[],errors=[];
await c.send('Network.enable');await c.send('Network.setBypassServiceWorker',{bypass:true});await c.send('Network.setCacheDisabled',{cacheDisabled:true});await c.send('Emulation.setFocusEmulationEnabled',{enabled:true});
c.onEvent('Fetch.requestPaused',e=>{c.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'model/gltf-binary'}],body:oldBody}).catch(e=>errors.push(String(e)));});
try{
  for(const [device,w,h,mobile]of [['desktop',1440,950,false],['mobile',393,844,true]]){
    await c.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile});
    for(const stage of ['before','after','after','before']){
      if(stage==='before')await c.send('Fetch.enable',{patterns:[{urlPattern:'http://localhost:4173/models/racer.glb*',requestStage:'Request'}]});else await c.send('Fetch.disable');
      const origin=await c.evaluate('performance.timeOrigin');
      await c.evaluate(`localStorage.removeItem('traffic-jam-session-v1');localStorage.setItem('traffic-jam-tutorial-v1',JSON.stringify({schema:1,data:true}));localStorage.setItem('traffic-jam-scene',JSON.stringify({pitch:55,yaw:25,zoom:.85,quality:'high',theme:'day',shadows:true,intensity:3,motion:1.2}));location.reload()`);
      await c.until(`performance.timeOrigin!==${origin}&&document.querySelector('.garage-canvas')?.garageInspection?.snapshot().ready&&document.querySelector('.game-column').getAttribute('aria-busy')==='false'`);
      await c.sleep(1200);await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.measure(true)`);await c.sleep(5000);
      const s=await c.evaluate(`document.querySelector('.garage-canvas').garageInspection.snapshot()`);
      assert.equal(s.cars.length,8);assert.equal(s.settings.theme,'day');
      results.push({device,stage,calls:s.calls,profile:s.performance.profile});
    }
  }
  assert.deepEqual(errors,[]);writeFileSync(out,JSON.stringify({method:'ABBA, old racer response intercepted only in isolated browser, same current code/scene, DPR 1',results,errors},null,2));console.log('Paired racer geometry performance checks passed');
}finally{
  await c.send('Fetch.disable');await c.send('Emulation.clearDeviceMetricsOverride');await c.evaluate(`for(const k of Object.keys(localStorage))if(k.startsWith('traffic-jam-'))localStorage.removeItem(k);for(const[k,v]of Object.entries(${JSON.stringify(saved)}))localStorage.setItem(k,v);location.reload()`);c.close();
}
