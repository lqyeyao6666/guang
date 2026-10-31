import { traceQuantumLevel } from './quantum-optics.ts';
import type { QuantumState } from './quantum-optics.ts';
import type { Item, Level, Point, SpectrumColor } from './level.ts';
import { LAYER_GAP, SPECTRUM } from './level.ts';
import { cowAtHome } from './rural-rules.ts';
import { traceFusionLevel } from './fusion-optics.ts';
import type { FusionState, RGB } from './fusion-optics.ts';
import { traceCubeLevel } from './cube-optics.ts';
import type { CubeState } from './cube-optics.ts';
import type { Vec3 } from './cube-space.ts';
import { movableBlockHitDistance } from './block-shape.ts';
import { traceRefractionLevel } from './refraction-optics.ts';
import type { RefractionState } from './refraction-optics.ts';
import { tracePhotoelectricLevel } from './photoelectric-optics.ts';
import type { PhotoelectricState } from './photoelectric-optics.ts';

export interface Divergence { halfWidth: number; travel: number }
export interface ProjectionPass { coverage: number; halfWidth: number; spread: boolean; aligned: boolean; received: number }

export interface BeamSegment {
  start: Point;
  end: Point;
  power: number;
  focusTravel: number | null;
  sourceId: string;
  endHeight?: number;
  color?: SpectrumColor;
  divergence?: Divergence;
  rgb?: RGB;
  lineage?: { stage: string; origins: string[] };
  worldStart?: Vec3;
  worldEnd?: Vec3;
  displayPower?: number;
  core?: boolean;
  edge?: boolean;
}
export interface TraceResult {
  segments: BeamSegment[];
  received: Record<string, number>;
  touched: string[];
  focused: boolean;
  loopStopped: boolean;
  interactionLimit: boolean;
  blocked: string[];
  waypointPasses: Record<string, WaypointPass[]>;
  qualifiedReceived: Record<string, number>;
  colorPasses: Record<string, { color: SpectrumColor; deliveredTo: string | null }[]>;
  spectrumReceived: Partial<Record<SpectrumColor, number>>;
  prismSplits: number;
  projections: Record<string, ProjectionPass[]>;
  fusion?: FusionState;
  cube?: CubeState;
  refraction?: RefractionState;
  photoelectric?: PhotoelectricState;
  quantum?:QuantumState;
}

export interface WaypointPass {
  sourceId: string;
  direction: number;
  deliveredTo: string | null;
}

export function waypointProgress(level: Level, result: TraceResult, id: string, beaconId = 'beacon') {
  const waypoint = level.items.find(item => item.id === id);
  const passes = result.waypointPasses[id] ?? [];
  const delivered = passes.filter(pass => pass.deliveredTo === beaconId);
  const directions = [...new Set(passes.map(pass => pass.direction))];
  const sources = [...new Set(passes.map(pass => pass.sourceId))];
  const deliveredDirections = [...new Set(delivered.map(pass => pass.direction))];
  const deliveredSources = [...new Set(delivered.map(pass => pass.sourceId))];
  return { directions, sources, deliveredDirections, deliveredSources,
    complete: deliveredDirections.length >= (waypoint?.requiredDirections ?? 2) && deliveredSources.length >= (waypoint?.requiredSources ?? 2) };
}

export function isLightReady(level: Level, result: TraceResult): boolean {
  if(level.quantum){const s=result.quantum;return !!s?.recordsValid&&s.powered&&s.closed&&s.apparatus&&!!s.bright&&Object.values(s.records).every(Boolean)&&(result.qualifiedReceived.beacon??0)>=level.threshold;}
  if(level.photoelectric)return !!result.photoelectric?.relayOn&&!!result.photoelectric.delivered&&(result.qualifiedReceived.beacon??0)>=level.threshold;
  if(level.aquarium)return !!result.refraction?.delivered&&result.qualifiedReceived.beacon>=level.threshold;
  if (level.cube) return result.cube?.faces.length===6 && result.cube.faces.every(face=>face.arrived && face.energy>1e-6) && result.qualifiedReceived.beacon>=level.threshold;
  if (level.fusion) return !!result.fusion?.stable && result.fusion.yellow.arrived && result.fusion.cyan.arrived && (result.qualifiedReceived.beacon ?? 0) >= level.threshold;
  const beacons = level.items.filter(item => item.kind === 'beacon' && !item.inInventory);
  const waypoints = level.items.filter(item => item.kind === 'waypoint' && !item.inInventory);
  if (level.items.some(item => item.kind === 'cow' && !cowAtHome(item))) return false;
  if (beacons.some(beacon => beacon.screenHalfWidth)) {
    return beacons.length > 0 && beacons.every(beacon => (result.projections[beacon.id] ?? []).some(pass => pass.spread && pass.aligned && pass.coverage >= 0.999 && pass.received >= level.threshold));
  }
  if (level.items.some(item => item.kind === 'colorWaypoint')) {
    return beacons.length > 0 && spectrumProgress(level, result).every(color => color.arrived)
      && beacons.every(beacon => (result.qualifiedReceived[beacon.id] ?? 0) >= level.threshold);
  }
  return beacons.length > 0 && beacons.every(beacon =>
    (waypoints.length ? result.qualifiedReceived[beacon.id] ?? 0 : result.received[beacon.id] ?? 0) >= level.threshold
    && waypoints.every(waypoint => waypointProgress(level, result, waypoint.id, beacon.id).complete));
}

export function spectrumProgress(level: Level, result: TraceResult) {
  return SPECTRUM.map(color => {
    const points = level.items.filter(item => item.kind === 'colorWaypoint' && item.color === color.id);
    return { ...color, energy: result.spectrumReceived[color.id] ?? 0,
      passed: points.length > 0 && points.every(point => result.colorPasses[point.id]?.some(pass => pass.color === color.id)),
      arrived: points.length > 0 && points.every(point => result.colorPasses[point.id]?.some(pass => pass.color === color.id && pass.deliveredTo === 'beacon')) };
  });
}

const epsilon = 1e-6;
const dot = (first: Point, second: Point) => first.x * second.x + first.y * second.y;
const cross = (first: Point, second: Point) => first.x * second.y - first.y * second.x;
const difference = (first: Point, second: Point): Point => ({ x: first.x - second.x, y: first.y - second.y });
export const directionFor = (angle: number): Point => ({ x: Math.cos(angle * Math.PI / 180), y: Math.sin(angle * Math.PI / 180) });

export function reflected(direction: Point, mirrorAngle: number): Point {
  const tangent = directionFor(mirrorAngle);
  const projection = dot(direction, tangent);
  return { x: 2 * projection * tangent.x - direction.x, y: 2 * projection * tangent.y - direction.y };
}

export function beamWidth(focusTravel: number | null, divergence?: Divergence): number {
  if (divergence) return divergence.halfWidth * (1 + divergence.travel / 2);
  return focusTravel === null ? 0.42 : 0.10 + 0.32 * Math.abs(1 - focusTravel / 2);
}

export function captureFraction(halfWidth: number, offset: number, receiverRadius = 0.16): number {
  const overlap = Math.max(0, Math.min(halfWidth, offset + receiverRadius) - Math.max(-halfWidth, offset - receiverRadius));
  return Math.min(1, overlap / (2 * halfWidth));
}

export function boundaryDistance(origin: Point, direction: Point, size: number): number {
  const distances: number[] = [];
  if (Math.abs(direction.x) > epsilon) distances.push(((direction.x > 0 ? size + 0.5 : 0.5) - origin.x) / direction.x);
  if (Math.abs(direction.y) > epsilon) distances.push(((direction.y > 0 ? size + 0.5 : 0.5) - origin.y) / direction.y);
  return Math.min(...distances.filter(distance => distance >= 0));
}

export function hitDistance(item: Item, origin: Point, direction: Point, focusTravel: number | null, divergence?: Divergence): number | null {
  const relative = difference(item, origin);
  if (item.kind === 'block' && item.movable) return movableBlockHitDistance(item, origin, direction);
  if (item.kind === 'block' || item.kind === 'hay' || item.kind === 'cow') {
    let near = -Infinity;
    let far = Infinity;
    for (const axis of ['x', 'y'] as const) {
      if (Math.abs(direction[axis]) < epsilon) {
        if (Math.abs(relative[axis]) > 0.46) return null;
      } else {
        const first = (relative[axis] - 0.46) / direction[axis];
        const second = (relative[axis] + 0.46) / direction[axis];
        near = Math.max(near, Math.min(first, second));
        far = Math.min(far, Math.max(first, second));
      }
    }
    return far >= near && near > epsilon ? near : null;
  }
  if (item.kind === 'mirror') {
    const tangent = directionFor(item.angle);
    const denominator = cross(direction, tangent);
    if (Math.abs(denominator) < epsilon) return null;
    const distance = cross(relative, tangent) / denominator;
    const alongMirror = cross(relative, direction) / denominator;
    return distance > epsilon && Math.abs(alongMirror) <= 0.46 ? distance : null;
  }
  const distance = dot(relative, direction);
  if (distance <= epsilon) return null;
  const offset = Math.abs(cross(relative, direction));
  if (item.kind === 'lens' || item.kind === 'concaveLens') return offset <= 0.42 ? distance : null;
  if (item.kind === 'waypoint') return offset <= 0.18 ? distance : null;
  if (item.kind === 'colorWaypoint') return offset <= 0.18 ? distance : null;
  if (item.kind === 'prism') return offset <= 0.36 ? distance : null;
  if (['splitter', 'mixer', 'booster', 'combiner'].includes(item.kind)) return offset <= 0.28 ? distance : null;
  if (item.kind === 'powerWaypoint') return offset <= 0.18 ? distance : null;
  if (item.kind === 'liftMirror' || item.kind === 'balloonMirror') return offset <= 0.4 ? distance : null;
  if (item.kind === 'beacon') {
    const width = beamWidth(focusTravel === null ? null : focusTravel + distance, divergence && { ...divergence, travel: divergence.travel + distance });
    return captureFraction(width, offset, item.screenHalfWidth ?? 0.16) > epsilon ? distance : null;
  }
  return null;
}

export function traceLevel(level: Level): TraceResult {
  if(level.quantum)return traceQuantumLevel(level);
  if(level.photoelectric)return tracePhotoelectricLevel(level);
  if(level.aquarium)return traceRefractionLevel(level);
  if (level.cube) return traceCubeLevel(level);
  if (level.fusion) return traceFusionLevel(level);
  const result: TraceResult = { segments: [], received: {}, touched: [], focused: false, loopStopped: false, interactionLimit: false, blocked: [], waypointPasses: {}, qualifiedReceived: {}, colorPasses: {}, spectrumReceived: {}, prismSplits: 0, projections: {} };
  const placedItems = level.items.filter(item => !item.inInventory);
  for (const item of placedItems) {
    if (item.kind === 'beacon') { result.received[item.id] = 0; result.qualifiedReceived[item.id] = 0; }
    if (item.kind === 'waypoint') result.waypointPasses[item.id] = [];
    if (item.kind === 'colorWaypoint') result.colorPasses[item.id] = [];
  }
  const touched = new Set<string>();
  for (const source of placedItems.filter(item => item.kind === 'source')) {
    interface Ray {
      origin: Point; direction: Point; power: number; layer: number; color?: SpectrumColor;
      interaction: number; visited: Set<string>; passes: { id: string; pass: WaypointPass }[];
    }
    const rays: Ray[] = [{ origin: { x: source.x, y: source.y }, direction: directionFor(source.angle), power: source.power ?? 1, layer: source.layer ?? 0, interaction: 0, visited: new Set(), passes: [] }];
    while (rays.length) {
    const ray = rays.shift()!;
    let { origin, direction, power, layer } = ray;
    const color = ray.color;
    let focusTravel: number | null = null;
    let divergence: Divergence | undefined;
    let lastOptical: Item['kind'] | null = null;
    let upward = false;
    const visited = ray.visited;
    const passes = ray.passes;
    const colorVisits: { id: string; pass: { color: SpectrumColor; deliveredTo: string | null } }[] = [];
    for (let interaction = ray.interaction; interaction < 32; interaction++) {
      if (upward) {
        const upper = layer + 1;
        const hole = upper < (level.layers ?? 1) && level.holes?.some(hole => (hole.layer ?? 1) === upper && Math.abs(hole.x - origin.x) < epsilon && Math.abs(hole.y - origin.y) < epsilon);
        const receiver = hole ? placedItems.find(item => item.kind === 'balloonMirror' && (item.layer ?? 0) === upper && Math.abs(item.x - origin.x) < epsilon && Math.abs(item.y - origin.y) < epsilon) : undefined;
        const height = !hole ? upper * LAYER_GAP + 0.15 : receiver ? upper * LAYER_GAP + 0.59 : upper * LAYER_GAP + 1.8;
        result.segments.push({ start: { ...origin, layer }, end: { ...origin, layer: upper }, endHeight: height, power, focusTravel, divergence: divergence && { ...divergence }, sourceId: source.id, color });
        if (!hole || !receiver) { result.blocked.push(hole ? 'missing-balloon' : 'ceiling'); break; }
        const key = `vertical:${receiver.id}:${upper}`;
        if (visited.has(key)) { result.loopStopped = true; break; }
        visited.add(key); touched.add(receiver.id);
        if (focusTravel !== null) focusTravel += LAYER_GAP;
        if (divergence) divergence.travel += LAYER_GAP;
        layer = upper; direction = directionFor(receiver.angle); power *= 0.95; upward = false;
        if (interaction === 31) result.interactionLimit = true;
        continue;
      }
      let distance = boundaryDistance(origin, direction, level.size);
      let hit: Item | undefined;
      for (const item of placedItems) {
        if ((item.layer ?? 0) !== layer) continue;
        const candidate = hitDistance(item, origin, direction, focusTravel, divergence);
        if (candidate !== null && candidate < distance - epsilon) {
          distance = candidate;
          hit = item;
        }
      }
      const end = { x: origin.x + direction.x * distance, y: origin.y + direction.y * distance, layer };
      result.segments.push({ start: { ...origin, layer }, end, power, focusTravel, divergence: divergence && { ...divergence }, sourceId: source.id, color });
      if (!hit) break;
      if (focusTravel !== null) focusTravel += distance;
      if (divergence) divergence.travel += distance;
      touched.add(hit.id);
      if (hit.kind === 'beacon') {
        const offset = Math.abs(cross(difference(hit, origin), direction));
        const halfWidth = beamWidth(focusTravel, divergence);
        const received = power * captureFraction(halfWidth, offset, hit.screenHalfWidth ?? 0.16);
        if (hit.screenHalfWidth) {
          const coverage = Math.max(0, Math.min(halfWidth, offset + hit.screenHalfWidth) - Math.max(-halfWidth, offset - hit.screenHalfWidth)) / (2 * hit.screenHalfWidth);
          (result.projections[hit.id] ??= []).push({ coverage, halfWidth, received, spread: !!divergence && lastOptical === 'concaveLens', aligned: dot(direction, directionFor(hit.angle)) > 0.999 });
        }
        result.received[hit.id] += received;
        if (received > epsilon) {
          for (const { pass } of passes) pass.deliveredTo = hit.id;
          for (const { pass } of colorVisits) pass.deliveredTo = hit.id;
          const requiredColors = placedItems.filter(item => item.kind === 'colorWaypoint' && item.color === color);
          const colorQualified = !Object.keys(result.colorPasses).length || !!color && requiredColors.length > 0 && requiredColors.every(point => colorVisits.some(visit => visit.id === point.id));
          if (Object.keys(result.waypointPasses).every(id => passes.some(visit => visit.id === id)) && colorQualified) {
            result.qualifiedReceived[hit.id] += received;
            if (color) result.spectrumReceived[color] = (result.spectrumReceived[color] ?? 0) + received;
          }
        }
        break;
      }
      if (hit.kind === 'block' || hit.kind === 'hay' || hit.kind === 'cow' || hit.kind === 'balloonMirror') { result.blocked.push(hit.id); break; }
      const key = `${layer}:${hit.id}:${end.x.toFixed(4)}:${end.y.toFixed(4)}:${direction.x.toFixed(4)}:${direction.y.toFixed(4)}`;
      if (visited.has(key)) {
        result.loopStopped = true;
        break;
      }
      visited.add(key);
      if (hit.kind === 'prism') {
        // A deliberately exaggerated dispersion fan for a grid puzzle, not a Snell-law simulation.
        // Only aligned white light splits; total outgoing power is 90% of incoming power.
        if (color || dot(direction, directionFor(hit.angle)) < 0.999) { result.blocked.push(hit.id); break; }
        result.prismSplits++;
        for (const band of SPECTRUM) {
          const normal = { x: -direction.y, y: direction.x };
          const length = Math.hypot(1, band.slope);
          rays.push({ origin: end, direction: { x: (direction.x + normal.x * band.slope) / length, y: (direction.y + normal.y * band.slope) / length }, power: power * 0.90 / 7, layer, color: band.id, interaction: interaction + 1, visited: new Set(visited), passes: [...passes] });
        }
        if (interaction === 31) result.interactionLimit = true;
        break;
      } else if (hit.kind === 'colorWaypoint') {
        if (color && color === hit.color) {
          const pass = { color, deliveredTo: null as string | null };
          result.colorPasses[hit.id].push(pass); colorVisits.push({ id: hit.id, pass });
        }
      } else if (hit.kind === 'waypoint') {
        const angle = (Math.atan2(direction.y, direction.x) * 180 / Math.PI + 360) % 360;
        const pass: WaypointPass = { sourceId: source.id, direction: Number(angle.toFixed(3)) % 360, deliveredTo: null };
        result.waypointPasses[hit.id].push(pass); passes.push({ id: hit.id, pass });
      } else if (hit.kind === 'mirror') {
        lastOptical = hit.kind;
        direction = reflected(direction, hit.angle);
        power *= 0.95;
      } else if (hit.kind === 'liftMirror') {
        lastOptical = hit.kind;
        if (dot(direction, directionFor(hit.angle)) < 0.999) { result.blocked.push(hit.id); break; }
        power *= 0.95; upward = true;
      } else if (hit.kind === 'lens') {
        lastOptical = hit.kind;
        power *= 0.92;
        if (Math.abs(dot(direction, directionFor(hit.angle))) > 0.999) {
          focusTravel = 0;
          divergence = undefined;
          result.focused = true;
        }
      } else if (hit.kind === 'concaveLens') {
        lastOptical = hit.kind;
        power *= 0.92;
        if (Math.abs(dot(direction, directionFor(hit.angle))) > 0.999) {
          // Simplified diverging light envelope; it expands a projected patch, not a full image simulation.
          divergence = { halfWidth: beamWidth(focusTravel, divergence), travel: 0 };
          focusTravel = null;
        }
      }
      origin = end;
      if (interaction === 31) result.interactionLimit = true;
    }
    }
  }
  result.touched = [...touched];
  return result;
}

export class WinGate {
  elapsed = 0;
  won = false;
  update(adequate: boolean, delta: number, holdSeconds = 0.6): boolean {
    this.elapsed = adequate ? this.elapsed + Math.min(delta, 0.1) : 0;
    if (this.elapsed >= holdSeconds) this.won = true;
    return this.won;
  }
  reset(): void { this.elapsed = 0; this.won = false; }
}
