import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Item, Level, Point } from './level.ts';
import type { TraceResult } from './optics.ts';
import { ForestWalker, forestRoute, forestVisible } from './forest-path.ts';

const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.86 });
function box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.18), mat(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}
function sphere(radius: number, color: string, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), mat(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; return mesh;
}

export function fadeForestObject(root: THREE.Object3D, opacity: number): void {
  root.visible = opacity > 0.001;
  if (root.userData.forestOpacity === opacity) return;
  root.userData.forestOpacity = opacity;
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.material) return;
    mesh.userData.forestShadow ??= mesh.castShadow;
    mesh.castShadow = opacity >= 0.999 && mesh.userData.forestShadow;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      material.userData.forestOriginal ??= { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite };
      const original = material.userData.forestOriginal, transparent = original.transparent || opacity < 0.999;
      if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
      material.opacity = original.opacity * opacity;
      material.depthWrite = opacity >= 0.999 && original.depthWrite;
    }
  });
}

/** All scenery is cell-owned: a concealed cell has no geometry, shadow, or pick target. */
export class ForestStory {
  readonly root = new THREE.Group();
  private readonly cells = new Map<string, THREE.Group>();
  private readonly fades = new Map<string, { opacity: number; target: number }>();
  private readonly hero = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private readonly fire = new THREE.Group();
  private readonly embers: THREE.Mesh[] = [];
  private readonly windows = new THREE.MeshStandardMaterial({ color: '#627789', emissive: '#95b9d8', emissiveIntensity: 0.025, roughness: 0.45 });
  private readonly hearth = new THREE.PointLight('#ffd093', 0, 2.4, 2);
  private readonly fireLight = new THREE.PointLight('#ff9f6d', 1.8, 2.3, 2);
  private walker: ForestWalker;
  private visible: string[] = [];
  private trace: TraceResult | null = null;
  private lastTime: number | null = null;
  private won = false;
  private get center() { return (this.level.size + 1) / 2; }

  constructor(private readonly level: Level) {
    const start = level.items.find(item => item.kind === 'source')!;
    this.walker = new ForestWalker(start);
    this.root.add(box(level.size + 0.35, 0.24, level.size + 0.35, '#101e25', 0, -0.16, 0));
    const occupied = level.items.filter(item => !item.inInventory);
    for (let y = 1; y <= level.size; y++) for (let x = 1; x <= level.size; x++) {
      const cell = new THREE.Group(); cell.position.set(x - this.center, 0, y - this.center);
      cell.add(box(0.985, 0.12, 0.985, (x + y) % 2 ? '#30433e' : '#3e4c46', 0, 0.08, 0));
      // Small leaf clusters and grass stay decorative, never changing the ray model.
      for (let n = 0; n < 3; n++) {
        const leaf = sphere(0.045, n % 2 ? '#71836b' : '#9a8060', Math.sin(x * 23 + y * 5 + n * 11) * 0.39, 0.16, Math.cos(x * 7 + y * 19 + n * 13) * 0.39);
        leaf.scale.set(1.6, 0.18, 0.7); leaf.rotation.y = x + n * 1.7; cell.add(leaf);
      }
      if (!occupied.some(item => item.x === x && item.y === y)) {
        for (let n = 0; n < 2; n++) {
          const grass = box(0.025, 0.13 + n * 0.05, 0.035, '#728771', 0.39 - n * 0.05, 0.2, -0.36);
          grass.rotation.z = n ? 0.25 : -0.2; cell.add(grass);
        }
      }
      cell.visible = false; this.cells.set(`${x},${y}`, cell); this.fades.set(`${x},${y}`, { opacity: 0, target: 0 }); this.root.add(cell);
    }
    // A hood, scarf, tiny backpack and walking limbs make the traveller legible at board scale.
    this.hero.add(box(0.24, 0.29, 0.2, '#d29a69', 0, 0.46, 0));
    this.hero.add(sphere(0.15, '#819999', 0, 0.72, 0));
    const face = sphere(0.11, '#f0d0a6', 0, 0.7, 0.085); face.scale.z = 0.62; this.hero.add(face);
    this.hero.add(box(0.25, 0.055, 0.23, '#d1886d', 0, 0.59, 0.01));
    this.hero.add(box(0.2, 0.24, 0.1, '#627776', 0, 0.46, -0.15));
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * 0.073, 0.32, 0);
      leg.add(box(0.08, 0.15, 0.09, '#536474', 0, -0.075, 0));
      leg.add(box(0.095, 0.055, 0.145, '#443e3a', 0, -0.16, 0.02));
      this.legs.push(leg); this.hero.add(leg);
      const arm = box(0.065, 0.22, 0.085, '#d29a69', side * 0.16, 0.44, 0.025); arm.rotation.z = side * 0.14; this.hero.add(arm);
    }
    this.root.add(this.hero);
  }

  item(item: Item): THREE.Group {
    const root = new THREE.Group();
    if (item.kind === 'source') {
      for (let n = 0; n < 9; n++) {
        const angle = n * Math.PI * 2 / 9, stone = sphere(0.085, '#7b8584', Math.cos(angle) * 0.29, 0.22, Math.sin(angle) * 0.29);
        stone.scale.y = 0.75; root.add(stone);
      }
      for (const angle of [-0.65, 0.65]) {
        const log = box(0.46, 0.1, 0.1, '#705243', 0, 0.24, 0); log.rotation.y = angle; root.add(log);
      }
      for (const [n, color] of ['#ea7859', '#ffae76', '#ffe1a0'].entries()) {
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.18 - n * 0.04, 14, 12), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
        flame.scale.set(0.9, 1.8 - n * 0.15, 0.8); flame.position.set(n * 0.018, 0.47 - n * 0.045, n * 0.025);
        this.fire.add(flame);
      }
      root.add(this.fire);
      for (let n = 0; n < 5; n++) {
        const ember = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffbb85', transparent: true }));
        this.embers.push(ember); root.add(ember);
      }
      this.fireLight.position.y = 0.6; root.add(this.fireLight);
    } else if (item.kind === 'beacon') {
      root.add(box(0.91, 0.12, 0.88, '#6b7779', 0, 0.2, 0));
      // Stacked, rounded logs with a pitched roof; no lighthouse or generic beacon underneath.
      for (let row = 0; row < 5; row++) {
        for (const side of [-1, 1]) {
          root.add(box(0.83, 0.12, 0.12, row % 2 ? '#77665a' : '#887365', 0, 0.32 + row * 0.115, side * 0.32));
          root.add(box(0.12, 0.12, 0.72, '#75675f', side * 0.36, 0.32 + row * 0.115, 0));
        }
      }
      root.add(box(0.23, 0.4, 0.055, '#45545a', 0, 0.47, 0.4));
      root.add(sphere(0.018, '#bcb394', 0.07, 0.47, 0.44));
      for (const x of [-0.255, 0.255]) {
        const pane = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.19, 0.035), this.windows);
        pane.position.set(x, 0.62, 0.397); root.add(pane);
        root.add(box(0.19, 0.025, 0.055, '#9b9181', x, 0.51, 0.408));
        root.add(box(0.015, 0.19, 0.045, '#8f8475', x, 0.62, 0.422));
      }
      for (const side of [-1, 1]) {
        const roof = box(0.58, 0.095, 0.98, '#596b76', side * 0.23, 0.99, 0);
        roof.rotation.z = side * -0.55; root.add(roof);
      }
      root.add(box(0.13, 0.32, 0.15, '#7b8381', -0.24, 1.16, -0.22));
      root.add(box(0.2, 0.065, 0.22, '#a3a8a0', -0.24, 1.34, -0.22));
      this.hearth.position.set(0, 0.66, 0.52); root.add(this.hearth);
    } else if (item.name === '覆苔岩石') {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.54, 1), mat('#6e7c7e'));
      rock.scale.set(0.88, 0.75, 0.88); rock.position.y = 0.49; rock.castShadow = true; root.add(rock);
      const moss = sphere(0.23, '#607a63', -0.1, 0.73, 0.05); moss.scale.y = 0.3; root.add(moss);
    } else {
      root.add(box(0.9, 0.11, 0.9, '#354b3e', 0, 0.2, 0));
      root.add(box(0.16, 0.62, 0.16, '#756455', 0, 0.47, 0));
      for (let n = 0; n < 3; n++) {
        const foliage = new THREE.Mesh(new THREE.ConeGeometry(0.45 - n * 0.09, 0.64, 10), mat(['#36594e', '#43685b', '#537666'][n]));
        foliage.position.y = 0.67 + n * 0.28; foliage.castShadow = true; root.add(foliage);
      }
    }
    return root;
  }

  reveal(trace: TraceResult, committed: boolean): void {
    this.trace = trace; this.visible = [];
    for (const [key, cell] of this.cells) {
      const [x, y] = key.split(',').map(Number);
      const visible = forestVisible(this.level, trace, { x, y });
      this.fades.get(key)!.target = visible ? 1 : 0;
      if (visible) this.visible.push(key);
    }
    if (committed) {
      const route = forestRoute(trace), home = this.level.items.find(item => item.kind === 'beacon')!;
      const last = route.at(-1);
      // Walk around the front corner to the door, rather than through the cabin wall.
      if (last && trace.received.beacon >= this.level.threshold && Math.abs(last.y - home.y) < 1e-5 && Math.abs(last.x - home.x) > 0.5) {
        route.push({ x: last.x, y: home.y + 0.35 }, { x: home.x, y: home.y + 0.35 });
      }
      this.walker.follow(route);
    }
  }
  reset(): void {
    this.walker = new ForestWalker(this.level.items.find(item => item.kind === 'source')!);
    this.lastTime = null; this.won = false;
    for (const fade of this.fades.values()) fade.opacity = 0;
    if (this.trace) this.walker.follow(forestRoute(this.trace));
  }
  update(time: number, won: boolean): void {
    const delta = this.lastTime === null ? 0 : Math.max(0, Math.min(time - this.lastTime, 0.1)); this.lastTime = time;
    this.won = won;
    for (const [key, cell] of this.cells) {
      const fade = this.fades.get(key)!;
      // About 0.8 seconds in either direction; reversals continue from the current brightness.
      const step = time === 0 ? 1 : delta / 0.8;
      fade.opacity += Math.sign(fade.target - fade.opacity) * Math.min(Math.abs(fade.target - fade.opacity), step);
      fadeForestObject(cell, fade.opacity);
    }
    this.walker.update(delta);
    if (time === 0 && won) this.walker.finish();
    const p = this.walker.position;
    this.hero.position.set(p.x - this.center, this.walker.moving ? Math.sin(time * 12) * 0.014 : 0, p.y - this.center + 0.31);
    this.hero.rotation.y = this.walker.heading;
    fadeForestObject(this.hero, this.opacityAt(p));
    this.legs.forEach((leg, index) => { leg.rotation.x = this.walker.moving ? Math.sin(time * 10 + index * Math.PI) * 0.42 : 0; });
    this.fire.scale.set(1 + Math.sin(time * 7) * 0.045, 1 + Math.sin(time * 9) * 0.12, 1);
    this.fireLight.intensity = 1.8 + Math.sin(time * 7) * 0.15;
    this.embers.forEach((ember, index) => {
      const phase = (time * 0.6 + index * 0.21) % 1;
      ember.position.set(Math.sin(index * 3 + time) * 0.12 * phase, 0.6 + phase * 0.45, Math.cos(index * 4 + time) * 0.1);
      (ember.material as THREE.MeshBasicMaterial).opacity = 1 - phase;
    });
    this.windows.color.set(won ? '#ffdca4' : '#627789');
    this.windows.emissive.set(won ? '#ffc47c' : '#95b9d8');
    this.windows.emissiveIntensity = won ? 1.9 + Math.sin(time * 1.6) * 0.06 : 0.025;
    this.hearth.intensity = won ? 1.4 : 0;
  }
  opacityAt(point: Point): number { return this.fades.get(`${Math.round(point.x)},${Math.round(point.y)}`)?.opacity ?? 0; }
  state() {
    return { visibleCells: [...this.visible], cabinLit: this.won, windowGlow: this.windows.emissiveIntensity,
      traveller: { ...this.walker.position, moving: this.walker.moving, visible: this.hero.visible },
      visibility: [...this.fades].map(([cell, fade]) => ({ cell, ...fade })),
      trees: this.level.items.filter(item => item.name === '固定松树').length, beamColor: '#ffc0a0' };
  }
}
