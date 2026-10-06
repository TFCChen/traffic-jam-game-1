import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { legalMovesForCar } from "./gameEngine.js";
import { vehicleModel } from "./vehicleModels.js";
import {
  asphaltTexture,
  sceneryTexture,
  detailTexture,
  prepareWheels,
  rollingMaterial,
  batchColoredMeshes,
} from "./garageMaterials.js";
import { SCENE_THEMES } from "./sceneThemes.js";
import { QUALITY } from "./gamePreferences.js";
import { configureVehicleGlass, prepareVehicleGlass, VEHICLE_MIRROR } from "./vehicleGlass.js";
import { quadDistance, snapDragDelta } from "./pointerHelpers.js";
import {
  stepSuspension,
  contactImpulse,
  axleCompression,
  SUSPENSION_PROFILES,
} from "./vehicleDynamics.js";
import { createRenderProfiler } from "./renderProfiler.js";
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
  const room = new RoomEnvironment(),
    pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  const roadTexture = asphaltTexture();
  const sceneryAtlas = sceneryTexture();
  const glowTexture = detailTexture("glow"),
    skidTexture = detailTexture("skid"),
    beamTexture = detailTexture("beam");
  const contactGeometry = new THREE.PlaneGeometry(1, 1);
  const camera = new THREE.OrthographicCamera(-5, 5, 4, -4, 0.1, ORTHOGRAPHIC_FAR);
  const aim = new THREE.Vector3(3, 0.15, 3);
  const viewAim = aim.clone();
  // A fixed reference view determines framing. Orbit changes orientation only,
  // so fitting the current angle cannot silently change the player's scale.
  const framingCamera = camera.clone();
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
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.055);
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
    nextFrame = 0,
    lastHover = 0;
  const sceneryLamps = [];
  const stats = { frames: 0, shadowUpdates: 0, renderedSceneKey: null };
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
  const garageFill = new THREE.SpotLight("#c7e4ec", 20, 9, 0.72, 0.75, 2);
  garageFill.position.set(3.2, 5, 3);
  garageFill.target.position.set(3, 0, 3);
  garageFill.visible = false;
  scene.add(garageFill, garageFill.target);
  const streetLights = [
    [-0.7, 0.2],
    [6.65, 5.45],
  ].map(([x, z]) => {
    const light = new THREE.PointLight("#ffd4a4", 3, 2.4, 2);
    light.position.set(x, 1.05, z);
    light.visible = false;
    scene.add(light);
    return light;
  });
  const sun = new THREE.DirectionalLight(0xffefce, settings.intensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.0002;
  sun.target.position.copy(aim);
  scene.add(sun, sun.target);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: "#edf0e8",
    roughness: 1,
  });
  floorMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying vec3 garageFloorPosition;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "garageFloorPosition=(modelMatrix*vec4(transformed,1.)).xyz;\n#include <project_vertex>",
    );
    shader.fragmentShader =
      "varying vec3 garageFloorPosition;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\nvec2 floorOffset=garageFloorPosition.xz-vec2(3.);\ndiffuseColor.rgb*=mix(.68,1.04,exp(-dot(floorOffset,floorOffset)*.027));",
    );
  };
  floorMaterial.customProgramCacheKey = () => "garage-floor-gradient-v1";
  ownedMaterials.add(floorMaterial);
  const floorGeometry = new THREE.PlaneGeometry(200, 200);
  ownedGeometries.add(floorGeometry);
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.48;
  floor.receiveShadow = true;
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
  const hintArrow = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(),
    1.1,
    0xffecaa,
    0.3,
    0.2,
  );
  hintArrow.visible = false;
  scene.add(hintArrow);
  const gate = new THREE.Group();
  gate.position.set(6.43, 0.34, 1.98);
  scene.add(gate);
  const gateGeometry = new THREE.BoxGeometry(0.07, 0.07, 0.98);
  ownedGeometries.add(gateGeometry);
  for (let i = 0; i < 7; i++) {
    const m = new THREE.MeshStandardMaterial({
      color: i % 2 ? "#e9ad78" : "#fff1d4",
      roughness: 0.5,
    });
    ownedMaterials.add(m);
    const piece = new THREE.Mesh(gateGeometry, m);
    piece.scale.z = 1 / 7;
    piece.position.z = ((i + 0.5) * 0.98) / 7;
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
  const lightPools = new THREE.InstancedMesh(glowGeometry, glowMaterial, 2);
  scene.add(lightPools);
  const beamGeometry = new THREE.PlaneGeometry(0.62, 1.05);
  ownedGeometries.add(beamGeometry);
  const beamMaterial = new THREE.MeshBasicMaterial({
    map: beamTexture,
    color: "#ffe6b0",
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  ownedMaterials.add(beamMaterial);
  const headlightBeams = new THREE.InstancedMesh(
    beamGeometry,
    beamMaterial,
    40,
  );
  headlightBeams.count = 0;
  headlightBeams.frustumCulled = false;
  headlightBeams.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(headlightBeams);
  for (let i = 0; i < 2; i++) {
    instancePose.position.set(i ? 6.65 : -0.7, 0.045, i ? 5.45 : 0.2);
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
  const accentMaterial = new THREE.MeshBasicMaterial({ color: "#78a58c" });
  ownedMaterials.add(accentMaterial);
  const accentGeometry = new THREE.BoxGeometry(0.13, 0.012, 0.035);
  ownedGeometries.add(accentGeometry);
  const roadLights = new THREE.InstancedMesh(accentGeometry, accentMaterial, 8);
  scene.add(roadLights);
  for (let i = 0; i < 8; i++) {
    instancePose.position.set(
      6.12 + (i % 4) * 0.37,
      0.052,
      i < 4 ? 2.03 : 2.97,
    );
    instancePose.rotation.set(0, 0, 0);
    instancePose.scale.set(1, 1, 1);
    instancePose.updateMatrix();
    roadLights.setMatrixAt(i, instancePose.matrix);
    roadLights.setColorAt(i, accentColour.set("#78a58c"));
  }
  const leafGeometry = new THREE.PlaneGeometry(0.07, 0.13);
  ownedGeometries.add(leafGeometry);
  const leafMaterial = new THREE.MeshBasicMaterial({
    color: "#b28e58",
    side: THREE.DoubleSide,
  });
  ownedMaterials.add(leafMaterial);
  const leaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, 4);
  leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  leaves.frustumCulled = false;
  scene.add(leaves);
  const confettiGeometry = new THREE.PlaneGeometry(0.055, 0.12);
  ownedGeometries.add(confettiGeometry);
  const confettiMaterial = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
  });
  ownedMaterials.add(confettiMaterial);
  const celebration = new THREE.InstancedMesh(
    confettiGeometry,
    confettiMaterial,
    24,
  );
  celebration.visible = false;
  celebration.frustumCulled = false;
  celebration.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(celebration);
  for (let i = 0; i < 24; i++)
    celebration.setColorAt(
      i,
      accentColour.set(["#ffc857", "#72d2bd", "#ee7f75", "#8a9df1"][i % 4]),
    );
  // A bounded particle pool: never allocate meshes in the animation loop.
  const particles = [];
  const smokeGeometry = new THREE.SphereGeometry(0.055, 6, 4);
  ownedGeometries.add(smokeGeometry);
  for (let i = 0; i < 28; i++) {
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
    const p = particles.find((item) => item.life <= 0);
    if (!p) return;
    p.life = spark ? 0.32 : 1.1;
    p.duration = p.life;
    p.spark = spark;
    p.mesh.position.copy(position);
    p.mesh.visible = true;
    p.mesh.material.color.set(spark ? "#ffd281" : "#d7dfd2");
    p.mesh.scale.setScalar(spark ? 0.5 : 0.6);
    p.velocity.copy(direction).multiplyScalar(spark ? 1.5 : 0.3);
    p.velocity.y = spark ? 0.2 : 0.2;
  }
  function updateCamera(viewOnly = false) {
    cameraFollow = 0;
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
    const bounds = portrait
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
            [-1.15, 7.7],
            [-0.48, 0.2],
            [-0.4, 6.4],
          ],
          [
            [0, 6],
            [0.08, 1.3],
            [0, 6],
          ],
          [
            [-0.9, 6.9],
            [0.2, 1.4],
            [0.1, 6],
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
    const halfWidth = Math.max(
        Math.max(maxX - centerX, centerX - minX) + padding,
        (Math.max(maxY - centerY, centerY - minY) + padding) * aspect,
      ),
      halfHeight = halfWidth / aspect;
    const visibleWidth = halfWidth / settings.zoom,
      visibleHeight = halfHeight / settings.zoom;
    const limitX = Math.max(1.5, halfWidth - visibleWidth + 2),
      limitY = Math.max(1.5, halfHeight - visibleHeight + 2);
    // Orbit shifts focus to preserve the screen center. Bound the actual view
    // relative to the lot in the CURRENT camera basis, not the old pan origin.
    const lotCenter = aim.clone().applyMatrix4(camera.matrixWorldInverse);
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
    camera.left = centerX + settings.panX - visibleWidth;
    camera.right = centerX + settings.panX + visibleWidth;
    camera.top = centerY + settings.panY + visibleHeight;
    camera.bottom = centerY + settings.panY - visibleHeight;
    camera.updateProjectionMatrix();
    if (viewOnly) {
      dirty = true;
      return;
    }
    const angle = THREE.MathUtils.degToRad(settings.light);
    sun.position.set(
      aim.x + Math.sin(angle) * 8,
      10,
      aim.z + Math.cos(angle) * 8,
    );
    const theme =
      SCENE_THEMES.find((t) => t.id === settings.theme) ?? SCENE_THEMES[0];
    sun.intensity = settings.intensity * theme.key;
    sun.color.set(theme.sun);
    sun.castShadow = settings.shadows && quality.decor;
    ambient.color.set(theme.sky);
    ambient.groundColor.set(theme.ground);
    ambient.intensity = theme.ambient;
    scene.environmentIntensity = theme.environment;
    floorMaterial.color.set(theme.floor);
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
    leafMaterial.color.set(settings.theme === "sunset" ? "#c28551" : "#87935e");
    lightPools.visible = settings.theme !== "day";
    glowMaterial.color.set("#ffd199");
    glowMaterial.opacity = settings.theme === "neon" ? 0.28 : 0.15;
    renderer.shadowMap.needsUpdate = true;
    dirty = true;
  }
  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
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
  function applyCamera(view) {
    Object.assign(settings, normalizeView(view));
    updateCamera(true);
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
    applyCamera(rotateView(settings, dx, dy));
    const moved = screenCenterPoint();
    if (pivot && moved)
      applyCamera({
        ...settings,
        focusX: settings.focusX + pivot.x - moved.x,
        focusZ: settings.focusZ + pivot.z - moved.z,
      });
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
        (active.moved ? getProps().onPlace : getProps().onCellClick)?.({
          row: active.row,
          col: active.col,
        });
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
    const changed = sceneKey !== props.sceneKey;
    sceneKey = props.sceneKey;
    if (changed) {
      cancelCamera();
      escapeStart = null;
      cameraFollow = 0;
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
              VEHICLE_MIRROR,
              "Batched cabin",
              "Headlamp",
              "Tail lamp",
              "Rolling wheels",
            ].includes(mesh.material.name) &&
            !mesh.material.name.startsWith("Paint"),
        );
        const lamps = [],
          tailLamps = [],
          paints = [],
          windows = [],
          wheelAngle = { value: 0 },
          tyreCompression = { value: [0, 0] };
        group.traverse((object) => {
          if (object.isMesh) {
            if (!object.userData.generatedGeometry)
              object.material = object.material.clone();
            const material = object.material;
            if (material.name.startsWith("Paint")) {
              paints.push(material);
              material.color.set(car.color);
              material.roughness = 0.3;
              material.metalness = 0.06;
              if ("clearcoat" in material) {
                material.clearcoat = quality === QUALITY.high ? 0.55 : 0;
                material.clearcoatRoughness = 0.2;
              }
            }
            if (material.name === "Automotive glass") {
              windows.push(material);
              configureVehicleGlass(material, settings.quality);
            }
            if (material.name === VEHICLE_MIRROR) {
              material.metalness = 1;
              material.roughness = 0.055;
              material.envMapIntensity = 1.4;
            }
            if (material.name === "Headlamp") {
              material.emissive.set("#ffd994");
              lamps.push(material);
            }
            if (material.name === "Tail lamp") {
              tailLamps.push(material);
            }
            if (material.name === "Rolling wheels") {
              rollingMaterial(material, wheelAngle, tyreCompression);
              object.customDepthMaterial = rollingMaterial(
                new THREE.MeshDepthMaterial({
                  depthPacking: THREE.RGBADepthPacking,
                }),
                wheelAngle,
                tyreCompression,
              );
            }
            object.castShadow = !["Automotive glass", "Batched cabin"].includes(material.name);
            object.receiveShadow = material.name !== "Automotive glass";
            object.userData.carId = car.id;
          }
        });
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
        const contact = new THREE.Mesh(
          contactGeometry,
          new THREE.MeshBasicMaterial({
            map: glowTexture,
            color: "#17232a",
            transparent: true,
            opacity: 0.32,
            depthWrite: false,
          }),
        );
        contact.rotation.x = -Math.PI / 2;
        contact.position.y = -0.014;
        contact.scale.set(car.len - 0.12, 0.85, 1);
        contact.raycast = () => {};
        group.add(contact);
        item = {
          group,
          body,
          suspension: { pitch: 0, rate: 0, speed: 0, heave: 0, heaveRate: 0 },
          car,
          index,
          model: vehicleModel(car).kind,
          lamps,
          tailLamps,
          paints,
          windows,
          wheelAngle,
          tyreCompression,
          velocity: 0,
          brakeUntil: 0,
        };
        groups.set(car.id, item);
        scene.add(group);
        group.position.set(
          car.col + (car.dir === "H" ? car.len / 2 : 0.5),
          0.055,
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
            0.055,
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
      const streetBatch = batchColoredMeshes(
        garage,
        (mesh) =>
          ![
            "Asphalt blue slate",
            "Street asphalt",
            "Automotive glass",
            "Streetlamp glow",
          ].includes(mesh.material.name),
        {
          roughness: 0.85,
          metalness: 0.02,
          name: "Batched scenery",
          atlas: sceneryAtlas,
        },
      );
      ownedGeometries.add(streetBatch.geometry);
      garage.traverse((o) => {
        if (o.isMesh) {
          if (!o.userData.generatedGeometry) o.material = o.material.clone();
          ownedMaterials.add(o.material);
          if (
            o.material.name === "Asphalt blue slate" ||
            o.material.name === "Street asphalt"
          ) {
            o.material.map = roadTexture;
            o.material.bumpMap = roadTexture;
            o.material.bumpScale = 0.003;
            o.material.roughnessMap = roadTexture;
          }
          if (o.material.name === "Streetlamp glow")
            sceneryLamps.push(o.material);
          o.receiveShadow = true;
          o.castShadow = true;
        }
      });
      scene.add(garage);
      updateCamera();
      sync();
      await renderer.compileAsync(scene, camera);
      if (!alive) return;
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
      (escapeStart != null && now - escapeStart < 1900);
    // Cap high-refresh displays too; retain ambient life without rendering at 120/144 Hz.
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
      if (props.won && car.id === "target") {
        const t = reduced.matches
          ? 1
          : clamp((now - escapeStart - 320) / 1050, 0, 1);
        x += 4 * t * t;
        group.visible = t < 1;
      } else group.visible = true;
      const blend = isDrag || reduced.matches ? 1 : 1 - Math.exp(-18 * dt);
      const height = 0.055;
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
      const travelled =
          (car.dir === "H" ? group.position.x : group.position.z) - oldAxis,
        velocity = travelled / Math.max(0.008, dt);
      item.wheelAngle.value -= travelled / 0.19;
      if (Math.abs(item.velocity) > 0.2 && Math.abs(velocity) < 0.12)
        item.brakeUntil = now + 220;
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
      item.lamps.forEach((material) => {
        material.emissiveIntensity =
          settings.theme === "neon"
            ? 1.4
            : isDrag || props.won
              ? 0.8
              : reduced.matches
                ? 0.2
                : 0.15 +
                  (Math.sin(now * 0.001 + item.index) * 0.5 + 0.5) * 0.25;
      });
      item.tailLamps.forEach((material) => {
        material.color.set(reversing ? "#e9f1e5" : "#df7460");
        material.emissive.set(reversing ? "#e7f0df" : "#ef3426");
        material.emissiveIntensity = reversing
          ? 0.9
          : braking
            ? 1.3
            : settings.theme === "neon"
              ? 0.2
              : 0.03;
      });
      if (!props.editor && !props.won && !reduced.matches && quality.decor) {
        const tick = Math.floor(now / 1000 + item.index * 1.47);
        if (tick !== item.lastTick) {
          item.lastTick = tick;
          if (tick % 4 === 0)
            puff(
              group.localToWorld(scratchPosition.set(-car.len / 2, 0.19, 0.2)),
              scratchDirection.set(
                car.dir === "H" ? -1 : 0,
                0,
                car.dir === "V" ? -1 : 0,
              ),
            );
        }
      }
      if (
        quality.decor &&
        isDrag &&
        Math.abs(drag.speed) > 1 &&
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
          scratchPosition
            .copy(group.position)
            .add(scratchDirection.set(-0.85, 0.13, 0.2)),
          scratchDirection.set(-1, 0, 0),
        );
      }
    }
    marker.visible = !!drag && !props.won;
    ringMaterial.color.set("#f5d391");
    ringMaterial.opacity = 0.13;
    if (drag) {
      const { car, min, max } = drag,
        span = car.len + max - min;
      marker.position.set(
        car.col + (car.dir === "H" ? (car.len + min + max) / 2 : 0.5),
        0.05,
        car.row + (car.dir === "V" ? (car.len + min + max) / 2 : 0.5),
      );
      marker.scale.set(
        car.dir === "H" ? span - 0.08 : 0.92,
        car.dir === "V" ? span - 0.08 : 0.92,
        1,
      );
    }
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
    hintArrow.visible = !!hinted && !props.won;
    if (hinted) {
      const direction = new THREE.Vector3(
        hinted.dir === "H" ? Math.sign(props.hint.delta) : 0,
        0,
        hinted.dir === "V" ? Math.sign(props.hint.delta) : 0,
      );
      hintArrow.setDirection(direction);
      hintArrow.position.set(
        hinted.col + (hinted.dir === "H" ? hinted.len / 2 : 0.5),
        1.4,
        hinted.row + (hinted.dir === "V" ? hinted.len / 2 : 0.5),
      );
      hintArrow.position.addScaledVector(direction, -0.55);
    }
    const opening = props.won ? Math.PI / 2 : 0;
    if (Math.abs(gate.rotation.x + opening) > 0.001) shadowChanged = true;
    gate.rotation.x = THREE.MathUtils.lerp(
      gate.rotation.x,
      -opening,
      reduced.matches ? 1 : 1 - Math.exp(-7 * dt),
    );
    const victoryAge = escapeStart == null ? 0 : now - escapeStart;
    const follow =
      props.won && !reduced.matches
        ? 0.26 * Math.sin(Math.PI * clamp(victoryAge / 1500, 0, 1))
        : 0;
    camera.position.x += follow - cameraFollow;
    cameraFollow = follow;
    camera.lookAt(
      scratchPosition.copy(viewAim).add(scratchDirection.set(follow, 0, 0)),
    );
    camera.updateMatrixWorld();
    headlightBeams.visible = settings.theme === "neon" && quality.decor;
    headlightBeams.count = 0;
    if (headlightBeams.visible) {
      for (const { group, car } of groups.values()) {
        if (!group.visible) continue;
        const axis = car.dir === "H" ? "x" : "z",
          lateral = car.dir === "H" ? "z" : "x",
          front = group.position[axis] + car.len / 2;
        let reach =
          props.won && car.id === "target" ? 1.05 : Math.min(1.05, 6 - front);
        for (const other of groups.values()) {
          if (other.car.id === car.id || !other.group.visible) continue;
          const along = other.car.dir === car.dir ? other.car.len : 0.9,
            across = other.car.dir === car.dir ? 0.9 : other.car.len;
          if (
            Math.abs(other.group.position[lateral] - group.position[lateral]) <
              (across + 0.6) / 2 &&
            other.group.position[axis] + along / 2 > front
          )
            reach = Math.min(
              reach,
              Math.max(
                0,
                other.group.position[axis] - along / 2 - front - 0.025,
              ),
            );
        }
        if (reach < 0.08) continue;
        for (const side of [-0.24, 0.24]) {
          if (headlightBeams.count >= 40) break;
          group.localToWorld(
            scratchPosition.set(car.len / 2 + reach / 2, 0, side),
          );
          instancePose.position.set(
            scratchPosition.x,
            0.052,
            scratchPosition.z,
          );
          instancePose.rotation.set(
            -Math.PI / 2,
            0,
            car.dir === "H" ? -Math.PI / 2 : Math.PI,
          );
          instancePose.scale.set(0.7 + reach * 0.3, reach / 1.05, 1);
          instancePose.updateMatrix();
          headlightBeams.setMatrixAt(
            headlightBeams.count++,
            instancePose.matrix,
          );
        }
      }
      headlightBeams.instanceMatrix.needsUpdate = true;
    }
    leaves.visible =
      quality.decor &&
      !reduced.matches &&
      settings.theme !== "neon" &&
      !props.editor;
    if (leaves.visible) {
      for (let i = 0; i < 4; i++) {
        const t = (now * 0.00007 + i * 0.25) % 1;
        instancePose.position.set(
          i % 2 ? 6.85 + Math.sin(t * 6) * 0.13 : -0.7 + Math.sin(t * 7) * 0.13,
          0.13 + Math.sin(t * Math.PI) * 0.17,
          0.2 + t * 5.7,
        );
        instancePose.rotation.set(-1.2, t * 7 + i, t * 5);
        instancePose.scale.set(1, 1, 1);
        instancePose.updateMatrix();
        leaves.setMatrixAt(i, instancePose.matrix);
      }
      leaves.instanceMatrix.needsUpdate = true;
    }
    for (let i = 0; i < 8; i++) {
      const lit = props.won && victoryAge > (i % 4) * 110;
      roadLights.setColorAt(
        i,
        accentColour.set(
          lit
            ? "#a9efc4"
            : settings.theme === "neon"
              ? i < 4
                ? "#79dfea"
                : "#b591ef"
              : "#78a58c",
        ),
      );
    }
    roadLights.instanceColor.needsUpdate = true;
    celebration.visible =
      quality.decor &&
      props.won &&
      props.perfect &&
      !reduced.matches &&
      victoryAge > 800 &&
      victoryAge < 1850;
    if (celebration.visible) {
      const t = (victoryAge - 800) / 1050;
      for (let i = 0; i < 24; i++) {
        const angle = i * 2.4;
        instancePose.position.set(
          6.8 + Math.cos(angle) * t * 0.9,
          0.25 + Math.sin(t * Math.PI) * (0.7 + (i % 3) * 0.2),
          2.5 + Math.sin(angle) * t * 0.8,
        );
        instancePose.rotation.set(t * 8 + i, t * 5 + i, t * 9);
        instancePose.scale.set(1, 1, 1);
        instancePose.updateMatrix();
        celebration.setMatrixAt(i, instancePose.matrix);
      }
      celebration.instanceMatrix.needsUpdate = true;
    }
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
      if (!p.spark) p.mesh.scale.addScalar(dt * 0.6);
    });
    if (shadowChanged && now - lastShadow >= 1000 / 30 - 0.5)
      renderer.shadowMap.needsUpdate = true;
    if (renderer.shadowMap.needsUpdate) {
      lastShadow = now;
      stats.shadowUpdates++;
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
    measure(value) {
      measuring = Boolean(value);
      pendingInputAt = null;
      inputSamples.length = 0;
      profiler.set(value);
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
          if ("clearcoat" in paint) {
            const coat = quality === QUALITY.high ? 0.55 : 0;
            if (paint.clearcoat !== coat) {
              paint.clearcoat = coat;
              paint.needsUpdate = true;
            }
          }
        }
      for (const item of groups.values())
        for (const glass of item.windows)
          configureVehicleGlass(glass, settings.quality);
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
        settings: { ...settings },
        cameraFrustum: {
          width: camera.right - camera.left,
          height: camera.top - camera.bottom,
          near: camera.near,
          far: camera.far,
          position: camera.position.toArray(),
        },
        transmissionResolutionScale: renderer.transmissionResolutionScale,
        viewCenter: screenCenterPoint()?.toArray(),
        cars: [...groups.values()].map((i) => ({
          id: i.car.id,
          model: i.model,
          dir: i.car.dir,
          len: i.car.len,
          position: i.group.position.toArray(),
          glazing: i.windows.map((m) => ({
            physical: m.isMeshPhysicalMaterial === true,
            transmission: m.transmission,
            opacity: m.opacity,
            roughness: m.roughness,
            ior: m.ior,
          })),
          wheelAngle: i.wheelAngle.value,
          tilt: i.body.rotation.z,
          compression: i.body.position.y - 0.19,
          wheelTilt: i.group.rotation.z,
          velocity: i.velocity,
          tailLight: i.tailLamps[0]?.emissiveIntensity,
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
        celebration: celebration.visible,
        cameraFollow,
        cameraGesture: cameraGesture?.mode ?? null,
        touchPointers: touches.size,
      };
    },
    dispose() {
      window.removeEventListener("blur", cancelInput);
      document.removeEventListener("visibilitychange", pauseInput);
      clearTimeout(wheelTimer);
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
      hintArrow.dispose();
      roadTexture.dispose();
      glowTexture.dispose();
      skidTexture.dispose();
      beamTexture.dispose();
      environment.dispose();
      roadLights.dispose();
      leaves.dispose();
      celebration.dispose();
      lightPools.dispose();
      headlightBeams.dispose();
      skidMarks.dispose();
      // Cached asset geometry is shared by current and future scene instances.
      profiler.dispose();
      renderer.dispose();
      sceneryAtlas.dispose();
    },
  };
}
