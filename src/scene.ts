import { QuantumGarden,quantumItem } from './quantum-scene.ts';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Item, Level, Point } from './level.ts';
import { LAYER_GAP, SPECTRUM } from './level.ts';
import { beamWidth } from './optics.ts';
import type { TraceResult } from './optics.ts';
import { defaultSettings } from './settings.ts';
import type { Settings } from './settings.ts';
import { StreetStory, streetBlock } from './street.ts';
import { ExperimentGarden, experimentBlock } from './experiment.ts';
import { ForestStory, fadeForestObject } from './forest.ts';
import { forestVisible } from './forest-path.ts';
import { RuralStory } from './rural.ts';
import { SchoolStory } from './school.ts';
import { AquariumLab, aquariumItem } from './aquarium.ts';
import { PhotoelectricLab,photoelectricItem } from './photoelectric-scene.ts';
import { CUBE_FACES, cubeLocal, cubeWorld } from './cube-space.ts';
import { buildCubeGarden, placeOnCube } from './cube-scene.ts';

interface ItemVisual { root: THREE.Group; rotating: THREE.Group; light?: THREE.MeshStandardMaterial; glow?: THREE.Sprite; sweep?: THREE.Group; illumination?: THREE.PointLight; waypointRings?: THREE.MeshStandardMaterial[]; color?: Item['color'] }

const palette = { cream: '#fff8e9', apricot: '#efb67e', frame: '#eab987', coral: '#e47b5d', metal: '#a9c9ca', mint: '#b8d5c4', ink: '#896f58' };
const material = (color: string, roughness = 0.55) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });

export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-6, 6, 6, -6, 0.1, 100);
  private readonly visuals = new Map<string, ItemVisual>();
  private readonly beams = new THREE.Group();
  private readonly hints = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private rotation = 0;
  private settings: Settings = { ...defaultSettings };
  private readonly selection: THREE.Mesh;
  private readonly placement: THREE.Mesh;
  private readonly selectionMaterial = new THREE.MeshBasicMaterial({ color: '#dc9b54', transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  private readonly placementMaterial = new THREE.MeshBasicMaterial({ color: '#85b6a0', transparent: true, opacity: 0.42, depthWrite: false });
  private readonly sparks = new THREE.Group();
  private selectedId: string | null = null;
  private width = 1;
  private height = 1;
  private viewportInsets = { top: 0, bottom: 0 };
  private zoom = 1;
  private readonly resizeObserver: ResizeObserver;
  private beaconEnergy = 0;
  private readonly sourcePowers = new Map<string, number>();
  private won = false;
  private theme: Level['theme'] = 'garden';
  private readonly environment = new THREE.Group();
  private readonly boats: THREE.Group[] = [];
  private readonly hemisphere = new THREE.HemisphereLight('#fff9ed', '#c7a88b', 2.4);
  private readonly sun = new THREE.DirectionalLight('#fff2d9', 3.3);
  private readonly fill = new THREE.DirectionalLight('#e4f3f0', 1.1);
  private readonly decks: THREE.Group[] = [];
  private layerCount = 1;
  private activeLayer = 0;
  private overview = false;
  private cubeMode = false;
  private hideCubeOthers = true;
  private setting: Level['setting'];
  private street: StreetStory | null = null;
  private experiment: ExperimentGarden | null = null;
  private forest: ForestStory | null = null;
  private rural: RuralStory | null = null;
  private school: SchoolStory | null = null;
  private aquarium: AquariumLab | null = null;
  private photoelectric:PhotoelectricLab|null=null;
  private quantum:QuantumGarden|null=null;
  private currentLevel?: Level;
  private currentTrace?: TraceResult;
  private readonly recovery = new Map<string, THREE.Group>();
  private boardSize = 7;
  private get center(): number { return (this.boardSize + 1) / 2; }

  constructor(readonly host: HTMLElement, level: Level) {
    this.currentLevel = level;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.setAttribute('aria-label', '可拖动的七乘七光学棋盘');
    this.renderer.domElement.tabIndex = 0;
    host.prepend(this.renderer.domElement);
    this.scene.add(this.hemisphere);
    const sun = this.sun;
    sun.position.set(-3, 10, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 25 });
    sun.shadow.normalBias = 0.035;
    sun.shadow.bias = -0.0002;
    sun.shadow.radius = 4;
    this.scene.add(sun);
    const fill = this.fill;
    fill.position.set(5, 6, -5);
    this.scene.add(fill);

    this.scene.add(this.environment);
    this.buildEnvironment(level);
    for (const item of level.items) this.createItem(item);
    this.selection = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.48, 64), this.selectionMaterial);
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.position.y = 0.19;
    this.selection.visible = false;
    this.scene.add(this.selection);
    this.placement = new THREE.Mesh(new RoundedBoxGeometry(0.96, 0.025, 0.96, 3, 0.06), this.placementMaterial);
    this.placement.visible = false;
    this.scene.add(this.placement, this.beams, this.hints, this.sparks);
    for (let index = 0; index < 20; index++) {
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.025 + (index % 3) * 0.012, 8, 6), new THREE.MeshBasicMaterial({ color: index % 2 ? '#f3bf70' : '#fff5c9', transparent: true, opacity: 0 }));
      this.sparks.add(spark);
    }
    this.sync(level);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
  }

  private buildEnvironment(level: Level): void {
    this.clearGroup(this.environment);
    this.boats.length = 0;
    this.decks.length = 0;
    this.layerCount = level.layers ?? 1;
    this.cubeMode = !!level.cube;
    this.activeLayer = 0; this.overview = false;
    this.boardSize = level.size;
    this.renderer.domElement.setAttribute('aria-label', `可拖动的${level.size}乘${level.size}光学棋盘`);
    this.theme = level.theme;
    this.setting = level.setting;
    this.street = null; this.experiment = null; this.forest = null; this.rural = null; this.school = null; this.aquarium = null;
    this.photoelectric=null;this.quantum=null;
    if (level.cube) {
      this.hemisphere.color.set('#fff9ed'); this.hemisphere.groundColor.set('#d7c9ab'); this.hemisphere.intensity=2.4;
      this.sun.color.set('#fff2d9'); this.sun.intensity=3.3; this.fill.color.set('#e4f3f0'); this.fill.intensity=1.1;
      this.hideCubeOthers=true; this.overview=true;
      buildCubeGarden(level,this.environment,this.decks);
      return;
    }
    const street = this.setting === 'street';
    const night = this.theme === 'night';
    const experiment = this.theme === 'experiment';
    if (this.setting === 'forest') {
      this.hemisphere.color.set('#b1c8da'); this.hemisphere.groundColor.set('#293d38'); this.hemisphere.intensity = 1.05;
      this.sun.color.set('#b2cbe4'); this.sun.intensity = 1.35;
      this.fill.color.set('#7b9caf'); this.fill.intensity = 0.45;
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({ color: '#101e25' }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.51; this.environment.add(floor);
      this.forest = new ForestStory(level); this.environment.add(this.forest.root);
      const coordinates = new THREE.Group();
      for (let n = 1; n <= level.size; n++) {
        this.addCoordinate(String(n), n - this.center, -level.size / 2 - 0.17, coordinates);
        this.addCoordinate(String(n), -level.size / 2 - 0.17, n - this.center, coordinates);
      }
      this.environment.add(coordinates);
      return;
    }
    this.hemisphere.color.set(night ? '#bcd7ff' : '#fff9ed');
    this.hemisphere.groundColor.set(night ? '#26394d' : experiment ? '#b3d0e4' : '#c7a88b');
    this.hemisphere.intensity = night ? 1.6 : 2.4;
    this.sun.color.set(night ? '#c4d9ff' : experiment ? '#f4faff' : '#fff2d9');
    this.sun.intensity = night ? 2.0 : 3.3;
    this.fill.color.set(night ? '#75a9db' : '#e4f3f0');
    this.fill.intensity = night ? 1.0 : 1.1;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), experiment ? new THREE.MeshBasicMaterial({ color: '#dceffc', toneMapped: false }) : night
      ? material(street ? '#243041' : '#112b44', 0.85)
      : new THREE.ShadowMaterial({ color: '#976f40', opacity: 0.12 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.51;
    floor.receiveShadow = true;
    this.environment.add(floor);
    for (let layer = 0; layer < this.layerCount; layer++) {
    const board = new THREE.Group();
    board.position.y = layer * LAYER_GAP;
    board.userData.layer = layer;
    if (layer === 0 && (level.photoelectric||level.quantum)) {
      const split=(level.photoelectric??level.quantum)!.splitColumn;
      for(const [min,max]of [[1,split-1],[split+1,level.size]]) {
        const width=max-min+1,x=(min+max)/2-this.center;
        board.add(this.box(width+.3,.38,level.size+.55,.15,'#b7d4e5',x,-.25,0));
        board.add(this.box(width+.2,.12,level.size+.42,.12,'#ffffff',x,-.02,0));
      }
    } else if (layer === 0) {
      board.add(this.box(level.size + 0.65, 0.38, level.size + 0.65, 0.18, night ? '#223c57' : experiment ? '#b7d4e5' : palette.frame, 0, -0.25, 0));
      board.add(this.box(level.size + 0.52, 0.12, level.size + 0.52, 0.15, night ? '#7c8b9c' : experiment ? '#ffffff' : '#ffedd5', 0, -0.02, 0));
    } else {
      // 上层用独立地板块和四边框搭建，洞口下方不留隐藏底板。
      for (const side of [-1, 1]) {
        board.add(this.box(7.65, 0.38, 0.24, 0.09, palette.frame, 0, -0.25, side * 3.7));
        board.add(this.box(0.24, 0.38, 7.2, 0.09, palette.frame, side * 3.7, -0.25, 0));
      }
      for (const x of [-3.48, 3.48]) for (const z of [-3.48, 3.48]) {
        board.add(this.box(0.17, LAYER_GAP - 0.1, 0.17, 0.06, '#e1b88b', x, -LAYER_GAP / 2, z));
      }
    }
    for (let row = 1; row <= level.size; row++) {
      for (let column = 1; column <= level.size; column++) {
        if((level.photoelectric||level.quantum)&&column===(level.photoelectric??level.quantum)!.splitColumn)continue;
        const hole = level.holes?.some(hole => (hole.layer ?? 1) === layer && hole.x === column && hole.y === row);
        if (hole) {
          for (const side of [-1, 1]) {
            board.add(this.box(1, 0.065, 0.065, 0.02, '#b2c5b4', column - this.center, 0.165, row - this.center + side * 0.47));
            board.add(this.box(0.065, 0.065, 0.88, 0.02, '#b2c5b4', column - this.center + side * 0.47, 0.165, row - this.center));
          }
          continue;
        }
        if (layer > 0) board.add(this.box(0.996, 0.36, 0.996, 0.035, '#f3d1a5', column - this.center, -0.2, row - this.center));
        const color = level.quantum ? column<8 ? ((row+column)%2?'#e4eef8':'#fbfdff') : ((row+column)%2?'#e6edf4':'#f9fcfb') : level.photoelectric ? column<level.photoelectric.splitColumn ? ((row+column)%2?'#e6f0fa':'#fbfdff') : ((row+column)%2?'#e0eee8':'#fafcf3') : this.setting === 'school' ? ((row + column) % 2 ? '#45566a' : '#667487') : this.setting === 'rural' ? ((row + column) % 2 ? '#47584f' : '#697063') : experiment ? this.experimentTile(level, column, row) : street ? ((row + column) % 2 ? '#46566a' : '#58677a') : night ? ((row + column) % 2 ? '#25476a' : '#6d7b8c') : ((row + column) % 2 ? palette.apricot : palette.cream);
        board.add(this.box(0.974, 0.14, 0.974, 0.065, color, column - this.center, 0.08, row - this.center));
      }
      this.addCoordinate(String(row), row - this.center, -level.size / 2 - 0.17, board);
      this.addCoordinate(String(row), -level.size / 2 - 0.17, row - this.center, board);
    }
    this.decks.push(board);
    this.environment.add(board);
    }
    if (this.setting === 'school') {
      this.school = new SchoolStory(level); this.environment.add(this.school.root);
      this.hemisphere.intensity = 1.15; this.sun.intensity = 1.4; this.fill.intensity = 0.6;
    } else if (this.setting === 'rural') {
      this.rural = new RuralStory(level); this.environment.add(this.rural.root);
    } else if (street) {
      this.street = new StreetStory(level);
      this.environment.add(this.street.root);
    } else if (night) this.createOcean();
    else if(level.quantum){this.quantum=new QuantumGarden(level);this.environment.add(this.quantum.root);}
    else if (level.photoelectric) { this.photoelectric=new PhotoelectricLab(level);this.environment.add(this.photoelectric.root); }
    else if (level.aquarium) { this.aquarium = new AquariumLab(level); this.environment.add(this.aquarium.root); }
    else if (experiment) { this.experiment = new ExperimentGarden(level); this.environment.add(this.experiment.root); }
  }

  private experimentTile(level: Level, x: number, y: number): string {
    const base = new THREE.Color((x + y) % 2 ? '#e5f2fb' : '#fafcff');
    const region = level.colorRegions?.find(region => x >= region.minX && x <= region.maxX && y >= region.minY && y <= region.maxY);
    if (region) base.lerp(new THREE.Color(SPECTRUM.find(color => color.id === region.color)!.color), (x + y) % 2 ? 0.62 : 0.50);
    return base.getStyle();
  }

  private oceanLine(points: THREE.Vector3[], opacity = 0.28): THREE.Line {
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(32)), new THREE.LineBasicMaterial({ color: '#74b6d3', transparent: true, opacity, depthWrite: false }));
  }

  private createOcean(): void {
    // Deterministic curved ripples stay outside the playable squares.
    for (let index = 0; index < 40; index++) {
      const x = Math.sin(index * 17.3) * 11;
      const z = Math.cos(index * 9.7) * 10;
      if (Math.abs(x) < 4.15 && Math.abs(z) < 4.15) continue;
      this.environment.add(this.oceanLine(Array.from({ length: 5 }, (_, step) => new THREE.Vector3(x + step * 0.3, -0.49, z + Math.sin(step * 1.1 + index) * 0.09)), 0.12 + index % 3 * 0.04));
    }
    for (const [index, [x, z, angle]] of [[-5.0, 0.3, -0.45], [4.9, -1.6, 0.7], [1.1, 5.4, -0.7]].entries()) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), material(index === 1 ? '#c67e6c' : '#d4b28b'));
      hull.scale.set(0.65, 0.17, 0.25);
      boat.add(hull);
      boat.add(this.box(0.78, 0.075, 0.33, 0.07, '#dce0d6', 0, 0.12, 0));
      boat.add(this.box(0.035, 0.98, 0.035, 0.012, '#829cae', -0.08, 0.6, 0));
      const sailGeometry = new THREE.BufferGeometry();
      sailGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.04, 1.05, 0, -0.04, 0.25, 0, 0.52, 0.3, 0], 3));
      sailGeometry.computeVertexNormals();
      boat.add(new THREE.Mesh(sailGeometry, new THREE.MeshStandardMaterial({ color: index === 1 ? '#b6d6d6' : '#f0e8ce', side: THREE.DoubleSide, roughness: 0.8 })));
      boat.add(this.box(0.2, 0.11, 0.025, 0.02, '#d79576', 0.025, 1.07, 0));
      boat.position.set(x, -0.29, z);
      boat.rotation.y = angle;
      boat.userData.baseY = boat.position.y;
      for (let wake = 0; wake < 3; wake++) boat.add(this.oceanLine([new THREE.Vector3(-0.75 - wake * 0.2, -0.18, -0.22 - wake * 0.06), new THREE.Vector3(-0.9 - wake * 0.2, -0.18, 0), new THREE.Vector3(-0.75 - wake * 0.2, -0.18, 0.22 + wake * 0.06)], 0.28 - wake * 0.06));
      this.boats.push(boat);
      this.environment.add(boat);
    }
  }

  private box(width: number, height: number, depth: number, radius: number, color: string, positionX = 0, positionY = 0, positionZ = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 3, radius), material(color));
    mesh.position.set(positionX, positionY, positionZ);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private addCoordinate(text: string, positionX: number, positionZ: number, parent: THREE.Group): void {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d')!;
    context.fillStyle = this.theme === 'night' ? '#e2eaf5' : '#a57c56';
    context.font = '500 34px system-ui';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 32, 32);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    label.rotation.x = -Math.PI / 2;
    label.position.set(positionX, 0.055, positionZ);
    parent.add(label);
  }

  private createItem(item: Item): void {
    const root = new THREE.Group();
    root.userData.itemId = item.id;
    const rotating = new THREE.Group();
    root.add(rotating);
    const visual: ItemVisual = { root, rotating, color: item.color };
    const night = this.theme === 'night';
    const baseColor = night ? '#8496a8' : item.kind === 'lens' ? '#d5e5d6' : item.kind === 'source' ? '#f5c3a7' : item.kind === 'beacon' ? '#ead5a7' : '#e2ded0';
    if (!(this.cubeMode && item.kind === 'beacon') && item.kind !== 'block' && item.kind !== 'balloonMirror' && !(this.setting === 'school' && ['source', 'beacon', 'waypoint'].includes(item.kind)) && !(this.setting === 'rural' && ['source', 'beacon', 'cow', 'hay'].includes(item.kind)) && !((this.setting === 'street' || this.setting === 'forest') && (item.kind === 'source' || item.kind === 'beacon'))) {
      root.add(this.box(0.78, 0.17, 0.78, 0.09, baseColor, 0, 0.25, 0));
      root.add(this.box(0.63, 0.055, 0.63, 0.06, night ? '#c2d1db' : '#fff5e2', 0, 0.35, 0));
    }
    if(this.quantum&&['beamSplitter','photonSource','photonDetector','photocell','source'].includes(item.kind)) {
      (item.kind==='beamSplitter'?rotating:root).add(quantumItem(item));
    } else if (this.cubeMode && item.kind === 'beacon') {
      visual.light=new THREE.MeshStandardMaterial({color:'#fff4cb',emissive:'#f4cd7e',emissiveIntensity:.1,roughness:.25});
      root.add(new THREE.Mesh(new THREE.SphereGeometry(.24,28,20),visual.light));
      for(const angle of [0,Math.PI/2]) {
        const ring=new THREE.Mesh(new THREE.TorusGeometry(.39,.025,10,64),material('#cbb58a'));ring.rotation.y=angle;root.add(ring);
      }
      for(const face of CUBE_FACES) {
        const petal=new THREE.Mesh(new THREE.SphereGeometry(.055,12,8),material('#c7d9b4'));
        petal.position.set(face.n.x*.48,face.n.y*.48,face.n.z*.48);root.add(petal);
      }
    } else if (this.school && ['source', 'beacon', 'block', 'waypoint'].includes(item.kind)) {
      (item.kind === 'source' ? rotating : root).add(this.school.item(item));
    } else if (this.rural && ['source', 'beacon', 'block', 'hay', 'cow'].includes(item.kind)) {
      (item.kind === 'source' || item.kind === 'cow' ? rotating : root).add(this.rural.item(item));
    } else if (item.kind === 'concaveLens') {
      const profile: THREE.Vector2[] = [];
      for (let n = 0; n <= 20; n++) { const r = n / 20; profile.push(new THREE.Vector2(r * 0.36, -0.025 - r * r * 0.09)); }
      for (let n = 20; n >= 0; n--) { const r = n / 20; profile.push(new THREE.Vector2(r * 0.36, 0.025 + r * r * 0.09)); }
      const glass = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), new THREE.MeshPhysicalMaterial({ color: '#bac9ef', transparent: true, opacity: 0.63, roughness: 0.1, metalness: 0.05, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide }));
      glass.rotation.z = Math.PI / 2; glass.position.y = 0.73; rotating.add(glass);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.365, 0.027, 10, 48), material('#9eafd1'));
      rim.rotation.y = Math.PI / 2; rim.position.y = 0.73; rotating.add(rim);
      rotating.add(this.box(0.17, 0.12, 0.69, 0.04, '#b3bdd5', 0, 0.4, 0));
    } else if (this.forest && ['source', 'beacon', 'block'].includes(item.kind)) {
      root.add(this.forest.item(item));
    } else if (this.setting === 'street' && item.kind === 'source') {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.58, 12), material('#516074'));
      cord.position.y = 1.24; root.add(cord);
      root.add(this.box(0.12, 0.045, 0.12, 0.025, '#aeb8bf', 0, 1.54, 0));
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.25, 0.24, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#e2d5b7', roughness: 0.6, side: THREE.DoubleSide }));
      shade.position.y = 0.82; root.add(shade);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.248, 0.018, 8, 32), material('#d0c9b9'));
      rim.rotation.x = Math.PI / 2; rim.position.y = 0.70; root.add(rim);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 16), new THREE.MeshBasicMaterial({ color: '#fffdf1', toneMapped: false }));
      bulb.position.y = 0.66; root.add(bulb);
      const light = new THREE.PointLight('#f5f4ed', 0.9, 2.7, 1.8);
      light.position.set(0, 0.65, 0); root.add(light);
    } else if (night && item.kind === 'source') {
      rotating.add(this.box(0.38, 0.08, 0.38, 0.09, '#d7c4a0', 0, 0.42, 0));
      rotating.add(this.box(0.09, 0.25, 0.09, 0.035, '#9caeb6', -0.1, 0.54, 0));
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.18, 0.36, 32), material('#e5d6b9'));
      shade.rotation.z = -Math.PI / 2;
      shade.position.set(0.025, 0.69, 0);
      rotating.add(shade);
      const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.195, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
      bulb.rotation.y = Math.PI / 2;
      bulb.position.set(0.21, 0.69, 0);
      rotating.add(bulb);
      const light = new THREE.PointLight('#e8f4ff', 0.7, 2.5, 2);
      light.position.set(0.35, 0.8, 0);
      rotating.add(light);
    } else if (this.setting === 'street' && item.kind === 'beacon') {
      visual.light = new THREE.MeshStandardMaterial({ color: '#b9bba6', emissive: '#ffdf9c', emissiveIntensity: 0.015, roughness: 0.6 });
      const receiver = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.045, 32), visual.light);
      receiver.position.y = 0.19; root.add(receiver);
      const marker = new THREE.Mesh(new THREE.RingGeometry(0.31, 0.34, 48), new THREE.MeshBasicMaterial({ color: '#c8bc96', side: THREE.DoubleSide }));
      marker.rotation.x = -Math.PI / 2; marker.position.y = 0.165; root.add(marker);
    } else if (night && item.kind === 'beacon') {
      this.createLighthouse(visual);
    } else if (item.kind === 'prism') {
      const shape = new THREE.Shape();
      shape.moveTo(-0.3, -0.31); shape.lineTo(-0.3, 0.31); shape.lineTo(0.34, 0); shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 3, steps: 1 });
      geometry.rotateX(-Math.PI / 2); geometry.translate(0, 0.4, 0);
      const glass = new THREE.Mesh(geometry, new THREE.MeshPhysicalMaterial({ color: '#c5e9f5', transparent: true, opacity: 0.72, roughness: 0.08, metalness: 0.1, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }));
      rotating.add(glass);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), new THREE.LineBasicMaterial({ color: '#8ebed7', transparent: true, opacity: 0.65 }));
      rotating.add(edges);
      for (const [index, band] of SPECTRUM.entries()) rotating.add(this.box(0.035, 0.015, 0.11, 0.005, band.color, -0.21 + index * 0.065, 0.38, 0.26));
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.17, 3), material('#719caf'));
      arrow.rotation.z = -Math.PI / 2; arrow.position.set(0.25, 0.39, -0.27); rotating.add(arrow);
    } else if (['splitter','mixer','booster','combiner'].includes(item.kind)) {
      const band = SPECTRUM.find(color => color.id === item.color);
      const color = band?.color ?? '#a8c3cb';
      root.add(this.box(.68,.38,.68,.09,'#eef8fc',0,.38,0));
      visual.light = new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.04,roughness:.3});
      const core = new THREE.Mesh(new THREE.SphereGeometry(.17,20,12),visual.light); core.position.y=.61; root.add(core);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(.27,.035,10,36),material(color)); collar.rotation.x=Math.PI/2; collar.position.y=.64; root.add(collar);
      for (const side of [-1,1]) root.add(this.box(.065,.12,.5,.02,color,side*.3,.53,0));
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(.075,.2,3),material('#6992a3'));
      arrow.rotation.z=-Math.PI/2; arrow.position.set(.34,.59,0); rotating.add(arrow);
      if (item.kind === 'splitter') { const second=arrow.clone(); second.rotation.z=0; second.rotation.x=-Math.PI/2; second.position.set(0,.59,-.34); root.add(second); }
    } else if (item.kind === 'colorWaypoint' || item.kind === 'powerWaypoint') {
      const band = SPECTRUM.find(color => color.id === item.color)!;
      visual.waypointRings = [];
      for (const radius of item.kind === 'powerWaypoint' ? [.2,.28,.36] : [0.27, 0.34]) {
        const ringMaterial = new THREE.MeshStandardMaterial({ color: band.color, emissive: band.color, emissiveIntensity: 0.05, roughness: 0.4 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.025, 10, 48), ringMaterial);
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.48 + (radius === 0.27 ? 0.05 : 0); root.add(ring); visual.waypointRings.push(ringMaterial);
      }
      for (let tick = 0; tick < SPECTRUM.findIndex(color => color.id === item.color) + 1; tick++) {
        const angle = tick * Math.PI * 2 / 7;
        root.add(this.box(0.035, 0.02, 0.035, 0.009, band.color, Math.cos(angle) * 0.25, 0.39, Math.sin(angle) * 0.25));
      }
    } else if(this.photoelectric&&['source','photocell','beacon'].includes(item.kind)) {
      root.add(photoelectricItem(item));
    } else if (this.setting==='aquarium'&&['sensor','gate','beacon'].includes(item.kind)) {
      root.add(aquariumItem(item));
    } else if (this.theme === 'experiment' && item.kind === 'beacon') {
      for (const [index, band] of (this.currentLevel?.fusion ? [] : SPECTRUM).entries()) {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(0.26 + index * 0.022, 0.014, 8, 40, Math.PI), material(band.color));
        arc.position.y = 0.48; root.add(arc);
      }
      visual.light = new THREE.MeshStandardMaterial({ color: '#f3fbff', emissive: '#bbe4f4', emissiveIntensity: 0.1, roughness: 0.2 });
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 16), visual.light); orb.position.y = 0.58; root.add(orb);
      if (this.currentLevel?.fusion) {
        root.add(this.box(.65,.32,.65,.09,'#c7dce3',0,.38,0));
        const aperture=new THREE.Mesh(new THREE.TorusGeometry(.25,.065,12,48),material('#eefaff')); aperture.rotation.x=Math.PI/2; aperture.position.y=.72; root.add(aperture);
      }
    } else if (item.kind === 'waypoint' || item.kind === 'cubeWaypoint') {
      visual.waypointRings = [];
      for (const angle of [0, Math.PI / 2]) {
        const ringMaterial = new THREE.MeshStandardMaterial({ color: '#a7b6a1', emissive: '#b8ce9e', emissiveIntensity: 0.04, roughness: 0.4 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.035, 12, 48), ringMaterial);
        ring.rotation.y = angle; ring.position.y = 0.68;
        root.add(ring); visual.waypointRings.push(ringMaterial);
      }
      root.add(this.box(0.45, 0.055, 0.45, 0.05, '#cad9ba', 0, 0.4, 0));
    } else if (item.kind === 'block') {
      if (this.setting === 'street') root.add(streetBlock(item));
      else if (this.theme === 'experiment') root.add(experimentBlock(item));
      else {
      root.add(this.box(0.91, 0.84, 0.91, 0.14, (item.x + item.y) % 2 ? '#e7b27d' : '#f4e5cb', 0, 0.56, 0));
      root.add(this.box(0.6, 0.055, 0.6, 0.05, '#fff2dc', 0, 1.0, 0));
      root.add(this.box(0.1, 0.11, 0.1, 0.03, '#cba77f', 0, 1.06, 0));
      }
    } else if (item.kind === 'liftMirror' || item.kind === 'balloonMirror' || item.kind === 'coreMirror') {
      const ramp = this.box(0.87, 0.12, 0.68, 0.045, '#8caaa8', 0, 0.64, 0);
      ramp.rotation.z = Math.PI / 4;
      rotating.add(ramp);
      const glass = this.box(0.75, 0.03, 0.57, 0.02, '#e2f2e9', -0.015, 0.7, 0);
      if(item.kind==='coreMirror') {
        const coating=glass.material as THREE.MeshStandardMaterial;
        coating.transparent=true;coating.opacity=.55;coating.depthWrite=false;
      }
      glass.rotation.z = Math.PI / 4;
      rotating.add(glass);
      if (item.kind !== 'balloonMirror') {
        rotating.add(this.box(0.16, 0.32, 0.46, 0.04, '#b3cbbb', 0.25, 0.48, 0));
      } else {
        // 红气球吊起镜面，细绳与洞口支架保留清楚的悬浮关系。
        const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 28, 20), material('#d8584d', 0.32));
        balloon.scale.y = 1.24; balloon.position.set(0, 1.77, 0);
        balloon.castShadow = true; root.add(balloon);
        const knot = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.09, 12), material('#c94b43'));
        knot.position.y = 1.36; root.add(knot);
        for (const side of [-1, 1]) {
          const string = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.65, 8), material('#bc9c7b'));
          string.position.set(0, 1.04, side * 0.22); root.add(string);
          root.add(this.box(0.13, 0.14, 0.9, 0.04, '#c5d5c6', side * 0.42, 0.25, 0));
        }
      }
      const arrow = new THREE.Shape();
      arrow.moveTo(0.32, 0); arrow.lineTo(0.09, 0.12); arrow.lineTo(0.09, 0.045);
      arrow.lineTo(-0.2, 0.045); arrow.lineTo(-0.2, -0.045); arrow.lineTo(0.09, -0.045); arrow.lineTo(0.09, -0.12); arrow.closePath();
      const marker = new THREE.Mesh(new THREE.ShapeGeometry(arrow), new THREE.MeshBasicMaterial({ color: '#b37d45', side: THREE.DoubleSide }));
      marker.rotation.x = -Math.PI / 2; marker.position.set(0, 0.39, -0.27); rotating.add(marker);
    } else if (item.kind === 'mirror') {
      if(item.rail) {
        root.add(this.box(.83,.12,.66,.05,'#799dad',0,.35,0));
        for(const x of [-.26,.26])root.add(this.box(.13,.12,.13,.03,'#b6d1dc',x,.28,0));
      }
      rotating.add(this.box(0.91, 0.62, 0.15, 0.045, '#8aa8ac', 0, 0.66, 0));
      rotating.add(this.box(0.78, 0.49, 0.16, 0.035, '#d6e9e6', 0, 0.67, 0));
      rotating.add(this.box(0.83, 0.035, 0.17, 0.012, '#f5fff9', 0, 0.88, 0));
      rotating.add(this.box(0.035, 0.34, 0.168, 0.012, '#f4fff9', -0.22, 0.68, 0));
      if (!item.movable) root.add(this.box(0.16, 0.09, 0.13, 0.035, night ? '#d9b576' : '#a38e74', 0.24, 0.405, 0.24));
    } else if (item.kind === 'lens') {
      const glass = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshPhysicalMaterial({ color: '#99d9d0', transparent: true, opacity: 0.63, roughness: 0.12, metalness: 0.08, clearcoat: 1, depthWrite: false }));
      glass.scale.set(0.13, 0.35, 0.4);
      glass.position.y = 0.73;
      rotating.add(glass);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.032, 10, 64), material('#86b6ad'));
      rim.rotation.y = Math.PI / 2;
      rim.position.y = 0.73;
      rim.scale.y = 0.96;
      rotating.add(rim);
      rotating.add(this.box(0.15, 0.12, 0.69, 0.04, '#a7c7b4', 0, 0.4, 0));
      const shine = this.box(0.03, 0.35, 0.035, 0.01, '#e3fff3', 0.12, 0.8, 0.12);
      shine.rotation.x = -0.3;
      rotating.add(shine);
    } else if (item.kind === 'source') {
      rotating.add(this.box(0.58, 0.47, 0.58, 0.12, palette.coral, -0.045, 0.6, 0));
      rotating.add(this.box(0.45, 0.06, 0.42, 0.03, '#ffd9bc', -0.06, 0.85, 0));
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.19, 24), material('#ac6953'));
      nozzle.rotation.z = Math.PI / 2;
      nozzle.position.set(0.31, 0.59, 0);
      rotating.add(nozzle);
      const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.106, 24), new THREE.MeshBasicMaterial({ color: '#ffefce' }));
      bulb.rotation.y = Math.PI / 2;
      bulb.position.set(0.411, 0.59, 0);
      rotating.add(bulb);
      for (let index = 0; index < 3; index++) rotating.add(this.box(0.05, 0.02, 0.22, 0.008, '#b66e55', -0.16 + index * 0.11, 0.885, 0));
    } else {
      root.add(this.box(0.6, 0.13, 0.6, 0.08, '#d5ad71', 0, 0.43, 0));
      visual.light = new THREE.MeshStandardMaterial({ color: '#f6dc9f', emissive: '#ffbd53', emissiveIntensity: 0.08, roughness: 0.28 });
      const lantern = new THREE.Mesh(new RoundedBoxGeometry(0.43, 0.48, 0.43, 4, 0.12), visual.light);
      lantern.position.y = 0.72;
      lantern.castShadow = true;
      root.add(lantern);
      root.add(this.box(0.48, 0.08, 0.48, 0.04, '#fff4d9', 0, 0.99, 0));
      root.add(this.box(0.13, 0.1, 0.13, 0.045, '#e9c982', 0, 1.07, 0));
    }
    this.visuals.set(item.id, visual);
    this.scene.add(root);
  }

  private createLighthouse(visual: ItemVisual): void {
    const { root } = visual;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.33, 1.0, 32), material('#e2e5de'));
    tower.position.y = 0.91;
    tower.castShadow = true;
    root.add(tower);
    for (const height of [0.72, 1.12]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(height < 1 ? 0.307 : 0.273, height < 1 ? 0.318 : 0.284, 0.13, 32), material('#bd7e78'));
      band.position.y = height;
      root.add(band);
    }
    root.add(this.box(0.14, 0.23, 0.05, 0.035, '#36526c', 0, 0.55, 0.31));
    const balcony = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.09, 32), material('#8babb9'));
    balcony.position.y = 1.41;
    root.add(balcony);
    visual.light = new THREE.MeshStandardMaterial({ color: '#adc2cb', emissive: '#def4ff', emissiveIntensity: 0.015, roughness: 0.25 });
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.34, 24), visual.light);
    lantern.position.y = 1.63;
    root.add(lantern);
    for (let index = 0; index < 4; index++) {
      const angle = Math.PI / 4 + index * Math.PI / 2;
      root.add(this.box(0.035, 0.39, 0.035, 0.01, '#7998aa', Math.cos(angle) * 0.26, 1.64, Math.sin(angle) * 0.26));
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.27, 32), material('#718fa7'));
    roof.position.y = 1.94;
    root.add(roof);
    root.add(this.box(0.055, 0.13, 0.055, 0.02, '#abc5d2', 0, 2.08, 0));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(0.2, '#d9f3ffb0'); gradient.addColorStop(1, '#b9dcff00');
    context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
    visual.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    visual.glow.position.y = 1.64;
    visual.glow.scale.set(2.3, 2.3, 1);
    visual.glow.raycast = () => {};
    root.add(visual.glow);
    visual.illumination = new THREE.PointLight('#d1efff', 0, 12, 1.5);
    visual.illumination.position.y = 1.8;
    root.add(visual.illumination);
    visual.sweep = new THREE.Group();
    visual.sweep.position.y = 1.64;
    // Decorative lighthouse fans do not participate in optics or pointer picking.
    for (const direction of [1, -1]) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, direction * 8, -0.25, -1.7, direction * 8, -0.25, 1.7], 3));
      const fan = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
        transparent: true, side: THREE.DoubleSide, forceSinglePass: true,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
        vertexShader: `
          varying vec2 fanCoordinate;
          void main() {
            fanCoordinate = vec2(abs(position.x) / 8.0, position.z / 1.7);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 fanCoordinate;
          void main() {
            float travel = fanCoordinate.x;
            float edge = 1.0 - smoothstep(0.35, 1.0, abs(fanCoordinate.y) / max(travel, 0.001));
            float fade = pow(1.0 - travel, 1.4) * smoothstep(0.0, 0.04, travel);
            gl_FragColor = vec4(0.82, 0.93, 1.0, 0.19 * edge * fade);
          }
        `,
      }));
      fan.raycast = () => {};
      visual.sweep.add(fan);
    }
    visual.sweep.visible = false;
    root.add(visual.sweep);
  }

  sync(level: Level): void {
    this.currentLevel = level;
    this.sourcePowers.clear();
    for (const source of level.items.filter(item => item.kind === 'source')) this.sourcePowers.set(source.id, source.power ?? 1);
    const rebuild = this.cubeMode !== !!level.cube || this.theme !== level.theme || this.layerCount !== (level.layers ?? 1) || this.setting !== level.setting || this.boardSize !== level.size;
    if (rebuild) {
      for (const visual of this.visuals.values()) { this.scene.remove(visual.root); this.clearGroup(visual.root); }
      this.visuals.clear();
      for (const marker of this.recovery.values()) { this.scene.remove(marker); this.clearGroup(marker); }
      this.recovery.clear();
      this.buildEnvironment(level);
    }
    const activeIds = new Set(level.items.map(item => item.id));
    for (const [id, visual] of this.visuals) if (!activeIds.has(id)) visual.root.visible = false;
    for (const item of level.items) {
      if (!this.visuals.has(item.id)) this.createItem(item);
      const visual = this.visuals.get(item.id)!;
      visual.root.visible = !item.inInventory;
      visual.root.userData.layer = item.layer ?? 0;
      if (this.cubeMode) placeOnCube(visual.root,item,level.size);
      else {visual.root.quaternion.identity();visual.root.position.set(item.x - this.center, (item.layer ?? 0) * LAYER_GAP, item.y - this.center);}
      visual.rotating.rotation.y = -item.angle * Math.PI / 180;
    }
    this.applyLayerVisibility();
    this.rural?.sync(level);
    if (rebuild && this.width > 1) this.resize();
    this.select(this.selectedId);
  }

  private fadeRoot(root: THREE.Object3D, opacity: number): void {
    root.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.material) return;
      mesh.userData.originalShadow ??= mesh.castShadow;
      mesh.castShadow = opacity === 1 && mesh.userData.originalShadow;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        material.userData.original ??= { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite };
        const original = material.userData.original;
        const transparent = original.transparent || opacity < 1;
        if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
        material.opacity = original.opacity * opacity;
        material.depthWrite = opacity === 1 ? original.depthWrite : false;
      }
    });
  }

  private applyLayerVisibility(): void {
    if (this.forest) return;
    if (this.cubeMode) {
      this.environment.traverse(object=>{if(object.userData.cubeFrame)object.visible=this.overview || !this.hideCubeOthers;});
      for (const [layer,deck] of this.decks.entries()) {deck.visible=this.overview || !this.hideCubeOthers || layer===this.activeLayer;this.fadeRoot(deck,this.overview ? .18 : layer===this.activeLayer ? 1 : .045);}
      for (const visual of this.visuals.values()) {
        const layer=visual.root.userData.layer??0;
        const item=this.currentLevel?.items.find(item=>item.id===visual.root.userData.itemId);
        visual.root.visible=!!item && !item.inInventory && (layer===-1 || this.overview || !this.hideCubeOthers || layer===this.activeLayer);
        this.fadeRoot(visual.root,layer===-1 || layer===this.activeLayer || this.overview ? 1 : .08);
      }
      return;
    }
    const opacityFor = (layer: number) => this.layerCount === 1 || this.overview || layer === this.activeLayer ? 1 : 0.09;
    for (const [layer, deck] of this.decks.entries()) this.fadeRoot(deck, opacityFor(layer));
    for (const visual of this.visuals.values()) this.fadeRoot(visual.root, opacityFor(visual.root.userData.layer ?? 0));
  }

  setLayerMode(layer: number, overview = false): void {
    this.activeLayer = Math.max(0, Math.min(this.layerCount - 1, layer));
    this.overview = overview; this.applyLayerVisibility(); this.select(null);
    if(this.cubeMode) {this.rotation=0;this.resize();if(this.currentTrace)this.updateBeams(this.currentTrace);}
  }

  layerState(): { count: number; active: number; overview: boolean } {
    return { count: this.layerCount, active: this.activeLayer, overview: this.overview };
  }

  setCubeOthers(hidden:boolean): void {this.hideCubeOthers=hidden;this.applyLayerVisibility();}
  cubeState() {return {active:this.activeLayer,overview:this.overview,hideOthers:this.hideCubeOthers,receiver:this.visuals.get('beacon')?.root.position.toArray()};}

  select(id: string | null): void {
    this.selectedId = id;
    const visual = id ? this.visuals.get(id) : undefined;
    this.selection.visible = (!!visual?.root.visible || !!(id && this.recovery.get(id)?.visible)) && !this.overview && visual?.root.userData.layer === this.activeLayer;
    if (visual) {
      if(this.cubeMode) {const item=this.currentLevel!.items.find(item=>item.id===id)!;placeOnCube(this.selection,item,this.boardSize,.18);this.selection.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2));}
      else {this.selection.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);this.selection.position.set(visual.root.position.x, visual.root.position.y + 0.18, visual.root.position.z);}
    }
  }

  previewPlacement(id: string, position: Point, valid: boolean): void {
    const visual = this.visuals.get(id)!;
    const marker = this.recovery.get(id); if (marker) marker.visible = false;
    if (!this.isVisible(position)) { visual.root.visible = false; this.selection.visible = false; this.placement.visible = false; return; }
    visual.root.visible = true;
    if(this.cubeMode) {
      placeOnCube(visual.root,position,this.boardSize,.18);placeOnCube(this.placement,position,this.boardSize,.18);
      this.placementMaterial.color.set(valid ? '#8cbd9a' : '#df8c7e');this.placement.visible=true;this.selection.visible=false;return;
    }
    this.placement.quaternion.identity();
    const height = (position.layer ?? this.activeLayer) * LAYER_GAP;
    visual.root.position.set(position.x - this.center, height + 0.18, position.y - this.center);
    this.selection.position.set(position.x - this.center, height + 0.19, position.y - this.center);
    this.placement.position.set(position.x - this.center, height + 0.18, position.y - this.center);
    this.placementMaterial.color.set(valid ? '#8cbd9a' : '#df8c7e');
    this.placement.visible = true;
  }

  endPlacement(): void { this.placement.visible = false; }

  hideItem(id: string): void {
    const visual = this.visuals.get(id);
    if (visual) visual.root.visible = false;
    const marker = this.recovery.get(id); if (marker) marker.visible = false;
    this.selection.visible = false;
  }

  private clearGroup(group: THREE.Group): void {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse(object => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const entry of materials) {
          (entry as THREE.MeshBasicMaterial | undefined)?.map?.dispose();
          entry?.dispose();
        }
      });
    }
  }

  updateBeams(trace: TraceResult, preview = false): void {
    this.photoelectric?.setTrace(trace.photoelectric,preview);
    this.quantum?.setTrace(trace.quantum,preview);
    this.currentTrace = trace;
    const sensor=this.visuals.get('sensor')?.root.getObjectByName('sensor-core') as THREE.Mesh|undefined;
    if(sensor)(sensor.material as THREE.MeshStandardMaterial).emissiveIntensity=(trace.refraction?.sensorPower??0) > .2 ? .8 : this.currentLevel?.aquarium?.gateOpen ? .45 : .03;
    this.forest?.reveal(trace, !preview);
    if (this.forest && this.currentLevel) {
      this.updateForestVisibility();
      this.select(this.selectedId);
    }
    this.clearGroup(this.beams);
    this.beaconEnergy = trace.qualifiedReceived.beacon ?? trace.received.beacon ?? 0;
    for (const [id, visual] of this.visuals) {
      if (trace.fusion?.nodes[id] && visual.light) {
        const node = trace.fusion.nodes[id]; visual.light.emissiveIntensity = node.active ? .75 : node.contaminated ? .2 : .03;
        if (node.contaminated) visual.light.emissive.set('#f06d59');
        else visual.light.emissive.copy(visual.light.color);
      }
      if (!visual.waypointRings) continue;
      if(trace.cube) {
        const face=trace.cube.faces[visual.root.userData.layer??0];
        visual.waypointRings.forEach(ring=>{ring.color.set(face.arrived ? '#88a878' : face.passed ? '#d6ad64' : '#a7b6a1');ring.emissiveIntensity=face.arrived ? .5 : face.passed ? .23 : .03;});continue;
      }
      if (visual.color) {
        const passes = trace.colorPasses[id] ?? [];
        visual.waypointRings.forEach(ring => { ring.emissiveIntensity = passes.some(pass => pass.deliveredTo === 'beacon') ? 0.8 : passes.length ? 0.4 : 0.03; });
        continue;
      }
      const passes = trace.waypointPasses[id] ?? [];
      const count = new Set(passes.map(pass => pass.direction)).size;
      const delivered = new Set(passes.filter(pass => pass.deliveredTo === 'beacon').map(pass => pass.sourceId)).size >= 2;
      visual.waypointRings.forEach((ring, index) => {
        ring.color.set(count > index ? delivered ? '#92b181' : '#d4b274' : '#a7b6a1');
        ring.emissiveIntensity = count > index ? 0.24 : 0.04;
      });
    }
    for (const segment of trace.segments) {
      // 两盏灯各占一半总能量，显示时仍保留同样清楚的白光轮廓。
      const visibility=this.cubeMode && !this.overview && segment.start.layer!==this.activeLayer ? segment.core ? .30 : .07 : 1;
      const displayPower = visibility*(segment.displayPower ?? Math.min(1.25, segment.power / Math.max(this.sourcePowers.get(segment.sourceId) ?? 1, 0.01) * (segment.color || segment.rgb ? 7 / 0.9 : 1)));
      const worldStart=segment.worldStart??(this.cubeMode ? cubeWorld(segment.start,this.boardSize,.59) : null);
      const worldEnd=segment.worldEnd??(this.cubeMode ? cubeWorld(segment.end,this.boardSize,.59) : null);
      const start = worldStart ? new THREE.Vector3(worldStart.x,worldStart.y,worldStart.z) : new THREE.Vector3(segment.start.x - this.center, (segment.start.layer ?? 0) * LAYER_GAP + 0.59, segment.start.y - this.center);
      const end = worldEnd ? new THREE.Vector3(worldEnd.x,worldEnd.y,worldEnd.z) : new THREE.Vector3(segment.end.x - this.center, segment.endHeight ?? (segment.end.layer ?? 0) * LAYER_GAP + 0.59, segment.end.y - this.center);
      const length = start.distanceTo(end);
      if (length < 0.0001) continue;
      const direction = end.clone().sub(start).normalize();
      const vertical = Math.abs(direction.y) > 0.9;
      const face=this.cubeMode ? CUBE_FACES[segment.start.layer??0] : null;
      const perpendicular = face ? segment.core ? new THREE.Vector3(face.u.x,face.u.y,face.u.z) : new THREE.Vector3(face.n.x,face.n.y,face.n.z).cross(direction).normalize() : vertical ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(-direction.z, 0, direction.x);
      if(perpendicular.lengthSq()<.01) perpendicular.set(1,0,0).cross(direction).normalize();
      const subdivisions = Math.max(2, Math.ceil(length * 16));
      const positions: number[] = [];
      const beamCoordinates: number[] = [];
      const opacities: number[] = [];
      const indices: number[] = [];
      // 几层薄光雾叠出柔和体积；中心和边缘都能透出下面的棋盘。
      const layerWeights = [0.25, 0.7, 1, 0.7, 0.25];
      for (const transverse of this.cubeMode ? segment.core ? [perpendicular,new THREE.Vector3().crossVectors(direction,perpendicular).normalize()] : [perpendicular] : vertical ? [perpendicular, new THREE.Vector3(0, 0, 1)] : [perpendicular]) {
      const thickness = new THREE.Vector3().crossVectors(direction, transverse).normalize();
      for (let layer = 0; layer < layerWeights.length; layer++) {
        const base = positions.length / 3;
        for (let index = 0; index <= subdivisions; index++) {
          const distance = length * index / subdivisions;
          const center = start.clone().addScaledVector(direction, distance);
          center.addScaledVector(thickness, (layer - 2) * 0.025);
          const width = Math.min(beamWidth(segment.focusTravel === null ? null : segment.focusTravel + distance, segment.divergence && { ...segment.divergence, travel: segment.divergence.travel + distance }), 2);
          const density = THREE.MathUtils.clamp(Math.sqrt(0.42 / width), 0.65, 1.6);
          for (const side of [-1, 1]) {
            // 显示宽度收窄，保留聚焦比例；实际能量仍由光学模型独立计算。
            positions.push(...center.clone().addScaledVector(transverse, side * width * (segment.divergence ? 1 : 0.6)).toArray());
            beamCoordinates.push(side, distance);
            opacities.push((segment.color ? 0.32 : 0.56) * layerWeights[layer] * displayPower * density);
          }
          if (index < subdivisions) {
            const vertex = base + index * 2;
            indices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2);
          }
        }
      }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('beamCoordinate', new THREE.Float32BufferAttribute(beamCoordinates, 2));
      geometry.setAttribute('beamOpacity', new THREE.Float32BufferAttribute(opacities, 1));
      geometry.setIndex(indices);
      const rgb = segment.rgb;
      const mist = new THREE.ShaderMaterial({
        transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
        // 双面光带只绘制一遍，避免透明度因正反面叠加而变得像实体。
        forceSinglePass: true,
        uniforms: { beamLength: { value: length }, beamColor: { value: rgb ? new THREE.Color().setRGB(...rgb.map(value => value / Math.max(...rgb)) as [number,number,number]).lerp(new THREE.Color('#ffffff'),.12).convertLinearToSRGB() : segment.color ? new THREE.Color(SPECTRUM.find(color => color.id === segment.color)!.color).lerp(new THREE.Color('#ffffff'), 0.10).convertLinearToSRGB() : new THREE.Color(this.forest ? '#ffc0a0' : '#ffffff').convertLinearToSRGB() } },
        vertexShader: `
          attribute vec2 beamCoordinate;
          attribute float beamOpacity;
          varying vec2 vBeamCoordinate;
          varying float vBeamOpacity;
          void main() {
            vBeamCoordinate = beamCoordinate;
            vBeamOpacity = beamOpacity;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float beamLength;
          uniform vec3 beamColor;
          varying vec2 vBeamCoordinate;
          varying float vBeamOpacity;
          void main() {
            float feather = 1.0 - smoothstep(0.12, 1.0, abs(vBeamCoordinate.x));
            float ends = smoothstep(0.0, 0.12, min(vBeamCoordinate.y, beamLength - vBeamCoordinate.y));
            gl_FragColor = vec4(beamColor, feather * ends * vBeamOpacity);
          }
        `,
      });
      this.beams.add(new THREE.Mesh(geometry, mist));
    }
  }

  showHints(positions: readonly Point[]): void {
    this.clearGroup(this.hints);
    for (const [index, position] of positions.entries()) {
      const marker = new THREE.Mesh(new THREE.RingGeometry(0.39, 0.43, 48), new THREE.MeshBasicMaterial({ color: index === 0 ? '#c58a45' : '#5f9b8a', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false }));
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(position.x - this.center, (position.layer ?? 0) * LAYER_GAP + 0.17, position.y - this.center);
      if(this.cubeMode) {placeOnCube(marker,position,this.boardSize,.17);marker.rotateX(-Math.PI/2);}
      marker.userData.cell = position; marker.visible = this.isVisible(position);
      this.hints.add(marker);
    }
  }

  isVisible(position: Point): boolean {
    return !this.forest || !!this.currentLevel && !!this.currentTrace && forestVisible(this.currentLevel, this.currentTrace, position);
  }
  visibilityOpacity(position: Point): number { return this.forest?.opacityAt(position) ?? 1; }

  private recoveryMarker(id: string): THREE.Group {
    const existing = this.recovery.get(id); if (existing) return existing;
    const root = new THREE.Group(); root.userData.itemId = id;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1c303ae8'; ctx.strokeStyle = '#c7c4a0'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(64, 64, 48, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#e4dab3'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(40, 85); ctx.lineTo(82, 43); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath();
    for (let n = 0; n < 3; n++) { ctx.moveTo(44 + n * 13, 88 - n * 13); ctx.lineTo(49 + n * 13, 93 - n * 13); }
    ctx.stroke();
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    sprite.scale.set(0.52, 0.52, 1); sprite.position.y = 0.62; sprite.renderOrder = 15; root.add(sprite);
    this.recovery.set(id, root); this.scene.add(root); return root;
  }

  private updateForestVisibility(): void {
    if (!this.forest || !this.currentLevel) return;
    for (const item of this.currentLevel.items) {
      const visual = this.visuals.get(item.id)!;
      const alpha = item.inInventory ? 0 : this.forest.opacityAt(item);
      fadeForestObject(visual.root, alpha);
      if (item.movable && !item.inInventory) {
        const marker = this.recoveryMarker(item.id);
        marker.position.set(item.x - this.center, (item.layer ?? 0) * LAYER_GAP, item.y - this.center);
        marker.visible = !this.isVisible(item);
        ((marker.children[0] as THREE.Sprite).material).opacity = (1 - alpha) * 0.86;
      } else { const marker = this.recovery.get(item.id); if (marker) marker.visible = false; }
    }
    for (const marker of this.hints.children) {
      const alpha = this.forest.opacityAt(marker.userData.cell);
      marker.visible = alpha > 0.001;
      ((marker as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.8 * alpha;
    }
  }

  resetStory(): void { this.forest?.reset(); this.rural?.reset(); this.school?.reset(); }

  private setRay(clientX: number, clientY: number): void {
    const bounds = this.host.getBoundingClientRect();
    this.pointer.set((clientX - bounds.left) / bounds.width * 2 - 1, -(clientY - bounds.top) / bounds.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  hitItem(clientX: number, clientY: number): string | null {
    if (this.overview) return null;
    this.setRay(clientX, clientY);
    const roots: THREE.Object3D[] = [...this.visuals.values()].filter(visual => visual.root.visible && visual.root.userData.layer === this.activeLayer && (!this.forest || this.isVisible(this.currentLevel!.items.find(item => item.id === visual.root.userData.itemId)!))).map(visual => visual.root);
    roots.push(...[...this.recovery.values()].filter(marker => marker.visible));
    const hits = this.raycaster.intersectObjects(roots, true);
    if (!hits.length) return null;
    let object: THREE.Object3D | null = hits[0].object;
    while (object && !object.userData.itemId) object = object.parent;
    return object?.userData.itemId ?? null;
  }

  boardPoint(clientX: number, clientY: number): Point {
    this.setRay(clientX, clientY);
    if(this.cubeMode) {
      const face=CUBE_FACES[this.activeLayer],normal=new THREE.Vector3(face.n.x,face.n.y,face.n.z);
      const origin=cubeWorld({x:this.center,y:this.center,layer:this.activeLayer},this.boardSize,.2),point=new THREE.Vector3();
      const hit=this.raycaster.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(normal,new THREE.Vector3(origin.x,origin.y,origin.z)),point);
      return hit ? cubeLocal(point,this.activeLayer,this.boardSize) : {x:-100,y:-100,layer:this.activeLayer};
    }
    const point = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -(this.activeLayer * LAYER_GAP + 0.2)), point);
    return { x: point.x + this.center, y: point.z + this.center, layer: this.activeLayer };
  }

  screenPoint(position: Point, height = 0.2): Point {
    this.camera.updateMatrixWorld();
    const world=this.cubeMode ? cubeWorld(position,this.boardSize,height) : null;
    const projected = (world ? new THREE.Vector3(world.x,world.y,world.z) : new THREE.Vector3(position.x - this.center, height + (position.layer ?? 0) * LAYER_GAP, position.y - this.center)).project(this.camera);
    const bounds = this.host.getBoundingClientRect();
    return { x: bounds.left + (projected.x + 1) * this.width / 2, y: bounds.top + (1 - projected.y) * this.height / 2 };
  }

  rotateViewBy(deltaX: number): void {
    this.rotation = THREE.MathUtils.euclideanModulo(this.rotation - deltaX * 0.006 * this.settings.rotationSpeed + Math.PI, Math.PI * 2) - Math.PI;
    this.updateCamera();
  }

  zoomBy(factor: number): void {
    this.zoom = THREE.MathUtils.clamp(this.zoom * factor, 0.65, 1.65);
    this.updateCamera();
  }

  resetView(): void { this.rotation = 0; this.zoom = 1; this.updateCamera(); }
  viewState(): { zoom: number; rotation: number; pitch: number; rotationSpeed: number } { return { zoom: this.zoom, rotation: this.rotation, ...this.settings }; }
  setSettings(settings: Settings): void { this.settings = { ...settings }; this.resize(); }

  setViewportInsets(top: number, bottom: number): void {
    if (top === this.viewportInsets.top && bottom === this.viewportInsets.bottom) return;
    this.viewportInsets = { top, bottom }; this.resize();
  }

  private resize(): void {
    this.width = this.host.clientWidth;
    this.height = this.host.clientHeight;
    this.renderer.setSize(this.width, this.height);
    const usableHeight = Math.max(this.height * .35, this.height - this.viewportInsets.top - this.viewportInsets.bottom);
    const aspect = this.width / usableHeight;
    const horizontalSpan = this.theme === 'experiment' ? Math.max(22.5,this.boardSize * 1.7) : this.setting === 'school' ? 18 : this.setting === 'rural' ? 17.5 : this.setting === 'street' ? 13.4 : this.setting === 'forest' ? 13.5 : 11.5;
    const vertical = Math.max(this.theme === 'experiment' ? Math.max(18.7,this.boardSize * 1.35) : this.setting === 'school' ? 15.5 : this.setting === 'rural' ? 14.2 : this.setting === 'forest' ? 10.2 : 8.8, (this.theme === 'experiment' ? Math.max(22.5,this.boardSize * 1.7) : this.setting === 'school' ? 18 : this.setting === 'rural' ? 17.5 : this.setting === 'forest' ? 13.5 : 11.5) * Math.sin(this.settings.pitch * Math.PI / 180) + 0.6, horizontalSpan / aspect) + (this.layerCount > 1 ? 2.6 : 0);
    const span=this.cubeMode ? Math.max(this.overview ? 12.6 : 10.0,(this.overview ? 12.8 : 11.5)/aspect) : vertical;
    const fullSpan = span * this.height / usableHeight;
    const offset = (this.viewportInsets.top - this.viewportInsets.bottom) * fullSpan / (2 * this.height);
    this.camera.left = -fullSpan * (this.width / this.height) / 2;
    this.camera.right = fullSpan * (this.width / this.height) / 2;
    this.camera.top = fullSpan / 2 + offset;
    this.camera.bottom = -fullSpan / 2 + offset;
    this.updateCamera();
  }

  private updateCamera(): void {
    this.camera.up.set(0,1,0);
    if(this.cubeMode && !this.overview) {
      const face=CUBE_FACES[this.activeLayer],angle=Math.atan2(5.4,8.8)+this.rotation,pitch=this.settings.pitch*Math.PI/180;
      const target=cubeWorld({x:this.center,y:this.center,layer:this.activeLayer},this.boardSize);
      const normal=new THREE.Vector3(face.n.x,face.n.y,face.n.z);
      const tangent=new THREE.Vector3(face.u.x,face.u.y,face.u.z).multiplyScalar(Math.sin(angle)).addScaledVector(new THREE.Vector3(face.v.x,face.v.y,face.v.z),Math.cos(angle));
      this.camera.position.set(target.x,target.y,target.z).addScaledVector(normal,18*Math.sin(pitch)).addScaledVector(tangent,18*Math.cos(pitch));
      this.camera.up.copy(normal);this.camera.lookAt(target.x,target.y,target.z);this.camera.zoom=this.zoom;this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();return;
    }
    const angle = Math.atan2(5.4, 8.8) + this.rotation + (this.rural ? 0.55 : 0);
    const distance = Math.hypot(5.4, 13.5, 8.8);
    const pitch = this.settings.pitch * Math.PI / 180;
    const radius = distance * Math.cos(pitch);
    const targetHeight = this.cubeMode ? 0 : this.layerCount > 1 ? LAYER_GAP * 0.55 : 0;
    this.camera.position.set(Math.sin(angle) * radius, distance * Math.sin(pitch) + targetHeight, Math.cos(angle) * radius);
    this.camera.lookAt(0, targetHeight, 0);
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  render(time: number, won: boolean): void {
    this.won = won;
    this.street?.update(time, won);
    this.experiment?.update(time, won);
    this.forest?.update(time, won);
    this.rural?.update(time, won);
    this.school?.update(time, won);
    if(this.quantum)this.quantum.update(time,won,new Map([...this.visuals].map(([id,v])=>[id,v.root])));
    if(this.photoelectric)this.photoelectric.update(time,won,new Map([...this.visuals].map(([id,v])=>[id,v.root])));
    if(this.aquarium) {
      this.aquarium.update(time,won,!!this.currentLevel?.aquarium?.gateOpen);
      const shutter=this.visuals.get('gate')?.root.getObjectByName('gate-shutter');if(shutter)shutter.position.y=this.aquarium.gateLift;
      const lamp=this.visuals.get('beacon')?.root.getObjectByName('aquarium-lamp') as THREE.Mesh;
      const light=this.visuals.get('beacon')?.root.getObjectByName('aquarium-lamp-light') as THREE.PointLight;
      (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity=won ? 1.1 : .13;
      light.intensity=won ? 1.6 : 0;
    }
    this.updateForestVisibility();
    const beacon = this.visuals.get('beacon');
    if (beacon?.light) {
      const night = this.theme === 'night';
      beacon.light.emissive.set(night ? '#e2f4ff' : won ? '#e9b955' : '#ffb75c');
      beacon.light.emissiveIntensity = won ? (night ? 2.8 : 0.65) + Math.sin(time * 2) * 0.12 : night ? 0.015 : Math.min(this.beaconEnergy, 1) * 0.4 + 0.04;
      if (beacon.glow) beacon.glow.material.opacity = won ? 0.8 + Math.sin(time * 2) * 0.06 : 0;
      if (beacon.illumination) beacon.illumination.intensity = won ? 7 : 0;
      if (beacon.sweep) { beacon.sweep.visible = won; beacon.sweep.rotation.y = time * 0.28; }
    }
    this.boats.forEach((boat, index) => {
      boat.position.y = boat.userData.baseY + Math.sin(time * 0.9 + index * 2) * 0.035;
      boat.rotation.z = Math.sin(time * 0.7 + index) * 0.035;
    });
    this.selectionMaterial.opacity = 0.65 + Math.sin(time * 3) * 0.15;
    this.sparks.visible = this.won && !this.quantum && !this.forest && !this.rural && !this.school;
    if (this.won && beacon) {
      this.sparks.children.forEach((child, index) => {
        const phase = (time * 0.25 + index / 20) % 1;
        const angle = index * 2.4 + time * 0.2;
        child.position.set(beacon.root.position.x + Math.cos(angle) * (0.35 + phase * 0.7), beacon.root.position.y + 0.8 + phase * 1.7, beacon.root.position.z + Math.sin(angle) * (0.35 + phase * 0.7));
        ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.sin(phase * Math.PI) * 0.8;
      });
    }
    this.renderer.render(this.scene, this.camera);
  }

  atmosphereState() {
    const beacon = this.visuals.get('beacon');
    const state = { theme: this.theme, boats: this.boats.length, lighthouseLit: !!beacon?.illumination?.intensity, sweepVisible: beacon?.sweep?.visible ?? false, ...(this.aquarium?{aquarium:this.aquarium.state()}:{}),...(this.photoelectric?{photoelectric:this.photoelectric.state()}:{}),...(this.quantum?{quantum:this.quantum.state()}:{}) };
    return { ...state, ...(this.street ? { street: this.street.state() } : {}), ...(this.experiment ? { experiment: this.experiment.state() } : {}), ...(this.forest ? { forest: { ...this.forest.state(), recoveryMarkers: [...this.recovery].filter(([, marker]) => marker.visible).map(([id, marker]) => ({ id, opacity: (marker.children[0] as THREE.Sprite).material.opacity })) } } : {}), ...(this.rural ? { rural: this.rural.state() } : {}), ...(this.school ? { school: this.school.state() } : {}) };
  }
}
