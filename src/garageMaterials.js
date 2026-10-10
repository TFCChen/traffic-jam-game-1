import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { surfaceShader } from './vehicleFinish.js';
import { contactOpacity } from './contactShadow.js';
import { sceneryAtlasData, sceneryTile } from './sceneryAtlas.js';

export function vehicleContactTexture(length, frontHalfTrack=.43) {
  const width = 128, height = 64;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;
    pixels.set([255, 255, 255, Math.round(255 * contactOpacity(
      ((x + .5) / width - .5) * (length + .12),
      ((y + .5) / height - .5) * 1.08, length, frontHalfTrack))], index);
  }
  const texture = new THREE.DataTexture(pixels, width, height);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function batchColoredMeshes(
  root,
  predicate,
  {
    roughness = 0.55,
    metalness = 0.12,
    name = "Batched trim",
    atlas = null,
    surface = null,
    colorMultiplier = null,
  } = {},
) {
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse((mesh) => {
    if (mesh.isMesh && predicate(mesh)) meshes.push(mesh);
  });
  if (meshes.length < 2) return;
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert(),
    geometries = [];
  for (const mesh of meshes) {
    const geometry = mesh.geometry
      .clone()
      .applyMatrix4(
        new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld),
      );
    if (atlas) {
      const p = geometry.getAttribute("position"),
        normal = geometry.getAttribute("normal");
      geometry.computeBoundingBox();
      const b = geometry.boundingBox,
        size = b.getSize(new THREE.Vector3()),
        name = mesh.material.name.toLowerCase();
      const tile = sceneryTile(name);
      const uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const n = [
            Math.abs(normal.getX(i)),
            Math.abs(normal.getY(i)),
            Math.abs(normal.getZ(i)),
          ],
          axis = n.indexOf(Math.max(...n));
        const a = axis === 0 ? 2 : 0,
          c = axis === 1 ? 2 : 1,
          coords = [p.getX(i), p.getY(i), p.getZ(i)],
          mins = [b.min.x, b.min.y, b.min.z],
          sizes = [size.x, size.y, size.z];
        uv[i * 2] =
          ((tile % 4) +
            ((coords[a] - mins[a]) / Math.max(0.001, sizes[a])) * 0.96 +
            0.02) /
          4;
        uv[i * 2 + 1] =
          (Math.floor(tile / 4) +
            ((coords[c] - mins[c]) / Math.max(0.001, sizes[c])) * 0.96 +
            0.02) /
          2;
      }
      geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    }
    const sourceColors = mesh.material.vertexColors
      ? geometry.getAttribute("color")
      : null;
    for (const name of Object.keys(geometry.attributes))
      if (name !== "position" && name !== "normal" && !(atlas && name === "uv"))
        geometry.deleteAttribute(name);
    const color = mesh.material.color,
      colors = new Float32Array(geometry.getAttribute("position").count * 3);
    const tint = colorMultiplier?.(mesh, geometry) ?? [1, 1, 1];
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = color.r * tint[0] * (sourceColors?.getX(i / 3) ?? 1);
      colors[i + 1] = color.g * tint[1] * (sourceColors?.getY(i / 3) ?? 1);
      colors[i + 2] = color.b * tint[2] * (sourceColors?.getZ(i / 3) ?? 1);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    if (surface) {
      const response = surface(mesh.material);
      const values = new Float32Array(geometry.getAttribute('position').count * 2);
      for (let i = 0; i < values.length; i += 2) values.set(response, i);
      geometry.setAttribute('surfaceResponse', new THREE.BufferAttribute(values, 2));
    }
    geometries.push(geometry);
  }
  const geometry = mergeGeometries(geometries);
  geometries.forEach((g) => g.dispose());
  if (!geometry) throw Error("Colored trim geometry could not be batched.");
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness,
    metalness,
  });
  material.name = name;
  if (surface) {
    material.onBeforeCompile = shader => surfaceShader(shader);
    material.customProgramCacheKey = () => 'batched-surface-response-v1';
  }
  if (atlas) {
    material.map = atlas;
    material.roughnessMap = atlas;
    material.bumpMap = atlas;
    material.bumpScale = .0016;
  }
  const merged = new THREE.Mesh(geometry, material);
  merged.userData.generatedGeometry = true;
  merged.castShadow = merged.receiveShadow = true;
  meshes.forEach((mesh) => mesh.removeFromParent());
  root.add(merged);
  return merged;
}

export function sceneryTexture() {
  const texture = new THREE.DataTexture(sceneryAtlasData(),1024,512);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function detailTexture(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d");
  if (kind === "beam") {
    const gradient = context.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, "rgba(255,239,191,0)");
    gradient.addColorStop(0.75, "rgba(255,239,191,.24)");
    gradient.addColorStop(1, "rgba(255,239,191,.7)");
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(5, 0);
    context.lineTo(59, 0);
    context.lineTo(38, 64);
    context.lineTo(26, 64);
    context.closePath();
    context.fill();
  } else if (kind === "glow") {
    const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,.65)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  } else {
    context.fillStyle = "rgba(25,35,40,.35)";
    for (let y = 0; y < 64; y += 5) {
      context.fillRect(14, y, 7, 3);
      context.fillRect(42, y, 7, 3);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function asphaltTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const context = canvas.getContext("2d"),
    data = context.createImageData(512, 512);
  let seed = 731;
  for (let i = 0; i < data.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const shade = 231 + (seed % 20);
    data.data.set([shade, shade, shade, 255], i);
  }
  context.putImageData(data, 0, 0);
  // Restrained wear: broad repair patches, aggregate and fine sealed cracks.
  context.fillStyle = "rgba(91,98,100,.07)";
  context.fillRect(84, 137, 173, 101);
  for (let i = 0; i < 450; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % 512;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y = seed % 512;
    context.fillStyle = i % 3 ? "rgba(25,32,36,.09)" : "rgba(255,255,255,.18)";
    context.fillRect(x, y, 1 + (i % 2), 1);
  }
  context.strokeStyle = "rgba(38,48,52,.10)";
  context.lineWidth = 0.8;
  for (const [x, y] of [
    [43, 61],
    [308, 332],
    [401, 111],
  ]) {
    context.beginPath();
    context.moveTo(x, y);
    for (let i = 1; i < 8; i++)
      context.lineTo(
        x + i * 8 + Math.sin(i * 2) * 4,
        y + i * 5 + Math.cos(i * 3) * 5,
      );
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Keep all four wheels in one material batch. Vertex rotation avoids four extra draw calls per car.
export function prepareWheels(root, length, frontHalfTrack = .43) {
  root.updateMatrixWorld(true);
  const wheels = [];
  root.traverse((mesh) => {
    if (mesh.isMesh && ["Rolling wheels", "Wheel brake calipers", "Wheel suspension links"].includes(mesh.material.name))
      wheels.push(mesh);
  });
  const prepared = [];
  for (const mesh of wheels) {
    const matrix = new THREE.Matrix4()
      .copy(root.matrixWorld)
      .invert()
      .multiply(mesh.matrixWorld);
    const geometry = mesh.geometry.clone().applyMatrix4(matrix),
      position = geometry.getAttribute("position");
    const pivots = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i),
        z = position.getZ(i);
      pivots.set(
        [
          x < 0 ? -length / 2 + 0.33 : length / 2 - 0.34,
          0.19,
          (z < 0 ? -1 : 1) * (x > 0 ? frontHalfTrack : .43),
        ],
        i * 3,
      );
    }
    geometry.setAttribute("wheelPivot", new THREE.BufferAttribute(pivots, 3));
    const linkage = mesh.material.name === 'Wheel suspension links';
    const fixed = mesh.material.name !== 'Rolling wheels';
    geometry.setAttribute('wheelSpin', new THREE.BufferAttribute(new Float32Array(position.count).fill(fixed ? 0 : 1), 1));
    // Body attachments stay pinned while hub attachments follow the knuckle.
    // A separate weight avoids swinging the whole arm or letting a static link
    // cut across the rotating rim when the front wheel reaches full lock.
    const steerWeights=new Float32Array(position.count);
    for(let i=0;i<position.count;i++)steerWeights[i]=linkage?THREE.MathUtils.clamp((Math.abs(position.getZ(i))-.23)/.115,0,1):1;
    geometry.setAttribute('wheelSteerWeight',new THREE.BufferAttribute(steerWeights,1));
    const colors = geometry.getAttribute('color');
    const surfaces = new Float32Array(position.count * 2);
    for (let i = 0; i < position.count; i++) {
      // Authored wheel vertex colours separate bright alloy from dark rubber.
      const brightness = colors ? Math.max(colors.getX(i), colors.getY(i), colors.getZ(i)) : 0;
      const alloy = brightness > .3, steel = brightness > .14;
      surfaces.set(fixed ? [.32, .35] : alloy ? [.24, .9] : steel ? [.48, .75] : [.88, 0], i * 2);
    }
    geometry.setAttribute('wheelSurface', new THREE.BufferAttribute(surfaces, 2));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    for (const name of Object.keys(geometry.attributes))
      if (!['position', 'normal', 'color', 'wheelPivot', 'wheelSpin', 'wheelSteerWeight', 'wheelSurface'].includes(name)) geometry.deleteAttribute(name);
    prepared.push(geometry);
  }
  if (!prepared.length) return;
  let geometry = mergeGeometries(prepared);
  if (!geometry) throw Error('Wheel and stationary brake geometry could not be batched');
  prepared.forEach(g => g.dispose());
  const visibleCount=geometry.index.count,shadow=createWheelShadowGeometry(length,frontHalfTrack);
  shadow.deleteAttribute('uv');
  const colorSize=geometry.attributes.color.itemSize;
  shadow.setAttribute('color',new THREE.BufferAttribute(new Float32Array(shadow.attributes.position.count*colorSize).fill(1),colorSize));
  const combined=mergeGeometries([geometry,shadow]);
  geometry.dispose();shadow.dispose();geometry=combined;
  geometry.userData.shadowRange=[visibleCount,geometry.index.count-visibleCount];
  geometry.setDrawRange(0,visibleCount);
  const material = wheels.find(mesh => mesh.material.name === 'Rolling wheels').material;
  wheels.forEach(mesh => mesh.removeFromParent());
  const batch = new THREE.Mesh(geometry, material);
  batch.name = 'Rolling wheels with fixed brakes';
  root.add(batch);
}

export function rollingMaterial(
  material,
  angle,
  compression = { value: [0, 0] },
  steering = { value: [0,0] },
) {
  material.onBeforeCompile = (shader) => {
    if (!material.isMeshDepthMaterial) surfaceShader(shader, 'wheelSurface');
    shader.uniforms.wheelAngle = angle;
    shader.uniforms.tyreCompression = compression;
    shader.uniforms.wheelSteering = steering;
    shader.vertexShader =
      "uniform float wheelAngle;\nuniform vec2 wheelSteering;\nuniform vec2 tyreCompression;\nattribute vec3 wheelPivot;\nattribute float wheelSpin;\nattribute float wheelSteerWeight;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      float wc=cos(wheelAngle*wheelSpin), ws=sin(wheelAngle*wheelSpin);
      vec2 wp=transformed.xy-wheelPivot.xy;
      transformed.xy=vec2(wc*wp.x-ws*wp.y,ws*wp.x+wc*wp.y)+wheelPivot.xy;
      float steer=wheelPivot.x>0.0?(wheelPivot.z<0.0?wheelSteering.x:wheelSteering.y):0.0;
      float sc=cos(steer),ss=sin(steer);
      vec2 axleOffset=transformed.xz-wheelPivot.xz;
      vec2 steeredOffset=vec2(sc*axleOffset.x+ss*axleOffset.y,-ss*axleOffset.x+sc*axleOffset.y);
      transformed.xz=mix(axleOffset,steeredOffset,wheelSteerWeight)+wheelPivot.xz;
      float load=wheelPivot.x>0.0?tyreCompression.x:tyreCompression.y;
      transformed.y-=load*smoothstep(0.0,0.38,transformed.y);
      transformed.x+=(transformed.x-wheelPivot.x)*load*2.0*(1.0-smoothstep(0.0,0.15,transformed.y));`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <beginnormal_vertex>",
      `#include <beginnormal_vertex>
      float nc=cos(wheelAngle*wheelSpin), ns=sin(wheelAngle*wheelSpin);
      objectNormal.xy=vec2(nc*objectNormal.x-ns*objectNormal.y,ns*objectNormal.x+nc*objectNormal.y);
      float normalSteer=wheelPivot.x>0.0?(wheelPivot.z<0.0?wheelSteering.x:wheelSteering.y):0.0;
      float normalSC=cos(normalSteer),normalSS=sin(normalSteer);
      objectNormal.xz=mix(objectNormal.xz,vec2(normalSC*objectNormal.x+normalSS*objectNormal.z,-normalSS*objectNormal.x+normalSC*objectNormal.z),wheelSteerWeight);`,
    );
  };
  material.customProgramCacheKey = () => "rolling-wheels-ackermann-linkage-v7";
  return material;
}

// Shadow maps cannot resolve tread grooves, spokes or brake drillings. Retain
// the tyre silhouette and exactly the same hubs/steering in a tiny depth mesh.
export function createWheelShadowGeometry(length, frontHalfTrack = .43) {
  const pieces=[];
  for(const x of [-length/2+.33,length/2-.34])for(const side of [-1,1]){
    const z=side*(x>0?frontHalfTrack:.43);
    const geometry=new THREE.CylinderGeometry(.19,.19,.134,24,1);
    geometry.rotateX(Math.PI/2);geometry.translate(x,.19,z);
    const count=geometry.attributes.position.count,pivots=new Float32Array(count*3);
    for(let i=0;i<count;i++)pivots.set([x,.19,z],i*3);
    geometry.setAttribute('wheelPivot',new THREE.BufferAttribute(pivots,3));
    geometry.setAttribute('wheelSpin',new THREE.BufferAttribute(new Float32Array(count),1));
    geometry.setAttribute('wheelSteerWeight',new THREE.BufferAttribute(new Float32Array(count).fill(1),1));
    geometry.setAttribute('wheelSurface',new THREE.BufferAttribute(new Float32Array(count*2),2));
    pieces.push(geometry);
  }
  const geometry=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());
  return geometry;
}
