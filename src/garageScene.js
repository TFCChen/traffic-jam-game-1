import * as THREE from "three";
import { cullUnlitPixels } from './localLightCulling.js';
cullUnlitPixels();
import {stabilizeShadowFilter} from './stableShadowFilter.js';
stabilizeShadowFilter();
import { createHintGuide } from './hintGuide.js';
import { exitPose, exitSceneFade, EXIT_COMPLETE_MS } from './exitChoreography.js';
import { vegetationShadowProxy, configureCourtyardSunShadow } from './environmentShadows.js';
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createCourtyardReflections } from './courtyardReflections.js';
import { legalMovesForCar } from "./gameEngine.js";
import { vehicleModel } from "./vehicleModels.js";
import { placementBetween, drawingCells } from './editorPlacement.js';
import {
  sceneryTexture,
  detailTexture,
  prepareWheels,
  rollingMaterial,
  batchColoredMeshes,
  vehicleContactTexture,
} from "./garageMaterials.js";
import { SCENE_THEMES } from "./sceneThemes.js";
import { QUALITY } from "./gamePreferences.js";
import { configureVehicleGlass, prepareVehicleGlass, VEHICLE_MIRROR } from "./vehicleGlass.js";
import { createVehicleLights, createExhaustSmoke, collectLampAnchors, vehicleLampState, movingShadowRefreshDue } from './vehicleEffects.js';
import { quadDistance, snapDragDelta } from "./pointerHelpers.js";
import {
  stepSuspension,
  contactImpulse,
  axleCompression,
  SUSPENSION_PROFILES,
} from "./vehicleDynamics.js";
import { createRenderProfiler } from "./renderProfiler.js";
import { cacheLocalTransforms } from "./sceneTransforms.js";
import { createCourtyardAtmosphere } from './courtyardAtmosphere.js';
import { createGroundSurface, pavingTone } from './groundSurface.js';
import { createStreetTraffic, extendStreetRoad } from './streetTraffic.js';
import { createRainSurfaces } from './rainSurfaces.js';
import { configureVehiclePaint, vehicleTrimSurface } from './vehicleFinish.js';
import { VEHICLE_GROUND_HEIGHT, CONTACT_PLANE_OFFSET } from './contactShadow.js';
import {
  DEFAULT_VIEW,
  ORTHOGRAPHIC_DISTANCE,
  ORTHOGRAPHIC_FAR,
  normalizeView,
  viewUp,
  rotateView,
  panView,
  zoomView,
  touchPair,
  safeFrame,
} from "./cameraControls.js";

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const modelNames = [
  "garage",
  "racer",
  "jeep",
  "pickup",
  "compact",
  "taxi",
  "schoolbus",
  "coach",
  "camper",
  "delivery",
];
let sceneSequence = 0;
let assetsPromise;
function assets() {
  if (!assetsPromise) {
    const loader = new GLTFLoader();
    assetsPromise = Promise.all(
      modelNames.map(async (name) => [
        name,
        (await loader.loadAsync(`/models/${name}.glb?v=${__MODEL_REVISION__}`)).scene,
      ]),
    )
      .then((entries) => {
        for (const [name, root] of entries) {
          if (name !== "garage")
            prepareWheels(
              root,
              ["schoolbus", "coach", "camper", "delivery"].includes(name)
                ? 3
                : 2,
              name === 'racer' ? .405 : .43,
            );
          root.traverse((o) => {
            if (o.isMesh && o.material.name === 'Automotive glass') {
              const original = o.geometry;
              o.geometry = prepareVehicleGlass(original);
              original.dispose();
            }
            if (o.isMesh) o.geometry.computeBoundingBox();
          });
        }
        return Object.fromEntries(entries);
      })
      .catch((error) => {
        assetsPromise = null;
        throw error;
      });
  }
  return assetsPromise;
}

export function createGarageScene(canvas, getProps, callbacks) {
  const instanceId = ++sceneSequence;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  const profiler = createRenderProfiler(renderer.getContext());
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  const scene = new THREE.Scene();
  // The scene root never moves; composing it every frame dirties every branch.
  scene.matrixAutoUpdate = false;
  const exitFadeMaterial=new THREE.MeshBasicMaterial({color:'#131a22',transparent:true,opacity:0,depthTest:false,depthWrite:false,toneMapped:false,fog:false});
  exitFadeMaterial.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','gl_Position=vec4(position.xy,0.,1.);');
  };
  exitFadeMaterial.customProgramCacheKey=()=> 'exit-shot-fade-v1';
  const exitFadeGeometry=new THREE.PlaneGeometry(2,2);
  const exitFade=new THREE.Mesh(exitFadeGeometry,exitFadeMaterial);
  exitFade.frustumCulled=false;exitFade.renderOrder=1000000;exitFade.visible=false;exitFade.raycast=()=>{};
  scene.add(exitFade);
  let reflections, reflectionTimer, reflectionTheme, reflectionPending;
  function refreshReflections(theme) {
    if(!reflections) return;
    const position=sun.position.clone(), intensity=sun.intensity;
    const key=JSON.stringify([theme.id,...position.toArray(),intensity]);
    if(key===reflections.snapshot().key) {clearTimeout(reflectionTimer);reflectionPending=null;return;}
    if(key===reflectionPending) return;
    clearTimeout(reflectionTimer);
    const capture=()=>{if(!alive)return;scene.environment=reflections.update(theme,position,intensity);reflectionPending=null;dirty=true;};
    if(reflectionTheme!==theme.id) {reflectionTheme=theme.id;capture();}
    else {reflectionPending=key;reflectionTimer=setTimeout(capture,180);}
  }
  const sceneryAtlas = sceneryTexture();
  const glowTexture = detailTexture("glow"),
    skidTexture = detailTexture("skid");
  const contactGeometry = new THREE.PlaneGeometry(1, 1);
  const contactTextures = new Map([2, 3].map(length => [length, vehicleContactTexture(length)]));
  contactTextures.set('racer',vehicleContactTexture(2,.405));
  const camera = new THREE.OrthographicCamera(-5, 5, 4, -4, 0.1, ORTHOGRAPHIC_FAR);
  const aim = new THREE.Vector3(3, 0.15, 3);
  const viewAim = aim.clone();
  // A fixed reference view determines framing. Orbit changes orientation only,
  // so fitting the current angle cannot silently change the player's scale.
  const framingCamera = camera.clone();
  let frameInsets = { top: 0, bottom: 0 };
  let framingEditor = false;
  const framingPitch = THREE.MathUtils.degToRad(DEFAULT_VIEW.pitch),
    framingYaw = THREE.MathUtils.degToRad(DEFAULT_VIEW.yaw);
  framingCamera.position.set(
    aim.x + Math.sin(framingYaw) * Math.cos(framingPitch) * 14,
    aim.y + Math.sin(framingPitch) * 14,
    aim.z + Math.cos(framingYaw) * Math.cos(framingPitch) * 14,
  );
  framingCamera.up.fromArray(viewUp(DEFAULT_VIEW));
  framingCamera.lookAt(aim);
  framingCamera.updateMatrixWorld();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -VEHICLE_GROUND_HEIGHT);
  const groups = new Map();
  const ownedMaterials = new Set(),
    ownedGeometries = new Set();
  let library,
    alive = true,
    ready = false,
    drag,
    editorDrag,
    sceneKey,
    selected,
    escapeStart,
    lastTime = performance.now(),
    frame;
  let dirty = true,
    inView = true,
    settlingUntil = 0,
    lastShadow = 0,
    cameraFollow = 0,
    cameraFollowZ = 0,
    nextFrame = 0,
    lastHover = 0;
  const sceneryLamps = [];
  let vegetationShadows;
  let atmosphere;
  let groundSurface;
  let streetTraffic;
  const rainSurfaces=createRainSurfaces();
  const stats = { frames: 0, shadowUpdates: 0, movingFrames: 0, movingShadowFrames: 0, renderedSceneKey: null };
  const inputSamples = [];
  let pendingInputAt = null,
    measuring = false;
  function inputSummary() {
    const sorted = [...inputSamples].sort((a, b) => a - b);
    return {
      count: sorted.length,
      median: sorted[Math.floor(sorted.length * 0.5)] ?? null,
      p95:
        sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ??
        null,
    };
  }
  const scratchPosition = new THREE.Vector3(),
    scratchDirection = new THREE.Vector3();
  const settings = {
    ...DEFAULT_VIEW,
    light: -40,
    intensity: 3,
    shadows: true,
    theme: "day",
    quality: "high",
    zoom: 1,
    panX: 0,
    panY: 0,
  };
  const touches = new Map();
  let cameraGesture = null,
    touchBlocked = false,
    cameraPending = false;
  let quality = QUALITY.high;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const motionChanged = () => {
    dirty = true;
    settlingUntil = performance.now() + 450;
  };
  reduced.addEventListener("change", motionChanged);
  const ambient = new THREE.HemisphereLight(0xfff7e7, 0x738a89, 2.0);
  scene.add(ambient);
  const garageFill = new THREE.SpotLight("#c7e4ec", 24, 9, 0.82, 0.9, 2);
  garageFill.position.set(3.2, 5, 3);
  garageFill.target.position.set(3, 0, 3);
  garageFill.visible = false;
  scene.add(garageFill, garageFill.target);
  const streetLights = [
    [-0.45, 0.16],
    [6.43, 5.45],
    [4.88, -0.74],
    [2.06, 7.0],
  ].map(([x, z]) => {
    const light = new THREE.PointLight("#ffd4a4", 3, 2.4, 2);
    light.position.set(x, 1.36, z);
    light.visible = false;
    scene.add(light);
    return light;
  });
  const sun = new THREE.DirectionalLight(0xffefce, settings.intensity);
  sun.castShadow = true;
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = true;
  sun.shadow.mapSize.set(1024, 1024);
  configureCourtyardSunShadow(sun.shadow);
  sun.target.position.copy(aim);
  scene.add(sun, sun.target);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: "#edf0e8",
    roughness: 1,
  });
  const nightBackdrop = { value: 0 };
  floorMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.nightBackdrop = nightBackdrop;
    // The backdrop is outside the playable block. It needs the sun/sky and
    // courtyard silhouette, but not eight local lamp evaluations per pixel.
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',
      THREE.ShaderChunk.lights_fragment_begin.replaceAll('NUM_POINT_LIGHTS','0').replaceAll('NUM_SPOT_LIGHTS','0'));
    shader.vertexShader =
      "varying vec3 garageFloorPosition;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "garageFloorPosition=(modelMatrix*vec4(transformed,1.)).xyz;\n#include <project_vertex>",
    );
    shader.fragmentShader =
      "uniform float nightBackdrop; varying vec3 garageFloorPosition;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\nvec2 floorOffset=garageFloorPosition.xz-vec2(3.);\ndiffuseColor.rgb*=mix(.68,1.04,exp(-dot(floorOffset,floorOffset)*.027));",
    );
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\nvec2 nightOffset=(garageFloorPosition.xz-vec2(3.,2.))/vec2(15.,11.);\ntotalEmissiveRadiance+=nightBackdrop*vec3(.006,.012,.022)*(.35+.65*exp(-dot(nightOffset,nightOffset)));');
  };
  floorMaterial.customProgramCacheKey = () => "garage-floor-sky-and-sun-v3";
  ownedMaterials.add(floorMaterial);
  const floorGeometry = new THREE.PlaneGeometry(200, 200);
  ownedGeometries.add(floorGeometry);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.48;
  floor.receiveShadow = true;
  // Fill the backdrop after the opaque courtyard, so covered pixels never
  // execute its lighting/shadow shader. Transparent vehicle panes still follow.
  floor.renderOrder = 1;
  scene.add(floor);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: "#f5d391",
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
  });
  ownedMaterials.add(ringMaterial);
  const ringGeometry = new THREE.PlaneGeometry(1, 1);
  ownedGeometries.add(ringGeometry);
  const marker = new THREE.Mesh(ringGeometry, ringMaterial);
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.047;
  marker.visible = false;
  scene.add(marker);
  const placementMaterial = new THREE.MeshBasicMaterial({ color: '#efc777', transparent: true, opacity: .12, depthWrite: false });
  ownedMaterials.add(placementMaterial);
  const placementCells = new THREE.InstancedMesh(ringGeometry, placementMaterial, 36);
  placementCells.frustumCulled = false;
  placementCells.visible = false;
  scene.add(placementCells);
  const ghostMaterial = new THREE.MeshBasicMaterial({ color: '#efc777', transparent: true, opacity: .38, depthWrite: false });
  const ghostGeometry = new THREE.BoxGeometry(1, 1, 1);
  ownedMaterials.add(ghostMaterial); ownedGeometries.add(ghostGeometry);
  const placementGhost = new THREE.InstancedMesh(ghostGeometry, ghostMaterial, 6);
  placementGhost.frustumCulled = false;
  placementGhost.visible = false;
  scene.add(placementGhost);
  const placementPose = new THREE.Object3D();
  let editorHover = null, previewPlacement = null, placementKey = '', availablePlacements = [];
  const hintGuide = createHintGuide(scene);
  const gate = new THREE.Group();
  gate.position.set(6.2, 0.415, 1.94);
  scene.add(gate);
  const gateGeometry = new THREE.BoxGeometry(0.034, 0.034, 1.12);
  ownedGeometries.add(gateGeometry);
  for (let i = 0; i < 7; i++) {
    const m = new THREE.MeshStandardMaterial({
      color: i % 2 ? "#b19a70" : "#d1cec2",
      roughness: 0.4,
    });
    ownedMaterials.add(m);
    const piece = new THREE.Mesh(gateGeometry, m);
    piece.scale.z = 1 / 7;
    piece.position.z = ((i + 0.5) * 1.12) / 7;
    piece.castShadow = true;
    gate.add(piece);
  }
  const gateBatch = batchColoredMeshes(gate, () => true);
  ownedMaterials.add(gateBatch.material);
  ownedGeometries.add(gateBatch.geometry);
  const instancePose = new THREE.Object3D(),
    accentColour = new THREE.Color();
  const glowGeometry = new THREE.PlaneGeometry(1.35, 1.35);
  ownedGeometries.add(glowGeometry);
  const glowMaterial = new THREE.MeshBasicMaterial({
    map: glowTexture,
    color: "#8edcf0",
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  ownedMaterials.add(glowMaterial);
  const lightPools = new THREE.InstancedMesh(glowGeometry, glowMaterial, streetLights.length);
  scene.add(lightPools);
  for (let i = 0; i < streetLights.length; i++) {
    instancePose.position.set(streetLights[i].position.x, 0.115, streetLights[i].position.z);
    instancePose.rotation.set(-Math.PI / 2, 0, 0);
    instancePose.updateMatrix();
    lightPools.setMatrixAt(i, instancePose.matrix);
  }
  const skidGeometry = new THREE.PlaneGeometry(0.42, 1.15);
  ownedGeometries.add(skidGeometry);
  const skidMaterial = new THREE.MeshBasicMaterial({
    map: skidTexture,
    transparent: true,
    opacity: 0.23,
    depthWrite: false,
  });
  ownedMaterials.add(skidMaterial);
  const skidMarks = new THREE.InstancedMesh(skidGeometry, skidMaterial, 3);
  scene.add(skidMarks);
  for (let i = 0; i < 3; i++) {
    instancePose.position.set(
      [1.8, 4.35, 6.8][i],
      i === 2 ? 0.048 : 0.047,
      [4.5, 1.4, 2.5][i],
    );
    instancePose.rotation.set(
      -Math.PI / 2,
      0,
      i === 2 ? Math.PI / 2 : 0.12 * i,
    );
    instancePose.updateMatrix();
    skidMarks.setMatrixAt(i, instancePose.matrix);
  }
  // A bounded particle pool: never allocate meshes in the animation loop.
  const vehicleLights = createVehicleLights(scene);
  const exhaustSmoke = createExhaustSmoke(scene);
  const reverseGeometry = new THREE.BoxGeometry(.014,.018,.038);
  ownedGeometries.add(reverseGeometry);
  const particles = [];
  const smokeGeometry = new THREE.SphereGeometry(0.055, 6, 4);
  ownedGeometries.add(smokeGeometry);
  for (let i = 0; i < 8; i++) {
    const material = new THREE.MeshBasicMaterial({
      color: "#d7dfd2",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    ownedMaterials.add(material);
    const mesh = new THREE.Mesh(smokeGeometry, material);
    mesh.visible = false;
    scene.add(mesh);
    particles.push({ mesh, life: 0, velocity: new THREE.Vector3() });
  }
  function puff(position, direction, spark = false) {
    if (reduced.matches) return;
    if (!spark) { exhaustSmoke.emit(position, direction); return; }
    const p = particles.find((item) => item.life <= 0);
    if (!p) return;
    p.life = 0.32;
    p.duration = p.life;
    p.spark = spark;
    p.mesh.position.copy(position);
    p.mesh.visible = true;
    p.mesh.material.color.set("#ffd281");
    p.mesh.scale.setScalar(0.5);
    p.velocity.copy(direction).multiplyScalar(1.5);
    p.velocity.y = 0.2;
  }
  function updateCamera(viewOnly = false, constrainPan = false) {
    cameraFollow = 0;
    cameraFollowZ = 0;
    viewAim.set(
      aim.x + (settings.focusX ?? 0),
      aim.y,
      aim.z + (settings.focusZ ?? 0),
    );
    const pitch = THREE.MathUtils.degToRad(settings.pitch),
      yaw = THREE.MathUtils.degToRad(settings.yaw);
    camera.position.set(
      viewAim.x + Math.sin(yaw) * Math.cos(pitch) * ORTHOGRAPHIC_DISTANCE,
      viewAim.y + Math.sin(pitch) * ORTHOGRAPHIC_DISTANCE,
      viewAim.z + Math.cos(yaw) * Math.cos(pitch) * ORTHOGRAPHIC_DISTANCE,
    );
    camera.up.fromArray(viewUp(settings));
    camera.lookAt(viewAim);
    camera.updateMatrixWorld();
    const rect = canvas.getBoundingClientRect(),
      aspect = rect.width / Math.max(1, rect.height);
    // Fit the occupied height ranges, rather than an oversized empty bounding cube.
    // Portrait framing prioritizes the puzzle; peripheral street edges may leave the shot.
    const portrait = rect.width < 560 && aspect < 1.15;
    const compact = !getProps().editor && (frameInsets.top > 0 || frameInsets.bottom > 0);
    const bounds = portrait || compact
      ? [
          [
            [-0.18, 6.62],
            [-0.4, 0.08],
            [-0.18, 6.18],
          ],
          [
            [0, 6],
            [0.08, 1.3],
            [0, 6],
          ],
        ]
      : [
          [
            [-1.9, 8.4],
            [-0.48, 0.2],
            [-1.2, 8.0],
          ],
          [
            [0, 6],
            [0.08, 1.3],
            [0, 6],
          ],
          [
            [-1.8, 6.3],
            [0.2, 1.6],
            [-0.8, 7.9],
          ],
        ];
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const [xs, ys, zs] of bounds)
      for (const x of xs)
        for (const y of ys)
          for (const z of zs) {
            const point = new THREE.Vector3(x, y, z).applyMatrix4(
              framingCamera.matrixWorldInverse,
            );
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
          }
    const padding = portrait ? 0.16 : 0.22;
    // Frame the puzzle itself centrally; the exit road must not shift the lot.
    const referenceCenter = aim
        .clone()
        .applyMatrix4(framingCamera.matrixWorldInverse),
      centerX = referenceCenter.x,
      centerY = referenceCenter.y;
    const {halfWidth, halfHeight, offsetY} = safeFrame(
      Math.max(maxX - centerX, centerX - minX) + padding,
      Math.max(maxY - centerY, centerY - minY) + padding,
      rect.width, rect.height, compact ? frameInsets.top : 0, compact ? frameInsets.bottom : 0,
    );
    const visibleWidth = halfWidth / settings.zoom,
      visibleHeight = halfHeight / settings.zoom;
    const limitX = Math.max(1.5, halfWidth - visibleWidth + 2),
      limitY = Math.max(1.5, halfHeight - visibleHeight + 2);
    // Bound deliberate pan/zoom input in the current camera basis. Rotation
    // must not clamp the intermediate pose before preserving its screen pivot;
    // doing so feeds the clamp back into focus and causes jumps at corners.
    const lotCenter = aim.clone().applyMatrix4(camera.matrixWorldInverse);
    if (constrainPan) {
      settings.panX = clamp(
        settings.panX,
        lotCenter.x - centerX - limitX,
        lotCenter.x - centerX + limitX,
      );
      settings.panY = clamp(
        settings.panY,
        lotCenter.y - centerY - limitY,
        lotCenter.y - centerY + limitY,
      );
    }
    camera.left = centerX + settings.panX - visibleWidth;
    camera.right = centerX + settings.panX + visibleWidth;
    camera.top = centerY + settings.panY - offsetY + visibleHeight;
    camera.bottom = centerY + settings.panY - offsetY - visibleHeight;
    camera.updateProjectionMatrix();
    if (viewOnly) {
      dirty = true;
      return;
    }
    const theme =
      SCENE_THEMES.find((t) => t.id === settings.theme) ?? SCENE_THEMES[0];
    const angle = THREE.MathUtils.degToRad(settings.light);
    const radius = theme.sunRadius ?? 8;
    sun.position.set(
      aim.x + Math.sin(angle) * radius,
      theme.sunHeight ?? 10,
      aim.z + Math.cos(angle) * radius,
    );
    sun.intensity = settings.intensity * theme.key;
    sun.color.set(theme.sun);
    sun.castShadow = settings.shadows && quality.decor;
    ambient.color.set(theme.sky);
    ambient.groundColor.set(theme.ground);
    ambient.intensity = theme.ambient;
    scene.environmentIntensity = theme.environment;
    refreshReflections(theme);
    floorMaterial.color.set(theme.floor);
    nightBackdrop.value = settings.theme === 'neon' ? 1 : 0;
    garageFill.visible = settings.theme === "neon";
    streetLights.forEach((light) => {
      light.visible = quality.decor && settings.theme !== "day";
      light.intensity = settings.theme === "neon" ? 3 : 1;
    });
    sceneryLamps.forEach((material) => {
      material.emissive.set("#ffc882");
      material.emissiveIntensity =
        settings.theme === "neon"
          ? 2.2
          : settings.theme === "sunset"
            ? 0.6
            : 0.1;
    });
    atmosphere?.setTheme(settings, quality);
    groundSurface?.setTheme(settings, quality);
    rainSurfaces.setTheme(settings,quality);
    lightPools.visible = settings.theme !== "day";
    glowMaterial.color.set("#ffd199");
    glowMaterial.opacity = settings.theme === "neon" ? 0.28 : 0.15;
    renderer.shadowMap.needsUpdate = true;
    dirty = true;
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const { width, height } = rect;
    frameInsets = {top: 0, bottom: 0};
    framingEditor = !!getProps().editor;
    // Read layout only on resize, never in the rendering/drag loop.
    if ((width <= 540 && height <= 700) || (width <= 1000 && height <= 500)) {
      const shell = canvas.closest('.immersive-play');
      const hud = shell?.querySelector('.game-hud')?.getBoundingClientRect();
      frameInsets.top = hud ? Math.max(0, hud.bottom - rect.top + 10) : 0;
      for (const selector of ['.toolbar', '.camera-navigation', '.scene-options-bar']) {
        const control = shell?.querySelector(selector);
        if (!control || !control.getClientRects().length) continue;
        const box = control.getBoundingClientRect();
        if (box.top > rect.top + height / 2)
          frameInsets.bottom = Math.max(frameInsets.bottom, rect.bottom - box.top + 12);
      }
    }
    stats.viewport = { width, height };
    renderer.setSize(width, height, false);
    const aspect = width / Math.max(1, height),
      halfWidth = 4.65,
      halfHeight = halfWidth / aspect;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    updateCamera();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    dirty = true;
  });
  visibilityObserver.observe(canvas);
  function cast(event) {
    camera.updateWorldMatrix(true, false);
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
  }
  function carAt(event) {
    cast(event);
    // A level can change between rendered frames; picking must use its new transforms.
    const visibleGroups = [...groups.values()]
      .map((item) => item.group)
      .filter((group) => group.visible);
    for (const group of visibleGroups) group.updateWorldMatrix(true, true);
    const hit = raycaster.intersectObjects(visibleGroups, true)[0];
    if (hit) return hit.object.userData.carId;
    if (event.pointerType !== "touch" || getProps().editor) return;
    const rect = canvas.getBoundingClientRect(),
      point = { x: event.clientX, y: event.clientY };
    let nearest,
      best = 12;
    for (const item of groups.values()) {
      if (!item.group.visible) continue;
      const quad = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, z]) => {
        const v = new THREE.Vector3(
          x * (item.car.len / 2 - 0.08),
          0.4,
          z * 0.4,
        );
        item.group.localToWorld(v);
        v.project(camera);
        return {
          x: rect.left + ((v.x + 1) * rect.width) / 2,
          y: rect.top + ((1 - v.y) * rect.height) / 2,
        };
      });
      const distance = quadDistance(point, quad);
      if (distance < best) {
        best = distance;
        nearest = item.car.id;
      }
    }
    return nearest;
  }
  function planePoint(event) {
    cast(event);
    return raycaster.ray.intersectPlane(ground, new THREE.Vector3());
  }
  function impact(item, direction = 1) {
    if (!item || performance.now() - (item.lastImpact ?? -1000) < 280) return;
    item.lastImpact = performance.now();
    item.brakeUntil = item.lastImpact + 250;
    item.suspension = contactImpulse(item.suspension, direction);
    settlingUntil = item.lastImpact + 650;
    dirty = true;
  }
  function blocked(id, direction = 1) {
    impact(groups.get(id), direction);
    callbacks.feedback?.("車輛受阻，先移開擋路的車");
    callbacks.select(id);
  }
  let wheelTimer;
  const publishCamera = () => callbacks.cameraChange?.(normalizeView(settings));
  function applyCamera(view, constrainPan = true) {
    Object.assign(settings, normalizeView(view));
    updateCamera(true, constrainPan);
  }
  function zoomAt(zoom, x, y) {
    const r = canvas.getBoundingClientRect();
    applyCamera(
      zoomView(
        settings,
        zoom,
        (x - r.left) / r.width - 0.5,
        0.5 - (y - r.top) / r.height,
        camera.right - camera.left,
        camera.top - camera.bottom,
      ),
    );
  }
  function screenCenterPoint() {
    const r = canvas.getBoundingClientRect();
    return planePoint({
      clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2,
    });
  }
  function orbitAtScreenCenter(dx, dy) {
    const pivot = screenCenterPoint();
    const rotated = rotateView(settings, dx, dy);
    if (!pivot) { applyCamera(rotated, false); return; }
    // Rebase the camera around the actual screen pivot each time. Accumulating
    // focus corrections eventually hits stored focus limits in off-center views.
    // Any bounded focus remainder is represented by the camera-plane offset.
    applyCamera({
      ...rotated,
      focusX: pivot.x - aim.x,
      focusZ: pivot.z - aim.z,
      panX: 0,
      panY: 0,
    }, false);
    const projectedPivot = pivot.clone().applyMatrix4(camera.matrixWorldInverse);
    applyCamera({
      ...settings,
      panX: projectedPivot.x - (camera.left + camera.right) / 2,
      panY: projectedPivot.y - (camera.top + camera.bottom) / 2,
    }, false);
  }
  function flushCamera() {
    if (!cameraPending || !cameraGesture) return;
    cameraPending = false;
    const g = cameraGesture;
    const next =
      g.kind === "touch"
        ? touches.size === 2
          ? touchPair([...touches.values()])
          : null
        : g.current;
    if (!next) return;
    const dx = next.x - g.last.x,
      dy = next.y - g.last.y;
    const r = canvas.getBoundingClientRect();
    if (g.mode === "pan")
      applyCamera(
        panView(
          settings,
          dx,
          dy,
          camera.right - camera.left,
          camera.top - camera.bottom,
          r.width,
          r.height,
        ),
      );
    else orbitAtScreenCenter(dx, dy);
    if (g.kind === "touch")
      zoomAt((settings.zoom * next.distance) / g.last.distance, next.x, next.y);
    g.last = next;
  }
  function cancelCamera(publish = true) {
    flushCamera();
    const active = !!cameraGesture;
    const ids = [
      ...touches.keys(),
      ...(cameraGesture?.kind === "mouse" ? [cameraGesture.pointerId] : []),
    ];
    cameraGesture = null;
    cameraPending = false;
    touchBlocked = false;
    touches.clear();
    delete canvas.dataset.cameraGesture;
    canvas.style.cursor = "default";
    for (const id of ids)
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    if (publish && active) publishCamera();
  }
  function cameraDown(event) {
    if (!ready || getProps().disabled) return false;
    if (event.pointerType === "touch") {
      flushCamera();
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId);
      if (touches.size < 2) {
        if (touchBlocked) return true;
        const point = planePoint(event);
        if (
          carAt(event) ||
          (point &&
            point.x >= 0 &&
            point.x <= 6 &&
            point.z >= 0 &&
            point.z <= 6)
        )
          return false;
        cameraGesture = {
          kind: "singleTouch",
          pointerId: event.pointerId,
          mode: "orbit",
          last: { x: event.clientX, y: event.clientY },
          current: { x: event.clientX, y: event.clientY },
        };
        canvas.focus({ preventScroll: true });
        canvas.dataset.cameraGesture = "orbit";
        event.preventDefault();
        return true;
      }
      event.preventDefault();
      if (drag) finish({ pointerId: drag.pointerId }, true, true);
      if (editorDrag) finish({ pointerId: editorDrag.pointerId }, true, true);
      if (touches.size > 2) {
        flushCamera();
        cameraGesture = null;
        cameraPending = false;
        delete canvas.dataset.cameraGesture;
        touchBlocked = true;
        publishCamera();
        return true;
      }
      if (touchBlocked && !cameraGesture) return true;
      touchBlocked = true;
      cameraGesture = {
        kind: "touch",
        mode: "pan",
        last: touchPair([...touches.values()]),
      };
    } else if (event.button === 2 || event.button === 1) {
      event.preventDefault();
      if (drag) finish({ pointerId: drag.pointerId }, true, true);
      if (editorDrag) finish({ pointerId: editorDrag.pointerId }, true, true);
      cameraGesture = {
        kind: "mouse",
        pointerId: event.pointerId,
        mode: event.button === 1 || event.shiftKey ? "pan" : "orbit",
        last: { x: event.clientX, y: event.clientY },
        current: { x: event.clientX, y: event.clientY },
      };
      canvas.setPointerCapture(event.pointerId);
    } else return !!cameraGesture;
    canvas.focus({ preventScroll: true });
    canvas.dataset.cameraGesture = cameraGesture.mode;
    canvas.style.cursor = "grabbing";
    return true;
  }
  function cameraMove(event) {
    if (touches.has(event.pointerId))
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (
      cameraGesture?.kind === "touch" ||
      cameraGesture?.pointerId === event.pointerId
    ) {
      if (cameraGesture.kind !== "touch")
        cameraGesture.current = { x: event.clientX, y: event.clientY };
      cameraPending = true;
      dirty = true;
      event.preventDefault();
      return true;
    }
    return event.pointerType === "touch" && touchBlocked;
  }
  function cameraEnd(event) {
    if (
      (cameraGesture?.kind === "mouse" ||
        cameraGesture?.kind === "singleTouch") &&
      cameraGesture.pointerId === event.pointerId
    ) {
      cancelCamera();
      return true;
    }
    if (!touches.has(event.pointerId)) return false;
    flushCamera();
    const handled = touchBlocked;
    touches.delete(event.pointerId);
    if (cameraGesture?.kind === "touch") {
      cameraGesture = null;
      cameraPending = false;
      delete canvas.dataset.cameraGesture;
      publishCamera();
    }
    if (!touches.size) touchBlocked = false;
    if (handled && canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    if (handled) canvas.style.cursor = "default";
    return handled;
  }
  function wheelCamera(event) {
    if (!ready || getProps().disabled) return;
    event.preventDefault();
    if (drag) finish({ pointerId: drag.pointerId }, true);
    if (editorDrag) finish({ pointerId: editorDrag.pointerId }, true);
    flushCamera();
    const pixels =
      event.deltaY *
      (event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? canvas.clientHeight
          : 1);
    zoomAt(
      settings.zoom * Math.exp(-clamp(pixels, -600, 600) * 0.0015),
      event.clientX,
      event.clientY,
    );
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(publishCamera, 180);
  }
  function cancelInput() {
    const ids = [drag?.pointerId, editorDrag?.pointerId].filter(
      (id) => id != null,
    );
    if (drag) finish({ pointerId: drag.pointerId }, true, true);
    if (editorDrag) finish({ pointerId: editorDrag.pointerId }, true, true);
    cancelCamera();
    for (const id of ids)
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  const pauseInput = () => {
    if (document.hidden) cancelInput();
  };
  window.addEventListener("blur", cancelInput);
  document.addEventListener("visibilitychange", pauseInput);
  function down(event) {
    const props = getProps();
    if (cameraDown(event)) return;
    if (
      drag &&
      event.pointerType === "touch" &&
      drag.pointerId !== event.pointerId
    ) {
      finish({ pointerId: drag.pointerId }, true);
      return;
    }
    if (
      !ready ||
      props.disabled ||
      props.won ||
      drag ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    const id = carAt(event);
    if (props.editor) {
      if (id && props.editorStart) {
        const point = planePoint(event);
        if (point) props.onCellClick?.({row:Math.floor(point.z),col:Math.floor(point.x)});
        return;
      }
      if (id) {
        selected = id;
        callbacks.select(id);
        const car = props.cars.find((c) => c.id === id),
          legal = legalMovesForCar(props.cars, id),
          start = planePoint(event);
        if (start && legal.length) {
          const deltas = legal.map((m) => m.delta);
          drag = {
            car,
            legal,
            start,
            min: Math.min(0, ...deltas),
            max: Math.max(0, ...deltas),
            pointerId: event.pointerId,
            delta: 0,
            lastAt: performance.now(),
            speed: 0,
            lastPuff: 0,
            editor: true,
          };
          canvas.setPointerCapture(event.pointerId);
          canvas.dataset.dragging = id;
          dirty = true;
        }
        return;
      }
      const point = planePoint(event);
      if (point && point.x >= 0 && point.x < 6 && point.z >= 0 && point.z < 6) {
        if (!props.cars.some(car=>car.id==='target') && !props.editorStart && Math.floor(point.z)!==2) {
          props.onCellClick?.({row:Math.floor(point.z),col:Math.floor(point.x)});
          return;
        }
        editorDrag = {
          row: Math.floor(point.z),
          col: Math.floor(point.x),
          pointerId: event.pointerId,
          start: { x: event.clientX, y: event.clientY },
        };
        canvas.setPointerCapture(event.pointerId);
      }
      return;
    }
    if (!id) return;
    callbacks.feedback?.(
      `${vehicleModel(props.cars.find((c) => c.id === id)).name} · ${props.cars.find((c) => c.id === id).dir === "H" ? "左右" : "上下"}移動`,
    );
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    selected = id;
    for(const [carId,item]of groups)item.lightUntil=carId===id?performance.now()+1600:0;
    callbacks.select(id);
    const car = props.cars.find((c) => c.id === id),
      legal = legalMovesForCar(props.cars, id);
    if (!legal.length) {
      blocked(id);
      return;
    }
    const start = planePoint(event);
    if (!start) return;
    const deltas = legal.map((m) => m.delta);
    drag = {
      car,
      legal,
      start,
      min: Math.min(0, ...deltas),
      max: Math.max(0, ...deltas),
      pointerId: event.pointerId,
      delta: 0,
      lastAt: performance.now(),
      speed: 0,
      lastPuff: 0,
    };
    dirty = true;
    canvas.setPointerCapture(event.pointerId);
    canvas.dataset.dragging = id;
  }
  function move(event) {
    if (cameraMove(event)) return;
    if (getProps().editor && !drag) {
      const point = planePoint(event);
      editorHover = point && point.x >= 0 && point.x < 6 && point.z >= 0 && point.z < 6
        ? { row: Math.floor(point.z), col: Math.floor(point.x) } : null;
      dirty = true;
    }
    if (editorDrag?.pointerId === event.pointerId) {
      editorDrag.moved =
        Math.hypot(
          event.clientX - editorDrag.start.x,
          event.clientY - editorDrag.start.y,
        ) > 8;
      return;
    }
    if (!drag || event.pointerId !== drag.pointerId) {
      if (ready && performance.now() - lastHover > 50) {
        lastHover = performance.now();
        canvas.style.cursor = carAt(event) ? "grab" : "default";
      }
      return;
    }
    const point = planePoint(event);
    if (!point) return;
    const raw =
      drag.car.dir === "H" ? point.x - drag.start.x : point.z - drag.start.z;
    const delta = clamp(raw, drag.min, drag.max);
    if (Math.abs(raw - delta) > 0.1 && !drag.atBoundary) {
      drag.atBoundary = true;
      impact(groups.get(drag.car.id), Math.sign(raw));
      callbacks.feedback?.("已到邊界，試著移開擋路的車");
    }
    if (Math.abs(raw - delta) < 0.05) drag.atBoundary = false;
    const now = performance.now();
    drag.speed =
      (delta - drag.delta) / Math.max(0.008, (now - drag.lastAt) / 1000);
    drag.lastAt = now;
    drag.delta = delta;
    canvas.style.cursor = "grabbing";
    if (measuring) pendingInputAt = performance.now();
  }
  function finish(event, cancel = false, transferring = false) {
    if (!transferring && cameraEnd(event)) return;
    if (editorDrag?.pointerId === event.pointerId) {
      const active = editorDrag;
      editorDrag = null;
      if (!transferring && canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
      if (!cancel)
        if (active.moved) {
          if (editorHover) getProps().onPlace?.({start:{row:active.row,col:active.col},end:editorHover});
          else getProps().onEditorCancel?.();
        } else getProps().onCellClick?.({row:active.row,col:active.col});
      return;
    }
    if (!drag || event.pointerId !== drag.pointerId) return;
    const active = drag;
    drag = null;
    delete canvas.dataset.dragging;
    const item = groups.get(active.car.id);
    if (item && Math.abs(active.delta) > 0.02) {
      item.brakeUntil = performance.now() + 280;
      if (!cancel && !active.atBoundary) impact(item, Math.sign(active.delta));
    }
    dirty = true;
    settlingUntil = performance.now() + 450;
    if (!transferring && canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    const move = active.legal.find(
      (m) => m.delta === snapDragDelta(active.delta),
    );
    callbacks.feedback?.(
      cancel ? "已取消移動" : move ? "已停入車位" : "位置不變",
    );
    if (!cancel && move)
      (active.editor ? getProps().onEditMove : getProps().onMove)?.(move);
  }
  function key(event) {
    const props = getProps();
    if (event.key === "Escape" && cameraGesture) {
      cancelCamera();
      event.preventDefault();
      return;
    }
    if (props.disabled || props.won || props.editor) return;
    if (event.key === "Escape" && drag) {
      finish({ pointerId: drag.pointerId }, true);
      return;
    }
    const car = props.cars.find((c) => c.id === selected);
    if (!car) return;
    const delta =
      car.dir === "H"
        ? { ArrowLeft: -1, ArrowRight: 1 }[event.key]
        : { ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (!delta) return;
    event.preventDefault();
    if (legalMovesForCar(props.cars, car.id).some((m) => m.delta === delta))
      props.onMove({ carId: car.id, delta });
    else blocked(car.id, delta);
  }
  const handlers = {
    pointerdown: down,
    pointermove: move,
    pointerleave: () => { if (!editorDrag) { editorHover = null; dirty = true; } },
    pointerup: (e) => finish(e),
    pointercancel: (e) => finish(e, true),
    lostpointercapture: (e) => {
      if (!canvas.hasPointerCapture(e.pointerId)) finish(e, true);
    },
    keydown: key,
    wheel: wheelCamera,
    contextmenu: (e) => e.preventDefault(),
    webglcontextlost: (event) => {
      event.preventDefault();
      if (drag) finish({ pointerId: drag.pointerId }, true);
      cancelCamera(false);
      callbacks.error(new Error("WebGL context lost"));
    },
  };
  Object.entries(handlers).forEach(([name, handler]) =>
    canvas.addEventListener(
      name,
      handler,
      name === "wheel" ? { passive: false } : undefined,
    ),
  );
  function sync() {
    if (!library || !alive) return;
    if (drag) finish({ pointerId: drag.pointerId }, true);
    const props = getProps(),
      ids = new Set(props.cars.map((c) => c.id));
    if (framingEditor !== !!props.editor) resize();
    const changed = sceneKey !== props.sceneKey;
    sceneKey = props.sceneKey;
    if (changed) {
      cancelCamera();
      editorHover = null;
      escapeStart = null;
      cameraFollow = 0;
      cameraFollowZ = 0;
      selected = null;
      callbacks.select(null);
      editorDrag = null;
    }
    for (const [id, item] of groups)
      if (
        !ids.has(id) ||
        changed ||
        item.model !== vehicleModel(props.cars.find((c) => c.id === id)).kind ||
        item.car.len !== props.cars.find((c) => c.id === id).len
      ) {
        scene.remove(item.group);
        item.group.traverse((o) => {
          if (o.isMesh) {
            rainSurfaces.detach(o.material);
            o.material.dispose();
            o.customDepthMaterial?.dispose();
            if (o.userData.generatedGeometry) o.geometry.dispose();
          }
        });
        groups.delete(id);
      }
    props.cars.forEach((car, index) => {
      let item = groups.get(car.id);
      if (!item) {
        const group = library[vehicleModel(car).kind].clone(true);
        // Cabin details receive the roof's shadow, but do not cast tiny
        // exterior shadows through glass. One batch retains all upholstery.
        batchColoredMeshes(
          group,
          (mesh) => ["Cabin upholstery", "Tailored cabin leather", "Seat stitching and console"].includes(mesh.material.name),
          { name: "Batched cabin", roughness: 0.7, metalness: 0.02 },
        );
        batchColoredMeshes(
          group,
          (mesh) =>
            ![
              "Automotive glass",
              "Lamp crystal",
              VEHICLE_MIRROR,
              "Batched cabin",
              "Headlamp",
              "Tail lamp",
              "Rolling wheels",
            ].includes(mesh.material.name) &&
            !mesh.material.name.startsWith("Paint"),
          { surface: vehicleTrimSurface },
        );
        const lamps = [],
          tailLamps = [],
          paints = [],
          windows = [],
          wheelAngle = { value: 0 },
          wheelSteering = { value: [0,0] },
          tyreCompression = { value: [0, 0] };
        group.traverse((object) => {
          if (object.isMesh) {
            if (!object.userData.generatedGeometry)
              object.material = object.material.clone();
            const material = object.material;
            if (material.name.startsWith("Paint")) {
              paints.push(material);
              configureVehiclePaint(material, vehicleModel(car).kind, settings.quality, car.color);
            }
            if (material.name === "Automotive glass") {
              windows.push(material);
              configureVehicleGlass(material, settings.quality);
            }
            if (material.name === 'Lamp crystal') {
              material.transmission=0;material.transparent=true;material.opacity=.22;
              material.depthWrite=false;material.roughness=.025;material.clearcoat=1;
              material.clearcoatRoughness=.02;material.envMapIntensity=1.5;
            }
            if (material.name === VEHICLE_MIRROR) {
              material.metalness = 1;
              material.roughness = 0.055;
              material.envMapIntensity = 1.4;
            }
            if (material.name === "Headlamp") {
              material.emissive.set("#ffd994");
              lamps.push(material);
              // Shared lamp meshes also contain roof signs; only front lenses glow.
              object.updateWorldMatrix(true,false);group.updateWorldMatrix(true,false);
              const lampRoot=new THREE.Matrix4().copy(group.matrixWorld).invert().multiply(object.matrixWorld);
              material.onBeforeCompile=shader=>{
                shader.uniforms.lampRoot={value:lampRoot};shader.uniforms.lampFrontLimit={value:car.len*.35};
                shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform mat4 lampRoot;uniform float lampFrontLimit;varying float frontLensMask;').replace('#include <begin_vertex>','#include <begin_vertex>\nvec3 lampPoint=(lampRoot*vec4(transformed,1.)).xyz;frontLensMask=step(lampFrontLimit,lampPoint.x)*step(.12,abs(lampPoint.z));');
                shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float frontLensMask;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=frontLensMask;');
              };
              material.customProgramCacheKey=()=> 'front-lens-emission-v1';
            }
            if (material.name === "Tail lamp") {
              tailLamps.push(material);
              // GLTF batches rear lenses with red buckles and roof markers.
              // Only the rear exterior region may emit parking/brake light.
              object.updateWorldMatrix(true,false);group.updateWorldMatrix(true,false);
              const lampRoot=new THREE.Matrix4().copy(group.matrixWorld).invert().multiply(object.matrixWorld);
              material.onBeforeCompile=shader=>{
                shader.uniforms.lampRoot={value:lampRoot};shader.uniforms.lampRearLimit={value:-car.len/2+.18};
                shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform mat4 lampRoot;uniform float lampRearLimit;varying float rearLensMask;').replace('#include <begin_vertex>','#include <begin_vertex>\nrearLensMask=step((lampRoot*vec4(transformed,1.)).x,lampRearLimit);');
                shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float rearLensMask;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=rearLensMask;');
              };
              material.customProgramCacheKey=()=> 'rear-lens-emission-v1';
            }
            if (material.name === "Rolling wheels") {
              // Use the same draw call and steering uniforms, selecting the
              // appended tyre silhouettes only while a shadow map is rendered.
              object.onBeforeShadow=(_r,_o,_c,_s,geometry)=>geometry.setDrawRange(...geometry.userData.shadowRange);
              object.onAfterShadow=(_r,_o,_c,_s,geometry)=>geometry.setDrawRange(0,geometry.userData.shadowRange[0]);
              rollingMaterial(material, wheelAngle, tyreCompression, wheelSteering);
              object.customDepthMaterial = rollingMaterial(
                new THREE.MeshDepthMaterial({
                  depthPacking: THREE.RGBADepthPacking,
                }),
                wheelAngle,
                tyreCompression,
                wheelSteering,
              );
            }
            object.castShadow = !["Automotive glass", "Lamp crystal", "Batched cabin", "Headlamp", "Tail lamp"].includes(material.name);
            object.receiveShadow = material.name !== "Automotive glass";
            object.userData.carId = car.id;
            rainSurfaces.attach(material,car.len);
          }
        });
        const lightAnchors=collectLampAnchors(group,car.len);
        const body = new THREE.Group();
        body.position.y = 0.19;
        group.add(body);
        group.updateMatrixWorld(true);
        const bodyMeshes = [];
        group.traverse((o) => {
          if (o.isMesh && o.material.name !== "Rolling wheels")
            bodyMeshes.push(o);
        });
        bodyMeshes.forEach((mesh) => body.attach(mesh));
        const reverseMaterial=new THREE.MeshStandardMaterial({color:'#9ba6a9',roughness:.22,emissive:'#eef4ff',emissiveIntensity:0});
        const reverseLenses=new THREE.InstancedMesh(reverseGeometry,reverseMaterial,2);
        reverseLenses.raycast=()=>{};body.add(reverseLenses);
        lightAnchors.reverse=lightAnchors.tail.map((anchor,i)=>{
          const rootPoint=anchor?group.worldToLocal(anchor.mesh.localToWorld(anchor.point.clone())):new THREE.Vector3(-car.len/2,.3,i?.26:-.26);
          rootPoint.x-=.006;rootPoint.y-=.045;rootPoint.z-=Math.sign(rootPoint.z)*.025;
          const node=new THREE.Object3D();node.position.copy(body.worldToLocal(group.localToWorld(rootPoint)));body.add(node);
          node.updateMatrix();reverseLenses.setMatrixAt(i,node.matrix);
          return {mesh:node,point:new THREE.Vector3()};
        });
        reverseLenses.instanceMatrix.needsUpdate=true;
        const contact = new THREE.Mesh(
          contactGeometry,
          new THREE.MeshBasicMaterial({
            map: contactTextures.get(vehicleModel(car).kind === 'racer' ? 'racer' : car.len),
            color: "#17232a",
            transparent: true,
            opacity: 0.52,
            depthWrite: false,
          }),
        );
        contact.rotation.x = -Math.PI / 2;
        contact.position.y = CONTACT_PLANE_OFFSET;
        contact.scale.set(car.len + 0.12, 1.08, 1);
        contact.raycast = () => {};
        group.add(contact);
        cacheLocalTransforms(group, new Set([group, body]));
        item = {
          group,
          body,
          suspension: { pitch: 0, rate: 0, speed: 0, heave: 0, heaveRate: 0 },
          car,
          index,
          model: vehicleModel(car).kind,
          lamps,
          tailLamps,
          lightAnchors,
          reverseMaterial,
          paints,
          windows,
          wheelAngle,
          wheelSteering,
          tyreCompression,
          velocity: 0,
          brakeUntil: 0,
          lightUntil: 0,
        };
        groups.set(car.id, item);
        scene.add(group);
        group.position.set(
          car.col + (car.dir === "H" ? car.len / 2 : 0.5),
          VEHICLE_GROUND_HEIGHT,
          car.row + (car.dir === "V" ? car.len / 2 : 0.5),
        );
      }
      item.car = car;
      item.group.rotation.y = car.dir === "V" ? -Math.PI / 2 : 0;
    });
    if (props.won && escapeStart == null) escapeStart = performance.now();
    if (!props.won) {
      if (escapeStart != null) {
        const item = groups.get("target");
        if (item)
          item.group.position.set(
            item.car.col + item.car.len / 2,
            VEHICLE_GROUND_HEIGHT,
            item.car.row + 0.5,
          );
      }
      escapeStart = null;
    }
    renderer.shadowMap.needsUpdate = true;
    dirty = true;
    settlingUntil = performance.now() + 450;
  }
  assets()
    .then(async (models) => {
      if (!alive) return;
      library = models;
      const garage = library.garage.clone(true);
      // Keep the fence independently inspectable after the shadow isolation
      // test. Its normal shadows are restored once the slab overlap is fixed.
      const fenceBatch=batchColoredMeshes(garage,mesh=>mesh.material.name.startsWith('Fence '),{
        name:'Courtyard fence',roughness:.55,metalness:.2,atlas:sceneryAtlas,
        surface:material=>[material.roughness??.8,material.metalness??0],
      });
      fenceBatch.name='Courtyard fence';
      ownedGeometries.add(fenceBatch.geometry);
      const pavingMaterial = material=>material.name.startsWith('Limestone paver')||material.name==='Recessed mortar';
      // Thin paving joints need to receive shadows, but must not generate tiny
      // self-shadow fragments across the otherwise flat walking surface.
      const pavingBatch=batchColoredMeshes(garage,mesh=>pavingMaterial(mesh.material),{
        name:'Courtyard paving',roughness:.86,metalness:0,atlas:sceneryAtlas,
        colorMultiplier: (mesh, geometry) => {
          geometry.computeBoundingBox();
          const center = geometry.boundingBox.getCenter(new THREE.Vector3());
          return pavingTone(mesh.material.name, center.x, center.z);
        },
      });
      ownedGeometries.add(pavingBatch.geometry);
      const stoneBatch=batchColoredMeshes(garage,mesh=>['Honed warm limestone','Basalt foundation'].includes(mesh.material.name),{
        name:'Courtyard stone',roughness:.84,metalness:0,
      });
      ownedGeometries.add(stoneBatch.geometry);
      const streetBatch = batchColoredMeshes(
        garage,
        (mesh) =>
          ![
            "Asphalt blue slate",
            "Street asphalt",
            "Automotive glass",
            "Streetlamp glow",
            "Architectural glazing",
            "Courtyard paving",
            "Courtyard stone",
            "Parking markings",
            "Courtyard foliage detail",
            "Courtyard bark",
            "Courtyard fence",
          ].includes(mesh.material.name) && !mesh.material.name.startsWith('Streetlamp glow'),
        {
          roughness: 0.85,
          metalness: 0.02,
          name: "Batched scenery",
          atlas: sceneryAtlas,
          surface: material=>[material.roughness??.8,material.metalness??0],
        },
      );
      ownedGeometries.add(streetBatch.geometry);
      extendStreetRoad(garage).forEach(geometry => ownedGeometries.add(geometry));
      garage.traverse((o) => {
        if (o.isMesh) {
          if (!o.userData.generatedGeometry) o.material = o.material.clone();
          ownedMaterials.add(o.material);
          if (o.material.name.startsWith('Streetlamp glow'))
            sceneryLamps.push(o.material);
          o.receiveShadow = true;
          o.castShadow = !['Courtyard paving','Parking markings','Asphalt blue slate','Street asphalt','Courtyard foliage detail'].includes(o.material.name);
          if(o.material.name==='Courtyard foliage detail') {
            vegetationShadows=vegetationShadowProxy(o);
            ownedGeometries.add(vegetationShadows.geometry);ownedMaterials.add(vegetationShadows.material);
            scene.add(vegetationShadows);cacheLocalTransforms(vegetationShadows);
          }
        }
      });
      scene.add(garage);
      cacheLocalTransforms(garage);
      // Capture the already batched courtyard, not thousands of source pieces.
      reflections = createCourtyardReflections(renderer,garage);
      atmosphere = createCourtyardAtmosphere(scene, garage);
      atmosphere.setTheme(settings, quality);
      garage.traverse(mesh=>{if(mesh.isMesh)rainSurfaces.attach(mesh.material);});
      groundSurface = createGroundSurface(renderer, garage);
      groundSurface.setTheme(settings, quality);
      streetTraffic = createStreetTraffic(scene, library, contactTextures, rainSurfaces, Math.random, camera);
      updateCamera();
      sync();
      streetTraffic.prepare();
      await renderer.compileAsync(scene, camera);
      if (!alive) return;
      streetTraffic.pause();
      ready = true;
      canvas.dataset.ready = "true";
      callbacks.ready();
    })
    .catch((error) => {
      if (alive) callbacks.error(error);
    });
  function animate(now) {
    if (!alive) return;
    frame = requestAnimationFrame(animate);
    if (document.hidden || !inView) {
      lastTime = now;
      nextFrame = now;
      return;
    }
    if (library && !ready) {
      lastTime = now;
      return;
    }
    flushCamera();
    const active =
      !!drag ||
      !!cameraGesture ||
      now < settlingUntil ||
      (escapeStart != null && now - escapeStart < EXIT_COMPLETE_MS + 700);
    // Cap high-refresh displays too; retain ambient life without rendering at 120/144 Hz.
    // Reset ambient poses before reduced motion suppresses static frames.
    if ((reduced.matches || !quality.decor) && atmosphere?.pause()) dirty = true;
    if ((reduced.matches || !quality.decor) && streetTraffic?.pause()) dirty = true;
    const budget = 1000 / (active ? quality.activeFPS : quality.idleFPS);
    if (
      !dirty &&
      (((reduced.matches || !quality.decor) && !active) ||
        now + 0.9 < nextFrame)
    )
      return;
    nextFrame =
      dirty || now - nextFrame > budget ? now + budget : nextFrame + budget;
    // Exact damped springs remain stable at low frame rates. A 40 ms cap made
    // suspension settle in slow motion when rendering dropped below 25 FPS.
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    dirty = false;
    const props = getProps();
    let shadowChanged = false;
    if (props.won && escapeStart == null) escapeStart = now;
    for (const item of groups.values()) {
      const { car, group } = item,
        isDrag = drag?.car.id === car.id;
      const delta = isDrag ? drag.delta : 0;
      let x =
          car.col +
          (car.dir === "H" ? car.len / 2 : 0.5) +
          (car.dir === "H" ? delta : 0),
        z =
          car.row +
          (car.dir === "V" ? car.len / 2 : 0.5) +
          (car.dir === "V" ? delta : 0);
      const exiting=props.won && car.id==='target';
      const exit=exiting?exitPose(now-escapeStart,x,z,reduced.matches):null;
      if(exit){x=exit.x;z=exit.z;group.rotation.y=exit.yaw;group.visible=exit.visible;if(exit.complete&&!item.exitReported){item.exitReported=true;callbacks.exitComplete?.();}}
      else {group.visible=true;item.exitReported=false;item.exitDistance=0;}
      const blend = isDrag || reduced.matches || exiting ? 1 : 1 - Math.exp(-18 * dt);
      const height = VEHICLE_GROUND_HEIGHT;
      if (
        Math.abs(group.position.x - x) > 0.001 ||
        Math.abs(group.position.z - z) > 0.001 ||
        group.position.y !== height
      )
        shadowChanged = true;
      const oldAxis = car.dir === "H" ? group.position.x : group.position.z;
      group.position.x = THREE.MathUtils.lerp(group.position.x, x, blend);
      group.position.z = THREE.MathUtils.lerp(group.position.z, z, blend);
      group.position.y = height;
      const travelled = exiting ? exit.distance-(item.exitDistance??0) :
          (car.dir === "H" ? group.position.x : group.position.z) - oldAxis,
        velocity = exiting ? exit.speed : travelled / Math.max(0.008, dt);
      item.wheelAngle.value -= travelled / 0.19;
      item.wheelSteering.value=exit?.steeringPair??[0,0];
      if(exiting)item.exitDistance=exit.distance;
      item.body.rotation.x=(exit?.bank??0)*(settings.motion??1);
      if(Math.abs(velocity)>.12){item.lastMotionAt=now;item.stopBrake=false;}
      else if(!item.stopBrake && now-(item.lastMotionAt??-Infinity)<300 && (!isDrag || now-drag.lastAt>140)){
        item.brakeUntil=now+220;item.stopBrake=true;
      }
      item.suspension = reduced.matches
        ? { pitch: 0, rate: 0, speed: 0, heave: 0, heaveRate: 0 }
        : stepSuspension(
            item.suspension,
            velocity,
            dt,
            SUSPENSION_PROFILES[item.model],
          );
      item.body.rotation.z =
        item.suspension.pitch *
        (settings.motion ?? 1) *
        (car.len === 3 ? 0.78 : 1);
      item.body.position.y =
        0.19 +
        item.suspension.heave *
          (settings.motion ?? 1) *
          (car.len === 3 ? 0.78 : 1);
      const axle = axleCompression(item.suspension, car.len),
        strength = (settings.motion ?? 1) * 0.5;
      item.tyreCompression.value[0] = axle.front * strength;
      item.tyreCompression.value[1] = axle.rear * strength;
      item.velocity = velocity;
      if (
        Math.abs(item.body.rotation.z) > 0.00005 ||
        Math.abs(item.suspension.heave) > 0.00005
      )
        shadowChanged = true;
      if (Math.abs(velocity) > 0.12) item.gear = Math.sign(velocity);
      const reversing = velocity < -0.12 || (isDrag && item.gear === -1),
        braking = now < item.brakeUntil;
      item.reversing = reversing; item.braking = braking; item.isDrag = isDrag;
      if(isDrag || Math.abs(velocity)>.08)item.lightUntil=now+1600;
      const lampsState=vehicleLampState(item,settings.theme,now);
      item.lampState=lampsState;
      item.lamps.forEach((material) => {
        material.emissive.set(settings.theme==='day'?'#e8f4ff':'#ffd994');
        material.emissiveIntensity=lampsState.head*1.2+(settings.theme==='day'?lampsState.activity*3.2:0);
      });
      item.tailLamps.forEach((material) => {
        material.color.set("#df7460");
        material.emissive.set("#ef3426");
        material.emissiveIntensity = Math.max(lampsState.park,lampsState.brake*1.3);
      });
      item.reverseMaterial.emissiveIntensity=lampsState.reverse*.3;
      if (!props.editor && !props.won && !reduced.matches && quality.decor) {
        const tick = Math.floor(now / 1000 + item.index * 1.47);
        if (tick !== item.lastTick) {
          item.lastTick = tick;
          if (tick % 4 === 0)
            puff(
              group.localToWorld(scratchPosition.set(-car.len / 2+.015, 0.16, -0.23)),
              scratchDirection.set(
                car.dir === "H" ? -1 : 0,
                0,
                car.dir === "V" ? -1 : 0,
              ),
            );
        }
      }
      if (quality.decor && !reduced.matches && isDrag && now-(item.lastExhaust??0)>110) {
        item.lastExhaust=now;
        puff(group.localToWorld(scratchPosition.set(-car.len/2+.015,.16,-.23)),
          scratchDirection.set(car.dir==='H'?-1:0,0,car.dir==='V'?-1:0));
      }
      if (
        quality.decor &&
        isDrag &&
        Math.abs(drag.speed) > 7 &&
        now - drag.lastAt < 140 &&
        now - drag.lastPuff > 65
      ) {
        drag.lastPuff = now;
        const sign = Math.sign(drag.speed);
        puff(
          scratchPosition
            .copy(group.position)
            .add(
              scratchDirection.set(
                car.dir === "H" ? -sign * 0.8 : 0,
                0.14,
                car.dir === "V" ? -sign * 0.8 : 0,
              ),
            ),
          scratchDirection.set(
            car.dir === "H" ? -sign : 0,
            0,
            car.dir === "V" ? -sign : 0,
          ),
          Math.abs(drag.speed) > 7,
        );
      }
      if (
        quality.decor &&
        !reduced.matches &&
        props.won &&
        car.id === "target" &&
        group.visible &&
        velocity > 0.6 &&
        now - (item.lastExitPuff ?? 0) > 130
      ) {
        item.lastExitPuff = now;
        puff(
          group.localToWorld(scratchPosition.set(-car.len/2+.015,.16,-.23)),
          scratchDirection.set(-1, 0, 0).applyQuaternion(group.quaternion),
        );
      }
    }
    marker.visible = false;
    const nextPlacementKey = props.editor ? JSON.stringify([props.cars, props.editorStart, editorDrag?.row, editorDrag?.col]) : '';
    if (nextPlacementKey !== placementKey) {
      placementKey = nextPlacementKey;
      availablePlacements = props.editor ? drawingCells(props.cars, props.editorStart ?? (editorDrag ? {row:editorDrag.row,col:editorDrag.col}:null)) : [];
      placementCells.count = availablePlacements.length;
      availablePlacements.forEach((p, i) => {
        placementPose.position.set(p.col + .5, .048, p.row + .5);
        placementPose.rotation.set(-Math.PI / 2, 0, 0);
        placementPose.scale.set(.76, .76, 1); placementPose.updateMatrix();
        placementCells.setMatrixAt(i, placementPose.matrix);
      });
      placementCells.instanceMatrix.needsUpdate = true;
    }
    placementCells.visible = !!props.editor && !drag;
    const origin = props.editorStart ?? (editorDrag ? {row:editorDrag.row,col:editorDrag.col}:null);
    previewPlacement = props.editor && origin && editorHover && !drag ? placementBetween(props.cars, origin, editorHover) : null;
    placementGhost.visible = !!previewPlacement && previewPlacement.len >= 2 && !cameraGesture;
    if (previewPlacement) {
      const p = previewPlacement, horizontal = p.dir === 'H';
      ghostMaterial.color.set(p.valid ? p.color : '#ff6e61');
      const parts = [[0,.24,0,p.len-.12,.30,.73],[-.1,.47,0,p.len*.46,.22,.56],
        [-p.len/2+.34,.16,-.38,.22,.25,.10],[-p.len/2+.34,.16,.38,.22,.25,.10],
        [p.len/2-.34,.16,-.38,.22,.25,.10],[p.len/2-.34,.16,.38,.22,.25,.10]];
      parts.forEach(([x,y,z,sx,sy,sz],i) => {
        placementPose.position.set(p.col+(horizontal?p.len/2:.5)+(horizontal?x:z), y, p.row+(horizontal?.5:p.len/2)+(horizontal?z:x));
        placementPose.rotation.set(0,horizontal?0:Math.PI/2,0);
        placementPose.scale.set(sx,sy,sz); placementPose.updateMatrix();
        placementGhost.setMatrixAt(i, placementPose.matrix);
      });
      placementGhost.instanceMatrix.needsUpdate = true;
    }
    ringMaterial.color.set("#f5d391");
    ringMaterial.opacity = 0.13;
    if (props.editor && props.editorStart) {
      marker.visible = true;
      ringMaterial.opacity = 0.25;
      marker.position.set(
        props.editorStart.col + 0.5,
        0.05,
        props.editorStart.row + 0.5,
      );
      marker.scale.set(0.92, 0.92, 1);
    }
    if (props.editor && props.editorConflict) {
      const car = props.editorConflict;
      marker.visible = true;
      ringMaterial.color.set("#fb786c");
      ringMaterial.opacity = 0.36;
      marker.position.set(
        car.col + (car.dir === "H" ? car.len / 2 : 0.5),
        0.052,
        car.row + (car.dir === "V" ? car.len / 2 : 0.5),
      );
      marker.scale.set(
        car.dir === "H" ? car.len - 0.08 : 0.92,
        car.dir === "V" ? car.len - 0.08 : 0.92,
        1,
      );
    }
    const hinted = props.cars.find((car) => car.id === props.hint?.carId);
    hintGuide.update(hinted, props.hint?.delta, !props.won && !props.editor, (camera.right-camera.left)/Math.max(1,canvas.clientWidth)*112);
    const opening = props.won ? Math.PI / 2 : 0;
    if (Math.abs(gate.rotation.x + opening) > 0.001) shadowChanged = true;
    gate.rotation.x = THREE.MathUtils.lerp(
      gate.rotation.x,
      -opening,
      reduced.matches ? 1 : 1 - Math.exp(-7 * dt),
    );
    const victoryAge = escapeStart == null ? 0 : now - escapeStart;
    exitFadeMaterial.opacity=props.won?exitSceneFade(victoryAge,reduced.matches):0;
    exitFade.visible=exitFadeMaterial.opacity>0;
    const exitTarget=groups.get('target');
    const followWeight=props.won?exitPose(victoryAge,5,2.5,reduced.matches).follow:0;
    const follow=followWeight*Math.min(1.8,Math.max(0,(exitTarget?.group.position.x??5)-5));
    const followZ=followWeight*Math.min(1.8,Math.max(0,(exitTarget?.group.position.z??2.5)-2.5));
    camera.position.x += follow - cameraFollow;
    camera.position.z += followZ-(cameraFollowZ??0);
    cameraFollow = follow;cameraFollowZ=followZ;
    camera.lookAt(
      scratchPosition.copy(viewAim).add(scratchDirection.set(follow, 0, followZ)),
    );
    camera.updateMatrixWorld();
    const lightOwner=groups.get(drag?.car.id ?? (props.won?'target':selected??'target'));
    const litCar=lightOwner?.group.visible?lightOwner:null;
    // Headlight refreshes must not force an unchanged sun map to render again.
    if (renderer.shadowMap.needsUpdate) sun.shadow.needsUpdate = true;
    // Every rendered moving pose needs matching depth, including native drag
    // and settling after release. Only unchanged poses may reuse cached maps.
    const synchronousMovingShadows = shadowChanged;
    if (vehicleLights.update(props.editor?null:litCar,settings,quality,now,shadowChanged||renderer.shadowMap.needsUpdate,synchronousMovingShadows)) renderer.shadowMap.needsUpdate=true;
    atmosphere?.update(dt, settings, quality, reduced.matches, props.editor);
    streetTraffic?.update(dt, settings, quality, reduced.matches, props);
    groundSurface?.update(dt,settings,quality,reduced.matches,props.editor);
    exhaustSmoke.update(dt,now,camera,!reduced.matches&&quality.decor&&!props.editor,settings.theme);
    particles.forEach((p) => {
      if (reduced.matches || !quality.decor) {
        p.life = 0;
        p.mesh.visible = false;
        return;
      }
      if (p.life <= 0) return;
      p.life -= dt;
      p.mesh.visible = p.life > 0;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.material.opacity = Math.max(0, p.life / p.duration) * 0.38;
    });
    if (movingShadowRefreshDue(shadowChanged,now,lastShadow,synchronousMovingShadows,30)) {
      sun.shadow.needsUpdate = true;
      renderer.shadowMap.needsUpdate = true;
    }
    if (renderer.shadowMap.needsUpdate) {
      lastShadow = now;
      stats.shadowUpdates++;
    }
    if(shadowChanged&&renderer.shadowMap.enabled){
      stats.movingFrames++;
      if(sun.shadow.needsUpdate&&renderer.shadowMap.needsUpdate)stats.movingShadowFrames++;
    }
    // Camera and vehicle motion must not change the optical clarity of windows.
    renderer.transmissionResolutionScale = 1;
    profiler.begin();
    renderer.render(scene, camera);
    profiler.end(renderer.info.render);
    stats.frames++;
    stats.renderedSceneKey = sceneKey;
    if (pendingInputAt !== null) {
      inputSamples.push(performance.now() - pendingInputAt);
      if (inputSamples.length > 1000) inputSamples.shift();
      pendingInputAt = null;
    }
  }
  resize();
  frame = requestAnimationFrame(animate);
  return {
    sync,
    finishExit() {
      if (!getProps().won || escapeStart == null) return;
      escapeStart = performance.now() - EXIT_COMPLETE_MS - 800;
      dirty = true;
      settlingUntil = performance.now() + 100;
    },
    measure(value) {
      measuring = Boolean(value);
      pendingInputAt = null;
      inputSamples.length = 0;
      profiler.set(value);
    },
    // Isolated profiling can exclude optical panes to measure the shared
    // transmission pass. Never changes stored quality or live player settings.
    probeGlass(hidden = false) {
      for (const item of groups.values()) item.group.traverse(mesh=>{
        if(mesh.isMesh && mesh.material.name==='Automotive glass') {
          mesh.visible=hidden!==true;
          if(typeof hidden==='string')configureVehicleGlass(mesh.material,settings.quality,hidden);
        }
      });
      dirty=true;
    },
    cancelInput,
    settings(next) {
      if (
        Object.entries(next).every(([key, value]) =>
          Object.is(settings[key], value),
        )
      )
        return;
      cancelCamera(false);
      if (drag) finish({ pointerId: drag.pointerId }, true);
      Object.assign(settings, next);
      Object.assign(settings, normalizeView(settings));
      quality = QUALITY[settings.quality] ?? QUALITY.high;
      for (const item of groups.values())
        for (const paint of item.paints) {
          configureVehiclePaint(paint, item.model, settings.quality, item.car.color);
        }
      for (const item of groups.values())
        for (const glass of item.windows) {
          configureVehicleGlass(glass, settings.quality);
          rainSurfaces.attach(glass);
        }
      renderer.setPixelRatio(Math.min(devicePixelRatio, quality.pixelRatio));
      renderer.shadowMap.enabled = settings.shadows && quality.decor;
      if (sun.shadow.mapSize.x !== quality.shadow) {
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
        sun.shadow.mapSize.set(quality.shadow, quality.shadow);
      }
      resize();
    },
    select(id) {
      selected = id;
      dirty = true;
      callbacks.select(id);
      canvas.focus({ preventScroll: true });
    },
    project(x, y, z) {
      const v = new THREE.Vector3(x, y, z).project(camera),
        r = canvas.getBoundingClientRect();
      return {
        x: r.left + ((v.x + 1) * r.width) / 2,
        y: r.top + ((1 - v.y) * r.height) / 2,
        depth: v.z,
      };
    },
    pick(x, y, pointerType = "mouse") {
      return carAt({ clientX: x, clientY: y, pointerType });
    },
    snapshot() {
      return {
        instanceId,
        sceneKey,
        memory: { ...renderer.info.memory },
        ready,
        hintGuide: hintGuide.snapshot(),
        atmosphere: atmosphere?.snapshot(),
        groundSurface: groundSurface?.snapshot(),
        rainSurfaces: rainSurfaces.snapshot(),
        settings: { ...settings },
        fenceShadows: (()=>{
          const fence=scene.getObjectByName('Courtyard fence');
          return fence?{visible:fence.visible,cast:fence.castShadow,receive:fence.receiveShadow,triangles:fence.geometry.index.count/3}:null;
        })(),
        cameraFrustum: {
          width: camera.right - camera.left,
          height: camera.top - camera.bottom,
          near: camera.near,
          far: camera.far,
          position: camera.position.toArray(),
        },
        lighting: { sunPosition: sun.position.toArray(), sunColor: sun.color.getHexString(), sunIntensity: sun.intensity, skyColor: ambient.color.getHexString(), ambientIntensity: ambient.intensity, reflections:reflections?.snapshot() },
        transmissionResolutionScale: renderer.transmissionResolutionScale,
        vehicleLighting: vehicleLights.snapshot(),
        exhaustSmoke: exhaustSmoke.snapshot(),
        viewCenter: screenCenterPoint()?.toArray(),
        cars: [...groups.values()].map((i) => ({
          id: i.car.id,
          model: i.model,
          dir: i.car.dir,
          len: i.car.len,
          position: i.group.position.toArray(),
          finish: i.paints.map(m => ({ physical: m.isMeshPhysicalMaterial === true,
            roughness: m.roughness, metalness: m.metalness,
            clearcoat: m.clearcoat, clearcoatRoughness: m.clearcoatRoughness })),
          glazing: i.windows.map((m) => ({
            physical: m.isMeshPhysicalMaterial === true,
            transmission: m.transmission,
            opacity: m.opacity,
            roughness: m.roughness,
            ior: m.ior,
            optics: m.userData.optics,
          })),
          wheelAngle: i.wheelAngle.value,
          wheelSteering: i.wheelSteering.value[1],
          wheelSteeringPair: i.wheelSteering.value,
          tilt: i.body.rotation.z,
          compression: i.body.position.y - 0.19,
          wheelTilt: i.group.rotation.z,
          velocity: i.velocity,
          tailLight: i.tailLamps[0]?.emissiveIntensity,
          headLight: i.lamps[0]?.emissiveIntensity,
          headColor: i.lamps[0]?.emissive.getHexString(),
          reverseLight: i.reverseMaterial.emissiveIntensity,
          tailColor: i.tailLamps[0]?.emissive.getHexString(),
          lampState: i.lampState,
          lampAnchors: {head:i.lightAnchors.head.map(a=>a?.mesh.name??null),tail:i.lightAnchors.tail.map(a=>a?.mesh.name??null)},
          lampOrigins: Object.fromEntries(['head','tail','reverse'].map(kind=>[kind,i.lightAnchors[kind].map(a=>a?.mesh.localToWorld(a.point.clone()).toArray()??null)])),
        })),
        calls: renderer.info.render.calls,
        performance: {
          ...stats,
          inputToSubmission: inputSummary(),
          pixelRatio: renderer.getPixelRatio(),
          shadowSize: sun.shadow.mapSize.x,
          shadows: renderer.shadowMap.enabled,
          inView,
          profile: profiler.snapshot(),
        },
        guide: {
          visible: marker.visible,
          position: marker.position.toArray(),
          scale: marker.scale.toArray(),
          opacity: ringMaterial.opacity,
        },
        celebration: false,
        editorPlacement: { legalStarts: availablePlacements.length, preview: previewPlacement },
        cameraFollow,
        exit:{age:escapeStart==null?null:performance.now()-escapeStart,fade:exitFadeMaterial.opacity,complete:groups.get('target')?.exitReported??false,visible:groups.get('target')?.group.visible??false,yaw:groups.get('target')?.group.rotation.y??0},
        cameraGesture: cameraGesture?.mode ?? null,
        touchPointers: touches.size,
      };
    },
    dispose() {
      window.removeEventListener("blur", cancelInput);
      document.removeEventListener("visibilitychange", pauseInput);
      clearTimeout(wheelTimer);
      clearTimeout(reflectionTimer);
      cancelCamera(false);
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibilityObserver.disconnect();
      Object.entries(handlers).forEach(([n, h]) =>
        canvas.removeEventListener(n, h),
      );
      reduced.removeEventListener("change", motionChanged);
      for (const item of groups.values())
        item.group.traverse((o) => {
          if (o.isMesh) {
            o.material.dispose();
            o.customDepthMaterial?.dispose();
            if (o.userData.generatedGeometry) o.geometry.dispose();
          }
        });
      ownedMaterials.forEach((m) => m.dispose());
      ownedGeometries.forEach((g) => g.dispose());
      contactGeometry.dispose();
      contactTextures.forEach(texture => texture.dispose());
      hintGuide.dispose();
      glowTexture.dispose();
      skidTexture.dispose();
      vehicleLights.dispose();
      exhaustSmoke.dispose();
      reflections?.dispose();

      atmosphere?.dispose();
      streetTraffic?.dispose();
      groundSurface?.dispose();
      rainSurfaces.dispose();
      placementCells.dispose(); placementGhost.dispose();
      lightPools.dispose();
      vegetationShadows?.dispose();
      skidMarks.dispose();
      // Cached asset geometry is shared by current and future scene instances.
      profiler.dispose();
      renderer.dispose();
      exitFadeGeometry.dispose();exitFadeMaterial.dispose();
      sceneryAtlas.dispose();
    },
  };
}
