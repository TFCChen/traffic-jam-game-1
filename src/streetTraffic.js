import * as THREE from 'three';
import { batchColoredMeshes, rollingMaterial } from './garageMaterials.js';
import { configureVehiclePaint, vehicleTrimSurface } from './vehicleFinish.js';
import { configureVehicleGlass, VEHICLE_MIRROR } from './vehicleGlass.js';
import { VEHICLE_GROUND_HEIGHT } from './contactShadow.js';
import { passageTrafficRoute } from './streetLayout.js';

export const TRAFFIC_FLEET = [
  { kind: 'compact', length: 2, colors: ['#5c98b6', '#b9c9c1', '#d8bd8e'] },
  { kind: 'jeep', length: 2, colors: ['#829675', '#c5b398', '#637eaa'] },
  { kind: 'pickup', length: 2, colors: ['#e0d3bd', '#688eaa', '#b76e52'] },
  { kind: 'taxi', length: 2, colors: ['#efc847'] },
  { kind: 'delivery', length: 3, colors: ['#d9d6cc', '#88a6a7', '#b6c0d4'] },
  { kind: 'coach', length: 3, colors: ['#779f98', '#bca386', '#7a95b9'] },
];
export function trafficTravel(progress, bend) {
  // Monotonic, with independently varied entry/exit speed; never stops or reverses.
  return progress + bend * Math.sin(Math.PI * progress) / Math.PI;
}
// Bound the complete vehicle, not just its centre, outside the current camera.
export function trafficRoute(camera, x, length) {
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const radius = Math.hypot(length / 2 + .25, .8, .6);
  let min = -96, max = 96;
  for (const plane of frustum.planes) {
    const distance = plane.distanceToPoint(new THREE.Vector3(x, .8, 0)) + radius;
    if (Math.abs(plane.normal.z) < 1e-6) {
      if (distance < 0) return null;
    } else if (plane.normal.z > 0) min = Math.max(min, -distance / plane.normal.z);
    else max = Math.min(max, -distance / plane.normal.z);
  }
  return min <= max ? { min: min - .5, max: max + .5 } : null;
}
export function createTrafficClock(random = Math.random) {
  let wait = 3, sequence = 0, active = [], bag = [], lastDirection = 0;
  const pick = count => Math.min(count - 1, Math.floor(random() * count));
  return {
    step(dt, enabled, blocked = false, routeFor = (_, length) => ({ min: -2.1 - length / 2, max: 10.2 + length / 2 })) {
      dt = Math.max(0, Math.min(.1, dt));
      if (!enabled) { active = []; wait = 3; return []; }
      for (const item of active) {
        item.age += dt;
        const progress = Math.min(1, item.age / item.duration);
        const distance = item.span * trafficTravel(progress, item.bend)
          + Math.max(0, item.age - item.duration) * item.speed * (1 - item.bend);
        item.distance = distance;
        item.z = item.start + item.direction * distance;
        // Zooming out or orbiting during a trip must not expose its despawn.
        const route = routeFor(item.direction, TRAFFIC_FLEET[item.model].length);
        if (route) item.end = item.direction < 0 ? Math.min(item.end, route.min) : Math.max(item.end, route.max);
        if (blocked) item.retiring = Math.max(0, item.retiring - dt / .18);
      }
      active = active.filter(item => item.z * item.direction < item.end * item.direction && item.retiring > 0);
      if (!blocked) wait -= dt;
      if (!blocked && wait <= 0 && active.length < 2) {
        if (!bag.length) bag = TRAFFIC_FLEET.map((_, index) => index);
        const available = bag.filter(index => !active.some(item => item.model === index));
        if (available.length) {
          const model = available[pick(available.length)], spec = TRAFFIC_FLEET[model];
          let direction = lastDirection ? -lastDirection : random() < .5 ? -1 : 1;
          if (active.some(item => item.direction === direction)) direction *= -1;
          const route = routeFor(direction, spec.length);
          if (!route) { wait = 1; return active.map(item => ({ ...item, x: item.direction < 0 ? 9.25 : 7.35, opacity: item.retiring })); }
          bag.splice(bag.indexOf(model), 1);
          lastDirection = direction;
          const span = route.max - route.min, speed = 5.2 + random() * 2.4;
          const start = direction < 0 ? route.max : route.min;
          active.push({ id: ++sequence, model, direction, color: spec.colors[pick(spec.colors.length)],
            duration: span / speed, span, speed, start, z: start, distance: 0,
            end: direction < 0 ? route.min : route.max, bend: (random() - .5) * .65,
            age: 0, retiring: 1 });
          wait = 3.8 + random() * 6.2;
        }
      }
      return active.map(item => ({ ...item, x: item.direction < 0 ? 9.25 : 7.35, opacity: item.retiring }));
    },
  };
}

// Shared screen coverage preserves opaque occlusion: seats cannot show through
// a fading shell. Glass keeps its own optical alpha; no material changes queues.
export function installTrafficCoverage(material, coverage) {
  const before = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    shader.uniforms.trafficCoverage = coverage;
    shader.fragmentShader = 'uniform float trafficCoverage;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', `void main() {
      vec2 pixel=mod(floor(gl_FragCoord.xy),4.);
      vec2 low=mod(pixel,2.);
      vec2 high=floor(pixel/2.);
      float threshold=(4.*(2.*low.x+3.*low.y-4.*low.x*low.y)+(2.*high.x+3.*high.y-4.*high.x*high.y)+.5)/16.;
      if(trafficCoverage < threshold) discard;
    `);
  };
  material.customProgramCacheKey = () => key + '-traffic-coverage-v2';
}

function createTrafficVehicle(scene, source, spec, contactTexture, rainSurfaces) {
  const car = source.clone(true);
  batchColoredMeshes(car, mesh => ['Cabin upholstery', 'Tailored cabin leather', 'Seat stitching and console'].includes(mesh.material.name),
    { name: 'Batched cabin', roughness: .7, metalness: .02 });
  batchColoredMeshes(car, mesh => !['Automotive glass', 'Lamp crystal', VEHICLE_MIRROR, 'Batched cabin', 'Headlamp', 'Tail lamp', 'Rolling wheels'].includes(mesh.material.name) && !mesh.material.name.startsWith('Paint'),
    { surface: vehicleTrimSurface });
  const materials = [], paints = [], coverage = { value: 0 }, wheelAngle = { value: 0 }, lampLevel = { value: 0 };
  car.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (!mesh.userData.generatedGeometry) mesh.material = mesh.material.clone();
    const material = mesh.material;
    if (material.name.startsWith('Paint')) {
      configureVehiclePaint(material, spec.kind, 'standard', spec.colors[0]); paints.push(material);
    }
    if (material.name === 'Automotive glass') configureVehicleGlass(material, 'standard');
    if (material.name === 'Lamp crystal') {
      material.transmission = 0; material.transparent = true; material.opacity = .22; material.depthWrite = false;
    }
    if (material.name === 'Rolling wheels') rollingMaterial(material, wheelAngle, { value: [0, 0] }, { value: [0, 0] });
    if (['Headlamp', 'Tail lamp'].includes(material.name)) {
      const front = material.name === 'Headlamp';
      material.emissive.set(front ? '#ffd994' : '#e73524');
      material.emissiveIntensity = 1;
      mesh.updateWorldMatrix(true, false); car.updateWorldMatrix(true, false);
      const lampRoot = new THREE.Matrix4().copy(car.matrixWorld).invert().multiply(mesh.matrixWorld);
      material.onBeforeCompile = shader => {
        shader.uniforms.trafficLampLevel = lampLevel;
        shader.uniforms.trafficLampRoot = { value: lampRoot };
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform mat4 trafficLampRoot; varying float trafficLens;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>\nvec3 lensPoint=(trafficLampRoot*vec4(transformed,1.)).xyz; trafficLens=${front ? `step(${spec.length * .35},lensPoint.x)*step(.12,abs(lensPoint.z))` : `step(lensPoint.x,${-spec.length / 2 + .18})`};`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float trafficLampLevel; varying float trafficLens;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance*=trafficLens*trafficLampLevel;');
      };
      material.customProgramCacheKey = () => `traffic-lens-${front}-${spec.length}`;
    }
    rainSurfaces?.attach(material, spec.length);
    installTrafficCoverage(material, coverage);
    materials.push(material);
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.raycast = () => {};
  });
  const footprintGeometry = new THREE.PlaneGeometry(spec.length + .12, 1.08);
  const footprintMaterial = new THREE.MeshBasicMaterial({ map: contactTexture ?? null, color: '#17232a', transparent: true, opacity: .5, depthWrite: false });
  const footprint = new THREE.Mesh(footprintGeometry, footprintMaterial);
  footprint.rotation.x = -Math.PI / 2;
  footprint.position.y = -.001;
  footprint.raycast = () => {};
  installTrafficCoverage(footprintMaterial, coverage);
  car.add(footprint);
  car.position.y = VEHICLE_GROUND_HEIGHT;
  car.visible = false;
  scene.add(car);
  return {
    prepare() { car.visible = true; coverage.value = 0; },
    hide() { const visible = car.visible; car.visible = false; return visible; },
    update(pose, settings) {
      car.visible = !!pose;
      if (!pose) return;
      if (car.userData.trip !== pose.id) {
        car.userData.trip = pose.id;
        paints.forEach(material => material.color.set(pose.color));
      }
      lampLevel.value = settings.theme === 'neon' ? 1.2 : settings.theme === 'sunset' || settings.theme === 'rain' ? .35 : 0;
      car.rotation.y = pose.direction < 0 ? Math.PI / 2 : -Math.PI / 2;
      car.position.x = pose.x;
      car.position.z = pose.z;
      wheelAngle.value = -pose.distance / .19;
      coverage.value = pose.opacity;
    },
    dispose() {
      scene.remove(car);
      car.traverse(mesh => { if (mesh.isMesh && mesh.userData.generatedGeometry) mesh.geometry.dispose(); });
      materials.forEach(material => { rainSurfaces?.detach(material); material.dispose(); });
      footprintGeometry.dispose(); footprintMaterial.dispose();
    },
  };
}

export function createStreetTraffic(scene, library, contactTextures, rainSurfaces, random = Math.random, camera) {
  const clock = createTrafficClock(random);
  const fleet = TRAFFIC_FLEET.map(spec => createTrafficVehicle(scene, library[spec.kind], spec, contactTextures.get(spec.length), rainSurfaces));
  return {
    prepare() { fleet.forEach(vehicle => vehicle.prepare()); },
    pause() {
      clock.step(0, false);
      let changed = false;
      fleet.forEach(vehicle => { if (vehicle.hide()) changed = true; });
      return changed;
    },
    update(dt, settings, quality, reduced, props) {
      const poses = clock.step(dt, quality.decor && !reduced && !props.editor, props.won || props.disabled,
        camera ? (direction, length) => passageTrafficRoute(camera, direction < 0 ? 9.25 : 7.35, length) : undefined);
      fleet.forEach((vehicle, index) => vehicle.update(poses.find(pose => pose.model === index), settings));
    },
    dispose() { fleet.forEach(vehicle => vehicle.dispose()); },
  };
}
