import * as THREE from 'three';
import { batchColoredMeshes, rollingMaterial } from './garageMaterials.js';
import { configureVehiclePaint, vehicleTrimSurface } from './vehicleFinish.js';
import { configureVehicleGlass, VEHICLE_MIRROR } from './vehicleGlass.js';
import { VEHICLE_GROUND_HEIGHT } from './contactShadow.js';

const DURATION = 7.2;
export function createTrafficClock() {
  let wait = 6, age = null, sequence = 0, retiring = 1;
  return {
    step(dt, enabled, blocked = false) {
      dt = Math.max(0, Math.min(.1, dt));
      if (!enabled) { age = null; wait = 6; retiring = 1; return null; }
      if (age === null) {
        if (blocked) return null;
        wait -= dt;
        if (wait > 0) return null;
        age = 0; retiring = 1;
      }
      age += dt;
      if (blocked) retiring = Math.max(0, retiring - dt / .18);
      if (age >= DURATION || retiring === 0) {
        age = null; wait = 22 + (++sequence * 7 % 13); return null;
      }
      const progress = age / DURATION;
      return { z: 9.2 - 10.3 * progress, distance: 10.3 * progress,
        opacity: Math.min(1, progress / .085, (1 - progress) / .085) * retiring };
    },
  };
}

// One recycled detailed car, restricted to the far street lane. Its materials
// and batches are owned here; the source GLB remains shared with puzzle cars.
export function createStreetTraffic(scene, source, contactTexture, rainSurfaces) {
  const car = source.clone(true), clock = createTrafficClock();
  batchColoredMeshes(car, mesh => ['Cabin upholstery', 'Tailored cabin leather', 'Seat stitching and console'].includes(mesh.material.name),
    { name: 'Batched cabin', roughness: .7, metalness: .02 });
  batchColoredMeshes(car, mesh => !['Automotive glass', 'Lamp crystal', VEHICLE_MIRROR, 'Batched cabin', 'Headlamp', 'Tail lamp', 'Rolling wheels'].includes(mesh.material.name) && !mesh.material.name.startsWith('Paint'),
    { surface: vehicleTrimSurface });
  const materials = [], wheelAngle = { value: 0 }, lampLevel = { value: 0 };
  car.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (!mesh.userData.generatedGeometry) mesh.material = mesh.material.clone();
    const material = mesh.material;
    if (material.name.startsWith('Paint')) configureVehiclePaint(material, 'compact', 'standard', '#b6c8c4');
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
          .replace('#include <begin_vertex>', `#include <begin_vertex>\nvec3 lensPoint=(trafficLampRoot*vec4(transformed,1.)).xyz; trafficLens=${front ? 'step(.7,lensPoint.x)*step(.12,abs(lensPoint.z))' : 'step(lensPoint.x,-.82)'};`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float trafficLampLevel; varying float trafficLens;')
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance*=trafficLens*trafficLampLevel;');
      };
      material.customProgramCacheKey = () => `traffic-lens-${front}`;
    }
    rainSurfaces?.attach(material, 2);
    materials.push({ material, opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite });
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.raycast = () => {};
  });
  const footprintGeometry = new THREE.PlaneGeometry(2.12, 1.08);
  const footprintMaterial = new THREE.MeshBasicMaterial({ map: contactTexture, color: '#17232a', transparent: true, opacity: .5, depthWrite: false });
  const footprint = new THREE.Mesh(footprintGeometry, footprintMaterial);
  footprint.rotation.x = -Math.PI / 2;
  footprint.position.y = -.001;
  footprint.raycast = () => {};
  car.add(footprint);
  car.rotation.y = Math.PI / 2;
  car.position.set(9.35, VEHICLE_GROUND_HEIGHT, 9.2);
  car.visible = false;
  scene.add(car);
  return {
    pause() { const visible = car.visible; car.visible = false; clock.step(0, false); return visible; },
    update(dt, settings, quality, reduced, props) {
      const pose = clock.step(dt, quality.decor && !reduced && !props.editor, props.won || props.disabled);
      car.visible = !!pose;
      if (!pose) return;
      lampLevel.value = settings.theme === 'neon' ? 1.2 : settings.theme === 'sunset' || settings.theme === 'rain' ? .35 : 0;
      car.position.z = pose.z;
      wheelAngle.value = -pose.distance / .19;
      for (const entry of materials) {
        entry.material.opacity = entry.opacity * pose.opacity;
        entry.material.transparent = entry.transparent || pose.opacity < .999;
        entry.material.depthWrite = entry.depthWrite && pose.opacity >= .999;
      }
      footprintMaterial.opacity = .5 * pose.opacity;
    },
    dispose() {
      scene.remove(car);
      car.traverse(mesh => { if (mesh.isMesh && mesh.userData.generatedGeometry) mesh.geometry.dispose(); });
      materials.forEach(({ material }) => { rainSurfaces?.detach(material); material.dispose(); });
      footprintGeometry.dispose(); footprintMaterial.dispose();
    },
  };
}
