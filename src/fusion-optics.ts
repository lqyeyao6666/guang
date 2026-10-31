import type { Item, Level, Point, SpectrumColor } from './level.ts';
import { SPECTRUM } from './level.ts';
import { boundaryDistance, captureFraction, directionFor, hitDistance, reflected } from './optics.ts';
import type { TraceResult } from './optics.ts';

export type RGB = [number, number, number];
type Route = 'yellow' | 'cyan';
type Role = 'white' | 'native' | 'mixed-yellow' | 'mixed-cyan' | 'boost-yellow' | 'boost-cyan' | 'final';
interface Packet {
  key: string; origin: Point; direction: Point; power: number; rgb: RGB; color?: SpectrumColor;
  role: Role; roots: string[]; nodes: string[]; points: string[]; depth: number; sourceId: string; skip?: string;
}
export interface NodeState { inputs: number; active: boolean; contaminated: boolean; power: number }
export interface FusionState {
  stable: boolean; nodes: Record<string, NodeState>;
  yellow: { mixed: boolean; boosted: boolean; passed: boolean; arrived: boolean; power: number };
  cyan: { mixed: boolean; boosted: boolean; passed: boolean; arrived: boolean; power: number };
}
// Linear additive RGB weights, normalized by radiant power. Native spectral bands
// keep their own identity: native yellow is never treated as two independent rays.
export const BAND_RGB: Record<SpectrumColor, RGB> = {
  red: [1,0,0], orange: [.75,.25,0], yellow: [.5,.5,0], green: [0,1,0],
  cyan: [0,.5,.5], blue: [0,0,1], violet: [.5,0,.5],
};
export function additiveRGB(inputs: { power: number; rgb: RGB }[]): RGB {
  const power = inputs.reduce((sum, input) => sum + input.power, 0);
  return [0,1,2].map(channel => power ? inputs.reduce((sum, input) => sum + input.power * input.rgb[channel], 0) / power : 0) as RGB;
}
const pure = (packet: Packet, color: SpectrumColor) => packet.rgb.every((value, i) => Math.abs(value - BAND_RGB[color][i]) < 1e-7);
const unique = (values: string[]) => [...new Set(values)].sort();
const coupling = (item: Item) => ['splitter','mixer','booster','combiner'].includes(item.kind);

/** A passive coupler consumes ALL simultaneous inputs. Stray colors invalidate
 * its recipe rather than being silently filtered. No state survives a trace. */
function evaluateNode(item: Item, inputs: Packet[]): { outputs: Packet[]; state: NodeState } {
  const state: NodeState = { inputs: inputs.length, active: false, contaminated: false, power: 0 };
  const output = (role: Role, rgb: RGB, power: number, color?: SpectrumColor, angle = item.angle): Packet => ({
    key: `${item.id}:${angle}`, origin: { x:item.x,y:item.y }, direction: directionFor(angle), power, rgb, color, role,
    roots: unique(inputs.flatMap(input => input.roots)), nodes: unique([...inputs.flatMap(input => input.nodes), item.id]),
    points: unique(inputs.flatMap(input => input.points)), depth: Math.max(...inputs.map(input => input.depth)) + 1,
    sourceId: inputs[0].sourceId, skip: item.id,
  });
  let outputs: Packet[] = [];
  const route = item.color as Route;
  if (item.kind === 'splitter') {
    state.contaminated = inputs.some(input => input.role !== 'native' || input.color !== 'green' || !pure(input, 'green')) || inputs.length > 1;
    if (inputs.length === 1 && !state.contaminated) outputs = [0,270].map(angle => output('native', BAND_RGB.green, inputs[0].power * .96 / 2, 'green', angle));
  } else if (item.kind === 'mixer') {
    const colors: SpectrumColor[] = route === 'yellow' ? ['red','green'] : ['green','blue'];
    state.contaminated = inputs.some(input => input.role !== 'native' || !colors.includes(input.color!) || !pure(input, input.color!))
      || inputs.length > 2 || inputs.length === 2 && inputs[0].color === inputs[1].color;
    if (inputs.length === 2 && !state.contaminated) {
      // Passive balancing attenuates the stronger input; it never amplifies the weaker one.
      const usable = Math.min(...inputs.map(input => input.power));
      outputs = [output(`mixed-${route}`, BAND_RGB[route], usable * 2 * .94, route)];
    }
  } else if (item.kind === 'booster') {
    const raw = inputs.filter(input => input.role === 'native' && input.color === route && pure(input, route));
    const mixed = inputs.filter(input => input.role === `mixed-${route}` && pure(input, route));
    state.contaminated = inputs.length > 2 || inputs.some(input => !raw.includes(input) && !mixed.includes(input));
    if (inputs.length === 2 && raw.length === 1 && mixed.length === 1 && !state.contaminated
      && !raw[0].roots.some(root => mixed[0].roots.includes(root))) {
      outputs = [output(`boost-${route}`, BAND_RGB[route], inputs.reduce((sum,input) => sum + input.power,0) * .94, route)];
    }
  } else if (item.kind === 'combiner') {
    const qualified = (route: Route) => inputs.filter(input => input.role === `boost-${route}` && pure(input, route) && input.points.includes(`power-${route}`));
    state.contaminated = inputs.some(input => !qualified('yellow').includes(input) && !qualified('cyan').includes(input)) || inputs.length > 2;
    if (inputs.length === 2 && qualified('yellow').length === 1 && qualified('cyan').length === 1 && !state.contaminated)
      outputs = [output('final', additiveRGB(inputs), inputs.reduce((sum,input) => sum + input.power,0) * .94)];
  }
  state.active = outputs.length > 0; state.power = outputs.reduce((sum,input) => sum + input.power,0);
  return { outputs, state };
}

export function traceFusionLevel(level: Level): TraceResult {
  const items = level.items.filter(item => !item.inInventory);
  const nodes = items.filter(coupling);
  let previous: Packet[] = [];
  let previousSignature = '';
  let result!: TraceResult;
  // Rebuild the entire network each round. A node sees all current inputs,
  // including later-arriving contaminants. The last stable round alone is used.
  for (let round = 0; round < 26; round++) {
    const emptyRoute = () => ({ mixed:false,boosted:false,passed:false,arrived:false,power:0 });
    const fusion: FusionState = { stable:false, nodes:{}, yellow:emptyRoute(), cyan:emptyRoute() };
    result = { segments:[],received:{beacon:0},qualifiedReceived:{beacon:0},touched:[],focused:false,loopStopped:false,interactionLimit:false,blocked:[],waypointPasses:{},colorPasses:{},spectrumReceived:{},prismSplits:0,projections:{},fusion };
    const inbox = new Map(nodes.map(node => [node.id, [] as Packet[]]));
    const queue: Packet[] = [...items.filter(item => item.kind === 'source').map((source): Packet => ({
      key:source.id,origin:source,direction:directionFor(source.angle),power:source.power ?? 1,rgb:[1/3,1/3,1/3],role:'white',roots:[],nodes:[],points:[],depth:0,sourceId:source.id,skip:source.id,
    })), ...previous];
    for (let packetIndex = 0; packetIndex < queue.length; packetIndex++) {
      let packet = queue[packetIndex];
      const visited = new Set<string>();
      for (; packet.depth < 32; packet = { ...packet, depth: packet.depth + 1 }) {
        let distance = boundaryDistance(packet.origin, packet.direction, level.size), target: Item | undefined;
        for (const item of items) {
          if (item.id === packet.skip || item.kind === 'source') continue;
          const hit = hitDistance(item, packet.origin, packet.direction, null);
          if (hit !== null && hit < distance) { distance = hit; target = item; }
        }
        const end = { x:packet.origin.x + packet.direction.x * distance,y:packet.origin.y + packet.direction.y * distance };
        result.segments.push({ start:packet.origin,end,power:packet.power,focusTravel:null,sourceId:packet.sourceId,color:packet.color,rgb:packet.role === 'white' ? undefined : packet.rgb,lineage:{stage:packet.role,origins:[...packet.roots]} });
        if (!target) break;
        result.touched.push(target.id);
        const signature = `${target.id}:${packet.direction.x.toFixed(5)},${packet.direction.y.toFixed(5)}`;
        if (visited.has(signature) || packet.nodes.includes(target.id)) { result.loopStopped = true; break; }
        visited.add(signature);
        packet = { ...packet,origin:end,skip:target.id };
        if (target.kind === 'block') { result.blocked.push(target.id); break; }
        if (target.kind === 'mirror') { packet.direction = reflected(packet.direction,target.angle); packet.power *= .95; continue; }
        if (target.kind === 'prism') {
          const arrow = directionFor(target.angle);
          if (packet.role !== 'white' || packet.direction.x * arrow.x + packet.direction.y * arrow.y < .999) break;
          result.prismSplits++;
          for (const band of SPECTRUM) {
            const length = Math.hypot(1,band.slope), d = { x:(arrow.x - arrow.y * band.slope)/length,y:(arrow.y + arrow.x * band.slope)/length };
            const root = `${packet.sourceId}/${target.id}/${band.id}`;
            queue.push({ ...packet,key:root,direction:d,power:packet.power * .90/7,rgb:BAND_RGB[band.id],color:band.id,role:'native',roots:[root],depth:packet.depth+1 });
          }
          break;
        }
        if (coupling(target)) { inbox.get(target.id)!.push(packet); break; }
        if (target.kind === 'powerWaypoint') {
          const route = target.color as Route;
          if (packet.role === `boost-${route}` && pure(packet,route) && packet.power >= .06) {
            packet.points = unique([...packet.points,target.id]); fusion[route].passed = true;
            fusion[route].power = Math.max(fusion[route].power,packet.power);
            (result.colorPasses[target.id] ??= []).push({ color:route,deliveredTo:null });
          }
          continue;
        }
        if (target.kind === 'beacon') {
          const received = packet.power * captureFraction(.42,Math.hypot(target.x-end.x,target.y-end.y));
          result.received[target.id] = (result.received[target.id] ?? 0) + received;
          if (packet.role === 'final' && ['power-yellow','power-cyan'].every(id => packet.points.includes(id))) {
            result.qualifiedReceived[target.id] = (result.qualifiedReceived[target.id] ?? 0) + received;
            for (const route of ['yellow','cyan'] as const) { fusion[route].arrived = true; (result.colorPasses[`power-${route}`] ??= []).push({color:route,deliveredTo:target.id}); }
          }
          break;
        }
        break;
      }
      if (packet.depth >= 32) result.interactionLimit = true;
    }
    const next: Packet[] = [];
    for (const node of nodes) {
      const evaluated = evaluateNode(node,inbox.get(node.id)!);
      fusion.nodes[node.id] = evaluated.state; next.push(...evaluated.outputs);
    }
    for (const route of ['yellow','cyan'] as const) {
      fusion[route].mixed = !!fusion.nodes[`mix-${route}`]?.active;
      fusion[route].boosted = !!fusion.nodes[`boost-${route}`]?.active;
    }
    const signature = JSON.stringify(next);
    if (signature === previousSignature) { fusion.stable = true; break; }
    previousSignature = signature; previous = next;
  }
  if (!result.fusion!.stable) { result.interactionLimit = true; result.qualifiedReceived = {beacon:0}; }
  result.touched = unique(result.touched); result.blocked = unique(result.blocked);
  return result;
}
