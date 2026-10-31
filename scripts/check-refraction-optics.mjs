import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createLevel,moveItem,storeItem,rotateItem,canPlace,snapItemPosition,levelSummaries} from '../src/level.ts';
import {traceLevel,isLightReady,WinGate,directionFor} from '../src/optics.ts';
import {snell,advanceAquariumGate} from '../src/refraction-optics.ts';
import {sensorPosition,refractionRails,refractionMirrors} from './refraction-solution.mjs';
const verified=[],near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const check=(name,run)=>{run();verified.push(name);console.log('PASS '+name)};
function unlock(l){assert.ok(moveItem(l,'rail-a',sensorPosition));for(let n=0;n<6;n++)advanceAquariumGate(l,traceLevel(l),.1);assert.equal(l.aquarium.gateOpen,true);}
function placeFinal(l){for(const [id,x,y,angle] of [...refractionRails,...refractionMirrors]){assert.ok(moveItem(l,id,{x,y}),id);l.items.find(i=>i.id===id).angle=angle;}return l;}
function solved(){const l=createLevel(13);unlock(l);return placeFinal(l);}
check('第三章第三关追加编号13，保留旧链接与上一关下一关顺序',()=>{
  assert.deepEqual(levelSummaries.slice(levelSummaries.findIndex(i=>i.number===7),levelSummaries.findIndex(i=>i.number===7)+3).map(i=>i.number),[7,10,13]);const l=createLevel(13);assert.equal(l.size,15);assert.equal(l.chapterLevel,3);assert.equal(l.items.filter(i=>i.rail).length,4);assert.equal(l.items.filter(i=>i.inInventory).length,5);assert.equal(l.aquarium.gateOpen,false);assert.equal(isLightReady(l,traceLevel(l)),false);
});
check('Snell折射满足正弦定律，空气入水偏向法线且可逆',()=>{
  const d=directionFor(315),n={x:-1,y:0},r=snell(d,n,1,4/3);near(r.y,d.y/(4/3));near(Math.hypot(r.x,r.y),1);assert.ok(Math.abs(r.y)<Math.abs(d.y));const back=snell(r,n,4/3,1);near(back.x,d.x);near(back.y,d.y);
});
check('垂直入射不转向，水到空气超过临界角发生全反射',()=>{
  assert.deepEqual(snell({x:1,y:0},{x:-1,y:0},1,4/3),{x:1,y:0});assert.equal(snell(directionFor(60),{x:-1,y:0},4/3,1),null);
});
check('3×3鱼缸九格真实保留，不允许在水里放镜或在轨上放库存镜',()=>{
  const l=createLevel(13);for(let x=7;x<=9;x++)for(let y=6;y<=8;y++)assert.equal(canPlace(l,'mirror',{x,y}),false);
  assert.equal(canPlace(l,'mirror',{x:12,y:3}),false);assert.equal(canPlace(l,'mirror',{x:4,y:7}),true);
});
check('实际入水53.1301度到36.8699度，平行出水恢复方向并横移',()=>{
  const l=createLevel(13),r=traceLevel(l),[a,b]=r.refraction.events;near(a.incident,53.13010235415598);near(a.transmitted,36.86989764584402);near(b.transmitted,a.incident);near(a.point.x,6.5);near(a.point.y,25/3);near(b.point.x,9.5);near(b.point.y,73/12);
  near(b.point.y-(13-(9.5-3)*4/3),1.75);assert.equal(r.refraction.events.length,2);
});
check('折射由几何与介质计算，改变折射率不能沿参考线假开门',()=>{
  const l=createLevel(13);moveItem(l,'rail-a',sensorPosition);l.aquarium.index=1;const r=traceLevel(l);assert.equal(r.refraction.bent,false);assert.equal(r.refraction.sensorPower,0);for(let i=0;i<10;i++)advanceAquariumGate(l,r,.1);assert.equal(l.aquarium.gateOpen,false);
});
check('直接照感应器的白光未经鱼缸不能冒充折射光',()=>{
  const l=createLevel(13);l.items=l.items.filter(i=>['source','sensor','beacon','gate'].includes(i.id));Object.assign(l.items.find(i=>i.kind==='source'),{x:11,y:5,angle:0});const r=traceLevel(l);assert.ok(r.touched.includes('sensor'));assert.equal(r.refraction.sensorPower,0);assert.equal(isLightReady(l,r),false);
});
check('连续正式照亮0.45秒才开门，中断或暂停清零，预览不能充能',()=>{
  const l=createLevel(13);moveItem(l,'rail-a',sensorPosition);const r=traceLevel(l);assert.ok(r.refraction.sensorPower>.3);
  for(let i=0;i<4;i++)advanceAquariumGate(l,r,.1);assert.equal(l.aquarium.gateOpen,false);advanceAquariumGate(l,r,.1,false);near(l.aquarium.sensorCharge,0);
  for(let i=0;i<8;i++)advanceAquariumGate(l,r,.1,false);assert.equal(l.aquarium.gateOpen,false);for(let i=0;i<5;i++)advanceAquariumGate(l,r,.1);assert.equal(l.aquarium.gateOpen,true);
});
check('开门锁存允许改光路，重新创建关卡恢复闭门和全部初始滑轨',()=>{
  const l=createLevel(13);unlock(l);moveItem(l,'rail-a',{x:12,y:5});advanceAquariumGate(l,traceLevel(l),1);assert.equal(l.aquarium.gateOpen,true);const fresh=createLevel(13);assert.equal(fresh.aquarium.gateOpen,false);assert.equal(fresh.items.find(i=>i.id==='rail-a').y,5);
});
check('闭门确实截住后半段光，打开后才能通向D滑轨',()=>{
  const l=placeFinal(createLevel(13)),r=traceLevel(l);assert.ok(r.blocked.includes('gate'));assert.equal(r.refraction.rails.includes('rail-d'),false);assert.equal(isLightReady(l,r),false);
});
check('完整两阶段通关：四轨、两环、十次反射，能量守恒',()=>{
  const l=solved(),r=traceLevel(l);assert.equal(isLightReady(l,r),true);assert.equal(r.refraction.rails.length,4);assert.equal(r.refraction.observations.length,2);assert.equal(r.refraction.gateCrossed,true);near(r.qualifiedReceived.beacon,.95**10*.98**2*.16/.42);near(r.qualifiedReceived.beacon,.21905788816934813);
});
check('每面滑轨镜均必须离开初始位置，不能只转角度完成',()=>{
  const initial=createLevel(13);for(const [id]of refractionRails){const l=solved(),piece=l.items.find(i=>i.id===id),start=initial.items.find(i=>i.id===id);Object.assign(piece,{x:start.x,y:start.y});assert.equal(isLightReady(l,traceLevel(l)),false,id);}
});
check('滑轨约束、半格吸附、端点、占用和收纳规则生效',()=>{
  const l=createLevel(13);assert.equal(moveItem(l,'rail-a',{x:11,y:3}),false);assert.equal(moveItem(l,'rail-a',{x:12,y:2.75}),false);assert.equal(moveItem(l,'rail-a',{x:12,y:0}),false);assert.equal(storeItem(l,'rail-a'),false);
  assert.deepEqual(snapItemPosition(l.items.find(i=>i.id==='rail-a'),{x:3,y:2.63}),{x:12,y:2.5,layer:0});assert.ok(moveItem(l,'rail-a',{x:12,y:1.5}));assert.ok(rotateItem(l,'rail-a',1));
  assert.equal(moveItem(l,'mirror',{x:14,y:5}),false);assert.equal(storeItem(l,'gate'),false);assert.equal(rotateItem(l,'sensor',1),false);
});
check('此解法五面库存镜逐一缺失或转错都不通关',()=>{
  for(const [id]of refractionMirrors){let l=solved();storeItem(l,id);assert.equal(isLightReady(l,traceLevel(l)),false,id);l=solved();rotateItem(l,id,1);assert.equal(isLightReady(l,traceLevel(l)),false,id);}
});
check('两枚观测环必须经过并继续抵达，不能先后累积',()=>{
  for(const id of ['observe-a','observe-b']){const l=solved();Object.assign(l.items.find(i=>i.id===id),{x:1,y:1});assert.equal(isLightReady(l,traceLevel(l)),false);}
  const l=solved();storeItem(l,'mirror-5');const r=traceLevel(l);assert.equal(r.refraction.observations.length,2);assert.equal(r.refraction.delivered,false);assert.equal(isLightReady(l,r),false);
});
check('非提示刻度的滑轨替代位置仍可完成，不硬编码推荐坐标',()=>{
  const l=solved();assert.ok(moveItem(l,'rail-b',{x:10,y:4}));assert.ok(moveItem(l,'rail-c',{x:14,y:7}));assert.equal(isLightReady(l,traceLevel(l)),true);
});
check('水中先全反射再从另一面出射，反射不冒充透射且能量不增加',()=>{
  const l=createLevel(13);l.items=l.items.filter(i=>i.kind==='source'||i.kind==='beacon');Object.assign(l.items[0],{x:9.4,y:7,angle:60});const r=traceLevel(l);assert.equal(r.refraction.events[0].totalReflection,true);assert.equal(r.refraction.events[1].totalReflection,false);assert.equal(r.refraction.entered,false);assert.ok(r.segments.every(s=>s.power<=1));assert.ok(r.segments.length<=32);assert.equal(isLightReady(l,r),false);
});
check('四级提示仅最后给位置，最终充能仍需连续0.6秒',()=>{
  const l=solved();for(const h of l.hints.slice(0,3))assert.doesNotMatch(h,/\(\d+(?:\.\d+)?,\d+(?:\.\d+)?\)/);assert.match(l.hints[3],/\(12,2\.5\)/);const gate=new WinGate();for(let i=0;i<5;i++)gate.update(isLightReady(l,traceLevel(l)),.1,.6);assert.equal(gate.won,false);gate.update(false,.1,.6);near(gate.elapsed,0);for(let i=0;i<7;i++)gate.update(true,.1,.6);assert.equal(gate.won,true);
});
await mkdir('qa',{recursive:true});await writeFile('qa/refraction-optics-report.json',JSON.stringify({passed:true,checks:verified.length,verified},null,2));
