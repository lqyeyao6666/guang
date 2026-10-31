import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createLevel,moveItem,storeItem,rotateItem,levelSummaries} from '../src/level.ts';
import {traceLevel,isLightReady,WinGate,hitDistance,directionFor} from '../src/optics.ts';
import {additiveRGB,BAND_RGB} from '../src/fusion-optics.ts';
import {fusionSolution} from './fusion-solution.mjs';
const verified=[];
const check=(name,run)=>{run();verified.push(name);console.log('PASS '+name)};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const solved=()=>{const l=createLevel(10);for(const [,id,x,y,angle] of fusionSolution){assert.ok(moveItem(l,id,{x,y}));l.items.find(i=>i.id===id).angle=angle;}return l};
check('追加第三章第二关，原有九关与编号完整保留',()=>{
  assert.deepEqual(levelSummaries.slice(0,12).map(l=>l.number),[1,2,4,6,11,3,5,8,9,12,7,10]);
  const l=createLevel(10);assert.equal(l.size,15);assert.equal(l.fusion,true);assert.equal(l.items.filter(i=>i.kind==='powerWaypoint').length,2);assert.equal(isLightReady(l,traceLevel(l)),false);
});
check('加色规则：红绿成黄、绿蓝成青、黄蓝是白光而非绿光',()=>{
  assert.deepEqual(additiveRGB([{power:1,rgb:BAND_RGB.red},{power:1,rgb:BAND_RGB.green}]),BAND_RGB.yellow);
  assert.deepEqual(additiveRGB([{power:1,rgb:BAND_RGB.green},{power:1,rgb:BAND_RGB.blue}]),BAND_RGB.cyan);
  const white=additiveRGB([{power:2,rgb:BAND_RGB.yellow},{power:1,rgb:BAND_RGB.blue}]);for(const c of white)near(c,1/3);
});
check('实际三棱镜七色、两次合成、两次增强、双圆环与最终合束同时成立',()=>{
  const l=solved(),r=traceLevel(l);assert.equal(r.prismSplits,1);assert.equal(r.fusion.stable,true);assert.equal(isLightReady(l,r),true);
  for(const route of ['yellow','cyan'])for(const flag of ['mixed','boosted','passed','arrived'])assert.equal(r.fusion[route][flag],true);
  near(r.qualifiedReceived.beacon,.14593271227419427);
});
check('两路增强光携带真实独立来源，原生同色只有一个来源',()=>{
  const r=traceLevel(solved());for(const route of ['yellow','cyan']){
    const beam=r.segments.find(s=>s.lineage?.stage==='boost-'+route);assert.ok(beam);
    assert.equal(beam.lineage.origins.length,3);assert.ok(beam.lineage.origins.some(o=>o.endsWith('/'+route)));
    const mixed=r.segments.find(s=>s.lineage?.stage==='mixed-'+route);assert.equal(mixed.lineage.origins.length,2);
  }
  const final=r.segments.find(s=>s.lineage?.stage==='final');assert.equal(final.lineage.origins.length,5);
  assert.ok(final.rgb[0]>0&&final.rgb[1]>final.rgb[0]&&final.rgb[2]>0); // final is yellow + cyan, never pure green.
});
check('被动分流、平衡和叠加守恒，增强不凭空放大能量',()=>{
  const r=traceLevel(solved()),nodes=r.fusion.nodes;
  near(nodes['split-green'].power,.9/7*.96);
  near(nodes['mix-yellow'].power,.9/7*.96/2*2*.94);
  near(nodes['mix-cyan'].power,.9/7*.96/2*.95**2*2*.94);
  assert.ok(nodes['boost-yellow'].power<.9/7+nodes['mix-yellow'].power*.95**2);
  assert.ok(nodes['final-combiner'].power<nodes['boost-yellow'].power+nodes['boost-cyan'].power);
});
check('不挡橙光会污染合黄器，先到的正确输入不能提前锁定输出',()=>{
  const l=solved();storeItem(l,'shade-1');const r=traceLevel(l);assert.equal(r.fusion.nodes['mix-yellow'].contaminated,true);assert.equal(r.fusion.yellow.mixed,false);assert.equal(isLightReady(l,r),false);
});
check('不挡紫光会污染分流器，两条绿光路线立即失效',()=>{
  const l=solved();storeItem(l,'shade-2');const r=traceLevel(l);assert.equal(r.fusion.nodes['split-green'].contaminated,true);assert.equal(r.fusion.yellow.boosted,false);assert.equal(r.fusion.cyan.boosted,false);
});
check('只有原生黄、青进入增强器不能合成或增强',()=>{
  const l=solved();l.items=l.items.filter(i=>!['split-green','mix-yellow','mix-cyan'].includes(i.id));
  const r=traceLevel(l);for(const route of ['yellow','cyan']){assert.ok(r.fusion.nodes['boost-'+route].inputs>=1);assert.equal(r.fusion[route].boosted,false);assert.equal(r.fusion[route].passed,false)}assert.equal(isLightReady(l,r),false);
});
check('原生光直接经过对应增强圆环也不记途经',()=>{
  const l=solved();l.items=l.items.filter(i=>!['boost-yellow','boost-cyan'].includes(i.id));
  Object.assign(l.items.find(i=>i.id==='power-yellow'),{x:11,y:4});Object.assign(l.items.find(i=>i.id==='power-cyan'),{x:11,y:12});
  const r=traceLevel(l);assert.ok(r.touched.includes('power-yellow'));assert.ok(r.touched.includes('power-cyan'));assert.equal(r.fusion.yellow.passed,false);assert.equal(r.fusion.cyan.passed,false);assert.equal(isLightReady(l,r),false);
});
check('只合成同色光但缺少原生光，增强器不能凭空补能量',()=>{
  for(const [route,x,y] of [['yellow',9,5],['cyan',7,10]]){
    const l=solved();moveItem(l,'shade-3',{x,y});const r=traceLevel(l);assert.equal(r.fusion[route].mixed,true);assert.equal(r.fusion[route].boosted,false);
  }
});
check('八面可移动镜在此解法逐一缺失均不能通关',()=>{
  for(const [,id] of fusionSolution.filter(s=>s[0]==='mirror')){const l=solved();storeItem(l,id);assert.equal(isLightReady(l,traceLevel(l)),false,id)}
});
check('八面镜逐一转错45度均不能绕过配方与途经',()=>{
  for(const [,id] of fusionSolution.filter(s=>s[0]==='mirror')){const l=solved();rotateItem(l,id,1);assert.equal(isLightReady(l,traceLevel(l)),false,id)}
});
check('两个圆环都亮仍须继续合束，先后调整不累计成果',()=>{
  const l=solved();storeItem(l,'mirror-8');let r=traceLevel(l);assert.equal(r.fusion.yellow.passed,true);assert.equal(r.fusion.cyan.passed,true);assert.equal(r.fusion.cyan.arrived,false);assert.equal(isLightReady(l,r),false);
  moveItem(l,'mirror-8',{x:14,y:12});storeItem(l,'mirror-7');r=traceLevel(l);assert.equal(r.fusion.yellow.arrived,false);assert.equal(isLightReady(l,r),false);
});
check('绕过任意增强途经点，合束器不能接受',()=>{
  for(const route of ['yellow','cyan']){const l=solved();l.items=l.items.filter(i=>i.id!=='power-'+route);const r=traceLevel(l);assert.equal(isLightReady(l,r),false);assert.equal(r.fusion.nodes['final-combiner'].active,false)}
});
check('路径交叉不会自动混色，固定合光器缺一不可',()=>{
  for(const id of ['mix-yellow','mix-cyan','boost-yellow','boost-cyan','final-combiner']){const l=solved();l.items=l.items.filter(i=>i.id!==id);assert.equal(isLightReady(l,traceLevel(l)),false,id)}
});
check('换错圆环颜色无效，白光直射也无法通过增强身份验证',()=>{
  const l=solved();l.items.find(i=>i.id==='power-yellow').color='cyan';assert.equal(isLightReady(l,traceLevel(l)),false);
  const white=createLevel(10);white.items=white.items.filter(i=>['source','power-yellow','beacon'].includes(i.id));Object.assign(white.items.find(i=>i.id==='power-yellow'),{x:5,y:8});assert.equal(traceLevel(white).fusion.yellow.passed,false);
});
check('挡光块按实体边界拦截、可移动收纳、固定器件不可操作',()=>{
  const l=solved(),r=traceLevel(l);assert.deepEqual(r.blocked,['shade-1','shade-2']);assert.ok(moveItem(l,'shade-3',{x:8,y:8}));assert.equal(isLightReady(l,traceLevel(l)),false);assert.ok(storeItem(l,'shade-3'));assert.equal(isLightReady(l,traceLevel(l)),true);
  for(const id of ['mix-yellow','split-green','power-yellow','fusion-obstacle-0']){assert.equal(moveItem(l,id,{x:1,y:1}),false);assert.equal(storeItem(l,id),false);assert.equal(rotateItem(l,id,1),false)}
});
check('小挡光块仍能挡住八方向及其他角度实际穿过块体的光',()=>{
  const block={id:'shade',kind:'block',x:7,y:9,movable:true,rotatable:false,angle:0,name:'挡光块'};
  for(const angle of [0,45,90,135,180,225,270,315,26.565,56.31]){
    const direction=directionFor(angle),origin={x:block.x-direction.x*2,y:block.y-direction.y*2};
    const distance=hitDistance(block,origin,direction,null);assert.ok(distance>1.5&&distance<2,`${angle} degrees`);
  }
  assert.equal(hitDistance(block,{x:5,y:9.33},{x:1,y:0},null),null);
  assert.equal(hitDistance(block,{x:7.33,y:7},{x:0,y:1},null),null);
  const fixed={...block,movable:false};assert.notEqual(hitDistance(fixed,{x:5,y:9.4},{x:1,y:0},null),null);
});
check('圆角空隙不再使用方形包围盒误挡斜光，穿过圆角实体仍会被挡',()=>{
  const block={id:'shade',kind:'block',x:0,y:0,movable:true,rotatable:false,angle:0,name:'挡光块'},direction=directionFor(315);
  assert.equal(hitDistance(block,{x:-1,y:1.63},direction,null),null);
  assert.notEqual(hitDistance(block,{x:-1,y:1.60},direction,null),null);
});
check('分流器旁原位置不再擦边挡紫光，移到紫光实体路径才能恢复合光',()=>{
  const l=solved();assert.ok(moveItem(l,'shade-2',{x:7,y:9}));let r=traceLevel(l);
  assert.equal(r.blocked.includes('shade-2'),false);assert.equal(r.fusion.nodes['split-green'].contaminated,true);assert.equal(isLightReady(l,r),false);
  assert.ok(moveItem(l,'shade-2',{x:4,y:10}));r=traceLevel(l);assert.equal(isLightReady(l,r),true);
});
check('非提示坐标的挡光替代解有效，通关不硬编码摆放坐标',()=>{
  const l=solved();assert.ok(moveItem(l,'shade-1',{x:5,y:6}));assert.equal(isLightReady(l,traceLevel(l)),true);
});
check('不正确的三棱镜朝向不分光，循环和超长路线有保护',()=>{
  for(const angle of [90,180,270]){const l=solved();l.items.find(i=>i.id==='prism').angle=angle;const r=traceLevel(l);assert.equal(r.prismSplits,0);assert.equal(isLightReady(l,r),false);assert.ok(r.segments.length<300)}
  const l=solved();l.items.find(i=>i.id==='final-combiner').angle=180;const r=traceLevel(l);assert.equal(isLightReady(l,r),false);assert.ok(r.segments.length<300);
});
check('持续充能后通关；失去合光立即重置计时',()=>{
  const l=solved(),r=traceLevel(l),gate=new WinGate();
  for(let n=0;n<3;n++)gate.update(isLightReady(l,r),.1,l.holdSeconds);assert.equal(gate.won,false);
  const broken=solved();storeItem(broken,'shade-2');gate.update(isLightReady(broken,traceLevel(broken)),.1,l.holdSeconds);near(gate.elapsed,0);
  for(let n=0;n<7;n++)gate.update(isLightReady(l,r),.1,l.holdSeconds);assert.equal(gate.won,true);gate.reset();assert.equal(gate.won,false);
});
check('七色园区覆盖225格无重叠，固定障碍颜色与区域一致',()=>{
  const l=createLevel(10);for(let x=1;x<=15;x++)for(let y=1;y<=15;y++)assert.equal(l.colorRegions.filter(r=>x>=r.minX&&x<=r.maxX&&y>=r.minY&&y<=r.maxY).length,1);
  for(const b of l.items.filter(i=>i.kind==='block'&&!i.movable))assert.equal(l.colorRegions.find(r=>b.x>=r.minX&&b.x<=r.maxX&&b.y>=r.minY&&b.y<=r.maxY).color,b.color);
});
check('四级提示只有最后一级给坐标',()=>{const l=createLevel(10);for(const hint of l.hints.slice(0,3))assert.doesNotMatch(hint,/\(\d+,\d+\)/);assert.match(l.hints[3],/\(14,12\)/)});
await mkdir('qa',{recursive:true});await writeFile('qa/fusion-optics-report.json',JSON.stringify({passed:true,checks:verified.length,verified},null,2));
