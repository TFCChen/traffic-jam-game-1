import * as THREE from 'three';
export function vehicleLightPower(theme, moving) {
  return theme === 'neon' ? moving ? 22 : 15 : theme === 'sunset' ? moving ? 14 : 8 : moving ? 7 : 0;
}
export function createVehicleLights(scene) {
  // The two visible lenses share a merged broad beam beyond the bumper.
  const heads = [0].map(side => {
    const light = new THREE.SpotLight('#fff0d6', 0, 5.5, .55, .45, 2);
    light.castShadow = true;
    light.shadow.mapSize.set(256, 256);
    light.shadow.camera.near = .045;
    light.shadow.bias = -.0002;
    light.shadow.normalBias = .008;
    light.shadow.autoUpdate = false;
    // Allocate a valid depth texture even when the daytime lamp starts off.
    light.shadow.needsUpdate = true;
    scene.add(light, light.target);
    return {
      light,
      side
    };
  });
  const rear = new THREE.SpotLight('#ef3024', 0, 1.6, 1.0, .85, 2);
  scene.add(rear, rear.target);
  rear.castShadow = true;
  rear.shadow.mapSize.set(256, 256);
  rear.shadow.camera.near = .045;
  rear.shadow.bias = -.0002;
  rear.shadow.normalBias = .008;
  rear.shadow.autoUpdate = false;
  rear.shadow.needsUpdate = true;
  const position = new THREE.Vector3();
  let owner = null,
    lastShadow = 0,
    lastPose = '',
    pendingShadow = false;
  return {
    update(item, settings, quality, now, castersChanged = false) {
      owner = item?.car.id ?? null;
      const moving = !!item && (item.isDrag || Math.abs(item.velocity) > .08 || now < item.brakeUntil);
      const power = item && quality.decor ? vehicleLightPower(settings.theme, moving) : 0;
      for (const {
        light,
        side
      } of heads) {
        light.intensity = power;
        if (item) {
          light.position.copy(item.group.localToWorld(position.set(item.car.len / 2 + .018, .32, side)));
          light.target.position.copy(item.group.localToWorld(position.set(item.car.len / 2 + 4, .10, side)));
          light.target.updateMatrixWorld();
        }
      }
      rear.intensity = item && quality.decor ? item.braking ? 4 : item.reversing ? 2 : settings.theme === 'neon' ? .7 : settings.theme === 'sunset' ? .35 : 0 : 0;
      if (item) {
        rear.position.copy(item.group.localToWorld(position.set(-item.car.len / 2 - .035, .24, 0)));
        rear.target.position.copy(item.group.localToWorld(position.set(-item.car.len / 2 - 1, .045, 0)));
        rear.target.updateMatrixWorld();
      }
      // A bounded front/rear pair follows the active car and respects occlusion;
      // idle maps are cached, with moving shadows refreshed at most 20 Hz.
      const pose = [...heads.map(h => h.light), rear].map(light => [...light.position.toArray(), ...light.target.position.toArray()].map(v => v.toFixed(3)).join(',')).join('|') + owner + settings.shadows;
      if (pose !== lastPose || castersChanged) pendingShadow = true;
      lastPose = pose;
      if ((power > 0 || rear.intensity > 0) && settings.shadows && pendingShadow && now - lastShadow >= 1000 / 20) {
        for (const {
          light
        } of heads) light.shadow.needsUpdate = true;
        rear.shadow.needsUpdate = true;
        pendingShadow = false;
        lastShadow = now;
        return true;
      }
      return false;
    },
    snapshot() {
      return {
        owner,
        headlights: heads.map(({
          light
        }) => ({
          intensity: light.intensity,
          position: light.position.toArray(),
          target: light.target.position.toArray(),
          shadow: light.castShadow,
          shadowMapReady: Boolean(light.shadow.map),
          angle: light.angle,
          distance: light.distance,
          decay: light.decay
        })),
        rear: {
          intensity: rear.intensity,
          color: rear.color.getHexString(),
          position: rear.position.toArray(),
          target: rear.target.position.toArray(),
          angle: rear.angle,
          distance: rear.distance,
          decay: rear.decay,
          shadow: rear.castShadow,
          shadowMapReady: Boolean(rear.shadow.map)
        }
      };
    },
    dispose() {
      for (const {
        light
      } of heads) {
        scene.remove(light, light.target);
        light.dispose();
      }
      scene.remove(rear, rear.target);
      rear.dispose();
    }
  };
}
function smokeTexture() {
  const size = 128,
    canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'),
    data = ctx.createImageData(size, size);
  const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const noise = (x, y) => {
    const a = Math.floor(x),
      b = Math.floor(y),
      u = x - a,
      v = y - b,
      s = u * u * (3 - 2 * u),
      t = v * v * (3 - 2 * v);
    return (hash(a, b) * (1 - s) + hash(a + 1, b) * s) * (1 - t) + (hash(a, b + 1) * (1 - s) + hash(a + 1, b + 1) * s) * t;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x - size / 2) / (size / 2),
      ny = (y - size / 2) / (size / 2),
      r = Math.hypot(nx, ny);
    const n = .55 * noise(x / 23, y / 23) + .28 * noise(x / 11, y / 11) + .17 * noise(x / 5, y / 5);
    const edge = Math.max(0, 1 - r),
      alpha = Math.pow(edge, 1.5) * Math.max(0, n - .18) * 1.7;
    const i = (y * size + x) * 4;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = Math.round(220 + n * 35);
    data.data[i + 3] = Math.round(Math.min(1, alpha) * 255);
  }
  ctx.putImageData(data, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function createExhaustSmoke(scene, capacity = 56, texture = smokeTexture()) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const opacity = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  opacity.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('smokeOpacity', opacity);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: '#aeb7ba',
    transparent: true,
    depthWrite: false,
    opacity: 1
  });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float smokeOpacity;varying float vSmokeOpacity;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSmokeOpacity=smokeOpacity;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSmokeOpacity;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a*=vSmokeOpacity;');
  };
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);
  const particles = Array.from({
    length: capacity
  }, () => ({
    life: 0,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    spin: 0,
    seed: Math.random() * 20
  }));
  const pose = new THREE.Object3D(),
    axis = new THREE.Vector3(0, 0, 1);
  let emitted = 0;
  for (let i = 0; i < capacity; i++) {
    pose.scale.setScalar(0);
    pose.updateMatrix();
    mesh.setMatrixAt(i, pose.matrix);
  }
  return {
    emit(position, direction) {
      const p = particles.find(p => p.life <= 0);
      if (!p) return false;
      p.life = p.duration = 1.8 + Math.random() * .6;
      p.position.copy(position);
      p.position.y += (Math.random() - .5) * .015;
      p.velocity.copy(direction).multiplyScalar(.10 + Math.random() * .08);
      p.velocity.y = .07 + Math.random() * .05;
      p.spin = Math.random() * Math.PI * 2;
      emitted++;
      return true;
    },
    update(dt, now, camera, enabled, theme) {
      let active = 0;
      mesh.visible = enabled;
      material.color.set(theme === 'neon' ? '#aabacb' : theme === 'sunset' ? '#b3a89f' : '#aeb7ba');
      for (let i = 0; i < capacity; i++) {
        const p = particles[i];
        if (!enabled) p.life = 0;
        if (p.life > 0) {
          p.life = Math.max(0, p.life - dt);
          const age = p.duration - p.life,
            t = age / p.duration;
          p.position.addScaledVector(p.velocity, dt);
          p.position.x += Math.sin(now * .001 + p.seed) * dt * .035;
          p.position.z += Math.cos(now * .0008 + p.seed) * dt * .024;
          pose.position.copy(p.position);
          pose.quaternion.copy(camera.quaternion);
          pose.rotateOnAxis(axis, p.spin + age * .22);
          pose.scale.setScalar(.065 + age * .16);
          opacity.setX(i, Math.min(1, age / .16) * Math.pow(1 - t, 1.6) * .65);
          active++;
        } else {
          pose.scale.setScalar(0);
          opacity.setX(i, 0);
        }
        pose.updateMatrix();
        mesh.setMatrixAt(i, pose.matrix);
      }
      opacity.needsUpdate = true;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = enabled && active > 0;
    },
    snapshot() {
      return {
        capacity,
        active: particles.filter(p => p.life > 0).length,
        emitted,
        drawCalls: mesh.visible ? 1 : 0
      };
    },
    dispose() {
      scene.remove(mesh);
      mesh.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    }
  };
}
