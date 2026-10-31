import type { Item, Level, Point } from './level.ts';
import type { TraceResult } from './optics.ts';
import { boundaryDistance, captureFraction, directionFor, hitDistance, reflected } from './optics.ts';
import { CUBE_FACES, crossCubeEdge, cubeWorld } from './cube-space.ts';
import { CUBE_FACE_ORDER } from './cube-level.ts';

export interface CubeState {
  faces: { layer:number; name:string; passed:boolean; arrived:boolean; energy:number }[];
  splits:number;
  edgeCrossings:number;
}

/** One source and real surface paths. Hiding a face never enters this calculation. */
export function traceCubeLevel(level: Level): TraceResult {
  const cube: CubeState = {faces:CUBE_FACES.map((face,layer)=>({layer,name:face.name,passed:false,arrived:false,energy:0})),splits:0,edgeCrossings:0};
  const result: TraceResult = {segments:[],received:{beacon:0},qualifiedReceived:{beacon:0},touched:[],focused:false,loopStopped:false,interactionLimit:false,blocked:[],waypointPasses:{},colorPasses:{},spectrumReceived:{},prismSplits:0,projections:{},cube};
  const placed = level.items.filter(item=>!item.inInventory);
  const touched = new Set<string>();
  interface Ray { origin:Point; direction:Point; power:number; sourceId:string; steps:number; visited:Set<string>; passed:Set<string>; branchPower:number }
  const queue: Ray[] = placed.filter(item=>item.kind==='source').map(source=>({origin:{x:source.x,y:source.y,layer:source.layer??0},direction:directionFor(source.angle),power:source.power??1,sourceId:source.id,steps:0,visited:new Set(),passed:new Set(),branchPower:source.power??1}));
  let processed=0;
  while(queue.length && processed++<256) {
    const ray=queue.shift()!;
    for(;ray.steps<32;ray.steps++) {
      if(ray.power<1e-8) break;
      const layer=ray.origin.layer??0;
      let distance=boundaryDistance(ray.origin,ray.direction,level.size), hit:Item|undefined;
      for(const item of placed) {
        if((item.layer??0)!==layer || item.kind==='source') continue;
        let candidate:number|null;
        if(item.kind==='cubeWaypoint' || item.kind==='coreMirror') candidate=hitDistance({...item,kind:'waypoint'},ray.origin,ray.direction,null);
        else candidate=hitDistance(item,ray.origin,ray.direction,null);
        if(candidate!==null && candidate<distance-1e-6) {distance=candidate;hit=item;}
      }
      const end:Point={x:ray.origin.x+ray.direction.x*distance,y:ray.origin.y+ray.direction.y*distance,layer};
      result.segments.push({start:{...ray.origin},end,power:ray.power,focusTravel:null,sourceId:ray.sourceId,displayPower:ray.power/Math.max(ray.branchPower,.001)});
      const key=`${layer}:${end.x.toFixed(4)}:${end.y.toFixed(4)}:${ray.direction.x.toFixed(4)}:${ray.direction.y.toFixed(4)}:${hit?.id??'edge'}`;
      if(ray.visited.has(key)) {result.loopStopped=true;break;}
      ray.visited.add(key);
      if(!hit) {
        const next=crossCubeEdge(end,ray.direction,level.size);
        if(!next) {result.blocked.push('cube-corner');break;}
        result.segments.push({start:end,end:next.point,worldStart:cubeWorld(end,level.size,.59),worldEnd:cubeWorld(next.point,level.size,.59),power:ray.power,focusTravel:null,sourceId:ray.sourceId,displayPower:ray.power/Math.max(ray.branchPower,.001),edge:true});
        cube.edgeCrossings++; ray.origin=next.point;ray.direction=next.direction;ray.power*=.95;
      } else {
        touched.add(hit.id);
        if(hit.kind==='block') {result.blocked.push(hit.id);break;}
        if(hit.kind==='cubeWaypoint') {cube.faces[layer].passed=true;ray.passed.add(hit.id);ray.steps--;}
        else if(hit.kind==='coreMirror') {
          const target=directionFor(hit.angle);
          if(ray.direction.x*target.x+ray.direction.y*target.y<.999) {result.blocked.push(hit.id);break;}
          const center=(level.size+1)/2;
          if(Math.abs(hit.x-center)>1e-6 || Math.abs(hit.y-center)>1e-6) {result.blocked.push(hit.id);break;}
          const order=CUBE_FACE_ORDER.indexOf(layer as typeof CUBE_FACE_ORDER[number]);
          const fraction=1/(6-order);
          const inwardPower=ray.power*.96*fraction*.95;
          const power=inwardPower*captureFraction(.42,0);
          const point=placed.find(item=>item.kind==='cubeWaypoint' && item.layer===layer);
          const qualified=!!point && ray.passed.has(point.id);
          result.received.beacon+=power;
          if(qualified) {cube.faces[layer].arrived=true;cube.faces[layer].energy+=power;result.qualifiedReceived.beacon+=power;}
          result.segments.push({start:end,end:{x:center,y:center,layer:-1},worldStart:cubeWorld(end,level.size,.59),worldEnd:{x:0,y:0,z:0},power:inwardPower,focusTravel:null,sourceId:ray.sourceId,displayPower:ray.power*.95/Math.max(ray.branchPower,.001),core:true});
          touched.add('beacon');
          if(fraction===1) break;
          cube.splits++;ray.power*=.96*(1-fraction);ray.branchPower=ray.power;
        } else if(hit.kind==='mirror') {ray.direction=reflected(ray.direction,hit.angle);ray.power*=.95;}
        ray.origin=end;
      }
      if(ray.steps===31) result.interactionLimit=true;
    }
  }
  if(queue.length) result.interactionLimit=true;
  result.touched=[...touched];return result;
}
