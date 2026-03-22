import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ============================================================
// Types
// ============================================================
interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}
interface Enemy {
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  speed: number;
  animPhase: number;
  dying: boolean;
  deathTimer: number;
  hpBar: THREE.Mesh;
  hpBarBg: THREE.Mesh;
  glow: THREE.PointLight;
}
interface Bullet {
  mesh: THREE.Mesh;
  trail: THREE.Line;
  velocity: THREE.Vector3;
  life: number;
}
interface CollisionBox {
  x: number;
  z: number;
  hw: number;
  hd: number;
}

// ============================================================
// Audio (Web Audio API - procedural)
// ============================================================
const audioCtx = new AudioContext();
// Resume audio context on user interaction (browser policy)
document.addEventListener('click', () => { if (audioCtx.state === 'suspended') audioCtx.resume(); }, { once: true });

function playShootSound() {
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.15, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
  g.connect(audioCtx.destination);

  // Noise burst
  const bufSize = audioCtx.sampleRate * 0.15;
  const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.05));
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(g);
  src.start();
}

function playHitSound() {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(200, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.1);
  g.gain.setValueAtTime(0.1, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function playKillSound() {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
  g.gain.setValueAtTime(0.12, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}

function playReloadSound() {
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    const t = audioCtx.currentTime + i * 0.15;
    osc.frequency.setValueAtTime(800 + i * 400, t);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  }
}

function playWaveSound() {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
  g.gain.setValueAtTime(0.08, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.8);
}

// ============================================================
// Game State
// ============================================================
const state = {
  started: false,
  gameOver: false,
  autoPlay: false,
  score: 0,
  wave: 1,
  hp: 100,
  kills: 0,
  ammo: 30,
  maxAmmo: 30,
  reloading: false,
  reloadTimer: 0,
  enemies: [] as Enemy[],
  bullets: [] as Bullet[],
  particles: [] as Particle[],
  spawnTimer: 0,
  waveEnemiesLeft: 0,
  waveEnemiesSpawned: 0,
  waveAnnounceTimer: 0,
  keys: { w: false, a: false, s: false, d: false, r: false },
  gunRecoil: 0,
  screenShake: 0,
  damageFlash: 0,
  aiShootCooldown: 0,
  combo: 0,
  comboTimer: 0,
};

// ============================================================
// Scene
// ============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e0e1a);
scene.fog = new THREE.FogExp2(0x0e0e1a, 0.014);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 1.6, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;
document.body.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.3, 0.85);
composer.addPass(bloomPass);

const controls = new PointerLockControls(camera, document.body);

// ============================================================
// Lighting
// ============================================================
scene.add(new THREE.AmbientLight(0x445566, 1.0));
scene.add(new THREE.HemisphereLight(0x4466aa, 0x223322, 0.5));

const moonLight = new THREE.DirectionalLight(0x6688cc, 1.3);
moonLight.position.set(20, 40, -10);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
moonLight.shadow.camera.near = 0.5;
moonLight.shadow.camera.far = 120;
moonLight.shadow.camera.left = -50;
moonLight.shadow.camera.right = 50;
moonLight.shadow.camera.top = 50;
moonLight.shadow.camera.bottom = -50;
scene.add(moonLight);

const playerLight = new THREE.PointLight(0xff6633, 0, 12);
scene.add(playerLight);

// ============================================================
// Starry sky
// ============================================================
const starGeo = new THREE.BufferGeometry();
const starCount = 1500;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.random() * Math.PI * 0.5; // upper hemisphere
  const r = 80 + Math.random() * 20;
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = r * Math.cos(phi) + 10;
  starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true });
scene.add(new THREE.Points(starGeo, starMat));

// Moon orb
const moonGeo = new THREE.SphereGeometry(3, 16, 16);
const moonMat = new THREE.MeshBasicMaterial({ color: 0xddeeff });
const moonOrb = new THREE.Mesh(moonGeo, moonMat);
moonOrb.position.set(40, 50, -30);
scene.add(moonOrb);

// ============================================================
// Atmosphere lights (fire barrels)
// ============================================================
const atmosLights: THREE.PointLight[] = [];
const fireMeshes: THREE.Mesh[] = [];
const lightDefs = [
  [10, -10, 0xff2200], [-12, 5, 0xff4400], [5, 18, 0xff1100],
  [-18, -15, 0xff3300], [20, 8, 0xff2200], [-8, -25, 0xff4400],
  [14, -18, 0xff3300], [-22, 12, 0xff2200],
];
for (const [x, z, color] of lightDefs) {
  const light = new THREE.PointLight(color, 1.2, 22);
  light.position.set(x, 3, z);
  scene.add(light);
  atmosLights.push(light);

  const barrelGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.8, 8);
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 });
  const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
  barrelMesh.position.set(x, 0.4, z);
  barrelMesh.castShadow = true;
  scene.add(barrelMesh);

  const fireGeo = new THREE.SphereGeometry(0.25, 6, 6);
  const fireMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const fire = new THREE.Mesh(fireGeo, fireMat);
  fire.position.set(x, 1.0, z);
  scene.add(fire);
  fireMeshes.push(fire);
}

// ============================================================
// Ground
// ============================================================
const groundCanvas = document.createElement('canvas');
groundCanvas.width = 512;
groundCanvas.height = 512;
const gctx = groundCanvas.getContext('2d')!;
gctx.fillStyle = '#1a1a28';
gctx.fillRect(0, 0, 512, 512);
for (let i = 0; i < 3000; i++) {
  const gx = Math.random() * 512, gy = Math.random() * 512;
  const b = Math.floor(Math.random() * 30 + 15);
  gctx.fillStyle = `rgb(${b},${b},${b + 10})`;
  gctx.fillRect(gx, gy, Math.random() * 3 + 1, Math.random() * 3 + 1);
}
gctx.strokeStyle = '#111115';
gctx.lineWidth = 1;
for (let i = 0; i < 15; i++) {
  gctx.beginPath();
  let cx = Math.random() * 512, cy = Math.random() * 512;
  gctx.moveTo(cx, cy);
  for (let j = 0; j < 8; j++) { cx += (Math.random() - 0.5) * 60; cy += (Math.random() - 0.5) * 60; gctx.lineTo(cx, cy); }
  gctx.stroke();
}
const groundTex = new THREE.CanvasTexture(groundCanvas);
groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
groundTex.repeat.set(10, 10);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.85, color: 0x999aab }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ============================================================
// Colliders
// ============================================================
const colliders: CollisionBox[] = [];

function pushOutOfColliders(pos: THREE.Vector3, radius: number) {
  for (const c of colliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const overlapX = (c.hw + radius) - Math.abs(dx);
    const overlapZ = (c.hd + radius) - Math.abs(dz);
    if (overlapX > 0 && overlapZ > 0) {
      if (overlapX < overlapZ) pos.x += dx > 0 ? overlapX : -overlapX;
      else pos.z += dz > 0 ? overlapZ : -overlapZ;
    }
  }
}

function isInsideCollider(x: number, z: number, margin: number): boolean {
  for (const c of colliders) {
    if (Math.abs(x - c.x) < c.hw + margin && Math.abs(z - c.z) < c.hd + margin) return true;
  }
  return false;
}

// ============================================================
// Buildings
// ============================================================
function createBuilding(x: number, z: number, w: number, h: number, d: number) {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4a55, roughness: 0.85 });
  const main = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  main.position.y = h / 2;
  main.castShadow = true;
  main.receiveShadow = true;
  group.add(main);

  const windowMat = new THREE.MeshBasicMaterial({ color: 0x112233, transparent: true, opacity: 0.5 });
  const windowGeo = new THREE.PlaneGeometry(0.6, 0.8);
  for (let wy = 2; wy < h - 1; wy += 2.5) {
    for (let wx = -w / 2 + 1; wx < w / 2 - 0.5; wx += 1.8) {
      if (Math.random() > 0.4) {
        const win = new THREE.Mesh(windowGeo, windowMat);
        win.position.set(wx, wy, d / 2 + 0.01);
        group.add(win);
        const winB = new THREE.Mesh(windowGeo, windowMat);
        winB.position.set(wx, wy, -d / 2 - 0.01);
        winB.rotation.y = Math.PI;
        group.add(winB);
      }
    }
  }
  group.position.set(x, 0, z);
  scene.add(group);
  colliders.push({ x, z, hw: w / 2, hd: d / 2 });
}

createBuilding(-30, -30, 8, 12, 6);
createBuilding(25, -25, 6, 8, 5);
createBuilding(-25, 20, 7, 15, 6);
createBuilding(30, 15, 5, 10, 7);
createBuilding(0, -35, 10, 7, 4);
createBuilding(-35, 0, 4, 18, 4);
createBuilding(35, -5, 6, 9, 5);
createBuilding(15, 30, 8, 6, 5);
createBuilding(-15, -35, 5, 11, 6);
createBuilding(38, 25, 6, 14, 5);

// ============================================================
// Crates
// ============================================================
const crateCanvas = document.createElement('canvas');
crateCanvas.width = 128;
crateCanvas.height = 128;
const cctx = crateCanvas.getContext('2d')!;
cctx.fillStyle = '#443322';
cctx.fillRect(0, 0, 128, 128);
cctx.strokeStyle = '#332211';
cctx.lineWidth = 4;
cctx.strokeRect(4, 4, 120, 120);
cctx.beginPath();
cctx.moveTo(0, 0); cctx.lineTo(128, 128);
cctx.moveTo(128, 0); cctx.lineTo(0, 128);
cctx.stroke();
for (let i = 0; i < 500; i++) {
  const ccx = Math.random() * 128, ccy = Math.random() * 128;
  const cb = Math.floor(Math.random() * 20 + 50);
  cctx.fillStyle = `rgba(${cb},${cb - 15},${cb - 30},0.3)`;
  cctx.fillRect(ccx, ccy, 2, 2);
}
const crateTex = new THREE.CanvasTexture(crateCanvas);
const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.85 });

const cratePositions: [number, number][] = [
  [8, -5], [-6, 8], [12, 10], [-10, -12], [3, 15],
  [-15, 3], [18, -8], [-8, -20], [0, -10], [15, 15],
  [-3, -5], [7, 3], [-20, -8], [22, 0], [-5, 22],
];
for (const [cx, cz] of cratePositions) {
  const size = 1 + Math.random() * 1.2;
  const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), crateMat);
  crate.position.set(cx, size / 2, cz);
  crate.rotation.y = Math.random() * Math.PI;
  crate.castShadow = true;
  crate.receiveShadow = true;
  scene.add(crate);
  colliders.push({ x: cx, z: cz, hw: size / 2, hd: size / 2 });

  if (Math.random() > 0.6) {
    const s2 = size * 0.7;
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(s2, s2, s2), crateMat);
    c2.position.set(cx + (Math.random() - 0.5) * 0.3, size + s2 / 2, cz + (Math.random() - 0.5) * 0.3);
    c2.rotation.y = Math.random() * Math.PI;
    c2.castShadow = true;
    scene.add(c2);
  }
}

// ============================================================
// Gun model (assault rifle style)
// ============================================================
const gunGroup = new THREE.Group();

// Canvas texture for gun body (scratched metal)
const gunTexCanvas = document.createElement('canvas');
gunTexCanvas.width = 64;
gunTexCanvas.height = 64;
const gtctx = gunTexCanvas.getContext('2d')!;
gtctx.fillStyle = '#1a1a1a';
gtctx.fillRect(0, 0, 64, 64);
for (let i = 0; i < 200; i++) {
  const gx = Math.random() * 64, gy = Math.random() * 64;
  const gl = Math.floor(Math.random() * 15 + 20);
  gtctx.fillStyle = `rgb(${gl},${gl},${gl})`;
  gtctx.fillRect(gx, gy, Math.random() * 4, 1);
}
const gunTex = new THREE.CanvasTexture(gunTexCanvas);

const gunMetalMat = new THREE.MeshStandardMaterial({ map: gunTex, color: 0x333333, metalness: 0.95, roughness: 0.15 });
const gunDarkMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.25 });
const gunAccentMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.9, roughness: 0.2 });

// Main receiver (upper)
const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.07, 0.35), gunMetalMat);
receiver.position.set(0, 0.01, -0.05);
gunGroup.add(receiver);

// Lower receiver
const lowerReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.25), gunDarkMat);
lowerReceiver.position.set(0, -0.03, 0.0);
gunGroup.add(lowerReceiver);

// Barrel (longer, cylindrical)
const barrelOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.35, 10), gunMetalMat);
barrelOuter.rotation.x = Math.PI / 2;
barrelOuter.position.set(0, 0.015, -0.38);
gunGroup.add(barrelOuter);

// Barrel shroud / handguard
const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.05, 0.18), gunAccentMat);
handguard.position.set(0, 0.01, -0.24);
gunGroup.add(handguard);

// Handguard rail details
for (let ri = 0; ri < 3; ri++) {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.005, 0.04), gunDarkMat);
  rail.position.set(0, 0.038, -0.18 - ri * 0.05);
  gunGroup.add(rail);
}

// Muzzle brake
const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.06, 8), gunMetalMat);
muzzleBrake.rotation.x = Math.PI / 2;
muzzleBrake.position.set(0, 0.015, -0.58);
gunGroup.add(muzzleBrake);

// Magazine (curved)
const magGeo = new THREE.BoxGeometry(0.035, 0.14, 0.05);
const gunMag = new THREE.Mesh(magGeo, gunDarkMat);
gunMag.position.set(0, -0.1, -0.04);
gunMag.rotation.x = 0.08;
gunGroup.add(gunMag);

// Grip (pistol grip)
const gripGeo = new THREE.BoxGeometry(0.045, 0.12, 0.06);
const gunGrip = new THREE.Mesh(gripGeo, gunDarkMat);
gunGrip.position.set(0, -0.09, 0.08);
gunGrip.rotation.x = 0.35;
gunGroup.add(gunGrip);

// Stock
const gunStock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.2), gunAccentMat);
gunStock.position.set(0, 0.0, 0.22);
gunGroup.add(gunStock);
const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.07, 0.02),
  new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }));
stockPad.position.set(0, 0.0, 0.33);
gunGroup.add(stockPad);

// Rear sight
const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.008), gunDarkMat);
rearSight.position.set(0, 0.05, 0.06);
gunGroup.add(rearSight);

// Front sight post
const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.008), gunDarkMat);
frontSight.position.set(0, 0.045, -0.2);
gunGroup.add(frontSight);

// Red dot sight housing
const sightHousing = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.035, 0.05), gunDarkMat);
sightHousing.position.set(0, 0.055, -0.05);
gunGroup.add(sightHousing);

// Red dot
const sightDot = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6),
  new THREE.MeshBasicMaterial({ color: 0xff0000 }));
sightDot.position.set(0, 0.055, -0.076);
gunGroup.add(sightDot);

// Trigger guard
const trigGuard = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.003, 4, 8, Math.PI),
  gunDarkMat);
trigGuard.position.set(0, -0.045, 0.03);
trigGuard.rotation.z = Math.PI;
trigGuard.rotation.y = Math.PI / 2;
gunGroup.add(trigGuard);

// Muzzle flash
const muzzleFlashMat = new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0 });
const muzzleFlash = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 6), muzzleFlashMat);
muzzleFlash.rotation.x = -Math.PI / 2;
muzzleFlash.position.set(0, 0.015, -0.65);
gunGroup.add(muzzleFlash);

// Player hand (left, holding handguard)
const handMat = new THREE.MeshStandardMaterial({ color: 0x8B6E5A, roughness: 0.7 });
const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.06), handMat);
leftHand.position.set(0.04, -0.01, -0.22);
gunGroup.add(leftHand);

// Player hand (right, on grip)
const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.06), handMat);
rightHand.position.set(-0.005, -0.05, 0.06);
rightHand.rotation.x = 0.3;
gunGroup.add(rightHand);

gunGroup.position.set(0.22, -0.18, -0.35);
camera.add(gunGroup);
scene.add(camera);

let flashTimer = 0;

// ============================================================
// Particles
// ============================================================
function spawnParticles(position: THREE.Vector3, color: number, count: number, speed: number, size = 0.06) {
  for (let i = 0; i < count; i++) {
    const s = size * (0.5 + Math.random());
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 4, 4), mat);
    mesh.position.copy(position);
    scene.add(mesh);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * speed,
      Math.random() * speed * 0.8 + speed * 0.2,
      (Math.random() - 0.5) * speed,
    );
    state.particles.push({ mesh, velocity: vel, life: 0.4 + Math.random() * 0.6, maxLife: 1 });
  }
}

// ============================================================
// Enemy - GLB model loading
// ============================================================
const zombieTemplates: THREE.Group[] = [];

const gltfLoader = new GLTFLoader();
const zombieFiles = ['/zombiea.glb', '/zombieb.glb', '/zombiec.glb'];
for (const file of zombieFiles) {
  gltfLoader.load(file, (gltf) => {
    const template = new THREE.Group();
    const model = gltf.scene;
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    template.add(model);
    zombieTemplates.push(template);
    console.log(`Zombie model loaded: ${file}`);
  });
}

function createEnemy(): Enemy {
  const group = new THREE.Group();

  // Clone random GLB model or fallback to simple mesh
  if (zombieTemplates.length > 0) {
    const template = zombieTemplates[Math.floor(Math.random() * zombieTemplates.length)];
    const clone = template.clone(true);
    clone.scale.setScalar(1.0);
    clone.rotation.y = Math.PI;
    group.add(clone);
  } else {
    // Fallback: simple capsule if model not loaded yet
    const mat = new THREE.MeshStandardMaterial({ color: 0x446644, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.8, 6, 10), mat);
    body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), mat);
    head.position.y = 1.7;
    head.castShadow = true;
    group.add(head);
  }

  // Eye glow light (always added)
  const eyeColor = Math.random() > 0.3 ? 0xff2200 : 0xffee00;
  const eyeGlow = new THREE.PointLight(eyeColor, 0.5, 4);
  eyeGlow.position.set(0, 1.85, -0.17);
  group.add(eyeGlow);

  // HP bar bg
  const hpBarBg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.08),
    new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  hpBarBg.position.y = 2.4;
  group.add(hpBarBg);

  // HP bar fill
  const hpBar = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x44ff44, side: THREE.DoubleSide }),
  );
  hpBar.position.y = 2.4;
  hpBar.position.z = 0.001;
  group.add(hpBar);

  // Spawn position
  let sx: number, sz: number;
  do {
    const angle = Math.random() * Math.PI * 2;
    const dist = 25 + Math.random() * 15;
    sx = camera.position.x + Math.cos(angle) * dist;
    sz = camera.position.z + Math.sin(angle) * dist;
  } while (isInsideCollider(sx, sz, 1));

  group.position.set(sx, 0, sz);
  scene.add(group);

  const waveSpeed = 1.8 + state.wave * 0.25;
  const maxHp = 1 + Math.floor(state.wave / 3);
  return { mesh: group, hp: maxHp, maxHp, speed: waveSpeed + Math.random() * 0.5, animPhase: Math.random() * Math.PI * 2, dying: false, deathTimer: 0, hpBar, hpBarBg, glow: eyeGlow };
}

// ============================================================
// Shooting
// ============================================================
function shoot() {
  if (state.gameOver || state.reloading || state.ammo <= 0) return;
  state.ammo--;
  if (state.ammo <= 0) startReload();

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffdd44 }));
  bullet.position.copy(camera.position).add(dir.clone().multiplyScalar(1));
  scene.add(bullet);

  const trailGeo = new THREE.BufferGeometry().setFromPoints([bullet.position.clone(), bullet.position.clone().add(dir.clone().multiplyScalar(-0.5))]);
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffaa22, transparent: true, opacity: 0.6 }));
  scene.add(trail);

  state.bullets.push({ mesh: bullet, trail, velocity: dir.multiplyScalar(80), life: 1.5 });

  state.gunRecoil = 0.08;
  muzzleFlashMat.opacity = 1;
  flashTimer = 0.04;
  playerLight.intensity = 2.5;
  playerLight.position.copy(camera.position);

  playShootSound();
}

function startReload() {
  if (state.reloading || state.ammo === state.maxAmmo) return;
  state.reloading = true;
  state.reloadTimer = 1.5;
  playReloadSound();
}

// ============================================================
// HUD elements
// ============================================================
const hudScore = document.getElementById('hud-score')!;
const hudWave = document.getElementById('hud-wave')!;
const hudHpFill = document.getElementById('hud-hp-fill')!;
const hudAmmo = document.getElementById('hud-ammo')!;
const hudKills = document.querySelector('#hud-kills span')!;
const overlay = document.getElementById('overlay')!;
const autoBadge = document.getElementById('auto-badge')!;
const waveAnnounce = document.getElementById('wave-announce')!;
const comboEl = document.getElementById('combo')!;
const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
const minimapCtx = minimapCanvas.getContext('2d')!;

function updateHUD() {
  hudScore.textContent = String(state.score);
  hudWave.textContent = `WAVE ${state.wave}`;
  hudHpFill.style.width = `${Math.max(0, state.hp)}%`;
  if (state.hp > 50) hudHpFill.style.background = '#4f4';
  else if (state.hp > 25) hudHpFill.style.background = '#ff4';
  else hudHpFill.style.background = '#f44';
  hudAmmo.innerHTML = state.reloading ? '<span style="color:#ff4">RELOADING...</span>' : `<span>${state.ammo}</span> / ${state.maxAmmo}`;
  hudKills.textContent = String(state.kills);

  // Combo display
  if (state.combo > 1 && state.comboTimer > 0) {
    comboEl.style.opacity = '1';
    comboEl.textContent = `${state.combo}x COMBO`;
    comboEl.style.fontSize = `${Math.min(48, 24 + state.combo * 3)}px`;
  } else {
    comboEl.style.opacity = '0';
  }
}

function drawMinimap() {
  const ctx = minimapCtx;
  const w = 140, h = 140;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, w, h);

  const scale = 1.4; // pixels per unit
  const cx = w / 2, cy = h / 2;
  const px = camera.position.x, pz = camera.position.z;

  // Colliders
  ctx.fillStyle = 'rgba(100,100,120,0.4)';
  for (const c of colliders) {
    const rx = cx + (c.x - px) * scale;
    const ry = cy + (c.z - pz) * scale;
    const rw = c.hw * 2 * scale;
    const rh = c.hd * 2 * scale;
    if (rx + rw > 0 && rx - rw < w && ry + rh > 0 && ry - rh < h) {
      ctx.fillRect(rx - rw / 2, ry - rh / 2, rw, rh);
    }
  }

  // Enemies
  for (const e of state.enemies) {
    if (e.dying) continue;
    const ex = cx + (e.mesh.position.x - px) * scale;
    const ey = cy + (e.mesh.position.z - pz) * scale;
    if (ex > 0 && ex < w && ey > 0 && ey < h) {
      ctx.fillStyle = '#ff3333';
      ctx.fillRect(ex - 2, ey - 2, 4, 4);
    }
  }

  // Player
  ctx.fillStyle = '#44ff44';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();

  // Player direction
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  ctx.strokeStyle = '#44ff44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + dir.x * 12, cy + dir.z * 12);
  ctx.stroke();
}

// ============================================================
// Game Over / Reset
// ============================================================
function showGameOver() {
  state.gameOver = true;
  autoBadge.classList.add('hidden');
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <h1>GAME OVER</h1>
    <div class="subtitle">SCORE: ${state.score} | WAVE: ${state.wave} | KILLS: ${state.kills}</div>
    <p class="blink" style="margin-top:30px">CLICK TO RESTART</p>
    <button id="auto-play-btn" style="margin-top:20px;padding:12px 32px;font-size:16px;font-family:'Courier New',monospace;cursor:pointer;background:transparent;color:#4f4;border:1px solid #4f4;letter-spacing:2px;">AUTO PLAY</button>
  `;
  controls.unlock();
  document.getElementById('auto-play-btn')!.addEventListener('click', (e) => {
    e.stopPropagation();
    startGame(true);
  });
}

function resetGame() {
  state.score = 0;
  state.wave = 1;
  state.hp = 100;
  state.kills = 0;
  state.ammo = state.maxAmmo;
  state.reloading = false;
  state.reloadTimer = 0;
  state.gameOver = false;
  state.spawnTimer = 0;
  state.waveEnemiesLeft = 8;
  state.waveEnemiesSpawned = 0;
  state.waveAnnounceTimer = 0;
  state.gunRecoil = 0;
  state.screenShake = 0;
  state.damageFlash = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.aiShootCooldown = 0;

  for (const e of state.enemies) scene.remove(e.mesh);
  state.enemies = [];
  for (const b of state.bullets) { scene.remove(b.mesh); scene.remove(b.trail); }
  state.bullets = [];
  for (const p of state.particles) scene.remove(p.mesh);
  state.particles = [];

  camera.position.set(0, 1.6, 0);
  updateHUD();
}

function startGame(auto: boolean) {
  resetGame();
  state.autoPlay = auto;
  state.started = true;
  overlay.classList.add('hidden');
  if (auto) {
    autoBadge.classList.remove('hidden');
  } else {
    autoBadge.classList.add('hidden');
    controls.lock();
  }
  announceWave();
}

// ============================================================
// Wave management
// ============================================================
function announceWave() {
  waveAnnounce.textContent = `WAVE ${state.wave}`;
  waveAnnounce.style.opacity = '1';
  state.waveAnnounceTimer = 2;
  playWaveSound();
}

function startNextWave() {
  state.wave++;
  state.waveEnemiesLeft = 5 + state.wave * 3;
  state.waveEnemiesSpawned = 0;
  state.spawnTimer = 0;
  announceWave();
}

// ============================================================
// Input
// ============================================================
document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key in state.keys) (state.keys as Record<string, boolean>)[key] = true;
  if (key === 'r' && !state.reloading && state.ammo < state.maxAmmo) startReload();
});
document.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (key in state.keys) (state.keys as Record<string, boolean>)[key] = false;
});
document.addEventListener('mousedown', (e) => {
  if (e.button === 0 && controls.isLocked) shoot();
});
overlay.addEventListener('click', (e) => {
  if ((e.target as HTMLElement).id === 'auto-play-btn') return;
  if (!state.started || state.gameOver) startGame(false);
});
document.getElementById('auto-play-btn')!.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame(true);
});

// ============================================================
// Damage overlay
// ============================================================
const damageOverlay = document.createElement('div');
damageOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;background:radial-gradient(ellipse at center, transparent 50%, rgba(255,0,0,0.4) 100%);opacity:0;transition:opacity 0.1s;';
document.body.appendChild(damageOverlay);

// ============================================================
// AI
// ============================================================
const _aiYaw = { value: 0 };
const _aiPitch = { value: -0.1 };

function updateAI(dt: number) {
  state.aiShootCooldown -= dt;

  // Auto reload
  if (state.ammo <= 0 && !state.reloading) startReload();

  // Find nearest alive enemy
  let nearest: Enemy | null = null;
  let nearestDist = Infinity;
  for (const e of state.enemies) {
    if (e.dying) continue;
    const d = camera.position.distanceTo(e.mesh.position);
    if (d < nearestDist) { nearestDist = d; nearest = e; }
  }

  // Danger assessment
  let dangerDist = Infinity;
  const dangerDir = new THREE.Vector3();
  let nearbyCount = 0;
  for (const e of state.enemies) {
    if (e.dying) continue;
    const d = camera.position.distanceTo(e.mesh.position);
    if (d < 8) nearbyCount++;
    if (d < dangerDist) {
      dangerDist = d;
      dangerDir.subVectors(e.mesh.position, camera.position).normalize();
    }
  }

  // Movement
  const moveSpeed = 7;
  const moveDir = new THREE.Vector3();

  if (dangerDist < 4) {
    // Emergency retreat + strafe
    moveDir.sub(dangerDir);
    moveDir.x += dangerDir.z * 0.7;
    moveDir.z -= dangerDir.x * 0.7;
  } else if (nearbyCount >= 3 && dangerDist < 8) {
    // Kite when surrounded
    moveDir.sub(dangerDir);
    moveDir.x += dangerDir.z * 0.4;
    moveDir.z -= dangerDir.x * 0.4;
  } else if (nearest && nearestDist > 18) {
    const toEnemy = new THREE.Vector3().subVectors(nearest.mesh.position, camera.position);
    toEnemy.y = 0;
    toEnemy.normalize();
    moveDir.add(toEnemy);
  } else if (nearest && nearestDist > 6) {
    // Circle strafe
    const toEnemy = new THREE.Vector3().subVectors(nearest.mesh.position, camera.position);
    toEnemy.y = 0;
    toEnemy.normalize();
    moveDir.x = toEnemy.z * 0.7;
    moveDir.z = -toEnemy.x * 0.7;
    moveDir.add(toEnemy.multiplyScalar(0.15));
  }

  // Arena bounds
  if (camera.position.x > 38) moveDir.x -= 2;
  if (camera.position.x < -38) moveDir.x += 2;
  if (camera.position.z > 38) moveDir.z -= 2;
  if (camera.position.z < -38) moveDir.z += 2;

  moveDir.y = 0;
  if (moveDir.lengthSq() > 0) {
    moveDir.normalize().multiplyScalar(moveSpeed * dt);
    camera.position.x += moveDir.x;
    camera.position.z += moveDir.z;
  }

  // Aim
  if (nearest && !nearest.dying) {
    const targetPos = nearest.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const toTarget = new THREE.Vector3().subVectors(targetPos, camera.position);
    const targetYaw = Math.atan2(-toTarget.x, -toTarget.z);
    const horizDist = Math.sqrt(toTarget.x ** 2 + toTarget.z ** 2);
    const targetPitch = Math.atan2(toTarget.y, horizDist);

    const aimSpeed = 5 * dt;
    let yawDiff = targetYaw - _aiYaw.value;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    _aiYaw.value += yawDiff * aimSpeed;
    _aiPitch.value += (targetPitch - _aiPitch.value) * aimSpeed;
    _aiPitch.value = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, _aiPitch.value));

    camera.quaternion.setFromEuler(new THREE.Euler(_aiPitch.value, _aiYaw.value, 0, 'YXZ'));

    // Shoot
    const aimError = Math.abs(yawDiff);
    if (aimError < 0.12 && state.aiShootCooldown <= 0 && nearestDist < 12 && !state.reloading && state.ammo > 0) {
      shoot();
      state.aiShootCooldown = 0.18 + Math.random() * 0.12;
    }
  }
}

// ============================================================
// Game Loop
// ============================================================
const clock = new THREE.Clock();
const baseGunPos = new THREE.Vector3(0.25, -0.2, -0.4);

function update(dt: number) {
  if (!state.started || state.gameOver) return;

  // --- Control ---
  if (state.autoPlay) {
    updateAI(dt);
  } else {
    const moveSpeed = 7;
    const dir = new THREE.Vector3();
    if (state.keys.w) dir.z -= 1;
    if (state.keys.s) dir.z += 1;
    if (state.keys.a) dir.x -= 1;
    if (state.keys.d) dir.x += 1;
    dir.normalize().multiplyScalar(moveSpeed * dt);
    controls.moveRight(dir.x);
    controls.moveForward(-dir.z);
  }

  camera.position.y = 1.6;

  // --- Gun bob ---
  const isMoving = state.autoPlay ? state.enemies.some(e => !e.dying) : (state.keys.w || state.keys.a || state.keys.s || state.keys.d);
  const t = clock.elapsedTime;
  if (isMoving) {
    gunGroup.position.x = baseGunPos.x + Math.sin(t * 8) * 0.01;
    gunGroup.position.y = baseGunPos.y + Math.abs(Math.cos(t * 8)) * 0.015;
  } else {
    gunGroup.position.x = baseGunPos.x + Math.sin(t * 1.5) * 0.002;
    gunGroup.position.y = baseGunPos.y + Math.sin(t * 2) * 0.002;
  }

  // Recoil
  if (state.gunRecoil > 0) {
    state.gunRecoil *= 0.85;
    if (state.gunRecoil < 0.001) state.gunRecoil = 0;
  }
  gunGroup.rotation.x = -state.gunRecoil * 3;
  gunGroup.position.z = baseGunPos.z + state.gunRecoil;

  // Reload
  if (state.reloading) {
    state.reloadTimer -= dt;
    // Gun dip during reload
    gunGroup.position.y = baseGunPos.y - 0.08;
    if (state.reloadTimer <= 0) {
      state.ammo = state.maxAmmo;
      state.reloading = false;
    }
  }

  // Muzzle flash light
  playerLight.intensity *= 0.82;
  if (flashTimer > 0) { flashTimer -= dt; if (flashTimer <= 0) muzzleFlashMat.opacity = 0; }

  // Screen shake
  if (state.screenShake > 0) {
    camera.position.x += (Math.random() - 0.5) * state.screenShake * 0.1;
    camera.position.z += (Math.random() - 0.5) * state.screenShake * 0.1;
    state.screenShake *= 0.88;
    if (state.screenShake < 0.01) state.screenShake = 0;
  }

  // Damage flash
  if (state.damageFlash > 0) {
    state.damageFlash -= dt * 3;
    damageOverlay.style.opacity = String(Math.max(0, state.damageFlash));
  }

  // Combo decay
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }

  // Wave announce fade
  if (state.waveAnnounceTimer > 0) {
    state.waveAnnounceTimer -= dt;
    if (state.waveAnnounceTimer <= 0.5) waveAnnounce.style.opacity = String(state.waveAnnounceTimer / 0.5);
    if (state.waveAnnounceTimer <= 0) waveAnnounce.style.opacity = '0';
  }

  // Collisions + clamp
  pushOutOfColliders(camera.position, 0.5);
  camera.position.x = Math.max(-45, Math.min(45, camera.position.x));
  camera.position.z = Math.max(-45, Math.min(45, camera.position.z));

  // Fire flicker
  for (let i = 0; i < atmosLights.length; i++) {
    atmosLights[i].intensity = 0.8 + Math.random() * 0.6;
    if (fireMeshes[i]) {
      fireMeshes[i].scale.setScalar(0.8 + Math.random() * 0.4);
      fireMeshes[i].position.y = 1.0 + Math.random() * 0.1;
    }
  }

  // --- Spawn enemies ---
  if (state.waveEnemiesSpawned < state.waveEnemiesLeft) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.enemies.push(createEnemy());
      state.waveEnemiesSpawned++;
      state.spawnTimer = Math.max(0.2, 0.8 - state.wave * 0.05);
    }
  }

  // Check wave clear
  const aliveEnemies = state.enemies.filter(e => !e.dying).length;
  if (state.waveEnemiesSpawned >= state.waveEnemiesLeft && aliveEnemies === 0) {
    startNextWave();
  }

  // --- Bullets ---
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    const prevPos = b.mesh.position.clone();
    b.mesh.position.add(b.velocity.clone().multiplyScalar(dt));
    b.life -= dt;

    const positions = b.trail.geometry.attributes.position as THREE.BufferAttribute;
    positions.setXYZ(0, b.mesh.position.x, b.mesh.position.y, b.mesh.position.z);
    positions.setXYZ(1, prevPos.x, prevPos.y, prevPos.z);
    positions.needsUpdate = true;

    let hit = false;
    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const e = state.enemies[j];
      if (e.dying) continue;
      const enemyCenter = e.mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
      if (b.mesh.position.distanceTo(enemyCenter) < 1.0) {
        e.hp--;
        hit = true;
        spawnParticles(b.mesh.position.clone(), 0x44ff44, 4, 3, 0.04);
        playHitSound();

        if (e.hp <= 0) {
          // Kill
          e.dying = true;
          e.deathTimer = 0.6;
          state.kills++;
          state.combo++;
          state.comboTimer = 2;
          state.score += 100 * state.wave * Math.max(1, state.combo);
          state.screenShake = Math.max(state.screenShake, 0.3);
          spawnParticles(enemyCenter, 0x33aa33, 12, 5);
          spawnParticles(enemyCenter, 0xff2200, 6, 4);
          playKillSound();
        }
        break;
      }
    }

    if (hit || b.life <= 0) {
      scene.remove(b.mesh);
      scene.remove(b.trail);
      state.bullets.splice(i, 1);
    }
  }

  // --- Enemies ---
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];

    if (e.dying) {
      e.deathTimer -= dt;
      e.mesh.rotation.x = Math.min(Math.PI / 2, e.mesh.rotation.x + dt * 4);
      e.mesh.position.y -= dt * 1.5;
      e.glow.intensity = 0;
      e.hpBar.visible = false;
      e.hpBarBg.visible = false;
      const fadeRatio = Math.max(0, e.deathTimer / 0.6);
      e.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
          if (!mat.transparent) mat.transparent = true;
          mat.opacity = fadeRatio;
        }
      });
      if (e.deathTimer <= 0) {
        scene.remove(e.mesh);
        state.enemies.splice(i, 1);
      }
      continue;
    }

    const toPlayer = new THREE.Vector3().subVectors(camera.position, e.mesh.position);
    toPlayer.y = 0;
    const distToPlayer = toPlayer.length();
    toPlayer.normalize();

    // Movement
    if (distToPlayer > 1.8) {
      e.mesh.position.add(toPlayer.clone().multiplyScalar(e.speed * dt));
    } else if (distToPlayer < 1.0) {
      e.mesh.position.add(toPlayer.clone().multiplyScalar(-2 * dt));
    }

    pushOutOfColliders(e.mesh.position, 0.4);
    e.mesh.lookAt(camera.position.x, 0, camera.position.z);

    // Animation (whole-body since GLB is a single mesh)
    if (distToPlayer > 1.8) {
      e.animPhase += dt * e.speed * 2;
    } else {
      e.animPhase += dt * 6;
    }

    const phase = e.animPhase;
    const walking = distToPlayer > 1.8;

    // Walking bob (up/down) - applied to the group's first child (GLB model)
    const bobOffset = walking ? Math.abs(Math.sin(phase)) * 0.06 : 0;
    // Slight body sway
    e.mesh.rotation.z = Math.sin(phase * 0.8) * (walking ? 0.04 : 0.08);
    if (e.mesh.children.length > 0) {
      e.mesh.children[0].position.y = bobOffset;
    }

    // HP bar: face camera (billboard)
    e.hpBar.lookAt(camera.position);
    e.hpBarBg.lookAt(camera.position);
    // Update HP bar scale
    const hpRatio = e.hp / e.maxHp;
    e.hpBar.scale.x = Math.max(0.01, hpRatio);
    e.hpBar.position.x = -(1 - hpRatio) * 0.38; // left-align
    if (hpRatio < 0.5) (e.hpBar.material as THREE.MeshBasicMaterial).color.setHex(0xff4444);
    else (e.hpBar.material as THREE.MeshBasicMaterial).color.setHex(0x44ff44);
    // Only show HP bar if damaged
    e.hpBar.visible = e.hp < e.maxHp;
    e.hpBarBg.visible = e.hp < e.maxHp;

    // Eye glow flicker
    e.glow.intensity = 0.4 + Math.sin(Date.now() * 0.01 + e.animPhase) * 0.2;

    // Damage player
    if (distToPlayer < 2.0) {
      state.hp -= 15 * dt;
      state.damageFlash = 0.6;
      state.screenShake = Math.max(state.screenShake, 0.3);
      if (state.hp <= 0) { showGameOver(); return; }
    }
  }

  // --- Particles ---
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
    p.velocity.y -= 12 * dt;
    p.life -= dt;
    (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life / p.maxLife);
    if (p.life <= 0) { scene.remove(p.mesh); state.particles.splice(i, 1); }
  }

  updateHUD();
  drawMinimap();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  composer.render();
}

// ============================================================
// Resize
// ============================================================
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ============================================================
// Init
// ============================================================
resetGame();
animate();
