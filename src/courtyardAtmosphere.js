import * as THREE from 'three';

// World-space tree anchors. Each path stays on the surrounding sidewalks.
export const TREE_ANCHORS = [[-.68, 5.6], [5.66, -.73], [6, 7.25], [-1.5, 6.95]];
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
export function leafPose(time, index) {
  const [x, z] = TREE_ANCHORS[index % 4];
  const age = (time + index * 4.1) % (33 + index * .7);
  const fall = Math.min(age / 5.2, 1);
  const drift = smooth(fall);
  return {
    x: x + .12 * drift + Math.sin(fall * 7 + index) * .07 * Math.sin(fall * Math.PI),
    y: 1.28 - 1.162 * drift,
    z: z + .26 * drift + Math.cos(fall * 6 + index) * .09 * Math.sin(fall * Math.PI),
    fall,
    alpha: smooth(age / .6) * (1 - smooth((age - 8) / 3)),
  };
}

export function createCourtyardAtmosphere(scene, garage) {
  let time = 0, activeLeaves = 0, enabled = false;
  const wind = { value: new THREE.Vector4() }, cafeGlow = { value: 0 };
  const geometries = [], changed = [];
  garage.updateWorldMatrix(true, true);
  garage.traverse(mesh => {
    if (!mesh.isMesh) return;
    const material = mesh.material;
    if (['Courtyard foliage detail', 'Courtyard bark'].includes(material.name)) {
      const original = mesh.geometry, geometry = original.clone();
      mesh.geometry = geometry; geometries.push(geometry); changed.push([mesh, original]);
      const positions = geometry.attributes.position, profile = new Float32Array(positions.count * 4);
      const point = new THREE.Vector3();
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        const weight = smooth((point.y - .2) / .95);
        profile.set([weight, weight * Math.sin(point.x * 3 + point.z * 2),
          weight * Math.cos(point.x * 4 - point.z * 3), weight * Math.sin(point.z * 5)], i * 4);
      }
      geometry.setAttribute('windProfile', new THREE.BufferAttribute(profile, 4));
      geometry.computeBoundingBox(); geometry.boundingBox.expandByScalar(.04);
      geometry.computeBoundingSphere(); geometry.boundingSphere.radius += .04;
      const toLocal = { value: new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld).invert() };
      const before = material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        before.call(material, shader, renderer);
        shader.uniforms.courtyardWind = wind; shader.uniforms.windToLocal = toLocal;
        shader.vertexShader = 'attribute vec4 windProfile; uniform vec4 courtyardWind; uniform mat3 windToLocal;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          transformed += windToLocal * vec3(courtyardWind.x * windProfile.x + courtyardWind.z * windProfile.y,
            courtyardWind.w * windProfile.z, courtyardWind.y * windProfile.x + courtyardWind.z * windProfile.w);`);
      };
      material.customProgramCacheKey = () => 'courtyard-wind-v1'; material.needsUpdate = true;
    }
    if (material.name === 'Architectural glazing') {
      const before = material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        before.call(material, shader, renderer);
        shader.uniforms.cafeGlow = cafeGlow;
        shader.vertexShader = 'varying vec3 cafeWorld;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ncafeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = 'varying vec3 cafeWorld; uniform float cafeGlow;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float windowMask = (1.0 - smoothstep(0.012, 0.027, abs(cafeWorld.x + .719)))
            * (1.0 - smoothstep(.425, .455, abs(cafeWorld.z - 1.08)))
            * (1.0 - smoothstep(.145, .165, abs(cafeWorld.y - .59)));
          float shelf = 1.0 - .35 * (1.0 - smoothstep(.008, .018, abs(cafeWorld.y - .565)));
          float warmth = .65 + .35 * smoothstep(.42, .74, cafeWorld.y);
          totalEmissiveRadiance += vec3(1.0, .55, .22) * cafeGlow * windowMask * shelf * warmth;`);
      };
      material.customProgramCacheKey = () => 'cafe-window-v1'; material.needsUpdate = true;
    }
  });

  // Folded almond silhouette instead of rectangular particles, one draw call.
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0,0,-.06, -.026,0,0, 0,.009,0,
    -.026,0,0, 0,0,.06, 0,.009,0,
    0,0,.06, .026,0,0, 0,.009,0,
    .026,0,0, 0,0,-.06, 0,.009,0,
  ], 3));
  geometry.computeVertexNormals();
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(8), 1);
  geometry.setAttribute('leafFade', fade);
  const material = new THREE.MeshLambertMaterial({ color: '#c7a16b', side: THREE.DoubleSide, transparent: true, depthWrite: false });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float leafFade; varying float fallingLeafFade;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nfallingLeafFade = leafFade;');
    shader.fragmentShader = 'varying float fallingLeafFade;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= fallingLeafFade;');
  };
  material.customProgramCacheKey = () => 'folded-leaf-v1';
  const leaves = new THREE.InstancedMesh(geometry, material, 8);
  leaves.name = 'Courtyard falling leaves'; leaves.frustumCulled = false;
  leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage); fade.setUsage(THREE.DynamicDrawUsage);
  const pose = new THREE.Object3D();
  for (let i = 0; i < 8; i++) leaves.setColorAt(i, new THREE.Color(i % 2 ? '#9eac6e' : '#d8b17b'));
  scene.add(leaves);
  // Residual runoff from the cafe canopy, rather than a screen rain overlay.
  const dripGeometry=new THREE.SphereGeometry(1,5,4);
  const dripMaterial=new THREE.MeshStandardMaterial({color:'#cce5ee',roughness:.04,metalness:.1,transparent:true,opacity:.5,depthWrite:false});
  const drips=new THREE.InstancedMesh(dripGeometry,dripMaterial,6);
  drips.visible=false;
  drips.name='Residual canopy drips';drips.raycast=()=>{};drips.frustumCulled=false;
  drips.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(drips);
  const cafeLight = new THREE.PointLight('#ffc17b', 0, 1.5, 2);
  cafeLight.name = 'Cafe window spill'; cafeLight.position.set(-.55, .63, 1.08); scene.add(cafeLight);

  return {
    setTheme(settings, quality) {
      cafeGlow.value = settings.theme === 'neon' ? .8 : settings.theme === 'sunset' ? .23 : settings.theme === 'rain' ? .12 : .018;
      cafeLight.intensity = quality.decor ? (settings.theme === 'neon' ? .4 : settings.theme === 'sunset' ? .15 : settings.theme === 'rain' ? .08 : 0) : 0;
      cafeLight.visible = cafeLight.intensity > 0;
    },
    update(dt, settings, quality, reduced, editor) {
      enabled = quality.decor && !reduced && !editor;
      leaves.visible = enabled;
      drips.visible=enabled&&settings.theme==='rain';
      if (!enabled) { wind.value.set(0, 0, 0, 0); activeLeaves = 0; return; }
      time += Math.min(dt, .1);
      if(drips.visible)for(let i=0;i<6;i++){
        const phase=(time+i*.63)%3.7,fall=Math.max(0,phase-2.9);
        const y=.9-1.7*fall*fall,visible=phase>2.9&&y>.11;
        pose.position.set(-.38,y,.6+i*.18);
        pose.rotation.set(0,0,0);pose.scale.set(visible?.005:0,visible?.007+fall*.013:0,visible?.005:0);
        pose.updateMatrix();drips.setMatrixAt(i,pose.matrix);
      }
      if(drips.visible)drips.instanceMatrix.needsUpdate=true;
      const gust = .7 + .3 * Math.sin(time * .31);
      wind.value.set(Math.sin(time * .7) * .017 * gust, Math.cos(time * .53) * .011 * gust,
        Math.sin(time * 1.7) * .003, Math.sin(time * 1.1) * .002);
      activeLeaves = 0;
      for (let i = 0; i < 8; i++) {
        const leaf = leafPose(time, i);
        pose.position.set(leaf.x, leaf.y, leaf.z);
        const airborne = 1 - smooth((leaf.fall - .75) / .25);
        pose.rotation.set(Math.sin(leaf.fall * 9 + i) * airborne, i + leaf.fall * 4, Math.cos(leaf.fall * 8 + i) * .6 * airborne);
        pose.scale.setScalar(.75 + (i % 3) * .13); pose.updateMatrix(); leaves.setMatrixAt(i, pose.matrix);
        fade.array[i] = leaf.alpha; if (leaf.alpha > .01) activeLeaves++;
      }
      leaves.instanceMatrix.needsUpdate = true; fade.needsUpdate = true;
    },
    snapshot() { return { enabled, activeLeaves, leafCapacity: 8, residualDrips:drips.visible, dripCapacity:6, wind: wind.value.toArray(), cafeGlow: cafeGlow.value, cafeLight: cafeLight.intensity, animatedShadowUpdates: 0 }; },
    pause() {
      const wasEnabled = enabled;
      enabled = false; activeLeaves = 0; leaves.visible = false; wind.value.set(0, 0, 0, 0);
      drips.visible=false;
      return wasEnabled;
    },
    dispose() {
      for (const [mesh, original] of changed) mesh.geometry = original;
      geometries.forEach(g => g.dispose()); scene.remove(leaves, cafeLight);
      leaves.dispose(); geometry.dispose(); material.dispose(); cafeLight.dispose();
      scene.remove(drips);drips.dispose();dripGeometry.dispose();dripMaterial.dispose();
    },
  };
}
