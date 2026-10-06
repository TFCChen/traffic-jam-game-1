import * as THREE from 'three';

// Keep the puzzle's parked fleet dark. Activity stays lit briefly, then fades.
export function vehicleLampState(item, theme, now) {
  const active = item?.isDrag || Math.abs(item?.velocity ?? 0) > .08;
  const fade = active ? 1 : Math.max(0, Math.min(1, ((item?.lightUntil ?? 0) - now) / 600));
  const night = theme !== 'day';
  const brake = item?.braking ? 1 : 0;
  return {
    head: night ? fade : 0,
    park: night ? .12 * fade : 0,
    brake,
    reverse: item?.reversing ? 1 : 0,
    activity: fade
  };
}
export function vehicleLightPower(theme, active) {
  return !active ? 0 : theme === 'day' ? .65 : theme === 'neon' ? 13 : 8;
}

// Choose actual exterior lenses, excluding taxi signs and roof safety markers.
export function collectLampAnchors(group, len) {
  const candidates = {
    head: [],
    tail: []
  };
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  group.traverse(mesh => {
    if (!mesh.isMesh || !['Headlamp', 'Tail lamp'].includes(mesh.material.name)) return;
    const kind = mesh.material.name === 'Headlamp' ? 'head' : 'tail';
    const matrix = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
    const vertices = mesh.geometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      const center = new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(matrix);
      if ((kind === 'head' ? center.x : -center.x) < len * .35 || Math.abs(center.z) < .12) continue;
      candidates[kind].push({
        mesh,
        center
      });
    }
  });
  const choose = kind => [-1, 1].map(side => {
    const all = candidates[kind].filter(a => Math.sign(a.center.z) === side);
    const low = Math.min(...all.map(a => a.center.y));
    const lowLenses = all.filter(a => a.center.y <= low + .12);
    if (!lowLenses.length) return null;
    const edge = kind === 'head' ? Math.max(...lowLenses.map(a => a.center.x)) : Math.min(...lowLenses.map(a => a.center.x));
    const lens = lowLenses.filter(a => Math.abs(a.center.x - edge) < .035);
    const rootPoint = lens.reduce((sum, a) => sum.add(a.center), new THREE.Vector3()).multiplyScalar(1 / lens.length);
    rootPoint.x = edge;
    rootPoint.y += .006;
    const mesh = lens[0].mesh;
    return {
      mesh,
      point: mesh.worldToLocal(group.localToWorld(rootPoint.clone()))
    };
  });
  return {
    head: choose('head'),
    tail: choose('tail')
  };
}
function beamMaterial() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      shadowDepth: {
        value: null
      },
      shadowTransform: {
        value: new THREE.Matrix4()
      },
      power: {
        value: 0
      },
      tint: {
        value: new THREE.Color('#ffeac7')
      }
    },
    vertexShader: `varying vec3 worldPoint;varying vec3 beamNormal;varying float along;
      void main(){worldPoint=(modelMatrix*vec4(position,1.)).xyz;beamNormal=normalize(mat3(modelMatrix)*normal);along=.5-position.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2DShadow shadowDepth;uniform mat4 shadowTransform;uniform float power;uniform vec3 tint;
      varying vec3 worldPoint;varying vec3 beamNormal;varying float along;out vec4 beamColor;
      void main(){vec4 s=shadowTransform*vec4(worldPoint,1.);vec3 p=s.xyz/s.w;
        float lit=all(greaterThanEqual(p,vec3(0.)))&&all(lessThanEqual(p,vec3(1.)))?texture(shadowDepth,vec3(p.xy,p.z-.002)):0.;
        float edge=pow(abs(dot(normalize(beamNormal),normalize(cameraPosition-worldPoint))),1.4);
        float fade=pow(1.-clamp(along,0.,1.),1.6)*smoothstep(0.,.035,along);
        beamColor=vec4(tint,power*edge*fade*lit);}`
  });
}
export function createVehicleLights(scene) {
  const headGeometry = new THREE.CylinderGeometry(.006, 1, 1, 12, 1, true);
  const heads = [-1, 1].map(side => {
    const light = new THREE.SpotLight('#fff0d6', 0, 5.5, .40, .50, 2);
    light.castShadow = true;
    light.shadow.mapSize.set(256, 256);
    light.shadow.camera.near = .025;
    light.shadow.bias = -.0002;
    light.shadow.normalBias = .006;
    light.shadow.autoUpdate = false;
    light.shadow.needsUpdate = true;
    const beam = new THREE.Mesh(headGeometry, beamMaterial());
    beam.visible = false;
    beam.frustumCulled = false;
    beam.raycast = () => {};
    scene.add(light, light.target, beam);
    return {
      light,
      side,
      beam
    };
  });
  // Short rear spill has no extra shadow maps; the two head maps remain bounded.
  const tails = [-1, 1].map(side => {
    const light = new THREE.SpotLight('#ef3024', 0, 1.2, .95, .9, 2);
    scene.add(light, light.target);
    return {
      light,
      side
    };
  });
  const forward = new THREE.Vector3(),
    local = new THREE.Vector3(),
    tip = new THREE.Vector3(),
    down = new THREE.Vector3(0, -1, 0);
  const lights = [...heads, ...tails];
  const previous = lights.map(() => ({
    position: new THREE.Vector3(Infinity, 0, 0),
    target: new THREE.Vector3(Infinity, 0, 0)
  }));
  let owner = null,
    previousTheme = null,
    previousOwner = null,
    lastShadow = 0,
    pendingShadow = true;
  function origin(item, kind, index, out) {
    const anchor = item.lightAnchors?.[kind]?.[index];
    if (anchor) anchor.mesh.localToWorld(out.copy(anchor.point));else item.group.localToWorld(out.set((kind === 'head' ? 1 : -1) * item.car.len / 2, .30, index ? .26 : -.26));
    out.addScaledVector(forward, kind === 'head' ? .012 : -.012);
  }
  return {
    update(item, settings, quality, now, castersChanged = false) {
      owner = item?.car.id ?? null;
      const state = vehicleLampState(item, settings.theme, now);
      if (item) {
        // Refresh cached descendants before sampling lenses: localToWorld on a
        // fixed child alone does not propagate a newly moved parent's matrix.
        item.group.updateWorldMatrix(true, true);
        forward.set(1, 0, 0).transformDirection(item.group.matrixWorld);
      }
      for (let i = 0; i < 2; i++) {
        const {
          light,
          beam
        } = heads[i];
        const daylight = settings.theme === 'day';
        const headActivity = daylight ? state.activity : state.head;
        light.color.set(daylight ? '#e8f4ff' : '#fff0d6');
        light.distance = daylight ? .85 : 5.5;
        light.angle = daylight ? .65 : .40;
        light.intensity = item && quality.decor ? vehicleLightPower(settings.theme, headActivity > 0) * headActivity : 0;
        if (item) {
          origin(item, 'head', i, light.position);
          light.target.position.copy(light.position).addScaledVector(forward, 4);
          light.target.position.y -= .23;
          light.target.updateMatrixWorld();
        }
        const depth = light.shadow.map?.depthTexture;
        beam.visible = !daylight && !!depth && light.intensity > 0 && quality.decor;
        if (beam.visible) {
          const length = 4.8,
            radius = Math.tan(light.angle) * length;
          tip.subVectors(light.target.position, light.position).normalize();
          beam.position.copy(light.position).addScaledVector(tip, length / 2);
          beam.quaternion.setFromUnitVectors(down, tip);
          beam.scale.set(radius, length, radius);
          beam.material.uniforms.shadowDepth.value = depth;
          beam.material.uniforms.shadowTransform.value = light.shadow.matrix;
          beam.material.uniforms.power.value = state.head * (settings.theme === 'neon' ? .065 : .035);
        }
        const rear = tails[i].light;
        const reverse = state.reverse > 0;
        rear.color.set(reverse ? '#eef4ff' : '#ef3024');
        rear.intensity = item && quality.decor ? reverse ? .22 : state.brake ? 2.0 : state.park * 1.8 : 0;
        if (item) {
          origin(item, reverse ? 'reverse' : 'tail', i, rear.position);
          rear.target.position.copy(rear.position).addScaledVector(forward, -1);
          rear.target.position.y -= .18;
          rear.target.updateMatrixWorld();
        }
      }
      if (owner !== previousOwner || castersChanged || settings.theme !== previousTheme) pendingShadow = true;
      previousTheme = settings.theme;
      previousOwner = owner;
      for (let i = 0; i < lights.length; i++) {
        const light = lights[i].light,
          old = previous[i];
        if (light.position.distanceToSquared(old.position) > 1e-6 || light.target.position.distanceToSquared(old.target) > 1e-6) pendingShadow = true;
        old.position.copy(light.position);
        old.target.copy(light.target.position);
      }
      if (heads[0].light.intensity > 0 && settings.shadows && pendingShadow && now - lastShadow >= 1000 / 20) {
        for (const {
          light
        } of heads) light.shadow.needsUpdate = true;
        pendingShadow = false;
        lastShadow = now;
        return true;
      }
      return false;
    },
    snapshot() {
      const describe = ({
        light
      }) => ({
        intensity: light.intensity,
        color: light.color.getHexString(),
        position: light.position.toArray(),
        target: light.target.position.toArray(),
        shadow: light.castShadow,
        shadowMapReady: !!light.shadow.map,
        angle: light.angle,
        distance: light.distance,
        decay: light.decay
      });
      return {
        owner,
        headlights: heads.map(describe),
        taillights: tails.map(describe),
        rear: describe(tails[0]),
        beams: heads.map(h => h.beam.visible)
      };
    },
    dispose() {
      for (const {
        light
      } of lights) {
        scene.remove(light, light.target);
        light.dispose();
      }
      for (const {
        beam
      } of heads) {
        scene.remove(beam);
        beam.material.dispose();
      }
      headGeometry.dispose();
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
