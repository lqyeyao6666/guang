import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SPECTRUM } from './level.ts';
import type { Item, Level } from './level.ts';
import { MOVABLE_BLOCK_HALF_SIZE, MOVABLE_BLOCK_CORNER_RADIUS } from './block-shape.ts';

const soft = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.02 });
const pebble = (color: string, x: number, y: number, z: number, scale = 1) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), soft(color));
  mesh.scale.set(0.35 * scale, 0.22 * scale, 0.28 * scale); mesh.position.set(x, y, z); mesh.castShadow = true; return mesh;
};

/** Fixed themed obstacles fill the cell; movable blocks share their smaller optical shape. */
export function experimentBlock(item: Item): THREE.Group {
  const root = new THREE.Group();
  if (item.movable) {
    const width = MOVABLE_BLOCK_HALF_SIZE * 2;
    const body = new THREE.Mesh(new RoundedBoxGeometry(width,.72,width,3,MOVABLE_BLOCK_CORNER_RADIUS),soft('#607c91'));
    body.position.y = .52; body.castShadow = true; root.add(body);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.16,.035,8,20,Math.PI),soft('#e4f2fc'));
    handle.position.y = .92; root.add(handle);
    for (const x of [-.15,0,.15]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(.035,.28,.015),soft('#aecbda'));
      stripe.position.set(x,.54,MOVABLE_BLOCK_HALF_SIZE-.0075); stripe.rotation.z = -.35; root.add(stripe);
    }
    return root;
  }
  const band = SPECTRUM.find(color => color.id === item.color)!;
  const stone = new THREE.Mesh(new RoundedBoxGeometry(0.92, 0.72, 0.92, 3, 0.09), soft(band.color));
  stone.position.y = 0.52; stone.castShadow = true; stone.receiveShadow = true; root.add(stone);
  const foot = new THREE.Mesh(new RoundedBoxGeometry(0.94, 0.08, 0.94, 3, 0.06), soft('#edf7fd'));
  foot.position.y = 0.19; root.add(foot);
  const top = new THREE.Mesh(new RoundedBoxGeometry(0.76, 0.045, 0.76, 3, 0.06), soft(new THREE.Color(band.color).lerp(new THREE.Color('#ffffff'), 0.45).getStyle()));
  top.position.y = 0.89; root.add(top);
  if (item.color === 'orange') {
    for (const side of [-1, 1]) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.14, 8), soft('#ffedd5')); stem.position.set(side * 0.18, 0.97, side * 0.12); root.add(stem);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), soft('#ef984c')); cap.position.set(side * 0.18, 1.04, side * 0.12); root.add(cap);
    }
  } else if (item.color === 'yellow' || item.color === 'green') {
    for (let bud = 0; bud < 4; bud++) {
      const x = bud % 2 ? 0.2 : -0.2, z = bud < 2 ? -0.2 : 0.2;
      root.add(pebble(item.color === 'green' ? '#76b987' : '#f1d25f', x, 0.97, z, item.color === 'green' ? 0.65 : 0.4));
      if (item.color === 'yellow') root.add(pebble('#c6a36b', x, 1.03, z, 0.14));
    }
  } else if (item.color === 'cyan' || item.color === 'violet') {
    for (let shard = 0; shard < 3; shard++) {
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24 + shard * 0.07, 5), soft(band.color));
      crystal.position.set((shard - 1) * 0.21, 1.02, (shard % 2) * 0.2 - 0.1); crystal.rotation.z = (shard - 1) * 0.16; root.add(crystal);
    }
  } else {
    for (const side of [-1, 1]) {
      const ridge = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.14, 0.52, 2, 0.035), soft(item.color === 'red' ? '#f8b1a5' : '#c3e0f6'));
      ridge.position.set(side * 0.2, 0.94, 0); ridge.rotation.y = side * 0.35; root.add(ridge);
    }
  }
  return root;
}

/** Code-built scenery only. It never participates in ray tracing or item picking. */
export class ExperimentGarden {
  readonly root = new THREE.Group();
  private readonly bridge = new THREE.Group();
  private started: number | null = null;
  private progress = 0;
  private readonly clouds: THREE.Group[] = [];
  private readonly laser = new THREE.Group();
  private readonly fusion: boolean;

  constructor(level: Level) {
    this.fusion = !!level.fusion;
    const center = (level.size + 1) / 2;
    for (const [index, band] of SPECTRUM.entries()) {
      const region = level.colorRegions!.find(region => region.color === band.id)!;
      const point = level.items.find(item => item.kind === 'colorWaypoint' && item.color === band.id) ?? region.scenery;
      const garden = new THREE.Group();
      // Low inlays occupy tile corners, keeping every playable cell and light path readable.
      garden.position.set(point.x - center + 0.39, 0.16, point.y - center + 0.34);
      const petals = index === 1 ? 3 : 5;
      for (let flower = 0; flower < 2; flower++) {
        const x = flower * 0.13 - 0.14, z = flower * 0.1;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.13, 6), soft('#98bcac'));
        stem.position.set(x, 0.065, z); garden.add(stem);
        for (let petal = 0; petal < petals; petal++) {
          const angle = petal / petals * Math.PI * 2;
          const bud = pebble(band.color, x + Math.cos(angle) * 0.035, 0.14, z + Math.sin(angle) * 0.035, 0.11);
          garden.add(bud);
        }
      }
      this.root.add(garden);

      // Each colored region has its own scenery, not a row of props next to the collector.
      const island = new THREE.Group();
      island.position.set(region.scenery.x - center, 0.25, region.scenery.y - center);
      const base = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.24, 1.0, 3, 0.12), soft('#f3faff'));
      base.receiveShadow = true; island.add(base);
      const soil = new THREE.Mesh(new RoundedBoxGeometry(0.96, 0.07, 0.88, 3, 0.1), soft(new THREE.Color(band.color).lerp(new THREE.Color('#ffffff'), 0.62).getStyle()));
      soil.position.y = 0.14; island.add(soil);
      if (index === 0) {
        // Coral stone arch.
        const arch = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.105, 10, 24, Math.PI), soft(band.color));
        arch.position.y = 0.25; island.add(arch);
        island.add(pebble('#f7c8c4', -0.3, 0.22, 0.34, 0.5));
      } else if (index === 1 || index === 2) {
        for (const side of [-1, 1]) {
          const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.48, 8), soft(index === 1 ? '#eed6ac' : '#91b89a'));
          stalk.position.set(side * 0.21, 0.4, side * 0.19); island.add(stalk);
          if (index === 1) {
            const cap = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), soft(band.color));
            cap.position.set(side * 0.21, 0.61, side * 0.19); island.add(cap);
          } else {
            const flower = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.06, 8, 12), soft(band.color));
            flower.position.set(side * 0.21, 0.68, side * 0.19); island.add(flower);
            island.add(pebble('#d4a573', side * 0.21, 0.68, side * 0.19, 0.2));
          }
        }
      } else if (index === 3) {
        for (const side of [-1, 1]) {
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.38, 8), soft('#c2b49d'));
          trunk.position.set(side * 0.23, 0.3, 0); island.add(trunk);
          const crown = pebble(band.color, side * 0.23, 0.66, 0, 1); crown.scale.y = 0.38; island.add(crown);
        }
      } else if (index === 5) {
        const water = new THREE.Mesh(new THREE.CircleGeometry(0.43, 40), new THREE.MeshStandardMaterial({ color: '#8ebee9', roughness: 0.22, transparent: true, opacity: 0.8 }));
        water.rotation.x = -Math.PI / 2; water.position.y = 0.185; island.add(water);
        for (const side of [-1, 1]) island.add(pebble('#d8e7f1', side * 0.32, 0.26, 0.3, 0.6));
      } else {
        for (let crystal = 0; crystal < 3; crystal++) {
          const shard = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42 + crystal * 0.12, index === 6 ? 5 : 6), soft(band.color));
          shard.position.set((crystal - 1) * 0.25, 0.39, (crystal % 2) * 0.24 - 0.12); shard.rotation.z = (crystal - 1) * 0.16;
          island.add(shard);
        }
      }
      this.root.add(island);
      const boundary = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(region.minX - 0.5 - center, 0.165, region.minY - 0.5 - center),
        new THREE.Vector3(region.maxX + 0.5 - center, 0.165, region.minY - 0.5 - center),
        new THREE.Vector3(region.maxX + 0.5 - center, 0.165, region.maxY + 0.5 - center),
        new THREE.Vector3(region.minX - 0.5 - center, 0.165, region.maxY + 0.5 - center),
        new THREE.Vector3(region.minX - 0.5 - center, 0.165, region.minY - 0.5 - center),
      ]), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
      this.root.add(boundary);
      const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 128;
      const context = canvas.getContext('2d')!;
      context.fillStyle = new THREE.Color(band.color).multiplyScalar(0.65).getStyle();
      context.font = '500 47px "Microsoft YaHei", sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText(`${band.name} · ${region.name}`, 384, 64);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const label = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.44), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
      label.rotation.x = -Math.PI / 2; label.position.set(region.label.x - center, 0.165, region.label.y - center); this.root.add(label);
    }
    // Soft clouds frame the tabletop and form the ends of the bridge.
    for (const side of [-1, 1]) for (let puff = 0; puff < 5; puff++) {
      const cloud = pebble('#ffffff', side * (this.fusion ? 6.8 : 5.8) + Math.sin(puff * 2) * 0.42, 0.12, (this.fusion ? -9.3 : -7.6) + Math.cos(puff * 2) * 0.45, 1.5);
      cloud.scale.y = 0.28; this.root.add(cloud);
    }
    // Peripheral clouds leave all thirteen rows, ray paths and draggable pieces unobscured.
    for (const [index, [x, y, z, scale]] of [
      [-8.1, 0.35, -3.4, 1.0], [-8.4, -0.05, 3.5, 0.85],
      [8.5, 0.1, -3.4, 0.9], [8.2, -0.15, 4.2, 0.8],
      [-2.1, 0.3, -10.0, 0.95], [3.5, 0.65, -10.5, 1.1],
    ].entries()) {
      const cloud = new THREE.Group();
      cloud.position.set(x * level.size / 13, y, z * level.size / 13); cloud.scale.setScalar(scale); cloud.userData.baseY = y;
      for (let puff = 0; puff < 6; puff++) {
        const bubble = pebble(puff === 0 ? '#eef7ff' : '#ffffff', Math.sin(puff * 2.1) * 0.62, Math.cos(puff * 1.7) * 0.12, Math.cos(puff * 2.1) * 0.3, 1.7 + (puff % 3) * 0.25);
        bubble.scale.y = 0.31 + (puff % 2) * 0.08; cloud.add(bubble);
      }
      cloud.userData.phase = index * 1.7; this.clouds.push(cloud); this.root.add(cloud);
    }
    if (this.fusion) {
      const beacon = level.items.find(item => item.kind === 'beacon')!;
      this.laser.position.set(beacon.x-center,.82,beacon.y-center);
      for (const [radius,opacity] of [[.32,.95],[.52,.42],[.82,.16],[1.15,.07],[1.55,.025]]) {
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,22,48,1,true),new THREE.MeshBasicMaterial({color:radius < .4 ? '#fafff0' : '#d6ffcf',transparent:true,opacity,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
        beam.position.y = 11; this.laser.add(beam);
      }
      for (const radius of [.55,.78,1.03]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius,.025,8,60),new THREE.MeshBasicMaterial({color:'#efffcb',transparent:true,opacity:.55,depthWrite:false,toneMapped:false}));
        ring.rotation.x = Math.PI/2; ring.position.y = -.1; this.laser.add(ring);
      }
      this.laser.visible = false; this.root.add(this.laser);
      return;
    }
    for (const [index, band] of SPECTRUM.entries()) {
      const positions: number[] = [], indices: number[] = [];
      for (let step = 0; step <= 96; step++) {
        const t = step / 96;
        for (const edge of [-0.49, 0.49]) positions.push(-5.8 + 11.6 * t, 0.28 + Math.sin(t * Math.PI) * 3.15, -7.6 + (index - 3 + edge) * 0.19);
        if (step < 96) { const v = step * 2; indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
      const ribbon = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: band.color, emissive: band.color, emissiveIntensity: 0.22, side: THREE.DoubleSide, transparent: true, opacity: 0.88, roughness: 0.4 }));
      this.bridge.add(ribbon);
    }
    for (const side of [-1, 1]) {
      const rail = new THREE.CatmullRomCurve3(Array.from({ length: 49 }, (_, step) => {
        const t = step / 48; return new THREE.Vector3(-5.8 + t * 11.6, 0.63 + Math.sin(t * Math.PI) * 3.15, -7.6 + side * 0.73);
      }));
      this.bridge.add(new THREE.Mesh(new THREE.TubeGeometry(rail, 72, 0.032, 8, false), soft('#ffffff')));
      for (let step = 1; step < 12; step++) {
        const t = step / 12;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.35, 8), soft('#f5fbff'));
        post.position.set(-5.8 + t * 11.6, 0.455 + Math.sin(t * Math.PI) * 3.15, -7.6 + side * 0.73); this.bridge.add(post);
      }
    }
    this.bridge.visible = false; this.root.add(this.bridge);
  }

  update(time: number, won: boolean): void {
    for (const cloud of this.clouds) cloud.position.y = cloud.userData.baseY + Math.sin(time * 0.4 + cloud.userData.phase) * 0.045;
    if (!won) { this.started = null; this.progress = 0; this.bridge.visible = false; this.laser.visible = false; return; }
    this.started ??= time;
    this.progress = time === 0 ? 1 : Math.min(1, (time - this.started) / 1.4);
    this.bridge.visible = !this.fusion; this.laser.visible = this.fusion;
    const eased = 1 - (1 - this.progress) ** 3;
    this.bridge.scale.y = Math.max(0.001, eased);
    this.laser.scale.set(Math.max(.001,eased),Math.max(.001,eased),Math.max(.001,eased));
  }

  state() { return { rainbowVisible: this.bridge.visible, rainbowProgress: this.fusion ? 0 : this.progress, laserVisible: this.laser.visible, laserProgress: this.fusion ? this.progress : 0, gardens: SPECTRUM.length, clouds: this.clouds.length + 2 }; }
}
