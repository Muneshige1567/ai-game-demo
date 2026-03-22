import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ============================================================
// Types
// ============================================================
interface Enemy {
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  speed: number;
  animPhase: number;
  dying: boolean;
  deathTimer: number;
}
interface Bullet {
  mesh: THREE.Mesh;
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
  spawnTimer: 0,
  waveEnemiesLeft: 0,
  waveEnemiesSpawned: 0,
  keys: { w: false, a: false, s: false, d: false, r: false },
  gunRecoil: 0,
  aiShootCooldown: 0,
};

// ============================================================
// Scene
// ============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.FogExp2(0x1a1a2e, 0.012);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 1.6, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new PointerLockControls(camera, document.body);

// ============================================================
// Lighting
// ============================================================
scene.add(new THREE.AmbientLight(0x445566, 1.2));

const dirLight = new THREE.DirectionalLight(0x6688cc, 1.3);
dirLight.position.set(20, 40, -10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 120;
dirLight.shadow.camera.left = -50;
dirLight.shadow.camera.right = 50;
dirLight.shadow.camera.top = 50;
dirLight.shadow.camera.bottom = -50;
scene.add(dirLight);

const playerLight = new THREE.PointLight(0xff6633, 0, 12);
scene.add(playerLight);

// ============================================================
// Ground
// ============================================================
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: 0x3a3a4a, roughness: 0.85 }),
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
const crateMat = new THREE.MeshStandardMaterial({ color: 0x665533, roughness: 0.85 });

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
// Gun model (simple box-based)
// ============================================================
const gunGroup = new THREE.Group();

const gunMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 });
const gunDarkMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.25 });

// Receiver
const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.07, 0.35), gunMat);
receiver.position.set(0, 0.01, -0.05);
gunGroup.add(receiver);

// Barrel
const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.35, 10), gunMat);
barrel.rotation.x = Math.PI / 2;
barrel.position.set(0, 0.015, -0.38);
gunGroup.add(barrel);

// Magazine
const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.14, 0.05), gunDarkMat);
mag.position.set(0, -0.1, -0.04);
mag.rotation.x = 0.08;
gunGroup.add(mag);

// Grip
const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.06), gunDarkMat);
grip.position.set(0, -0.09, 0.08);
grip.rotation.x = 0.35;
gunGroup.add(grip);

// Stock
const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.2), gunMat);
stock.position.set(0, 0.0, 0.22);
gunGroup.add(stock);

// Muzzle flash
const muzzleFlashMat = new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0 });
const muzzleFlash = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 6), muzzleFlashMat);
muzzleFlash.rotation.x = -Math.PI / 2;
muzzleFlash.position.set(0, 0.015, -0.58);
gunGroup.add(muzzleFlash);

gunGroup.position.set(0.22, -0.18, -0.35);
camera.add(gunGroup);
scene.add(camera);

let flashTimer = 0;

// ============================================================
// Enemy (simple capsule + sphere)
// ============================================================
function createEnemy(): Enemy {
  const group = new THREE.Group();

  const mat = new THREE.MeshStandardMaterial({ color: 0x446644, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.8, 6, 10), mat);
  body.position.y = 1.0;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), mat);
  head.position.y = 1.7;
  head.castShadow = true;
  group.add(head);

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
  return { mesh: group, hp: maxHp, maxHp, speed: waveSpeed + Math.random() * 0.5, animPhase: Math.random() * Math.PI * 2, dying: false, deathTimer: 0 };
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

  state.bullets.push({ mesh: bullet, velocity: dir.multiplyScalar(80), life: 1.5 });

  state.gunRecoil = 0.08;
  muzzleFlashMat.opacity = 1;
  flashTimer = 0.04;
  playerLight.intensity = 2.5;
  playerLight.position.copy(camera.position);
}

function startReload() {
  if (state.reloading || state.ammo === state.maxAmmo) return;
  state.reloading = true;
  state.reloadTimer = 1.5;
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

function updateHUD() {
  hudScore.textContent = String(state.score);
  hudWave.textContent = `WAVE ${state.wave}`;
  hudHpFill.style.width = `${Math.max(0, state.hp)}%`;
  if (state.hp > 50) hudHpFill.style.background = '#4f4';
  else if (state.hp > 25) hudHpFill.style.background = '#ff4';
  else hudHpFill.style.background = '#f44';
  hudAmmo.innerHTML = state.reloading ? '<span style="color:#ff4">RELOADING...</span>' : `<span>${state.ammo}</span> / ${state.maxAmmo}`;
  hudKills.textContent = String(state.kills);
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
  state.gunRecoil = 0;
  state.aiShootCooldown = 0;

  for (const e of state.enemies) scene.remove(e.mesh);
  state.enemies = [];
  for (const b of state.bullets) scene.remove(b.mesh);
  state.bullets = [];

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
}

// ============================================================
// Wave management
// ============================================================
function startNextWave() {
  state.wave++;
  state.waveEnemiesLeft = 5 + state.wave * 3;
  state.waveEnemiesSpawned = 0;
  state.spawnTimer = 0;
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
    gunGroup.position.y = baseGunPos.y - 0.08;
    if (state.reloadTimer <= 0) {
      state.ammo = state.maxAmmo;
      state.reloading = false;
    }
  }

  // Muzzle flash light
  playerLight.intensity *= 0.82;
  if (flashTimer > 0) { flashTimer -= dt; if (flashTimer <= 0) muzzleFlashMat.opacity = 0; }

  // Collisions + clamp
  pushOutOfColliders(camera.position, 0.5);
  camera.position.x = Math.max(-45, Math.min(45, camera.position.x));
  camera.position.z = Math.max(-45, Math.min(45, camera.position.z));

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
    b.mesh.position.add(b.velocity.clone().multiplyScalar(dt));
    b.life -= dt;

    let hit = false;
    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const e = state.enemies[j];
      if (e.dying) continue;
      const enemyCenter = e.mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
      if (b.mesh.position.distanceTo(enemyCenter) < 1.0) {
        e.hp--;
        hit = true;

        if (e.hp <= 0) {
          e.dying = true;
          e.deathTimer = 0.6;
          state.kills++;
          state.score += 100 * state.wave;
        }
        break;
      }
    }

    if (hit || b.life <= 0) {
      scene.remove(b.mesh);
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
      const fadeRatio = Math.max(0, e.deathTimer / 0.6);
      e.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
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

    // Simple walk animation
    if (distToPlayer > 1.8) {
      e.animPhase += dt * e.speed * 2;
    } else {
      e.animPhase += dt * 6;
    }
    e.mesh.rotation.z = Math.sin(e.animPhase * 0.8) * (distToPlayer > 1.8 ? 0.04 : 0.08);
    if (e.mesh.children.length > 0) {
      const bobOffset = distToPlayer > 1.8 ? Math.abs(Math.sin(e.animPhase)) * 0.06 : 0;
      e.mesh.children[0].position.y = 1.0 + bobOffset;
    }

    // Damage player
    if (distToPlayer < 2.0) {
      state.hp -= 15 * dt;
      if (state.hp <= 0) { showGameOver(); return; }
    }
  }

  updateHUD();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);
  renderer.render(scene, camera);
}

// ============================================================
// Resize
// ============================================================
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ============================================================
// Init
// ============================================================
resetGame();
animate();
