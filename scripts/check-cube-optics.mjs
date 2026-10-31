import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createLevel,canPlace,moveItem,rotateItem,storeItem,levelSummaries} from '../src/level.ts';
import {traceLevel,isLightReady,WinGate} from '../src/optics.ts';
import {CUBE_SOLUTION,CUBE_FACE_ORDER} from '../src/cube-level.ts';
import {CUBE_FACES,cubeWorld,cubeLocal,crossCubeEdge} from '../src/cube-space.ts';
const verified=[];
const check=(name,fn)=>{fn();verified.push(name);console.log('PASS',name);};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const solve=()=>{
 const level=createLevel(11);
 for(const [layer,face] of CUBE_SOLUTION.entries()) {
  for(const [index,[x,y,angle]] of face.mirrors.entries()) {
   const id=`cube-mirror-${layer}-${index}`;assert.ok(moveItem(level,id,{x,y,layer}));level.items.find(item=>item.id===id).angle=angle;
  }
  const id=`cube-core-${layer}`;assert.ok(moveItem(level,id,{x:4,y:4,layer}));level.items.find(item=>item.id===id).angle=face.angle;
 }
 return level;
};
check('第一章第五关保留全部旧链接，一盏底灯、六面、六点及独立悬浮终点',()=>{
 const level=createLevel(11);
 assert.equal(level.chapter,1);assert.equal(level.chapterLevel,5);assert.equal(level.theme,'garden');assert.equal(level.layers,6);
 assert.deepEqual(levelSummaries.slice(0,6).map(entry=>entry.number),[1,2,4,6,11,3]);
 assert.equal(level.items.filter(item=>item.kind==='source').length,1);assert.equal(level.items.find(item=>item.kind==='source').layer,0);
 assert.equal(level.items.filter(item=>item.kind==='cubeWaypoint').length,6);
 assert.equal(level.items.filter(item=>item.inInventory && item.kind==='mirror').length,12);
 assert.equal(level.items.filter(item=>item.inInventory && item.kind==='coreMirror').length,6);
 assert.equal(level.items.filter(item=>item.kind==='block').length,36);
 assert.deepEqual(cubeWorld(level.items.find(item=>item.id==='beacon')), {x:0,y:0,z:0});
});
check('六面是同一立方体的六个真实正交面，局部坐标可双向转换',()=>{
 const centers=CUBE_FACES.map((_,layer)=>cubeWorld({x:4,y:4,layer}));
 assert.equal(new Set(centers.map(p=>JSON.stringify(p))).size,6);
 for(let layer=0;layer<6;layer++) for(const [x,y] of [[1,1],[4,4],[7,2]]) {
  const point=cubeLocal(cubeWorld({x,y,layer}),layer);near(point.x,x);near(point.y,y);
 }
});
check('24 条有向棱边双向连续，不会穿空转移或跳过面',()=>{
 for(let layer=0;layer<6;layer++) for(const [x,y,dx,dy] of [[.5,3,-1,0],[7.5,3,1,0],[3,.5,0,-1],[3,7.5,0,1]]) {
  const next=crossCubeEdge({x,y,layer},{x:dx,y:dy});assert.ok(next);assert.notEqual(next.point.layer,layer);
  const a=cubeWorld({x,y,layer}),b=cubeWorld(next.point);
  near(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z),1e-5);
  const boundary={...next.point,x:next.point.x-next.direction.x*1e-5,y:next.point.y-next.direction.y*1e-5};
  const reverse=crossCubeEdge(boundary,{x:-next.direction.x,y:-next.direction.y});assert.equal(reverse.point.layer,layer);
 }
 assert.equal(crossCubeEdge({x:.5,y:.5,layer:0},{x:-Math.SQRT1_2,y:-Math.SQRT1_2}),null);
});
check('初始只有底面光路，其他五面没有光、没有分光或跨棱边接通',()=>{
 const trace=traceLevel(createLevel(11));assert.equal(isLightReady(createLevel(11),trace),false);
 assert.equal(trace.cube.splits,0);assert.equal(trace.cube.edgeCrossings,0);
 assert.ok(trace.segments.every(segment=>segment.start.layer===0 && segment.end.layer===0));
 assert.ok(trace.cube.faces.every(face=>!face.passed && !face.arrived));near(trace.received.beacon,0);
});
check('完整真实光路：六面各两面镜、向心反射，六束同时汇入几何中心',()=>{
 const level=solve(),trace=traceLevel(level);assert.equal(isLightReady(level,trace),true);
 assert.ok(trace.cube.faces.every(face=>face.passed && face.arrived && face.energy>0));
 assert.equal(trace.segments.filter(segment=>segment.core).length,6);
 assert.equal(new Set(trace.segments.filter(segment=>segment.core).map(segment=>segment.start.layer)).size,6);
 for(const segment of trace.segments.filter(segment=>segment.core)) {assert.deepEqual(segment.worldEnd,{x:0,y:0,z:0});assert.equal(segment.sourceId,'source');}
 assert.equal(trace.interactionLimit,false);assert.equal(trace.loopStopped,false);
 near(trace.cube.faces.reduce((sum,face)=>sum+face.energy,0),trace.qualifiedReceived.beacon);
});
check('逐面接力：未摆镜的下游无光，任一上游转错都会切断后续各面',()=>{
 const level=createLevel(11);
 for(const [order,layer] of CUBE_FACE_ORDER.entries()) {
  for(const [index,[x,y,angle]] of CUBE_SOLUTION[layer].mirrors.entries()) {
   const id=`cube-mirror-${layer}-${index}`;moveItem(level,id,{x,y,layer});level.items.find(item=>item.id===id).angle=angle;
  }
  moveItem(level,`cube-core-${layer}`,{x:4,y:4,layer});level.items.find(item=>item.id===`cube-core-${layer}`).angle=CUBE_SOLUTION[layer].angle;
  const trace=traceLevel(level);
  assert.equal(trace.cube.faces.filter(face=>face.arrived).length,order+1);
  const lit=new Set(trace.segments.flatMap(segment=>[segment.start.layer,segment.end.layer]).filter(layer=>layer>=0));
  assert.deepEqual([...lit].sort(),CUBE_FACE_ORDER.slice(0,Math.min(order+2,6)).toSorted());
 }
 for(const [order,layer] of CUBE_FACE_ORDER.slice(0,5).entries()) {
  const changed=solve();changed.items.find(item=>item.id===`cube-core-${layer}`).angle=(CUBE_SOLUTION[layer].angle+90)%360;
  const trace=traceLevel(changed);assert.ok(CUBE_FACE_ORDER.slice(order+1).every(layer=>!trace.segments.some(segment=>segment.start.layer===layer)));
 }
});
check('能量守恒：五次分光透过96%，普通镜/棱边/向心镜均保留95%',()=>{
 const level=solve(),trace=traceLevel(level);
 let remaining=1,total=0;
 for(const [order,layer] of CUBE_FACE_ORDER.entries()) {
  const atCore=remaining*.95**(order===0 ? 2 : 3);
  const energy=atCore*.96/(6-order)*.95*.16/.42;near(trace.cube.faces[layer].energy,energy);total+=energy;
  if(order<5) remaining=atCore*.96*(1-1/(6-order))*.95;
 }
 near(trace.qualifiedReceived.beacon,total);assert.ok(total>=level.threshold && total<=1);
});
check('18 件推荐器件缺任一件均不通关，各面的镜子朝向均需正确',()=>{
 for(const item of solve().items.filter(item=>item.movable)) {
  const level=solve();storeItem(level,item.id);assert.equal(isLightReady(level,traceLevel(level)),false,item.id);
  for(const delta of item.kind==='coreMirror' ? [90,180,270] : [45,90,135]) {
   const level=solve();const piece=level.items.find(piece=>piece.id===item.id);piece.angle=(piece.angle+delta)%(piece.kind==='coreMirror' ? 360 : 180);
   assert.equal(isLightReady(level,traceLevel(level)),false,`${item.id} ${delta}`);
  }
 }
});
check('五路抵达即使降低能量门槛，也不能冒充六路同时完成',()=>{
 const level=solve();level.threshold=0;storeItem(level,'cube-core-4');const trace=traceLevel(level);
 assert.equal(trace.cube.faces.filter(face=>face.arrived).length,5);assert.equal(isLightReady(level,trace),false);
});
check('只途经但向心镜朝向错误、漏点或换到别的面，均不能合格抵达',()=>{
 for(let layer=0;layer<6;layer++) {
  const level=solve();storeItem(level,`cube-core-${layer}`);const trace=traceLevel(level);
  assert.equal(trace.cube.faces[layer].passed,true);assert.equal(trace.cube.faces[layer].arrived,false);
  const changed=solve();changed.items.find(item=>item.id===`cube-point-${layer}`).layer=(layer+1)%6;
  const raw=traceLevel(changed);assert.ok(raw.received.beacon>raw.qualifiedReceived.beacon);assert.equal(isLightReady(changed,raw),false);
 }
});
check('棋盘中心预留向心座，按面占格，错误落点/固定物品不能移动或复制',()=>{
 const level=createLevel(11);
 assert.equal(canPlace(level,'cube-core-0',{x:3,y:4,layer:0}),false);
 assert.equal(canPlace(level,'cube-mirror-0-0',{x:4,y:4,layer:0}),false);
 assert.equal(moveItem(level,'cube-core-0',{x:4,y:4,layer:0}),true);
 assert.equal(moveItem(level,'cube-core-1',{x:4,y:4,layer:1}),true);
 assert.equal(canPlace(level,'cube-core-2',{x:4,y:4,layer:1}),false);
 assert.equal(canPlace(level,'cube-core-2',{x:4,y:4,layer:6}),false);
 for(const item of level.items.filter(item=>!item.movable)) {
  assert.equal(moveItem(level,item.id,{x:4,y:4,layer:0}),false);assert.equal(storeItem(level,item.id),false);assert.equal(rotateItem(level,item.id,1),false);
 }
});
check('同一镜子可收纳换面，向心镜完整360°且收纳保留朝向',()=>{
 const level=createLevel(11);assert.ok(moveItem(level,'cube-core-0',{x:4,y:4,layer:5}));
 for(let i=0;i<4;i++) rotateItem(level,'cube-core-0',1);assert.equal(level.items.find(item=>item.id==='cube-core-0').angle,0);
 rotateItem(level,'cube-core-0',-1);storeItem(level,'cube-core-0');assert.equal(level.items.find(item=>item.id==='cube-core-0').angle,270);
 assert.ok(moveItem(level,'cube-core-0',{x:4,y:4,layer:2}));assert.equal(level.items.find(item=>item.id==='cube-core-0').angle,270);
});
check('固定积木真正阻断接力，其他面不能凭空继续发光',()=>{
 const level=solve();level.items.push({id:'stop',kind:'block',x:5,y:4,layer:0});
 const trace=traceLevel(level);assert.ok(trace.blocked.includes('stop'));assert.equal(trace.cube.faces[0].arrived,true);
 assert.ok(trace.cube.faces.slice(1).every(face=>!face.arrived));assert.equal(isLightReady(level,trace),false);
});
check('当前布局重新追踪，先后点亮和纯界面隐藏标记不积累过关',()=>{
 const level=solve();storeItem(level,'cube-core-0');const first=traceLevel(level);assert.equal(first.cube.faces[0].arrived,false);
 moveItem(level,'cube-core-0',{x:4,y:4,layer:0});storeItem(level,'cube-core-5');
 const second=traceLevel(level);assert.equal(second.cube.faces[0].arrived,true);assert.equal(second.cube.faces[5].arrived,false);assert.equal(isLightReady(level,second),false);
 const solved=solve(),before=traceLevel(solved);solved.hiddenFaces=[1,2,3,4,5];assert.deepEqual(traceLevel(solved),before);
});
check('闭环可终止，不能反复分光放大能量或无限递归',()=>{
 const level=createLevel(11);level.items=level.items.filter(item=>['source','beacon'].includes(item.kind));
 level.items.find(item=>item.kind==='source').x=3;
 for(const [i,[x,y,angle]] of [[5,6,135],[5,2,45],[2,2,135],[2,6,45]].entries()) level.items.push({id:`loop-${i}`,kind:'mirror',x,y,angle,layer:0});
 const trace=traceLevel(level);assert.equal(trace.loopStopped,true);assert.ok(trace.segments.length<32);assert.equal(isLightReady(level,trace),false);
});
check('连续满足六面条件0.6秒才通关；中途丢失一路需重新充能',()=>{
 const level=solve(),good=traceLevel(level),gate=new WinGate();for(let i=0;i<4;i++)gate.update(isLightReady(level,good),.1);
 assert.equal(gate.won,false);storeItem(level,'cube-core-0');gate.update(isLightReady(level,traceLevel(level)),.1);assert.equal(gate.elapsed,0);
 for(let i=0;i<6;i++)gate.update(isLightReady(level,good),.1);assert.equal(gate.won,true);
});
await mkdir('qa',{recursive:true});await writeFile('qa/cube-optics-report.json',JSON.stringify({status:'passed',checks:verified.length,solvedEnergy:traceLevel(solve()).qualifiedReceived.beacon,verified},null,2));
console.log(`${verified.length} cube rule checks passed.`);
