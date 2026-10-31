import type { Item, Level, Point } from './level.ts';
import type { TraceResult } from './optics.ts';
import { boundaryDistance, captureFraction, directionFor, hitDistance, reflected } from './optics.ts';

const epsilon = 1e-6;
const dot = (a:Point,b:Point) => a.x*b.x+a.y*b.y;
export interface RefractionEvent { point:Point; entering:boolean; totalReflection:boolean; incident:number; transmitted:number; n1:number; n2:number }
export interface RefractionState { events:RefractionEvent[]; entered:boolean; exited:boolean; bent:boolean; sensorPower:number; rails:string[]; observations:string[]; gateCrossed:boolean; delivered:boolean }

/** Normal points back into the incident medium. Null means total internal reflection. */
export function snell(direction:Point, normal:Point, n1:number, n2:number):Point|null {
  const ratio=n1/n2,cosine=-dot(direction,normal),k=1-ratio*ratio*(1-cosine*cosine);
  if(k < -epsilon) return null;
  const correction=ratio*cosine-Math.sqrt(Math.max(0,k));
  return {x:ratio*direction.x+correction*normal.x,y:ratio*direction.y+correction*normal.y};
}

export function tankBoundary(level:Level, origin:Point, direction:Point) {
  const tank=level.aquarium!;
  let nearest=Infinity,normal:Point={x:0,y:0};
  for(const axis of ['x','y'] as const) for(const side of [0,1]) {
    const value=(axis==='x'?tank.minX:tank.minY)+side*tank.size;
    if(Math.abs(direction[axis])<epsilon)continue;
    const distance=(value-origin[axis])/direction[axis];
    const other=axis==='x'?'y':'x',coordinate=origin[other]+distance*direction[other],minimum=other==='x'?tank.minX:tank.minY;
    if(distance>epsilon&&distance<nearest&&coordinate>=minimum-epsilon&&coordinate<=minimum+tank.size+epsilon) {
      nearest=distance;normal=axis==='x'?{x:side?1:-1,y:0}:{x:0,y:side?1:-1};
    }
  }
  return Number.isFinite(nearest)?{distance:nearest,normal}:null;
}

export function traceRefractionLevel(level:Level):TraceResult {
  const water:RefractionState={events:[],entered:false,exited:false,bent:false,sensorPower:0,rails:[],observations:[],gateCrossed:false,delivered:false};
  const result:TraceResult={segments:[],received:{beacon:0},qualifiedReceived:{beacon:0},touched:[],focused:false,loopStopped:false,interactionLimit:false,blocked:[],waypointPasses:{},colorPasses:{},spectrumReceived:{},prismSplits:0,projections:{},refraction:water};
  const source=level.items.find(i=>i.kind==='source')!,tank=level.aquarium!;
  let origin:Point=source,direction=directionFor(source.angle),power=source.power??1,last=source.id;
  let inside=origin.x>tank.minX&&origin.x<tank.minX+tank.size&&origin.y>tank.minY&&origin.y<tank.minY+tank.size;
  const visited=new Set<string>();
  const passes:{id:string;direction:number}[]=[];
  for(let step=0;step<32;step++) {
    let distance=boundaryDistance(origin,direction,level.size),target:Item|undefined;
    let boundary=tankBoundary(level,origin,direction);
    if(boundary&&boundary.distance<distance)distance=boundary.distance;else boundary=null;
    for(const item of level.items) {
      if(item.inInventory||item.id===last||item.kind==='source')continue;
      let hit:number|null;
      if(item.kind==='sensor') {
        const relative={x:item.x-origin.x,y:item.y-origin.y},d=dot(relative,direction);
        hit=d>epsilon&&Math.abs(relative.x*direction.y-relative.y*direction.x)<=.18?d:null;
      } else if(item.kind==='gate')hit=hitDistance({...item,kind:'block'},origin,direction,null);
      else hit=hitDistance(item,origin,direction,null);
      if(hit!==null&&hit<distance){distance=hit;target=item;boundary=null;}
    }
    const end={x:origin.x+direction.x*distance,y:origin.y+direction.y*distance};
    result.segments.push({start:origin,end,power,sourceId:source.id,focusTravel:null});
    if(boundary) {
      const normal=inside?{x:-boundary.normal.x,y:-boundary.normal.y}:boundary.normal;
      const n1=inside?tank.index:1,n2=inside?1:tank.index,next=snell(direction,normal,n1,n2);
      const incident=Math.acos(Math.max(-1,Math.min(1,-dot(direction,normal))))*180/Math.PI;
      water.events.push({point:end,entering:!inside,totalReflection:!next,incident,transmitted:next?Math.acos(Math.max(-1,Math.min(1,-dot(next,normal))))*180/Math.PI:incident,n1,n2});
      if(next){water.bent ||= Math.abs(next.x-direction.x)+Math.abs(next.y-direction.y)>epsilon;water.entered ||= !inside;water.exited ||= inside;inside=!inside;direction=next;power*=.98;}
      else {direction={x:direction.x+2*Math.cos(incident*Math.PI/180)*normal.x,y:direction.y+2*Math.cos(incident*Math.PI/180)*normal.y};power*=.95;}
      origin=end;last='';continue;
    }
    if(!target)return result;
    result.touched.push(target.id);
    const signature=`${target.id}:${direction.x.toFixed(5)},${direction.y.toFixed(5)}:${inside}`;
    if(visited.has(signature)){result.loopStopped=true;return result;}visited.add(signature);
    origin=end;last=target.id;
    if(target.kind==='block'||target.kind==='gate'&&!tank.gateOpen){result.blocked.push(target.id);return result;}
    if(target.kind==='gate'){water.gateCrossed=true;continue;}
    if(target.kind==='mirror') {
      if(target.rail&&water.exited&&!water.rails.includes(target.id))water.rails.push(target.id);
      direction=reflected(direction,target.angle);power*=.95;continue;
    }
    if(target.kind==='sensor') {
      if(water.entered&&water.exited&&water.bent)water.sensorPower=power*captureFraction(.42,Math.hypot(target.x-end.x,target.y-end.y));
      return result;
    }
    if(target.kind==='waypoint') {
      if(!water.observations.includes(target.id))water.observations.push(target.id);
      passes.push({id:target.id,direction:(Math.round(Math.atan2(direction.y,direction.x)*180/Math.PI)+360)%360});
      (result.waypointPasses[target.id]??=[]).push({sourceId:source.id,direction:passes.at(-1)!.direction,deliveredTo:null});continue;
    }
    if(target.kind==='beacon') {
      const received=power*captureFraction(.42,Math.hypot(target.x-end.x,target.y-end.y));result.received.beacon=received;
      const qualified=water.entered&&water.exited&&water.bent&&tank.gateOpen&&water.gateCrossed
        &&level.items.filter(i=>i.rail).every(i=>water.rails.includes(i.id))&&level.items.filter(i=>i.kind==='waypoint').every(i=>water.observations.includes(i.id));
      if(qualified){water.delivered=true;result.qualifiedReceived.beacon=received;for(const list of Object.values(result.waypointPasses))for(const pass of list)pass.deliveredTo=target.id;}
      return result;
    }
    return result;
  }
  result.interactionLimit=true;return result;
}

/** Called only with the committed trace; preview, hidden pages and dialogs never charge the latch. */
export function advanceAquariumGate(level:Level, result:TraceResult, delta:number, active=true):boolean {
  const tank=level.aquarium;if(!tank||tank.gateOpen)return false;
  tank.sensorCharge=active&&(result.refraction?.sensorPower??0)>=.20?tank.sensorCharge+Math.min(Math.max(delta,0),.1):0;
  if(tank.sensorCharge+.000001<.45)return false;
  tank.gateOpen=true;tank.sensorCharge=.45;return true;
}
