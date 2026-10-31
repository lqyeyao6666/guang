import type { Item, Level, Point } from './level.ts';
import { PHOTO_WAVELENGTHS } from './photoelectric-level.ts';
import { beamWidth,boundaryDistance,captureFraction,directionFor,hitDistance,reflected } from './optics.ts';
import type { Divergence,TraceResult } from './optics.ts';

// Exact SI defining constants; the lamp wattage and quantum yield are teaching-model parameters.
export const PLANCK = 6.62607015e-34;
export const LIGHT_SPEED = 299792458;
export const ELECTRON_CHARGE = 1.602176634e-19;
export const HC_EV_NM = PLANCK*LIGHT_SPEED/ELECTRON_CHARGE*1e9;
export interface PhotoelectricState {
  wavelengthNm:number;frequencyTHz:number;cutoffNm:number;photonEv:number;maxKineticEv:number|null;
  incidentPower:number;incidentMicrowatts:number;photonRate:number;electronRate:number;currentMicroamps:number;
  emitting:boolean;relayOn:boolean;coverage:number;delivered:boolean;
}
export function photoelectricResponse(config:NonNullable<Level['photoelectric']>,power:number):PhotoelectricState {
  const photonEv=HC_EV_NM/config.wavelengthNm;
  const incidentMicrowatts=Math.max(0,power)*config.sourceMicrowatts;
  const photonRate=incidentMicrowatts*1e-6/(photonEv*ELECTRON_CHARGE);
  const emitting=photonEv>=config.workFunctionEv&&incidentMicrowatts>1e-12;
  const electronRate=emitting?photonRate*config.quantumEfficiency:0;
  const currentMicroamps=electronRate*ELECTRON_CHARGE*1e6;
  return {wavelengthNm:config.wavelengthNm,frequencyTHz:LIGHT_SPEED/(config.wavelengthNm*1e-9)/1e12,
    cutoffNm:HC_EV_NM/config.workFunctionEv,photonEv,maxKineticEv:emitting?photonEv-config.workFunctionEv:null,
    incidentPower:Math.max(0,power),incidentMicrowatts,photonRate,electronRate,currentMicroamps,emitting,
    relayOn:currentMicroamps>=config.relayThresholdMicroamps,coverage:0,delivered:false};
}

export function tracePhotoelectricLevel(level:Level):TraceResult {
  const config=level.photoelectric!;
  const result:TraceResult={segments:[],received:{beacon:0,photocathode:0},qualifiedReceived:{beacon:0},touched:[],focused:false,loopStopped:false,interactionLimit:false,blocked:[],waypointPasses:{},colorPasses:{},spectrumReceived:{},prismSplits:0,projections:{}};
  const placed=level.items.filter(i=>!i.inInventory),epsilon=1e-6;
  const traceRay=(source:Item,input:number,left:boolean)=>{
    let origin:Point=source,direction=directionFor(source.angle),power=input,focusTravel:number|null=null,divergence:Divergence|undefined,last=source.id,lastOptical='';
    const visited=new Set<string>();
    const color=left?PHOTO_WAVELENGTHS.find(w=>w.nm===config.wavelengthNm)?.color:undefined;
    for(let n=0;n<32;n++) {
      let distance=boundaryDistance(origin,direction,level.size),target:Item|undefined;
      const edge=left?config.splitColumn-.5:config.splitColumn+.5;
      if(left&&direction.x>epsilon||!left&&direction.x< -epsilon)distance=Math.min(distance,(edge-origin.x)/direction.x);
      for(const item of placed) {
        if(item.id===last||item.kind==='source'||(item.x<config.splitColumn)!==left)continue;
        let hit:number|null;
        if(item.kind==='photocell'||item.kind==='beacon') {
          const normal=directionFor(item.angle),denominator=direction.x*normal.x+direction.y*normal.y;
          const distance=Math.abs(denominator)<epsilon? -1:((item.x-origin.x)*normal.x+(item.y-origin.y)*normal.y)/denominator;
          const offset=Math.abs((item.x-origin.x-direction.x*distance)*direction.y-(item.y-origin.y-direction.y*distance)*direction.x);
          const width=beamWidth(focusTravel===null?null:focusTravel+distance,divergence&&{...divergence,travel:divergence.travel+distance});
          hit=distance>epsilon&&captureFraction(width,offset,item.screenHalfWidth??.16)>epsilon?distance:null;
        } else hit=hitDistance(item,origin,direction,focusTravel,divergence);
        if(hit!==null&&hit<distance-epsilon){distance=hit;target=item;}
      }
      const end={x:origin.x+direction.x*distance,y:origin.y+direction.y*distance};
      result.segments.push({start:origin,end,power,focusTravel,divergence:divergence&&{...divergence},sourceId:source.id,color,displayPower:power});
      if(focusTravel!==null)focusTravel+=distance;
      if(divergence)divergence.travel+=distance;
      if(!target)return;
      result.touched.push(target.id);
      const key=`${target.id}:${direction.x.toFixed(5)},${direction.y.toFixed(5)}:${end.x.toFixed(4)},${end.y.toFixed(4)}`;
      if(visited.has(key)){result.loopStopped=true;return;}visited.add(key);
      origin=end;last=target.id;
      if(target.kind==='block'){result.blocked.push(target.id);return;}
      if(target.kind==='mirror'){direction=reflected(direction,target.angle);power*=.95;lastOptical='mirror';continue;}
      if(target.kind==='lens'||target.kind==='concaveLens') {
        power*=.92;lastOptical=target.kind;
        const axis=directionFor(target.angle),aligned=Math.abs(direction.x*axis.x+direction.y*axis.y)>.999;
        if(aligned&&target.kind==='lens'){focusTravel=0;divergence=undefined;result.focused=true;}
        if(aligned&&target.kind==='concaveLens'){divergence={halfWidth:beamWidth(focusTravel,divergence),travel:0};focusTravel=null;}
        continue;
      }
      if(target.kind==='photocell'||target.kind==='beacon') {
        const relative={x:target.x-end.x,y:target.y-end.y},offset=Math.abs(relative.x*direction.y-relative.y*direction.x),width=beamWidth(focusTravel,divergence);
        const axis=directionFor(target.angle),aligned=direction.x*axis.x+direction.y*axis.y>.999;
        const received=aligned?power*captureFraction(width,offset,target.screenHalfWidth??.16):0;
        result.received[target.id]=received;
        if(target.kind==='beacon') {
          const radius=target.screenHalfWidth??.16;
          const coverage=Math.max(0,Math.min(width,offset+radius)-Math.max(-width,offset-radius))/(2*radius);
          const spread=!!divergence&&lastOptical==='concaveLens';
          result.projections[target.id]=[{coverage,halfWidth:width,spread,aligned,received}];
          result.photoelectric!.coverage=aligned?coverage:0;
          if(spread&&aligned&&coverage>=.999){result.qualifiedReceived.beacon=received;result.photoelectric!.delivered=true;}
        }
        return;
      }
      return;
    }
    result.interactionLimit=true;
  };
  traceRay(placed.find(i=>i.id==='source')!,config.intensity,true);
  result.photoelectric=photoelectricResponse(config,result.received.photocathode);
  if(result.photoelectric.relayOn)traceRay(placed.find(i=>i.id==='powered-source')!,1,false);
  return result;
}
