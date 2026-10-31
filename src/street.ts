import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Item, Level } from './level.ts';

const surface = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.78 });
function box(parent: THREE.Group, x: number, y: number, z: number, width: number, height: number, depth: number, color: string, radius = 0.04): THREE.Mesh {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 2, radius), surface(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
  return mesh;
}
function sphere(parent: THREE.Group, x: number, y: number, z: number, radius: number, color: string): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), surface(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
}
function rod(parent: THREE.Group, x: number, y: number, z: number, radius: number, length: number, color: string): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), surface(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
}

interface Worker {
  root: THREE.Group; hips: THREE.Group; torso: THREE.Group; legs: THREE.Group[]; knees: THREE.Group[];
  arms: THREE.Group[]; forearms: THREE.Group[]; broom: THREE.Group; bowl: THREE.Group;
  bread: THREE.Mesh; x: number; z: number;
  patrol: { minX: number; maxX: number; minZ: number; maxZ: number };
  arrival: THREE.Vector3[];
  phase: 'sweeping' | 'walking-to-curb' | 'sitting-down' | 'breakfast';
}

function worker(parent: THREE.Group, x: number, z: number, alternate: boolean): Worker {
  const root = new THREE.Group(); root.position.set(x, -0.31, z); parent.add(root);
  const hips = new THREE.Group(); hips.position.y = 0.62; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const orange = alternate ? '#dc9960' : '#e18c53';
  box(torso, 0, 0.23, 0, 0.33, 0.4, 0.23, orange, 0.075);
  for (const height of [0.15, 0.33]) box(torso, 0, height, 0.123, 0.32, 0.045, 0.018, '#dde4bd', 0.008);
  box(torso, 0, 0.26, 0.135, 0.025, 0.37, 0.015, '#d5d0a8', 0.006);
  sphere(torso, 0, 0.6, 0.015, 0.145, '#dcb292');
  const cap = sphere(torso, 0, 0.69, 0, 0.157, orange); cap.scale.y = 0.48;
  box(torso, 0, 0.675, 0.13, 0.26, 0.035, 0.17, orange, 0.025);
  for (const side of [-1, 1]) sphere(torso, side * 0.047, 0.615, 0.148, 0.011, '#39414a');
  const legs: THREE.Group[] = [], knees: THREE.Group[] = [], arms: THREE.Group[] = [], forearms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.x = side * 0.09; hips.add(leg); legs.push(leg);
    box(leg, 0, -0.13, 0, 0.12, 0.27, 0.14, '#364b61', 0.045);
    const knee = new THREE.Group(); knee.position.y = -0.26; leg.add(knee); knees.push(knee);
    box(knee, 0, -0.12, 0, 0.115, 0.25, 0.13, '#364b61', 0.04);
    box(knee, 0, -0.12, 0.073, 0.105, 0.035, 0.015, '#d8dcbf', 0.006);
    box(knee, 0, -0.265, 0.035, 0.14, 0.09, 0.24, '#27384b', 0.035);
    const arm = new THREE.Group(); arm.position.set(side * 0.2, 0.39, 0); torso.add(arm); arms.push(arm);
    box(arm, 0, -0.11, 0, 0.105, 0.24, 0.115, orange, 0.045);
    box(arm, 0, -0.13, 0.065, 0.1, 0.04, 0.015, '#e7e5bf', 0.006);
    const elbow = new THREE.Group(); elbow.position.y = -0.23; arm.add(elbow); forearms.push(elbow);
    box(elbow, 0, -0.1, 0, 0.09, 0.2, 0.1, orange, 0.035);
    sphere(elbow, 0, -0.205, 0, 0.057, '#ddb99a');
  }
  const broom = new THREE.Group(); broom.position.set(0.27, 0.68, 0.2); root.add(broom);
  rod(broom, 0, 0, 0, 0.018, 1.12, '#bc9c73');
  box(broom, 0, -0.56, 0, 0.34, 0.1, 0.14, '#b89c66', 0.02);
  for (let index = 0; index < 7; index++) rod(broom, -0.15 + index * 0.05, -0.62, 0, 0.016, 0.11, '#cfb77d');
  const bowl = new THREE.Group(); bowl.position.set(-0.02, -0.2, 0.055); forearms[0].add(bowl);
  const bowlMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.07, 0.11, 20), surface('#e6e1cb'));
  bowlMesh.position.y = 0.035; bowl.add(bowlMesh);
  const soup = new THREE.Mesh(new THREE.CircleGeometry(0.102, 20), surface('#d7b97d'));
  soup.rotation.x = -Math.PI / 2; soup.position.y = 0.093; bowl.add(soup);
  const bread = sphere(forearms[1], 0, -0.21, 0.04, 0.08, '#e8c98f'); bread.scale.set(0.85, 1.3, 0.85);
  return {
    root, hips, torso, legs, knees, arms, forearms, broom, bowl, bread, x, z,
    patrol: alternate ? { minX: 4.17, maxX: 4.33, minZ: -2.15, maxZ: 0.65 } : { minX: -4.33, maxX: -4.17, minZ: 3.05, maxZ: 4.45 },
    arrival: [], phase: 'sweeping',
  };
}

function followPath(points: THREE.Vector3[], distance: number): { position: THREE.Vector3; heading: number } {
  for (let index = 1; index < points.length; index++) {
    const start = points[index - 1], end = points[index];
    const length = start.distanceTo(end);
    if (distance <= length || index === points.length - 1) {
      return { position: start.clone().lerp(end, Math.min(distance / Math.max(length, 0.001), 1)), heading: Math.atan2(end.x - start.x, end.z - start.z) };
    }
    distance -= length;
  }
  return { position: points[0].clone(), heading: 0 };
}

function building(parent: THREE.Group, x: number, z: number, height: number, color: string, index: number): void {
  const house = new THREE.Group(); house.position.set(x, -0.4, z); parent.add(house);
  box(house, 0, height / 2, 0, 1.4, height, 1.15, color, 0.12);
  box(house, 0, height + 0.035, 0, 1.52, 0.15, 1.26, '#74849a', 0.055);
  for (let floor = 0; floor < 3; floor++) for (const column of [-0.34, 0.34]) {
    const window = box(house, column, 0.48 + floor * 0.64, 0.59, 0.32, 0.4, 0.025, (floor + index + (column > 0 ? 1 : 0)) % 3 ? '#263b55' : '#c9b98e', 0.025);
    const windowMaterial = window.material as THREE.MeshStandardMaterial;
    if ((floor + index + (column > 0 ? 1 : 0)) % 3 === 0) { windowMaterial.emissive.set('#e9c78d'); windowMaterial.emissiveIntensity = 0.35; }
    box(house, column, 0.48 + floor * 0.64, 0.61, 0.018, 0.4, 0.02, '#9aa7b6', 0.004);
  }
  box(house, 0, 0.29, 0.61, 0.28, 0.55, 0.035, '#34465a', 0.035);
}

export function streetBlock(item: Item): THREE.Group {
  const group = new THREE.Group();
  if (item.name === '固定花箱') {
    box(group, 0, 0.45, 0, 0.91, 0.58, 0.91, '#788b8f', 0.08);
    box(group, 0, 0.76, 0, 0.94, 0.09, 0.94, '#a8b8b1', 0.04);
    box(group, 0, 0.8, 0, 0.76, 0.035, 0.76, '#5b5147', 0.015);
    for (const [x, z] of [[-0.21, -0.19], [0.2, -0.13], [-0.06, 0.23]]) {
      const shrub = sphere(group, x, 0.91, z, 0.24, '#708c7f'); shrub.scale.y = 0.62;
    }
  } else {
    box(group, 0, 0.27, 0, 0.91, 0.22, 0.91, '#748596', 0.055);
    box(group, 0, 0.6, 0, 0.89, 0.48, 0.85, '#a2937d', 0.05);
    for (const side of [-1, 1]) {
      box(group, side * 0.31, 0.6, 0.435, 0.12, 0.47, 0.018, '#ddd4b3', 0.008);
      box(group, side * 0.31, 0.6, -0.435, 0.12, 0.47, 0.018, '#ddd4b3', 0.008);
    }
    box(group, 0, 0.87, 0, 0.94, 0.07, 0.92, '#d7ba81', 0.025);
  }
  return group;
}

/** The street story is decorative; only the shared optics and WinGate activate breakfast. */
export class StreetStory {
  readonly root = new THREE.Group();
  private readonly workers: Worker[] = [];
  private readonly womanArm = new THREE.Group();
  private readonly breakfastLight = new THREE.PointLight('#ffe6b6', 0, 5, 1.4);
  private readonly pool: THREE.Mesh;
  private wonAt: number | null = null;
  private progress = 0;
  private victorious = false;
  private leafCount = 0;
  private patrolStartedAt: number | null = null;
  private previousTime: number | null = null;

  constructor(level: Level) {
    const source = level.items.find(item => item.kind === 'source')!;
    const receiver = level.items.find(item => item.kind === 'beacon')!;
    // Residents' buildings stay behind the board, leaving every square accessible.
    for (const [index, [x, z, height, color]] of ([[-3.5, -5.1, 2.3, '#59677e'], [-1.7, -5.5, 2.9, '#646c82'], [0.2, -5.35, 2.45, '#556d7c'], [2.1, -5.2, 2.75, '#687182'], [4.05, -5.15, 2.3, '#5a6e83']] as const).entries()) building(this.root, x, z, height, color, index);
    box(this.root, 0, -0.36, -4.15, 12.2, 0.18, 0.6, '#627486', 0.07);
    // A narrow sidewalk leaves an open road in front and a curb to sit on after victory.
    box(this.root, 0, -0.35, 4.15, 7.65, 0.18, 0.7, '#617082', 0.08);
    for (const side of [-1, 1]) for (let dash = 0; dash < 6; dash++) box(this.root, side * 4.55, -0.48, dash * 1.55 - 4.3, 0.065, 0.012, 0.7, '#b9bcaf', 0.008);
    for (let index = 0; index < 4; index++) box(this.root, -2.6 + index * 0.66, -0.49, 4.98, 0.31, 0.015, 0.82, '#b1b9ba', 0.008);
    this.createBalcony(source.x - 4, source.y - 4);
    for (const [x, z] of [[-5.1, -1.8], [5.1, 1.6]]) {
      rod(this.root, x, 0.25, z, 0.085, 1.5, '#806f5d');
      for (const [dx, dy, dz] of [[0, 0, 0], [-0.24, 0.06, 0.07], [0.24, 0.15, -0.06]]) {
        const crown = sphere(this.root, x + dx, 1.17 + dy, z + dz, 0.48, '#6d8073'); crown.scale.y = 0.85;
      }
      box(this.root, x, -0.35, z, 0.9, 0.2, 0.86, '#7d8a8a', 0.1);
    }
    for (let index = 0; index < 53; index++) {
      const x = index < 28 ? Math.sin(index * 13.7) * 3.35 : Math.sin(index * 17.1) * 5.2;
      const z = index < 28 ? Math.cos(index * 7.3) * 3.35 : 4.2 + Math.cos(index * 3.1) * 0.48;
      const leaf = sphere(this.root, x, index < 28 ? 0.165 : z > 4.5 ? -0.49 : -0.23, z, 0.09, ['#b99b65', '#a78a62', '#b8aa7b'][index % 3]);
      leaf.scale.set(1.35, 0.08, 0.6); leaf.rotation.y = index * 2.3;
      this.leafCount++;
    }
    const targetX = receiver.x - 4, targetZ = receiver.y - 4;
    this.workers.push(worker(this.root, targetX - 0.35, targetZ + 1.42, false), worker(this.root, targetX + 0.7, targetZ + 1.42, true));
    this.breakfastLight.position.set(targetX + 0.15, 1.1, targetZ + 1.42); this.root.add(this.breakfastLight);
    this.pool = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), new THREE.MeshBasicMaterial({ color: '#f1dca6', transparent: true, opacity: 0, depthWrite: false }));
    this.pool.rotation.x = -Math.PI / 2; this.pool.position.set(targetX + 0.2, -0.49, targetZ + 1.65); this.root.add(this.pool);
  }

  private createBalcony(x: number, z: number): void {
    const balcony = new THREE.Group(); balcony.position.set(x - 0.95, -0.35, z - 0.2); this.root.add(balcony);
    box(balcony, -0.13, 1.1, -0.24, 1.15, 2.4, 0.86, '#69738a', 0.1);
    box(balcony, -0.1, 1.8, 0.205, 0.73, 0.54, 0.035, '#263a54', 0.035);
    box(balcony, -0.1, 0.91, 0.21, 0.7, 0.67, 0.03, '#a59e8a', 0.025);
    box(balcony, 0.16, 0.64, 0.43, 1.52, 0.1, 0.85, '#b4b8b0', 0.045);
    // A visible ceiling edge supports the pendant without hiding the resident in the overhead view.
    box(balcony, 0.25, 1.92, 0.2, 1.6, 0.08, 0.11, '#a5afb9', 0.03);
    box(balcony, 0.95, 1.92, 0.02, 0.09, 0.08, 0.36, '#a5afb9', 0.025);
    for (const sx of [-0.49, -0.18, 0.14, 0.46]) rod(balcony, sx, 0.86, 0.85, 0.018, 0.39, '#8fa1b4');
    rod(balcony, -0.6, 0.86, 0.56, 0.018, 0.39, '#8fa1b4');
    box(balcony, -0.05, 1.06, 0.85, 1.16, 0.035, 0.035, '#c1c9cb', 0.012);
    const woman = new THREE.Group(); woman.position.set(-0.12, 0.69, 0.45); woman.rotation.y = 0.22; balcony.add(woman);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.43, 20), surface('#b09ea9')); skirt.position.y = 0.28; woman.add(skirt);
    box(woman, 0, 0.54, 0, 0.28, 0.27, 0.2, '#bca6ae', 0.07);
    sphere(woman, 0, 0.8, -0.045, 0.165, '#474553');
    sphere(woman, 0, 0.78, 0.035, 0.137, '#dfbca1');
    const hair = sphere(woman, -0.02, 0.89, 0.01, 0.145, '#494552'); hair.scale.y = 0.55;
    for (const side of [-1, 1]) sphere(woman, side * 0.041, 0.79, 0.164, 0.009, '#484752');
    this.womanArm.position.set(0.17, 0.61, 0); woman.add(this.womanArm);
    box(this.womanArm, 0, -0.11, 0, 0.1, 0.23, 0.11, '#bca6ae', 0.04);
    sphere(this.womanArm, 0, -0.24, 0.02, 0.049, '#dfbca1');
    box(woman, -0.17, 0.51, 0.07, 0.09, 0.26, 0.1, '#bca6ae', 0.035);
    const light = new THREE.PointLight('#ffe0ac', 0.7, 2.8, 1.7); light.position.set(0.6, 1.12, 0.5); balcony.add(light);
  }

  update(time: number, won: boolean): void {
    const delta = this.previousTime === null ? 0.1 : Math.max(0, Math.min(0.1, time - this.previousTime));
    this.previousTime = time;
    if (this.patrolStartedAt === null || (!won && this.victorious)) this.patrolStartedAt = time;
    if (!won) { this.wonAt = null; this.workers.forEach(actor => actor.arrival = []); }
    else if (this.wonAt === null) {
      this.wonAt = time;
      for (const actor of this.workers) {
        const start = actor.root.position.clone();
        // Both patrol areas open onto the front road; the route stays outside the board and buildings.
        actor.arrival = [start, new THREE.Vector3(start.x, -0.56, 4.9)];
        actor.arrival.push(new THREE.Vector3(actor.x, -0.56, 4.9), new THREE.Vector3(actor.x, -0.31, actor.z));
      }
    }
    this.victorious = won;
    this.progress = won ? 1 : 0;
    for (const [index, actor] of this.workers.entries()) {
      const sweep = Math.sin(time * 1.65 + index * 1.7);
      let p = 0, heading = 0;
      if (!won) {
        const angle = (time - this.patrolStartedAt!) * 0.32 + index * 1.8;
        const area = actor.patrol, radiusX = (area.maxX - area.minX) / 2, radiusZ = (area.maxZ - area.minZ) / 2;
        actor.root.position.set((area.minX + area.maxX) / 2 + Math.cos(angle) * radiusX, -0.56, (area.minZ + area.maxZ) / 2 + Math.sin(angle) * radiusZ);
        heading = Math.atan2(-Math.sin(angle) * radiusX, Math.cos(angle) * radiusZ);
        actor.phase = 'sweeping';
      } else {
        const distance = actor.arrival.reduce((sum, point, index, points) => index ? sum + points[index - 1].distanceTo(point) : sum, 0);
        const walkSeconds = distance / 1.6;
        const elapsed = Math.max(0, time - this.wonAt!);
        const seated = time === 0 ? 1 : THREE.MathUtils.clamp((elapsed - walkSeconds) / 0.95, 0, 1);
        p = seated * seated * (3 - 2 * seated);
        const step = followPath(actor.arrival, Math.min(elapsed * 1.6, distance));
        actor.root.position.copy(time === 0 ? actor.arrival[actor.arrival.length - 1] : step.position);
        heading = seated > 0 || time === 0 ? 0 : step.heading;
        actor.phase = seated === 1 ? 'breakfast' : elapsed < walkSeconds ? 'walking-to-curb' : 'sitting-down';
        this.progress = Math.min(this.progress, seated);
      }
      const turn = THREE.MathUtils.euclideanModulo(heading - actor.root.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      actor.root.rotation.y += time === 0 ? turn : turn * (1 - Math.exp(-delta * 7));
      const walking = actor.phase === 'walking-to-curb';
      const stride = Math.sin(time * (walking ? 10 : 5) + index * 2) * (walking ? 0.5 : 0.12);
      const eat = actor.phase === 'breakfast' ? Math.sin(time * 2 + index * 0.8) * 0.12 : 0;
      actor.hips.position.y = THREE.MathUtils.lerp(0.62, 0.13, p);
      actor.torso.rotation.x = (1 - p) * (walking ? 0.04 : 0.28);
      actor.legs.forEach((leg, index) => leg.rotation.x = -p * 1.3 + (1 - p) * stride * (index ? -1 : 1));
      actor.knees.forEach((knee, index) => knee.rotation.x = p * 0.55 + (1 - p) * Math.max(0, stride * (index ? 1 : -1)) * 0.7);
      actor.arms[0].rotation.x = (1 - p) * (walking ? stride * 0.5 : -0.34 + sweep * 0.1) - p * 0.66;
      actor.arms[1].rotation.x = (1 - p) * (walking ? -0.15 : -0.55 - sweep * 0.12) - p * (0.55 + eat);
      actor.forearms[0].rotation.x = -p * 1.6;
      actor.forearms[1].rotation.x = -p * (1.75 + eat);
      actor.broom.position.x = 0.27 + p * 0.24;
      actor.broom.rotation.z = (1 - p) * (walking ? -0.15 : 0.24 + sweep * 0.16) + p * -0.18;
      actor.broom.rotation.x = (1 - p) * (walking ? -0.08 : -0.35);
      actor.bowl.visible = p > 0.7; actor.bread.visible = p > 0.7;
    }
    this.womanArm.rotation.x = won ? -1.75 : -0.45;
    this.womanArm.rotation.z = won ? 0.2 + Math.sin(time * 1.7) * 0.12 : -0.15;
    this.breakfastLight.intensity = won ? 3.4 : 0;
    (this.pool.material as THREE.MeshBasicMaterial).opacity = won ? 0.12 : 0;
  }

  state() {
    return {
      workers: !this.victorious ? 'sweeping' : this.workers.some(actor => actor.phase === 'walking-to-curb') ? 'walking-to-curb' : this.progress < 1 ? 'sitting-down' : 'breakfast',
      progress: this.progress, leaves: this.leafCount, woman: true,
      poses: this.workers.map(actor => ({ hipHeight: actor.hips.position.y, legAngle: actor.legs[0].rotation.x, bowlVisible: actor.bowl.visible, breadVisible: actor.bread.visible, position: actor.root.position.toArray(), phase: actor.phase, patrolBounds: { ...actor.patrol }, curb: { x: actor.x, z: actor.z } })),
    };
  }
}
