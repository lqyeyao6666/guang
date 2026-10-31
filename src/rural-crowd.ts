import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

type Role = 'adult' | 'runner' | 'tree' | 'shoulder';
interface Person {
  name: string; role: Role; root: THREE.Group; hips: THREE.Group; head: THREE.Group; torso: THREE.Group;
  arms: THREE.Group[]; elbows: THREE.Group[]; legs: THREE.Group[]; knees: THREE.Group[];
  chat: THREE.Vector3; target: THREE.Vector3; route: THREE.Vector3[]; curve?: THREE.CatmullRomCurve3;
  u: number; speed: number; sit: number; climb: number; arrived: boolean; seed: number;
}
const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
function box(parent: THREE.Group, w: number, h: number, d: number, color: string, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.2), mat(color));
  mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function ball(parent: THREE.Group, r: number, color: string, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
}
const ground = -0.39;
const v = (x: number, z: number) => new THREE.Vector3(x, ground, z);
const smooth = (t: number) => t * t * (3 - 2 * t);
const turn = (from: number, to: number, amount: number) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * Math.min(1, amount);

/** A separate story scene: all routes stay outside the board and never affect the puzzle. */
export class RuralCrowd {
  readonly root = new THREE.Group();
  private readonly people: Person[] = [];
  private clock = 0;
  private previous: number | null = null;
  private won = false;
  private readonly treeBase = v(7.35, -4.0);

  constructor() {
    box(this.root, 3.5, 0.045, 5.6, '#686458', 6.5, -0.43, -1.8);
    this.tree();
    const names = ['爷爷', '奶奶', '爸爸', '妈妈', '哥哥', '姐姐', '追逐的男孩', '追逐的女孩', '树上的孩子', '肩头的小宝宝'];
    const colors = ['#839a9c', '#a98b94', '#7e9f8e', '#b39183', '#819ab8', '#b898a8', '#d5ae6a', '#c98077', '#91b29b', '#e2bb81'];
    const chats = [v(5.65, -2.7), v(6.25, -2.6), v(5.85, -1.1), v(6.52, -1.3), v(6.3, 0.05), v(6.95, -0.25)];
    const seats = [v(5.65, -2.95), v(6.38, -2.48), v(5.45, -1.15), v(6.18, -0.78), v(6.95, -1.9), v(6.7, 0.14), v(5.27, 0.1), v(6.43, -3.3), v(6.92, -4.0), v(5.45, -1.15)];
    const loop = new THREE.CatmullRomCurve3([v(5.06, -3.6), v(6.9, -3.55), v(7.5, -2.3), v(7.45, 0.48), v(5.25, 0.62), v(5.02, -1.25)], true, 'centripetal');
    const treeLoop = new THREE.CatmullRomCurve3([v(6.65, -4.0), v(7.3, -4.72), v(8.0, -3.9), v(7.3, -3.28)], true, 'centripetal');
    names.forEach((name, index) => {
      const person = this.person(name, colors[index], index);
      person.target.copy(seats[index]);
      if (index < 6) person.chat.copy(chats[index]);
      else if (index < 8) { person.curve = loop; person.u = index === 6 ? 0.08 : 0.58; }
      else if (index === 8) { person.curve = treeLoop; person.u = 0.38; }
      this.people.push(person); this.root.add(person.root);
    });
    this.reset();
  }

  private person(name: string, color: string, seed: number): Person {
    const role: Role = seed < 6 ? 'adult' : seed < 8 ? 'runner' : seed === 8 ? 'tree' : 'shoulder';
    const root = new THREE.Group(), hips = new THREE.Group(), torso = new THREE.Group(), head = new THREE.Group();
    root.add(hips); hips.add(torso); torso.add(head); head.position.set(0, 0.52, 0.015);
    root.scale.setScalar(role === 'shoulder' ? 0.52 : role === 'adult' ? 1 : 0.72);
    box(torso, 0.32, 0.35, 0.22, color, 0, 0.18, 0);
    ball(head, 0.145, '#dfbca0', 0, 0, 0);
    const hair = ball(head, 0.15, seed < 2 ? '#bdc4bd' : '#3e4346', 0, 0.07, -0.015); hair.scale.y = seed % 2 ? 0.65 : 0.45;
    if (seed % 2 && role !== 'shoulder') ball(head, 0.078, seed < 2 ? '#bdc4bd' : '#3e4346', 0, 0.07, -0.13);
    for (const side of [-1, 1]) ball(head, 0.01, '#3e474d', side * 0.047, 0.01, 0.14);
    const arms: THREE.Group[] = [], elbows: THREE.Group[] = [], legs: THREE.Group[] = [], knees: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * (role === 'shoulder' ? 0.21 : 0.085), 0, 0); hips.add(leg); legs.push(leg);
      box(leg, 0.12, 0.25, 0.14, '#4b5c6c', 0, -0.125, 0);
      const knee = new THREE.Group(); knee.position.y = -0.25; leg.add(knee); knees.push(knee);
      box(knee, 0.115, 0.23, 0.13, '#4b5c6c', 0, -0.115, 0); box(knee, 0.14, 0.075, 0.22, '#394346', 0, -0.265, 0.035);
      const arm = new THREE.Group(); arm.position.set(side * 0.21, 0.3, 0); torso.add(arm); arms.push(arm);
      box(arm, 0.09, 0.18, 0.1, color, 0, -0.09, 0);
      const elbow = new THREE.Group(); elbow.position.y = -0.18; arm.add(elbow); elbows.push(elbow);
      box(elbow, 0.08, 0.14, 0.09, color, 0, -0.07, 0); ball(elbow, 0.049, '#dfbca0', 0, -0.15, 0);
    }
    return { name, role, root, hips, torso, head, arms, elbows, legs, knees, chat: v(0, 0), target: v(0, 0), route: [], u: 0, speed: seed === 7 ? 1.52 : 1.34, sit: 0, climb: 0, arrived: false, seed };
  }

  private tree(): void {
    const tree = new THREE.Group(); tree.position.copy(this.treeBase); this.root.add(tree);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 1.8, 12), mat('#88755e'));
    trunk.position.y = 0.9; trunk.castShadow = true; tree.add(trunk);
    const branch = box(tree, 0.67, 0.095, 0.13, '#8f7b61', -0.25, 1.03, 0); branch.rotation.z = -0.1;
    for (const [x, y, z, r] of [[0, 1.92, 0, 0.65], [-0.48, 1.66, -0.08, 0.48], [0.4, 1.73, 0.03, 0.5], [0.05, 2.25, -0.1, 0.43]]) {
      const leaves = ball(tree, r, '#698c75', x, y, z); leaves.scale.y = 0.8;
    }
  }

  reset(): void {
    this.clock = 0; this.previous = null; this.won = false;
    for (const person of this.people) {
      person.sit = person.climb = 0; person.arrived = false; person.route = [];
      if (person.role === 'runner') person.u = person.seed === 6 ? 0.08 : 0.58;
      if (person.role === 'tree') person.u = 0.38;
      if (person.role === 'adult') {
        person.root.position.copy(person.chat);
        const partner = this.people[person.seed ^ 1];
        person.root.rotation.y = Math.atan2(partner.chat.x - person.chat.x, partner.chat.z - person.chat.z);
      } else if (person.curve) person.root.position.copy(person.curve.getPointAt(person.u));
    }
    this.before(0, 0);
  }

  private before(delta: number, time: number): void {
    for (const person of this.people) {
      if (person.role === 'shoulder') continue;
      person.hips.position.y = 0.59;
      if (person.role === 'adult') {
        const partner = this.people[person.seed ^ 1];
        person.root.position.copy(person.chat);
        person.root.position.x += Math.sin(time * 0.6 + person.seed) * 0.018;
        person.root.rotation.y = Math.atan2(partner.chat.x - person.chat.x, partner.chat.z - person.chat.z) + Math.sin(time * 0.43 + person.seed) * 0.06;
        person.torso.rotation.z = Math.sin(time * 0.8 + person.seed * 2) * 0.025;
        person.head.rotation.x = Math.sin(time * (0.8 + person.seed * 0.07) + person.seed) * 0.06;
        person.head.rotation.y = Math.sin(time * 0.63 + person.seed * 3) * 0.09;
        person.arms.forEach((arm, side) => {
          const gesture = Math.max(0, Math.sin(time * (0.72 + person.seed * 0.04) + person.seed * 2.1 + side * 1.9));
          arm.rotation.x = -gesture * (side ? 0.55 : 0.38); arm.rotation.z = (side ? 1 : -1) * gesture * 0.17;
          person.elbows[side].rotation.x = -gesture * 0.7;
        });
        person.legs.forEach(leg => { leg.rotation.set(0, 0, 0); }); person.knees.forEach(knee => { knee.rotation.x = 0; });
      } else {
        const curve = person.curve!, length = curve.getLength();
        let speed = person.speed * (1 + Math.sin(time * 0.81 + person.seed * 1.7) * 0.15);
        for (const other of this.people.filter(other => other !== person && other.curve === curve)) {
          const gap = (other.u - person.u + 1) % 1 * length;
          if (gap < 0.9) speed *= THREE.MathUtils.clamp((gap - 0.2) / 0.7, 0.25, 1);
        }
        person.u = (person.u + delta * speed / length) % 1;
        person.root.position.copy(curve.getPointAt(person.u));
        const tangent = curve.getTangentAt(person.u); person.root.rotation.y = Math.atan2(tangent.x, tangent.z);
        this.walkPose(person, time, 1);
        person.hips.position.y += Math.abs(Math.sin(time * 10 + person.seed)) * 0.025;
      }
    }
    this.shoulder(time);
  }

  private walkPose(person: Person, time: number, amount: number): void {
    person.torso.rotation.z *= 0.8; person.head.rotation.set(0, 0, 0);
    person.legs.forEach((leg, side) => { leg.rotation.set(Math.sin(time * 9 + person.seed + side * Math.PI) * 0.48 * amount, 0, 0); person.knees[side].rotation.x = Math.max(0, -Math.sin(time * 9 + person.seed + side * Math.PI)) * 0.35 * amount; });
    person.arms.forEach((arm, side) => { arm.rotation.set(-Math.sin(time * 9 + person.seed + side * Math.PI) * 0.38 * amount, 0, 0); person.elbows[side].rotation.x = -0.28 * amount; });
  }

  private plan(): void {
    for (const person of this.people.filter(person => person.role !== 'shoulder')) {
      const destination = person.role === 'tree' ? this.treeBase.clone().add(new THREE.Vector3(-0.22, 0, 0.25)) : person.target;
      person.route = [destination.clone()];
      person.arrived = false; person.sit = person.climb = 0;
    }
  }

  update(time: number, won: boolean): void {
    const delta = this.previous === null ? 0 : Math.max(0, Math.min(time - this.previous, 0.1)); this.previous = time; this.clock += delta;
    if (!won) {
      if (this.won) this.reset();
      this.won = false; this.before(delta, this.clock); return;
    }
    if (!this.won) this.plan(); this.won = true;
    const instant = time === 0;
    for (const person of this.people.filter(person => person.role !== 'shoulder')) {
      if (instant) { person.route = []; person.arrived = true; person.sit = person.climb = 1; }
      let remaining = delta * (person.role === 'adult' ? person.seed < 2 ? 0.75 : 1.05 : 1.5);
      while (person.route.length && remaining >= 0) {
        const target = person.route[0], distance = person.root.position.distanceTo(target);
        if (distance > remaining) {
          const vector = target.clone().sub(person.root.position);
          person.root.rotation.y = turn(person.root.rotation.y, Math.atan2(vector.x, vector.z), delta * 6);
          person.root.position.addScaledVector(vector, remaining / distance); break;
        }
        person.root.position.copy(target); remaining -= distance; person.route.shift();
      }
      person.arrived = person.route.length === 0;
      if (!person.arrived) { person.hips.position.y = 0.59; this.walkPose(person, this.clock, 0.7); continue; }
      if (person.role === 'tree') {
        person.climb = instant ? 1 : Math.min(1, person.climb + delta / 1.3);
        const climb = smooth(person.climb);
        person.root.position.copy(this.treeBase).add(new THREE.Vector3(-0.22 - climb * 0.21, climb * 0.94, (1 - climb) * 0.25));
        if (person.climb < 1) {
          this.walkPose(person, this.clock, 0.5);
          person.arms.forEach((arm, i) => { arm.rotation.x = -1.8 + Math.sin(this.clock * 8 + i * Math.PI) * 0.2; });
          continue;
        }
      } else person.root.position.copy(person.target);
      person.sit = instant ? 1 : Math.min(1, person.sit + delta / 0.95);
      const ease = smooth(person.sit);
      person.root.rotation.y = turn(person.root.rotation.y, Math.atan2(3 - person.root.position.x, -3 - person.root.position.z), instant ? 1 : delta * 3);
      person.hips.position.y = 0.59 - ease * 0.33; person.torso.rotation.set(-ease * 0.045, 0, 0);
      person.head.rotation.set(Math.sin(this.clock * 0.5 + person.seed) * 0.012, 0, 0);
      person.legs.forEach((leg, i) => { leg.rotation.set(-ease * Math.PI / 2, 0, (i ? 1 : -1) * ease * 0.16); person.knees[i].rotation.x = ease * Math.PI / 2; });
      person.arms.forEach((arm, i) => { arm.rotation.set(-ease * 0.72, 0, 0); person.elbows[i].rotation.x = -ease * 0.2; });
    }
    this.shoulder(this.clock);
  }

  private shoulder(time: number): void {
    const child = this.people[9], parent = this.people[2];
    child.root.position.copy(parent.root.position);
    child.root.position.y += parent.hips.position.y + 0.5;
    child.root.rotation.y = parent.root.rotation.y;
    child.hips.position.y = 0.26; child.torso.rotation.set(0, 0, 0);
    child.legs.forEach((leg, i) => { leg.rotation.x = -0.55; child.knees[i].rotation.x = 0.7; });
    child.arms.forEach((arm, i) => { arm.rotation.x = this.won ? -0.3 : -0.25 - Math.max(0, Math.sin(time * 1.8 + i * 2)) * 0.6; });
    child.head.rotation.y = this.won ? Math.sin(time * 0.4) * 0.04 : Math.sin(time * 1.1) * 0.18;
  }

  state() {
    const seated = this.people.filter(person => person.role !== 'shoulder');
    const progress = this.won ? Math.min(...seated.map(person => person.sit)) : 0;
    return { audience: this.people.length, audiencePhase: !this.won ? 'chatting-and-playing' : progress < 1 ? 'settling' : 'watching', seatProgress: progress,
      chattingAdults: this.won ? 0 : 6, playingChildren: this.won ? 0 : 3, treeChildren: this.won && this.people[8].climb === 1 ? 1 : 0, shoulderChildren: 1,
      ages: this.people.map(person => person.name), people: this.people.map(person => ({ name: person.name, role: person.role, position: person.root.position.toArray(), heading: person.root.rotation.y, sit: person.sit, climb: person.climb, armAngles: person.arms.map(arm => arm.rotation.x) })) };
  }
}
