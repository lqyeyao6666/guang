import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Item, Level } from './level.ts';
import { cowAtHome } from './rural-rules.ts';
import { RuralCrowd } from './rural-crowd.ts';

const surface = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
function box(parent: THREE.Group, w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.19), surface(color));
  mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function ball(parent: THREE.Group, r: number, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), surface(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
}
function rod(parent: THREE.Group, radius: number, h: number, color: string, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, h, 10), surface(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
}
export class RuralStory {
  readonly root = new THREE.Group();
  private readonly crowd = new RuralCrowd();
  private readonly cows = new Map<string, { head: THREE.Group; legs: THREE.Group[] }>();
  private readonly reels: THREE.Group[] = [];
  private readonly canvas = document.createElement('canvas');
  private readonly film: THREE.CanvasTexture;
  private readonly cloth: THREE.MeshStandardMaterial;
  private readonly screenLight = new THREE.PointLight('#f4dca8', 0, 5, 2);
  private level: Level;
  private won = false;
  private paintedFrame = -1;
  private get center() { return (this.level.size + 1) / 2; }

  constructor(level: Level) {
    this.level = level;
    this.canvas.width = 480; this.canvas.height = 300;
    this.film = new THREE.CanvasTexture(this.canvas); this.film.colorSpace = THREE.SRGBColorSpace;
    this.cloth = new THREE.MeshStandardMaterial({ color: '#b0b7b7', map: this.film, emissiveMap: this.film, emissive: '#ffe7b5', emissiveIntensity: 0, roughness: 0.85, side: THREE.DoubleSide });
    this.paint(0, false);
    // Fields and low village houses remain outside the playable grid.
    for (const side of [-1]) {
      box(this.root, 2.0, 0.15, 7.0, '#374c46', side * 5.75, -0.4, 0);
      for (let row = 0; row < 11; row++) for (let col = 0; col < 3; col++) {
        const x = side * 5.75 - 0.65 + col * 0.64, z = -3 + row * 0.57;
        const stem = rod(this.root, 0.012, 0.26, '#8c966d', x, -0.2, z);
        stem.rotation.z = Math.sin(row * 7 + col) * 0.15;
        const rice = ball(this.root, 0.045, '#b8ab74', x + 0.02, -0.04, z); rice.scale.set(0.6, 1.6, 0.6);
      }
    }
    box(this.root, 7.0, 0.15, 1.8, '#374c46', 0, -0.4, 5.7);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 12; col++) {
      const x = -3.1 + col * 0.56, z = 5.15 + row * 0.54;
      rod(this.root, 0.012, 0.26, '#8c966d', x, -0.2, z);
      const rice = ball(this.root, 0.045, '#b8ab74', x + 0.02, -0.04, z); rice.scale.set(0.6, 1.6, 0.6);
    }
    for (const [i, [x, z]] of [[-4.7, -6], [-1.3, -6.0], [2.4, -6.2], [5.5, -5.4]].entries()) {
      const house = new THREE.Group(); house.position.set(x, -0.43, z); this.root.add(house);
      box(house, 1.9, 1.25, 1.4, i % 2 ? '#8c9691' : '#c0b7a2', 0, 0.62, 0);
      for (const side of [-1, 1]) {
        const roof = box(house, 1.2, 0.12, 1.7, '#65727c', side * 0.46, 1.48, 0); roof.rotation.z = -side * 0.48;
      }
      box(house, 0.35, 0.7, 0.045, '#3d505a', 0, 0.36, 0.72);
      for (const side of [-1, 1]) {
        const window = box(house, 0.35, 0.34, 0.035, '#c4bb90', side * 0.57, 0.77, 0.72);
        (window.material as THREE.MeshStandardMaterial).emissive.set('#b0a46c');
        (window.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12;
      }
    }
    // A two-by-two pen, open at the gate leading to the marked entrance square.
    const pen = new THREE.Group(); pen.position.set(1.5 - this.center, 0, 1.5 - this.center); this.root.add(pen);
    box(pen, 1.95, 0.025, 1.95, '#66725a', 0, 0.165, 0);
    for (const z of [-1, 1]) for (const x of [-1, 0, 1]) {
      if (z === 1 && x === 0) continue;
      rod(pen, 0.035, 0.63, '#b6a482', x, 0.45, z);
    }
    for (const y of [0.35, 0.65]) {
      box(pen, 2.05, 0.055, 0.055, '#a7a087', 0, y, -1);
      box(pen, 0.055, 0.055, 2.05, '#a7a087', -1, y, 0);
      box(pen, 0.055, 0.055, 2.05, '#a7a087', 1, y, 0);
      box(pen, 1.0, 0.055, 0.055, '#a7a087', -0.5, y, 1);
    }
    const gate = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.28, 32), new THREE.MeshBasicMaterial({ color: '#c7ba83', transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    gate.rotation.x = -Math.PI / 2; gate.position.set(2 - this.center, 0.17, 3 - this.center); this.root.add(gate);
    this.root.add(this.crowd.root);
  }

  item(item: Item): THREE.Group {
    const root = new THREE.Group();
    if (item.kind === 'cow') {
      const flower = item.id === 'cow-flower', fur = flower ? '#dedfd2' : '#b99068';
      const body = ball(root, 0.36, fur, -0.04, 0.56, 0); body.scale.set(1.1, 0.76, 0.66);
      const head = new THREE.Group(); head.position.set(0.31, 0.68, 0); root.add(head);
      const skull = ball(head, 0.17, fur, 0, 0, 0); skull.scale.set(0.8, 1.0, 0.9);
      box(head, 0.21, 0.16, 0.27, flower ? '#caab9e' : '#c6a78a', 0.12, -0.13, 0);
      for (const side of [-1, 1]) {
        ball(head, 0.021, '#35454b', 0.07, 0.035, side * 0.145);
        ball(head, 0.012, '#695c52', 0.23, -0.12, side * 0.065);
        const ear = ball(head, 0.073, fur, -0.07, 0.09, side * 0.19); ear.scale.set(1, 0.42, 0.8);
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.033, 0.15, 10), surface('#d9cda9'));
        horn.position.set(-0.06, 0.18, side * 0.1); horn.rotation.z = 0.18; head.add(horn);
      }
      if (flower) for (let n = 0; n < 5; n++) {
        const patch = ball(root, 0.12, '#59645f', -0.24 + n % 3 * 0.16, 0.62 + n % 2 * 0.12, n % 2 ? -0.19 : 0.2); patch.scale.set(1, 0.75, 0.24);
      }
      const legs: THREE.Group[] = [];
      for (const x of [-0.25, 0.19]) for (const z of [-0.14, 0.14]) {
        const leg = new THREE.Group(); leg.position.set(x, 0.4, z); root.add(leg); legs.push(leg);
        rod(leg, 0.039, 0.25, fur, 0, -0.125, 0); box(leg, 0.09, 0.065, 0.09, '#59605c', 0, -0.25, 0);
      }
      const tail = rod(root, 0.017, 0.28, fur, -0.44, 0.52, 0); tail.rotation.z = -0.3;
      ball(root, 0.041, '#62625a', -0.48, 0.38, 0);
      this.cows.set(item.id, { head, legs });
    } else if (item.kind === 'hay') {
      const hay = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.4, 0.5, 18), surface('#bd9c5d')); hay.position.y = 0.41; root.add(hay);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.3, 18), surface('#ccb16f')); cap.position.y = 0.78; root.add(cap);
      for (const y of [0.3, 0.56]) {
        const tie = new THREE.Mesh(new THREE.TorusGeometry(y < 0.4 ? 0.37 : 0.32, 0.017, 6, 32), surface('#817355'));
        tie.rotation.x = Math.PI / 2; tie.position.y = y; root.add(tie);
      }
      for (let n = 0; n < 14; n++) {
        const angle = n * Math.PI * 2 / 14, strand = rod(root, 0.008, 0.42, n % 2 ? '#dfc78d' : '#a68b55', Math.cos(angle) * 0.345, 0.43, Math.sin(angle) * 0.345);
        strand.rotation.z = Math.cos(angle) * -0.15; strand.rotation.x = Math.sin(angle) * 0.15;
      }
    } else if (item.kind === 'source') {
      box(root, 0.57, 0.34, 0.4, '#607782', -0.07, 0.6, 0);
      const lens = rod(root, 0.12, 0.26, '#a4b3b5', 0.32, 0.6, 0); lens.rotation.z = Math.PI / 2;
      const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.095, 20), new THREE.MeshBasicMaterial({ color: '#fff6db', side: THREE.DoubleSide, toneMapped: false }));
      bulb.rotation.y = Math.PI / 2; bulb.position.set(0.455, 0.6, 0); root.add(bulb);
      for (const x of [-0.24, 0.1]) {
        const reel = new THREE.Group(); reel.position.set(x, 0.96, 0); root.add(reel); this.reels.push(reel);
        const disk = rod(reel, 0.185, 0.07, '#a5b2b3', 0, 0, 0); disk.rotation.x = Math.PI / 2;
        for (let n = 0; n < 5; n++) {
          const a = n * Math.PI * 2 / 5;
          const hole = new THREE.Mesh(new THREE.CircleGeometry(0.036, 12), new THREE.MeshBasicMaterial({ color: '#415761', side: THREE.DoubleSide }));
          hole.position.set(Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.04); reel.add(hole);
        }
      }
      rod(root, 0.035, 0.37, '#9aa7a4', 0, 0.3, 0);
      for (let n = 0; n < 3; n++) { const leg = box(root, 0.06, 0.25, 0.06, '#899b9e', Math.sin(n * 2.094) * 0.16, 0.2, Math.cos(n * 2.094) * 0.16); leg.rotation.z = Math.sin(n * 2.094) * 0.4; }
    } else if (item.kind === 'beacon') {
      for (const z of [-0.92, 0.92]) rod(root, 0.025, 1.4, '#a8a791', 0, 0.86, z);
      const bar = box(root, 0.055, 0.06, 2.0, '#bdbda7', 0, 1.47, 0);
      bar.castShadow = false;
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.08), this.cloth);
      cloth.rotation.y = Math.PI / 2; cloth.position.set(0, 0.88, 0); root.add(cloth);
      box(root, 0.045, 0.035, 1.75, '#c5c6b3', 0, 0.33, 0);
      this.screenLight.position.set(-0.1, 0.9, 0); root.add(this.screenLight);
    } else {
      box(root, 0.9, 0.13, 0.9, '#596354', 0, 0.22, 0);
      if (item.name === '固定矮石墙') {
        for (let row = 0; row < 2; row++) for (let n = 0; n < 3; n++) box(root, 0.29, 0.2, 0.8, (row + n) % 2 ? '#828c83' : '#6f7b78', -0.3 + n * 0.3, 0.37 + row * 0.19, 0);
      } else {
        for (const x of [-0.23, 0, 0.23]) { const bush = ball(root, 0.21, '#637b61', x, 0.46, 0); bush.scale.y = 1.25; }
        for (const x of [-0.26, 0.22]) ball(root, 0.045, '#bfa76f', x, 0.71, 0.07);
      }
    }
    return root;
  }

  sync(level: Level): void { this.level = level; }
  reset(): void { this.crowd.reset(); this.won = false; this.paintedFrame = -1; this.paint(0, false); }
  update(time: number, won: boolean): void {
    this.crowd.update(time, won);
    this.won = won;
    for (const [id, cow] of this.cows) {
      const moving = !!this.level.items.find(item => item.id === id)?.herdPath;
      cow.head.rotation.z = Math.sin(time * 1.7 + id.length) * 0.035;
      cow.legs.forEach((leg, i) => { leg.rotation.z = moving ? Math.sin(time * 11 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.4 : 0; });
    }
    this.reels.forEach(reel => { reel.rotation.z = won ? -time * 1.8 : 0; });
    this.cloth.color.set(won ? '#ffffff' : '#aeb9bc'); this.cloth.emissiveIntensity = won ? 0.8 : 0;
    this.screenLight.intensity = won ? 1.5 : 0;
    const frame = won ? Math.floor(time * 12) : -1;
    if (frame !== this.paintedFrame) { this.paint(time, won); this.paintedFrame = frame; }
  }
  private paint(time: number, playing: boolean): void {
    const c = this.canvas.getContext('2d')!, w = this.canvas.width, h = this.canvas.height;
    if (!playing) {
      c.fillStyle = '#c5c9c3'; c.fillRect(0, 0, w, h); c.strokeStyle = '#adb8b3'; c.lineWidth = 2;
      for (let y = 12; y < h; y += 18) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    } else {
      c.fillStyle = '#b8d5d3'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f4df9f'; c.beginPath(); c.arc(385, 63, 27, 0, Math.PI * 2); c.fill();
      for (let n = 0; n < 3; n++) {
        c.fillStyle = n % 2 ? '#7faaa0' : '#93b9aa'; c.beginPath(); c.ellipse(n * 215, 205, 220, 125, 0, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#c5bb88'; c.fillRect(0, 231, w, 69);
      c.strokeStyle = '#647d77'; c.lineWidth = 4;
      for (const y of [249, 267]) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      for (let x = 0; x < w; x += 22) c.fillRect(x, 247, 5, 23);
      const x = ((time * 32) % 650) - 100;
      c.fillStyle = '#536d78'; c.fillRect(x, 197, 82, 45); c.fillRect(x + 51, 170, 36, 47); c.fillRect(x + 9, 174, 14, 27);
      c.fillStyle = '#eadbb2'; c.fillRect(x + 59, 177, 19, 22);
      for (const wheel of [17, 64]) { c.fillStyle = '#4a6267'; c.beginPath(); c.arc(x + wheel, 242, 14, 0, Math.PI * 2); c.fill(); c.fillStyle = '#b8c9b8'; c.beginPath(); c.arc(x + wheel, 242, 6, 0, Math.PI * 2); c.fill(); }
      for (let n = 0; n < 4; n++) { c.fillStyle = '#eef0d9'; c.beginPath(); c.arc(x + 16 - n * 13, 157 - n * 14 + Math.sin(time * 2 + n) * 5, 9 + n * 3, 0, Math.PI * 2); c.fill(); }
    }
    c.strokeStyle = '#8b968a'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10); this.film.needsUpdate = true;
  }
  state() {
    return { filmPlaying: this.won, ...this.crowd.state(), cowsHome: this.level.items.filter(cowAtHome).length,
      cows: this.level.items.filter(item => item.kind === 'cow').map(item => ({ id: item.id, x: item.x, y: item.y, moving: !!item.herdPath, home: cowAtHome(item) })) };
  }
}
