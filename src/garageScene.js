import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { legalMovesForCar } from './gameEngine.js';
import { vehicleModel } from './vehicleModels.js';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const modelNames = ['garage', 'racer', 'jeep', 'pickup', 'compact', 'taxi', 'schoolbus', 'coach', 'camper', 'delivery'];
let assetsPromise;
function assets() {
  if (!assetsPromise) {
    const loader = new GLTFLoader();
    assetsPromise = Promise.all(modelNames.map(async name => [name, (await loader.loadAsync(`/models/${name}.glb`)).scene]))
      .then(Object.fromEntries).catch(error => { assetsPromise = null; throw error; });
  }
  return assetsPromise;
}

export function createGarageScene(canvas, getProps, callbacks) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-5, 5, 4, -4, .1, 80);
  const aim = new THREE.Vector3(3.45, .15, 3);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.055);
  const groups = new Map();
  const ownedMaterials = new Set(), ownedGeometries = new Set();
  let library, alive = true, ready = false, drag, selected, escapeStart, lastTime = performance.now(), frame;
  let dirty = true, inView = true, settlingUntil = 0, lastShadow = 0;
  const stats = { frames: 0, shadowUpdates: 0 };
  const scratchPosition = new THREE.Vector3(), scratchDirection = new THREE.Vector3();
  const settings = { pitch: 65, yaw: 0, light: -40, intensity: 3, shadows: true };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motionChanged=()=>{dirty=true;settlingUntil=performance.now()+450;};
  reduced.addEventListener('change',motionChanged);
  const ambient = new THREE.HemisphereLight(0xfff7e7, 0x738a89, 2.0);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffefce, settings.intensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -8; sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8; sun.shadow.camera.bottom = -8;
  sun.shadow.normalBias = .025;
  sun.shadow.bias = -.0002;
  sun.target.position.copy(aim);
  scene.add(sun, sun.target);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: '#edf0e8', roughness: 1 });
  ownedMaterials.add(floorMaterial);
  const floorGeometry = new THREE.PlaneGeometry(200, 200); ownedGeometries.add(floorGeometry);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.48; floor.receiveShadow = true; scene.add(floor);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: '#f5d391', transparent: true, opacity: .13, depthWrite: false });
  ownedMaterials.add(ringMaterial);
  const ringGeometry = new THREE.PlaneGeometry(1, 1); ownedGeometries.add(ringGeometry);
  const marker = new THREE.Mesh(ringGeometry, ringMaterial);
  marker.rotation.x = -Math.PI / 2; marker.position.y = .047; marker.visible = false; scene.add(marker);
  const hintArrow = new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(),1.1,0xffecaa,.3,.2);
  hintArrow.visible=false;scene.add(hintArrow);
  const gate = new THREE.Group(); gate.position.set(6.43, .34, 1.98); scene.add(gate);
  const gateGeometry = new THREE.BoxGeometry(.07, .07, .98); ownedGeometries.add(gateGeometry);
  for (let i=0; i<7; i++) {
    const m = new THREE.MeshStandardMaterial({ color: i%2 ? '#e9ad78' : '#fff1d4', roughness: .5 }); ownedMaterials.add(m);
    const piece = new THREE.Mesh(gateGeometry, m); piece.scale.z=1/7; piece.position.z=(i+.5)*.98/7;
    piece.castShadow=true; gate.add(piece);
  }
  // A bounded particle pool: never allocate meshes in the animation loop.
  const particles = [];
  const smokeGeometry = new THREE.SphereGeometry(.055, 6, 4); ownedGeometries.add(smokeGeometry);
  for (let i=0;i<28;i++) {
    const material = new THREE.MeshBasicMaterial({ color: '#d7dfd2', transparent: true, opacity: 0, depthWrite: false }); ownedMaterials.add(material);
    const mesh = new THREE.Mesh(smokeGeometry, material); mesh.visible=false; scene.add(mesh);
    particles.push({ mesh, life: 0, velocity: new THREE.Vector3() });
  }
  function puff(position, direction, spark=false) {
    if (reduced.matches) return;
    const p = particles.find(item => item.life <= 0); if (!p) return;
    p.life = spark ? .32 : 1.1; p.duration=p.life; p.spark=spark;
    p.mesh.position.copy(position); p.mesh.visible=true; p.mesh.material.color.set(spark ? '#ffd281' : '#d7dfd2');
    p.mesh.scale.setScalar(spark ? .5 : .6);
    p.velocity.copy(direction).multiplyScalar(spark ? 1.5 : .3); p.velocity.y=spark ? .2 : .2;
  }
  function updateCamera() {
    const pitch=THREE.MathUtils.degToRad(settings.pitch), yaw=THREE.MathUtils.degToRad(settings.yaw);
    camera.position.set(aim.x+Math.sin(yaw)*Math.cos(pitch)*14, aim.y+Math.sin(pitch)*14, aim.z+Math.cos(yaw)*Math.cos(pitch)*14);
    camera.lookAt(aim); camera.updateMatrixWorld();
    const rect=canvas.getBoundingClientRect(),aspect=rect.width/Math.max(1,rect.height);
    let halfWidth=0,halfHeight=0;
    for(const x of [-.4,7.7])for(const y of [-.48,1.25])for(const z of [-.4,6.4]){
      const point=new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
      halfWidth=Math.max(halfWidth,Math.abs(point.x)+.35);halfHeight=Math.max(halfHeight,Math.abs(point.y)+.35);
    }
    halfWidth=Math.max(halfWidth,halfHeight*aspect);halfHeight=halfWidth/aspect;
    camera.left=-halfWidth;camera.right=halfWidth;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
    const angle=THREE.MathUtils.degToRad(settings.light);
    sun.position.set(aim.x+Math.sin(angle)*8, 10, aim.z+Math.cos(angle)*8);
    sun.intensity=settings.intensity; sun.castShadow=settings.shadows;
    renderer.shadowMap.needsUpdate=true;
    dirty=true;
  }
  function resize() {
    const { width, height }=canvas.getBoundingClientRect();
    renderer.setSize(width, height, false);
    const aspect=width/Math.max(1,height), halfWidth=4.65, halfHeight=halfWidth/aspect;
    camera.left=-halfWidth; camera.right=halfWidth; camera.top=halfHeight; camera.bottom=-halfHeight;
    camera.updateProjectionMatrix(); updateCamera();
  }
  const observer=new ResizeObserver(resize); observer.observe(canvas);
  const visibilityObserver=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;dirty=true;});
  visibilityObserver.observe(canvas);
  function cast(event) {
    const rect=canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
  }
  function carAt(event) {
    cast(event);
    const hit=raycaster.intersectObjects([...groups.values()].map(item=>item.group),true)[0];
    return hit?.object.userData.carId;
  }
  function planePoint(event) { cast(event); return raycaster.ray.intersectPlane(ground,new THREE.Vector3()); }
  function blocked(id) { const item=groups.get(id); if(item)item.blockedUntil=performance.now()+300; settlingUntil=performance.now()+400;dirty=true;callbacks.select(id); }
  function down(event) {
    const props=getProps();
    if (!ready || props.disabled || props.won || drag || (event.pointerType==='mouse' && event.button!==0)) return;
    const id=carAt(event);
    if(props.editor) {
      if(id) { selected=id; callbacks.select(id); return; }
      const point=planePoint(event);
      if(point && point.x>=0&&point.x<6&&point.z>=0&&point.z<6)props.onCellClick({row:Math.floor(point.z),col:Math.floor(point.x)});
      return;
    }
    if(!id)return;
    event.preventDefault(); canvas.focus({preventScroll:true}); selected=id; callbacks.select(id);
    const car=props.cars.find(c=>c.id===id), legal=legalMovesForCar(props.cars,id);
    if(!legal.length){blocked(id);return;}
    const start=planePoint(event); if(!start)return;
    const deltas=legal.map(m=>m.delta);
    drag={car,legal,start,min:Math.min(0,...deltas),max:Math.max(0,...deltas),pointerId:event.pointerId,delta:0,lastAt:performance.now(),speed:0,lastPuff:0};
    dirty=true;
    canvas.setPointerCapture(event.pointerId); canvas.dataset.dragging=id;
  }
  function move(event) {
    if(!drag||event.pointerId!==drag.pointerId){if(ready)canvas.style.cursor=carAt(event)?'grab':'default';return;}
    const point=planePoint(event); if(!point)return;
    const raw=drag.car.dir==='H'?point.x-drag.start.x:point.z-drag.start.z;
    const delta=clamp(raw,drag.min,drag.max);
    const now=performance.now(); drag.speed=(delta-drag.delta)/Math.max(.008,(now-drag.lastAt)/1000);
    drag.lastAt=now; drag.delta=delta; canvas.style.cursor='grabbing';
  }
  function finish(event,cancel=false) {
    if(!drag||event.pointerId!==drag.pointerId)return;
    const active=drag; drag=null; delete canvas.dataset.dragging;
    dirty=true;settlingUntil=performance.now()+450;
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    const move=active.legal.find(m=>m.delta===Math.round(active.delta));
    if(!cancel&&move)getProps().onMove(move);
  }
  function key(event) {
    const props=getProps(); if(props.disabled||props.won||props.editor)return;
    if(event.key==='Escape'&&drag){finish({pointerId:drag.pointerId},true);return;}
    const car=props.cars.find(c=>c.id===selected);if(!car)return;
    const delta=car.dir==='H'?{ArrowLeft:-1,ArrowRight:1}[event.key]:{ArrowUp:-1,ArrowDown:1}[event.key];
    if(!delta)return;event.preventDefault();
    if(legalMovesForCar(props.cars,car.id).some(m=>m.delta===delta))props.onMove({carId:car.id,delta});else blocked(car.id);
  }
  const handlers={pointerdown:down,pointermove:move,pointerup:e=>finish(e),pointercancel:e=>finish(e,true),lostpointercapture:e=>finish(e,true),keydown:key,webglcontextlost:event=>{event.preventDefault();if(drag)finish({pointerId:drag.pointerId},true);callbacks.error(new Error('WebGL context lost'));}};
  Object.entries(handlers).forEach(([name,handler])=>canvas.addEventListener(name,handler));
  function sync() {
    if(!library||!alive)return;
    if(drag)finish({pointerId:drag.pointerId},true);
    const props=getProps(),ids=new Set(props.cars.map(c=>c.id));
    for(const [id,item]of groups)if(!ids.has(id)){scene.remove(item.group);item.group.traverse(o=>{if(o.isMesh)o.material.dispose();});groups.delete(id);}
    props.cars.forEach((car,index)=>{
      let item=groups.get(car.id);
      if(!item){
        const group=library[vehicleModel(car).kind].clone(true);
        const lamps=[];
        group.traverse(object=>{if(object.isMesh){object.material=object.material.clone();if(object.material.name.startsWith('Paint'))object.material.color.set(car.color);if(object.material.name==='Headlamp'){object.material.emissive.set('#ffd994');lamps.push(object.material);}object.castShadow=true;object.receiveShadow=true;object.userData.carId=car.id;}});
        item={group,car,index,model:vehicleModel(car).kind,lamps};groups.set(car.id,item);scene.add(group);
        group.position.set(car.col+(car.dir==='H'?car.len/2:.5),.055,car.row+(car.dir==='V'?car.len/2:.5));
      }
      item.car=car;
      item.group.rotation.y=car.dir==='V'?-Math.PI/2:0;
    });
    if(props.won&&escapeStart==null)escapeStart=performance.now();
    if(!props.won){
      if(escapeStart!=null){const item=groups.get('target');if(item)item.group.position.set(item.car.col+item.car.len/2,.055,item.car.row+.5);}
      escapeStart=null;
    }
    renderer.shadowMap.needsUpdate=true;
    dirty=true;settlingUntil=performance.now()+450;
  }
  assets().then(models=>{
    if(!alive)return; library=models;
    const garage=library.garage.clone(true);garage.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.castShadow=true;}});scene.add(garage);
    sync(); ready=true;canvas.dataset.ready='true';callbacks.ready();
  }).catch(error=>{if(alive)callbacks.error(error);});
  function animate(now) {
    if(!alive)return;frame=requestAnimationFrame(animate);
    if(document.hidden||!inView){lastTime=now;return;}
    const active=!!drag||now<settlingUntil||(escapeStart!=null&&now-escapeStart<1200);
    // Cap high-refresh displays too; retain ambient life without rendering at 120/144 Hz.
    if(!dirty&&(reduced.matches&&!active||now-lastTime<(active?1000/60:1000/30)-.5))return;
    const dt=Math.min(.04,(now-lastTime)/1000);lastTime=now;
    dirty=false;
    const props=getProps();
    let shadowChanged=false;
    if(props.won&&escapeStart==null)escapeStart=now;
    for(const item of groups.values()) {
      const {car,group}=item,isDrag=drag?.car.id===car.id;
      const delta=isDrag?drag.delta:0;
      let x=car.col+(car.dir==='H'?car.len/2:.5)+(car.dir==='H'?delta:0),z=car.row+(car.dir==='V'?car.len/2:.5)+(car.dir==='V'?delta:0);
      if(props.won&&car.id==='target') {
        const t=reduced.matches?1:clamp((now-escapeStart)/850,0,1);x+=4*t*t;group.visible=t<1;
      }else group.visible=true;
      const blend=isDrag||reduced.matches?1:1-Math.exp(-18*dt);
      const height=isDrag ? .09 : .055;
      if(Math.abs(group.position.x-x)>.001||Math.abs(group.position.z-z)>.001||group.position.y!==height)shadowChanged=true;
      group.position.x=THREE.MathUtils.lerp(group.position.x,x,blend);group.position.z=THREE.MathUtils.lerp(group.position.z,z,blend);
      group.position.y=height;
      item.lamps.forEach(material=>{material.emissiveIntensity=(isDrag||props.won) ? .8 : reduced.matches ? .2 : .15+(Math.sin(now*.001+item.index)*.5+.5)*.25;});
      if(item.blockedUntil>now&&!reduced.matches)group.position.x+=Math.sin(now*.08)*.018;
      if(!props.editor&&!props.won&&!reduced.matches) {
        const tick=Math.floor(now/1000+item.index*1.47);
        if(tick!==item.lastTick){item.lastTick=tick;if(tick%4===0)puff(group.localToWorld(scratchPosition.set(-car.len/2,.19,.2)),scratchDirection.set(car.dir==='H'?-1:0,0,car.dir==='V'?-1:0));}
      }
      if(isDrag&&Math.abs(drag.speed)>1&&now-drag.lastAt<140&&now-drag.lastPuff>65) {
        drag.lastPuff=now;const sign=Math.sign(drag.speed);
        puff(scratchPosition.copy(group.position).add(scratchDirection.set(car.dir==='H'?-sign*.8:0,.14,car.dir==='V'?-sign*.8:0)),scratchDirection.set(car.dir==='H'?-sign:0,0,car.dir==='V'?-sign:0),Math.abs(drag.speed)>7);
      }
    }
    marker.visible=!!drag&&!props.won;
    ringMaterial.opacity=.13;
    if(drag){
      const {car,min,max}=drag,span=car.len+max-min;
      marker.position.set(car.col+(car.dir==='H'?(car.len+min+max)/2:.5),.05,car.row+(car.dir==='V'?(car.len+min+max)/2:.5));
      marker.scale.set(car.dir==='H'?span-.08:.92,car.dir==='V'?span-.08:.92,1);
    }
    if(props.editor&&props.editorStart){marker.visible=true;ringMaterial.opacity=.25;marker.position.set(props.editorStart.col+.5,.05,props.editorStart.row+.5);marker.scale.set(.92,.92,1);}
    const hinted=props.cars.find(car=>car.id===props.hint?.carId);
    hintArrow.visible=!!hinted&&!props.won;
    if(hinted){const direction=new THREE.Vector3(hinted.dir==='H'?Math.sign(props.hint.delta):0,0,hinted.dir==='V'?Math.sign(props.hint.delta):0);hintArrow.setDirection(direction);hintArrow.position.set(hinted.col+(hinted.dir==='H'?hinted.len/2:.5),1.4,hinted.row+(hinted.dir==='V'?hinted.len/2:.5));hintArrow.position.addScaledVector(direction,-.55);}
    const opening=props.won?Math.PI/2:0;if(Math.abs(gate.rotation.x+opening)>.001)shadowChanged=true;gate.rotation.x=THREE.MathUtils.lerp(gate.rotation.x,-opening,reduced.matches?1:1-Math.exp(-7*dt));
    particles.forEach(p=>{if(reduced.matches){p.life=0;p.mesh.visible=false;return;}if(p.life<=0)return;p.life-=dt;p.mesh.visible=p.life>0;p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.material.opacity=Math.max(0,p.life/p.duration)*.38;if(!p.spark)p.mesh.scale.addScalar(dt*.6);});
    if(shadowChanged&&now-lastShadow>=1000/30-.5)renderer.shadowMap.needsUpdate=true;
    if(renderer.shadowMap.needsUpdate){lastShadow=now;stats.shadowUpdates++;}
    renderer.render(scene,camera);stats.frames++;
  }
  resize();frame=requestAnimationFrame(animate);
  return {
    sync,
    settings(next){if(drag)finish({pointerId:drag.pointerId},true);Object.assign(settings,next);updateCamera();},
    select(id){selected=id;dirty=true;callbacks.select(id);canvas.focus({preventScroll:true});},
    project(x,y,z){const v=new THREE.Vector3(x,y,z).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};},
    pick(x,y){return carAt({clientX:x,clientY:y});},
    snapshot(){return {ready,settings:{...settings},cars:[...groups.values()].map(i=>({id:i.car.id,model:i.model,dir:i.car.dir,len:i.car.len,position:i.group.position.toArray()})),calls:renderer.info.render.calls,performance:{...stats,pixelRatio:renderer.getPixelRatio(),shadowSize:sun.shadow.mapSize.x,inView},guide:{visible:marker.visible,position:marker.position.toArray(),scale:marker.scale.toArray(),opacity:ringMaterial.opacity}};},
    dispose(){
      if(!alive)return;
      alive=false;cancelAnimationFrame(frame);observer.disconnect();visibilityObserver.disconnect();Object.entries(handlers).forEach(([n,h])=>canvas.removeEventListener(n,h));
      reduced.removeEventListener('change',motionChanged);
      for(const item of groups.values())item.group.traverse(o=>{if(o.isMesh)o.material.dispose();});
      ownedMaterials.forEach(m=>m.dispose());ownedGeometries.forEach(g=>g.dispose());
      hintArrow.dispose();
      if(library)Object.values(library).forEach(root=>root.traverse(o=>{if(o.isMesh)o.geometry.dispose();}));
      renderer.dispose();
    },
  };
}
