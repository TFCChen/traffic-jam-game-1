import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { legalMovesForCar } from './gameEngine.js';
import { vehicleModel } from './vehicleModels.js';
import { asphaltTexture, detailTexture, prepareWheels, rollingMaterial } from './garageMaterials.js';
import { SCENE_THEMES } from './sceneThemes.js';
import { QUALITY } from './gamePreferences.js';
import { quadDistance,snapDragDelta } from './pointerHelpers.js';
import {stepSuspension,contactImpulse} from './vehicleDynamics.js';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const modelNames = ['garage', 'racer', 'jeep', 'pickup', 'compact', 'taxi', 'schoolbus', 'coach', 'camper', 'delivery'];
let assetsPromise;
function assets() {
  if (!assetsPromise) {
    const loader = new GLTFLoader();
    assetsPromise = Promise.all(modelNames.map(async name => [name, (await loader.loadAsync(`/models/${name}.glb`)).scene]))
      .then(entries=>{for(const [name,root]of entries)if(name!=='garage')prepareWheels(root,['schoolbus','coach','camper','delivery'].includes(name)?3:2);return Object.fromEntries(entries);}).catch(error => { assetsPromise = null; throw error; });
  }
  return assetsPromise;
}

export function createGarageScene(canvas, getProps, callbacks) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
  const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;
  room.dispose();pmrem.dispose();
  const roadTexture=asphaltTexture();
  const glowTexture=detailTexture('glow'),skidTexture=detailTexture('skid');
  const contactGeometry=new THREE.PlaneGeometry(1,1);
  const camera = new THREE.OrthographicCamera(-5, 5, 4, -4, .1, 80);
  const aim = new THREE.Vector3(3.45, .15, 3);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.055);
  const groups = new Map();
  const ownedMaterials = new Set(), ownedGeometries = new Set();
  let library, alive = true, ready = false, drag, selected, escapeStart, lastTime = performance.now(), frame;
  let dirty = true, inView = true, settlingUntil = 0, lastShadow = 0, cameraFollow=0;
  const sceneryLamps=[];
  const stats = { frames: 0, shadowUpdates: 0 };
  const scratchPosition = new THREE.Vector3(), scratchDirection = new THREE.Vector3();
  const settings = { pitch: 65, yaw: 0, light: -40, intensity: 3, shadows: true,theme:'day',quality:'standard' };
  let quality=QUALITY.standard;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motionChanged=()=>{dirty=true;settlingUntil=performance.now()+450;};
  reduced.addEventListener('change',motionChanged);
  const ambient = new THREE.HemisphereLight(0xfff7e7, 0x738a89, 2.0);
  scene.add(ambient);
  const garageFill=new THREE.SpotLight('#c7e4ec',20,9,.72,.75,2);
  garageFill.position.set(3.2,5,3);garageFill.target.position.set(3,0,3);garageFill.visible=false;scene.add(garageFill,garageFill.target);
  const streetLights=[[-.7,.2],[6.65,5.45]].map(([x,z])=>{const light=new THREE.PointLight('#ffd4a4',3,2.4,2);light.position.set(x,1.05,z);light.visible=false;scene.add(light);return light;});
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
  const instancePose=new THREE.Object3D(),accentColour=new THREE.Color();
  const glowGeometry=new THREE.PlaneGeometry(1.35,1.35);ownedGeometries.add(glowGeometry);
  const glowMaterial=new THREE.MeshBasicMaterial({map:glowTexture,color:'#8edcf0',transparent:true,opacity:.35,depthWrite:false,blending:THREE.AdditiveBlending});ownedMaterials.add(glowMaterial);
  const lightPools=new THREE.InstancedMesh(glowGeometry,glowMaterial,2);scene.add(lightPools);
  for(let i=0;i<2;i++){instancePose.position.set(i?6.65:-.7,.045,i?5.45:.2);instancePose.rotation.set(-Math.PI/2,0,0);instancePose.updateMatrix();lightPools.setMatrixAt(i,instancePose.matrix);}
  const skidGeometry=new THREE.PlaneGeometry(.42,1.15);ownedGeometries.add(skidGeometry);
  const skidMaterial=new THREE.MeshBasicMaterial({map:skidTexture,transparent:true,opacity:.23,depthWrite:false});ownedMaterials.add(skidMaterial);
  const skidMarks=new THREE.InstancedMesh(skidGeometry,skidMaterial,3);scene.add(skidMarks);
  for(let i=0;i<3;i++){instancePose.position.set([1.8,4.35,6.8][i],i===2?.048:.047,[4.5,1.4,2.5][i]);instancePose.rotation.set(-Math.PI/2,0,i===2?Math.PI/2:.12*i);instancePose.updateMatrix();skidMarks.setMatrixAt(i,instancePose.matrix);}
  const accentMaterial=new THREE.MeshBasicMaterial({color:'#78a58c'});ownedMaterials.add(accentMaterial);
  const accentGeometry=new THREE.BoxGeometry(.13,.012,.035);ownedGeometries.add(accentGeometry);
  const roadLights=new THREE.InstancedMesh(accentGeometry,accentMaterial,8);scene.add(roadLights);
  for(let i=0;i<8;i++){instancePose.position.set(6.12+(i%4)*.37,.052,i<4?2.03:2.97);instancePose.rotation.set(0,0,0);instancePose.scale.set(1,1,1);instancePose.updateMatrix();roadLights.setMatrixAt(i,instancePose.matrix);roadLights.setColorAt(i,accentColour.set('#78a58c'));}
  const leafGeometry=new THREE.PlaneGeometry(.07,.13);ownedGeometries.add(leafGeometry);
  const leafMaterial=new THREE.MeshBasicMaterial({color:'#b28e58',side:THREE.DoubleSide});ownedMaterials.add(leafMaterial);
  const leaves=new THREE.InstancedMesh(leafGeometry,leafMaterial,4);leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);leaves.frustumCulled=false;scene.add(leaves);
  const confettiGeometry=new THREE.PlaneGeometry(.055,.12);ownedGeometries.add(confettiGeometry);
  const confettiMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});ownedMaterials.add(confettiMaterial);
  const celebration=new THREE.InstancedMesh(confettiGeometry,confettiMaterial,24);celebration.visible=false;celebration.frustumCulled=false;celebration.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(celebration);
  for(let i=0;i<24;i++)celebration.setColorAt(i,accentColour.set(['#ffc857','#72d2bd','#ee7f75','#8a9df1'][i%4]));
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
    cameraFollow=0;
    const pitch=THREE.MathUtils.degToRad(settings.pitch), yaw=THREE.MathUtils.degToRad(settings.yaw);
    camera.position.set(aim.x+Math.sin(yaw)*Math.cos(pitch)*14, aim.y+Math.sin(pitch)*14, aim.z+Math.cos(yaw)*Math.cos(pitch)*14);
    camera.lookAt(aim); camera.updateMatrixWorld();
    const rect=canvas.getBoundingClientRect(),aspect=rect.width/Math.max(1,rect.height);
    let halfWidth=0,halfHeight=0;
    for(const x of [-1.2,7.7])for(const y of [-.48,1.4])for(const z of [-.55,6.4]){
      const point=new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
      halfWidth=Math.max(halfWidth,Math.abs(point.x)+.35);halfHeight=Math.max(halfHeight,Math.abs(point.y)+.35);
    }
    halfWidth=Math.max(halfWidth,halfHeight*aspect);halfHeight=halfWidth/aspect;
    camera.left=-halfWidth;camera.right=halfWidth;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
    const angle=THREE.MathUtils.degToRad(settings.light);
    sun.position.set(aim.x+Math.sin(angle)*8, 10, aim.z+Math.cos(angle)*8);
    const theme=SCENE_THEMES.find(t=>t.id===settings.theme)??SCENE_THEMES[0];
    sun.intensity=settings.intensity*theme.key;sun.color.set(theme.sun);sun.castShadow=settings.shadows&&quality.decor;
    ambient.color.set(theme.sky);ambient.groundColor.set(theme.ground);ambient.intensity=theme.ambient;
    scene.environmentIntensity=theme.environment;floorMaterial.color.set(theme.floor);
    garageFill.visible=settings.theme==='neon';
    streetLights.forEach(light=>{light.visible=quality.decor&&settings.theme!=='day';light.intensity=settings.theme==='neon'?3:1;});
    sceneryLamps.forEach(material=>{material.emissive.set('#ffc882');material.emissiveIntensity=settings.theme==='neon'?2.2:settings.theme==='sunset'?.6:.1;});
    leafMaterial.color.set(settings.theme==='sunset'?'#c28551':'#87935e');
    lightPools.visible=settings.theme!=='day';glowMaterial.color.set('#ffd199');glowMaterial.opacity=settings.theme==='neon'?.28:.15;
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
    if(hit)return hit.object.userData.carId;
    if(event.pointerType!=='touch'||getProps().editor)return;
    const rect=canvas.getBoundingClientRect(),point={x:event.clientX,y:event.clientY};
    let nearest,best=12;
    for(const item of groups.values()){
      if(!item.group.visible)continue;
      const quad=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>{
        const v=new THREE.Vector3(x*(item.car.len/2-.08),.4,z*.4);item.group.localToWorld(v);v.project(camera);
        return {x:rect.left+(v.x+1)*rect.width/2,y:rect.top+(1-v.y)*rect.height/2};
      });
      const distance=quadDistance(point,quad);
      if(distance<best){best=distance;nearest=item.car.id;}
    }
    return nearest;
  }
  function planePoint(event) { cast(event); return raycaster.ray.intersectPlane(ground,new THREE.Vector3()); }
  function impact(item,direction=1){
    if(!item||performance.now()-(item.lastImpact??-1000)<280)return;
    item.lastImpact=performance.now();item.brakeUntil=item.lastImpact+250;
    item.suspension=contactImpulse(item.suspension,direction);settlingUntil=item.lastImpact+650;dirty=true;
  }
  function blocked(id,direction=1) { impact(groups.get(id),direction);callbacks.feedback?.('車輛受阻，先移開擋路的車');callbacks.select(id); }
  function down(event) {
    const props=getProps();
    if(drag&&event.pointerType==='touch'&&drag.pointerId!==event.pointerId){finish({pointerId:drag.pointerId},true);return;}
    if (!ready || props.disabled || props.won || drag || (event.pointerType==='mouse' && event.button!==0)) return;
    const id=carAt(event);
    if(props.editor) {
      if(id) { selected=id; callbacks.select(id); return; }
      const point=planePoint(event);
      if(point && point.x>=0&&point.x<6&&point.z>=0&&point.z<6)props.onCellClick({row:Math.floor(point.z),col:Math.floor(point.x)});
      return;
    }
    if(!id)return;
    callbacks.feedback?.(`${vehicleModel(props.cars.find(c=>c.id===id)).name} · ${props.cars.find(c=>c.id===id).dir==='H'?'左右':'上下'}移動`);
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
    if(Math.abs(raw-delta)>.1&&!drag.atBoundary){drag.atBoundary=true;impact(groups.get(drag.car.id),Math.sign(raw));callbacks.feedback?.('已到邊界，試著移開擋路的車');}
    if(Math.abs(raw-delta)<.05)drag.atBoundary=false;
    const now=performance.now(); drag.speed=(delta-drag.delta)/Math.max(.008,(now-drag.lastAt)/1000);
    drag.lastAt=now; drag.delta=delta; canvas.style.cursor='grabbing';
  }
  function finish(event,cancel=false) {
    if(!drag||event.pointerId!==drag.pointerId)return;
    const active=drag; drag=null; delete canvas.dataset.dragging;
    const item=groups.get(active.car.id);if(item&&Math.abs(active.delta)>.02){item.brakeUntil=performance.now()+280;if(!cancel&&!active.atBoundary)impact(item,Math.sign(active.delta));}
    dirty=true;settlingUntil=performance.now()+450;
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    const move=active.legal.find(m=>m.delta===snapDragDelta(active.delta));
    callbacks.feedback?.(cancel?'已取消移動':move?'已停入車位':'位置不變');
    if(!cancel&&move)getProps().onMove(move);
  }
  function key(event) {
    const props=getProps(); if(props.disabled||props.won||props.editor)return;
    if(event.key==='Escape'&&drag){finish({pointerId:drag.pointerId},true);return;}
    const car=props.cars.find(c=>c.id===selected);if(!car)return;
    const delta=car.dir==='H'?{ArrowLeft:-1,ArrowRight:1}[event.key]:{ArrowUp:-1,ArrowDown:1}[event.key];
    if(!delta)return;event.preventDefault();
    if(legalMovesForCar(props.cars,car.id).some(m=>m.delta===delta))props.onMove({carId:car.id,delta});else blocked(car.id,delta);
  }
  const handlers={pointerdown:down,pointermove:move,pointerup:e=>finish(e),pointercancel:e=>finish(e,true),lostpointercapture:e=>finish(e,true),keydown:key,webglcontextlost:event=>{event.preventDefault();if(drag)finish({pointerId:drag.pointerId},true);callbacks.error(new Error('WebGL context lost'));}};
  Object.entries(handlers).forEach(([name,handler])=>canvas.addEventListener(name,handler));
  function sync() {
    if(!library||!alive)return;
    if(drag)finish({pointerId:drag.pointerId},true);
    const props=getProps(),ids=new Set(props.cars.map(c=>c.id));
    for(const [id,item]of groups)if(!ids.has(id)){scene.remove(item.group);item.group.traverse(o=>{if(o.isMesh){o.material.dispose();o.customDepthMaterial?.dispose();}});groups.delete(id);}
    props.cars.forEach((car,index)=>{
      let item=groups.get(car.id);
      if(!item){
        const group=library[vehicleModel(car).kind].clone(true);
        const lamps=[],tailLamps=[],wheelAngle={value:0};
        group.traverse(object=>{if(object.isMesh){
          object.material=object.material.clone();
          const material=object.material;
          if(material.name.startsWith('Paint')){material.color.set(car.color);material.roughness=.3;material.metalness=.06;if('clearcoat'in material){material.clearcoat=.55;material.clearcoatRoughness=.2;}}
          if(material.name==='Opaque blue glass'){material.roughness=.1;material.metalness=.28;}
          if(material.name==='Headlamp'){material.emissive.set('#ffd994');lamps.push(material);}
          if(material.name==='Tail lamp'){tailLamps.push(material);}
          if(material.name==='Rolling wheels'){
            rollingMaterial(material,wheelAngle);
            object.customDepthMaterial=rollingMaterial(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),wheelAngle);
          }
          object.castShadow=true;object.receiveShadow=true;object.userData.carId=car.id;
        }});
        const body=new THREE.Group();body.position.y=.19;group.add(body);group.updateMatrixWorld(true);
        const bodyMeshes=[];group.traverse(o=>{if(o.isMesh&&o.material.name!=='Rolling wheels')bodyMeshes.push(o);});
        bodyMeshes.forEach(mesh=>body.attach(mesh));
        const contact=new THREE.Mesh(contactGeometry,new THREE.MeshBasicMaterial({map:glowTexture,color:'#17232a',transparent:true,opacity:.32,depthWrite:false}));
        contact.rotation.x=-Math.PI/2;contact.position.y=-.014;contact.scale.set(car.len-.12,.85,1);contact.raycast=()=>{};group.add(contact);
        item={group,body,suspension:{pitch:0,rate:0,speed:0},car,index,model:vehicleModel(car).kind,lamps,tailLamps,wheelAngle,velocity:0,brakeUntil:0};groups.set(car.id,item);scene.add(group);
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
  assets().then(async models=>{
    if(!alive)return; library=models;
    const garage=library.garage.clone(true);garage.traverse(o=>{if(o.isMesh){
      o.material=o.material.clone();ownedMaterials.add(o.material);
      if(o.material.name==='Asphalt blue slate'||o.material.name==='Street asphalt'){o.material.map=roadTexture;o.material.bumpMap=roadTexture;o.material.bumpScale=.004;}
      if(o.material.name==='Streetlamp glow')sceneryLamps.push(o.material);
      o.receiveShadow=true;o.castShadow=true;
    }});scene.add(garage);updateCamera();
    sync();await renderer.compileAsync(scene,camera);
    if(!alive)return;
    ready=true;canvas.dataset.ready='true';callbacks.ready();
  }).catch(error=>{if(alive)callbacks.error(error);});
  function animate(now) {
    if(!alive)return;frame=requestAnimationFrame(animate);
    if(document.hidden||!inView){lastTime=now;return;}
    if(library&&!ready){lastTime=now;return;}
    const active=!!drag||now<settlingUntil||(escapeStart!=null&&now-escapeStart<1900);
    // Cap high-refresh displays too; retain ambient life without rendering at 120/144 Hz.
    if(!dirty&&((reduced.matches||!quality.decor)&&!active||now-lastTime<1000/(active?quality.activeFPS:quality.idleFPS)-.5))return;
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
        const t=reduced.matches?1:clamp((now-escapeStart-320)/1050,0,1);x+=4*t*t;group.visible=t<1;
      }else group.visible=true;
      const blend=isDrag||reduced.matches?1:1-Math.exp(-18*dt);
      const height=.055;
      if(Math.abs(group.position.x-x)>.001||Math.abs(group.position.z-z)>.001||group.position.y!==height)shadowChanged=true;
      const oldAxis=car.dir==='H'?group.position.x:group.position.z;
      group.position.x=THREE.MathUtils.lerp(group.position.x,x,blend);group.position.z=THREE.MathUtils.lerp(group.position.z,z,blend);
      group.position.y=height;
      const travelled=(car.dir==='H'?group.position.x:group.position.z)-oldAxis,velocity=travelled/Math.max(.008,dt);
      item.wheelAngle.value-=travelled/.19;
      if(Math.abs(item.velocity)>.2&&Math.abs(velocity)<.12)item.brakeUntil=now+220;
      item.suspension=reduced.matches?{pitch:0,rate:0,speed:0}:stepSuspension(item.suspension,velocity,dt);
      item.body.rotation.z=item.suspension.pitch*(settings.motion??1)*(car.len===3?.78:1);
      item.velocity=velocity;
      if(Math.abs(item.body.rotation.z)>.00005)shadowChanged=true;
      if(Math.abs(velocity)>.12)item.gear=Math.sign(velocity);
      const reversing=velocity<-.12||(isDrag&&item.gear===-1),braking=now<item.brakeUntil;
      item.lamps.forEach(material=>{material.emissiveIntensity=settings.theme==='neon'?1.4:(isDrag||props.won)?.8:reduced.matches?.2:.15+(Math.sin(now*.001+item.index)*.5+.5)*.25;});
      item.tailLamps.forEach(material=>{material.color.set(reversing?'#e9f1e5':'#df7460');material.emissive.set(reversing?'#e7f0df':'#ef3426');material.emissiveIntensity=reversing?.9:braking?1.3:settings.theme==='neon'?.2:.03;});
      if(!props.editor&&!props.won&&!reduced.matches&&quality.decor) {
        const tick=Math.floor(now/1000+item.index*1.47);
        if(tick!==item.lastTick){item.lastTick=tick;if(tick%4===0)puff(group.localToWorld(scratchPosition.set(-car.len/2,.19,.2)),scratchDirection.set(car.dir==='H'?-1:0,0,car.dir==='V'?-1:0));}
      }
      if(quality.decor&&isDrag&&Math.abs(drag.speed)>1&&now-drag.lastAt<140&&now-drag.lastPuff>65) {
        drag.lastPuff=now;const sign=Math.sign(drag.speed);
        puff(scratchPosition.copy(group.position).add(scratchDirection.set(car.dir==='H'?-sign*.8:0,.14,car.dir==='V'?-sign*.8:0)),scratchDirection.set(car.dir==='H'?-sign:0,0,car.dir==='V'?-sign:0),Math.abs(drag.speed)>7);
      }
      if(quality.decor&&!reduced.matches&&props.won&&car.id==='target'&&group.visible&&velocity>.6&&now-(item.lastExitPuff??0)>130){
        item.lastExitPuff=now;puff(scratchPosition.copy(group.position).add(scratchDirection.set(-.85,.13,.2)),scratchDirection.set(-1,0,0));
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
    const victoryAge=escapeStart==null?0:now-escapeStart;
    const follow=props.won&&!reduced.matches?.26*Math.sin(Math.PI*clamp(victoryAge/1500,0,1)):0;
    camera.position.x+=follow-cameraFollow;cameraFollow=follow;camera.lookAt(scratchPosition.copy(aim).add(scratchDirection.set(follow,0,0)));camera.updateMatrixWorld();
    leaves.visible=quality.decor&&!reduced.matches&&settings.theme!=='neon'&&!props.editor;
    if(leaves.visible){for(let i=0;i<4;i++){const t=(now*.00007+i*.25)%1;instancePose.position.set(i%2?6.85+Math.sin(t*6)*.13:-.7+Math.sin(t*7)*.13,.13+Math.sin(t*Math.PI)*.17,.2+t*5.7);instancePose.rotation.set(-1.2,t*7+i,t*5);instancePose.scale.set(1,1,1);instancePose.updateMatrix();leaves.setMatrixAt(i,instancePose.matrix);}leaves.instanceMatrix.needsUpdate=true;}
    for(let i=0;i<8;i++){const lit=props.won&&victoryAge>i%4*110;roadLights.setColorAt(i,accentColour.set(lit?'#a9efc4':settings.theme==='neon'?(i<4?'#79dfea':'#b591ef'):'#78a58c'));}roadLights.instanceColor.needsUpdate=true;
    celebration.visible=quality.decor&&props.won&&props.perfect&&!reduced.matches&&victoryAge>800&&victoryAge<1850;
    if(celebration.visible){const t=(victoryAge-800)/1050;for(let i=0;i<24;i++){const angle=i*2.4;instancePose.position.set(6.8+Math.cos(angle)*t*.9,.25+Math.sin(t*Math.PI)*(.7+(i%3)*.2),2.5+Math.sin(angle)*t*.8);instancePose.rotation.set(t*8+i,t*5+i,t*9);instancePose.scale.set(1,1,1);instancePose.updateMatrix();celebration.setMatrixAt(i,instancePose.matrix);}celebration.instanceMatrix.needsUpdate=true;}
    particles.forEach(p=>{if(reduced.matches||!quality.decor){p.life=0;p.mesh.visible=false;return;}if(p.life<=0)return;p.life-=dt;p.mesh.visible=p.life>0;p.mesh.position.addScaledVector(p.velocity,dt);p.mesh.material.opacity=Math.max(0,p.life/p.duration)*.38;if(!p.spark)p.mesh.scale.addScalar(dt*.6);});
    if(shadowChanged&&now-lastShadow>=1000/30-.5)renderer.shadowMap.needsUpdate=true;
    if(renderer.shadowMap.needsUpdate){lastShadow=now;stats.shadowUpdates++;}
    renderer.render(scene,camera);stats.frames++;
  }
  resize();frame=requestAnimationFrame(animate);
  return {
    sync,
    settings(next){
      if(drag)finish({pointerId:drag.pointerId},true);Object.assign(settings,next);quality=QUALITY[settings.quality]??QUALITY.standard;
      renderer.setPixelRatio(Math.min(devicePixelRatio,quality.pixelRatio));renderer.shadowMap.enabled=settings.shadows&&quality.decor;
      if(sun.shadow.mapSize.x!==quality.shadow){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(quality.shadow,quality.shadow);}
      resize();
    },
    select(id){selected=id;dirty=true;callbacks.select(id);canvas.focus({preventScroll:true});},
    project(x,y,z){const v=new THREE.Vector3(x,y,z).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};},
    pick(x,y,pointerType='mouse'){return carAt({clientX:x,clientY:y,pointerType});},
    snapshot(){return {ready,settings:{...settings},cars:[...groups.values()].map(i=>({id:i.car.id,model:i.model,dir:i.car.dir,len:i.car.len,position:i.group.position.toArray(),wheelAngle:i.wheelAngle.value,tilt:i.body.rotation.z,wheelTilt:i.group.rotation.z,velocity:i.velocity,tailLight:i.tailLamps[0]?.emissiveIntensity})),calls:renderer.info.render.calls,performance:{...stats,pixelRatio:renderer.getPixelRatio(),shadowSize:sun.shadow.mapSize.x,shadows:renderer.shadowMap.enabled,inView},guide:{visible:marker.visible,position:marker.position.toArray(),scale:marker.scale.toArray(),opacity:ringMaterial.opacity},celebration:celebration.visible,cameraFollow};},
    dispose(){
      if(!alive)return;
      alive=false;cancelAnimationFrame(frame);observer.disconnect();visibilityObserver.disconnect();Object.entries(handlers).forEach(([n,h])=>canvas.removeEventListener(n,h));
      reduced.removeEventListener('change',motionChanged);
      for(const item of groups.values())item.group.traverse(o=>{if(o.isMesh){o.material.dispose();o.customDepthMaterial?.dispose();}});
        ownedMaterials.forEach(m=>m.dispose());ownedGeometries.forEach(g=>g.dispose());contactGeometry.dispose();
      hintArrow.dispose();
      roadTexture.dispose();glowTexture.dispose();skidTexture.dispose();environment.dispose();roadLights.dispose();leaves.dispose();celebration.dispose();lightPools.dispose();skidMarks.dispose();
      if(library)Object.values(library).forEach(root=>root.traverse(o=>{if(o.isMesh)o.geometry.dispose();}));
      renderer.dispose();
    },
  };
}
