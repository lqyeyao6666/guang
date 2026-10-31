import type {Item,Level,Point} from './level.ts';
import {traceLevel,beamWidth,boundaryDistance,captureFraction,directionFor,hitDistance,reflected} from './optics.ts';
import type {TraceResult,Divergence} from './optics.ts';
import {photoelectricResponse} from './photoelectric-optics.ts';
import {snell,tankBoundary} from './refraction-optics.ts';

export interface QuantumArm {arrived:boolean;power:number;opticalLength:number;reflections:number;wetLength:number;rails:string[];direction:Point}
export interface QuantumState {
  powered:boolean;currentMicroamps:number;bluePower:number;closed:boolean;arms:QuantumArm[];
  probabilityA:number;probabilityB:number;loss:number;visibility:number;phase:number;coverage:number;
  apparatus:boolean;bright:'a'|'b'|null;records:{open:boolean;a:boolean;b:boolean};recordsValid:boolean;fingerprint:string;message:string;
}
const epsilon=1e-6,dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y;
export function interferenceProbabilities(a:number,b:number,phase:number){const mean=(a+b)/2,cross=Math.sqrt(Math.max(0,a*b))*Math.cos(phase);return {a:Math.max(0,mean+cross),b:Math.max(0,mean-cross),visibility:a+b>0?2*Math.sqrt(a*b)/(a+b):0};}
export function photonDetection(a:number,b:number,sample:number):'a'|'b'|null {return sample<a?'a':sample<a+b?'b':null;}

export function quantumFingerprint(level:Level):string {
  return JSON.stringify([level.quantum?.water,level.quantum?.wavelengthNm,level.quantum?.phaseWavelength,level.items.map(i=>[i.id,i.kind,i.angle,i.socket?false:!!i.inInventory,i.rail?'phase':i.x,i.rail?'phase':i.y]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))]);
}
export function traceQuantumLevel(level:Level):TraceResult {
  const q=level.quantum!,split=q.splitColumn;
  // Preparation is ordinary multi-photon light. Reuse the existing prism/lens rules.
  const preparation:Level={...level,quantum:undefined,items:level.items.filter(i=>i.x<split||i.inInventory).map(i=>i.kind==='photocell'?{...i,kind:'beacon'}:i)};
  const result=traceLevel(preparation);
  result.segments=result.segments.filter(s=>s.start.x<split-.5).map(s=>{if(s.end.x<=split-.5)return s;const t=(split-.5-s.start.x)/(s.end.x-s.start.x);return {...s,end:{...s.end,x:split-.5,y:s.start.y+(s.end.y-s.start.y)*t}};});
  const cathode=level.items.find(i=>i.kind==='photocell')!,axis=directionFor(cathode.angle);
  const aligned=result.segments.some(s=>s.color==='blue'&&Math.hypot(s.end.x-cathode.x,s.end.y-cathode.y)<.01&&dot(axis,{x:(s.end.x-s.start.x)/Math.hypot(s.end.x-s.start.x,s.end.y-s.start.y),y:(s.end.y-s.start.y)/Math.hypot(s.end.x-s.start.x,s.end.y-s.start.y)})>.999);
  const bluePower=aligned?result.spectrumReceived.blue??0:0;
  const response=photoelectricResponse({splitColumn:split,wavelengthNm:460,intensity:1,sourceMicrowatts:100,quantumEfficiency:.12,workFunctionEv:2.46,relayThresholdMicroamps:.33},bluePower);
  const socket=level.items.find(i=>i.id==='recombiner')!,closed=!socket.inInventory;
  const fingerprint=quantumFingerprint(level),recordsValid=fingerprint===q.fingerprint;
  const state:QuantumState={powered:response.relayOn,currentMicroamps:response.currentMicroamps,bluePower,closed,arms:[],probabilityA:0,probabilityB:0,loss:1,visibility:0,phase:0,coverage:0,apparatus:false,bright:null,records:{...q.records},recordsValid,fingerprint,message:'先接通左区蓝光与聚焦实验。'};
  result.quantum=state;result.received.beacon=0;result.qualifiedReceived.beacon=0;
  if(!state.powered)return result;
  const placed=level.items.filter(i=>!i.inInventory&&i.x>split),water=q.water;
  const waterLevel:Level={...level,aquarium:{...water,gateOpen:false,sensorCharge:0}};
  const inWater=(p:Point)=>p.x>water.minX+epsilon&&p.x<water.minX+water.size-epsilon&&p.y>water.minY+epsilon&&p.y<water.minY+water.size-epsilon;
  const hit=(item:Item,origin:Point,d:Point,focus:number|null,divergence?:Divergence)=>{
    if(item.kind==='beamSplitter')return hitDistance({...item,kind:'mirror'},origin,d,focus,divergence);
    if(item.kind==='photonDetector'){
      const normal=directionFor(item.angle),denom=dot(d,normal);if(Math.abs(denom)<epsilon)return null;
      const distance=dot({x:item.x-origin.x,y:item.y-origin.y},normal)/denom;if(distance<=epsilon)return null;
      const offset=Math.abs((item.x-origin.x)*d.y-(item.y-origin.y)*d.x),width=beamWidth(focus===null?null:focus+distance,divergence&&{...divergence,travel:divergence.travel+distance});
      return captureFraction(width,offset,item.screenHalfWidth)>.000001?distance:null;
    }
    return hitDistance(item,origin,d,focus,divergence);
  };
  interface PathResult {power:number;opticalLength:number;reflections:number;wetLength:number;rails:string[];direction:Point;target:string|null;coverage:number;spread:boolean}
  function follow(start:Point,initial:Point,input:number,sourceId:string,toJoint:boolean):PathResult {
    let origin:Point=start,direction=initial,power=input,inside=inWater(start),opticalLength=0,wetLength=0,reflections=0,last=toJoint?'splitter-first':'recombiner',focus:number|null=null,divergence:Divergence|undefined;
    const rails:string[]=[],visited=new Set<string>();
    const finish=(target:string|null,coverage=0,spread=false):PathResult=>({power,opticalLength,reflections,wetLength,rails,direction,target,coverage,spread});
    for(let n=0;n<32;n++){
      let distance=boundaryDistance(origin,direction,level.size),target:Item|undefined,boundary=tankBoundary(waterLevel,origin,direction);
      if(direction.x< -epsilon)distance=Math.min(distance,(split+.5-origin.x)/direction.x);
      if(boundary&&boundary.distance<distance)distance=boundary.distance;else boundary=null;
      const candidates=toJoint?[...placed.filter(i=>i.id!=='recombiner'),{...socket,inInventory:false}]:placed;
      for(const item of candidates){if(item.id===last||item.kind==='photonSource')continue;const d=hit(item,origin,direction,focus,divergence);if(d!==null&&d<distance-epsilon){distance=d;target=item;boundary=null;}}
      const end={x:origin.x+direction.x*distance,y:origin.y+direction.y*distance};
      result.segments.push({start:origin,end,power:power,displayPower:power*.65,sourceId,color:'blue',focusTravel:focus,divergence:divergence&&{...divergence}});
      opticalLength+=distance*(inside?water.index:1);if(inside)wetLength+=distance;if(focus!==null)focus+=distance;if(divergence)divergence.travel+=distance;
      if(boundary){
        const normal=inside?{x:-boundary.normal.x,y:-boundary.normal.y}:boundary.normal,n1=inside?water.index:1,n2=inside?1:water.index,next=snell(direction,normal,n1,n2);
        if(next){direction=next;inside=!inside;power*=.98;}else{const c=-dot(direction,normal);direction={x:direction.x+2*c*normal.x,y:direction.y+2*c*normal.y};power*=.95;reflections++;}
        origin=end;last='';continue;
      }
      if(!target)return finish(null);
      result.touched.push(target.id);const key=`${target.id}:${direction.x.toFixed(5)},${direction.y.toFixed(5)}`;if(visited.has(key)){result.loopStopped=true;return finish(null);}visited.add(key);origin=end;last=target.id;
      if(target.id==='recombiner'&&toJoint)return finish(target.id);
      if(target.kind==='block'){result.blocked.push(target.id);return finish(null);}
      if(target.kind==='mirror'){direction=reflected(direction,target.angle);power*=.95;reflections++;if(target.rail)rails.push(target.id);continue;}
      if(target.kind==='lens'||target.kind==='concaveLens'){
        power*=.92;const axis=directionFor(target.angle);if(Math.abs(dot(axis,direction))>.999){if(target.kind==='lens'){focus=0;divergence=undefined;}else{divergence={halfWidth:beamWidth(focus,divergence),travel:0};focus=null;}}continue;
      }
      if(target.kind==='photonDetector'){
        const offset=Math.abs((target.x-end.x)*direction.y-(target.y-end.y)*direction.x),width=beamWidth(focus,divergence),radius=target.screenHalfWidth??.42;
        const coverage=Math.max(0,Math.min(width,offset+radius)-Math.max(-width,offset-radius))/(2*radius);
        power*=dot(direction,directionFor(target.angle))>.999?captureFraction(width,offset,radius):0;return finish(target.id,coverage,!!divergence);
      }
      return finish(null);
    }
    result.interactionLimit=true;return finish(null);
  }
  const source=placed.find(i=>i.kind==='photonSource')!,first=placed.find(i=>i.id==='splitter-first')!;
  const sourceDirection=directionFor(source.angle),firstDistance=hit(first,source,sourceDirection,null);
  if(firstDistance===null||placed.some(i=>i.id!==source.id&&i.id!==first.id&&(()=>{const d=hit(i,source,sourceDirection,null);return d!==null&&d<firstDistance-epsilon;})())){state.message='单光子源尚未对齐第一块分束镜。';return result;}
  result.segments.push({start:source,end:first,power:1,displayPower:.22,focusTravel:null,sourceId:'quantum-input',color:'blue'});
  const upper=follow(first,reflected(directionFor(source.angle),first.angle),.49,'quantum-upper',true),lower=follow(first,directionFor(source.angle),.49,'quantum-lower',true);
  state.arms=[upper,lower].map(p=>({...p,arrived:p.target==='recombiner'}));
  if(!state.arms.some(p=>p.arrived)){state.message='先让上下两条通道都抵达合束插座。';return result;}
  const down={x:0,y:1},left={x:-1,y:0};
  const alignedPorts=(!state.arms[0].arrived||dot(upper.direction,down)>.999)&&(!state.arms[1].arrived||dot(lower.direction,left)>.999)&&dot(reflected(down,socket.angle),left)>.999;
  if(!alignedPorts){state.message='两路需从合束镜的不同入口对齐，检查镜面朝向。';return result;}
  // Board phase distances are deliberately magnified: 460nm corresponds to two illustrated units.
  state.phase=2*Math.PI*(upper.opticalLength-lower.opticalLength)/(q.phaseWavelength*q.wavelengthNm/460)+Math.PI*(upper.reflections-lower.reflections);
  const upperPower=state.arms[0].arrived?upper.power:0,lowerPower=state.arms[1].arrived?lower.power:0;
  const probabilities=interferenceProbabilities(upperPower,lowerPower,state.phase);state.visibility=probabilities.visibility;
  const outputStart=result.segments.length;
  const outA=follow(socket,down,1,'quantum-output-a',false),outB=follow(socket,left,1,'quantum-output-b',false);
  const portA=closed?probabilities.a*.98:upperPower,portB=closed?probabilities.b*.98:lowerPower;
  for(const segment of result.segments.slice(outputStart)){const weight=segment.sourceId==='quantum-output-a'?portA:portB;segment.power*=weight;segment.displayPower=segment.power*.65;}
  state.probabilityA=outA.target==='detector-a'?portA*outA.power:0;state.probabilityB=outB.target==='detector-b'?portB*outB.power:0;
  state.loss=Math.max(0,1-state.probabilityA-state.probabilityB);state.coverage=outA.coverage;
  const rails=level.items.filter(i=>i.rail);
  state.apparatus=state.arms.every(a=>a.arrived)&&outA.target==='detector-a'&&outB.target==='detector-b'&&outA.spread&&outA.coverage>=.999&&outA.power>.6&&outB.power>.7
    &&state.arms.some(p=>p.wetLength>1)&&rails.every(i=>state.arms.some(p=>p.rails.includes(i.id)))&&state.visibility>.97;
  const total=state.probabilityA+state.probabilityB;
  if(closed&&state.apparatus&&total>=level.threshold){if(state.probabilityA/total>.985)state.bright='a';if(state.probabilityB/total>.985)state.bright='b';}
  state.message=!state.arms.every(a=>a.arrived)?'只有一路到达，仍会探测到光子，但没有双路干涉。':!state.apparatus?'检查鱼缸通道、两轨镜和A屏的展开覆盖。':!closed?'开放装置已接通，保持片刻记录单次探测。':state.bright?`${state.bright.toUpperCase()}口明亮，另一口变暗；保持片刻留下记录。`:'两路已合束；一起微移两轨镜，寻找明暗最明显的位置。';
  result.received.beacon=Math.max(state.probabilityA,state.probabilityB);result.qualifiedReceived.beacon=state.apparatus?result.received.beacon:0;
  return result;
}

/** Only committed, active experiments write records. Preview never changes a record or its fingerprint. */
export function advanceQuantumExperiment(level:Level,result:TraceResult,delta:number,active=true):boolean {
  const q=level.quantum,s=result.quantum;if(!q||!s)return false;
  if(!active){q.charge=0;q.charging='';return false;}
  if(q.fingerprint!==s.fingerprint){q.fingerprint=s.fingerprint;q.records={open:false,a:false,b:false};q.charge=0;q.charging='';return true;}
  const recording=s.powered&&s.apparatus?(!s.closed&&s.probabilityA>.15&&s.probabilityB>.15?'open':s.bright):null;
  if(!recording||recording!=='open'&&!q.records.open){q.charge=0;q.charging='';return false;}
  if(q.charging!==recording){q.charging=recording;q.charge=0;}
  if(q.records[recording])return false;
  q.charge+=Math.min(.1,Math.max(0,delta));if(q.charge<.65)return false;
  q.records[recording]=true;q.charge=0;return true;
}
