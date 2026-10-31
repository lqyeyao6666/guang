import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createLevel,levelSummaries,moveItem,storeItem,rotateItem,canPlace} from '../src/level.ts';
import {SCHOOL_TURNS} from '../src/school-level.ts';
import {traceLevel,isLightReady,reflected,WinGate} from '../src/optics.ts';
const verified=[];
const check=(name,run)=>{run();verified.push(name);console.log(`PASS ${name}`)};
function solve(){const l=createLevel(12);l.items.filter(i=>i.kind==='block'&&i.movable).forEach(i=>storeItem(l,i.id));SCHOOL_TURNS.forEach(([x,y,a],n)=>{const id=n?`mirror-${n+1}`:'mirror';assert.ok(moveItem(l,id,{x,y}));l.items.find(i=>i.id===id).angle=a});assert.ok(moveItem(l,'lens',{x:8,y:5}));l.items.find(i=>i.id==='lens').angle=0;return l;}
check('新增第二章第五关，旧编号保留，11×11、九镜、凸透镜、两只可搬书箱',()=>{
  assert.deepEqual(levelSummaries.slice(levelSummaries.findIndex(i=>i.number===9),levelSummaries.findIndex(i=>i.number===9)+3).map(i=>i.number),[9,12,7]);
  const l=createLevel(12);assert.equal(l.size,11);assert.equal(l.chapterLevel,5);assert.equal(l.setting,'school');assert.equal(l.items.filter(i=>i.kind==='mirror'&&i.movable).length,9);assert.equal(l.items.filter(i=>i.kind==='block'&&i.movable).length,2);assert.equal(isLightReady(l,traceLevel(l)),false);
});
check('书箱真实挡光、可搬可收，不可转；固定课桌椅与教具柜不可操作',()=>{
  const l=createLevel(12);assert.ok(traceLevel(l).blocked.includes('school-crate-0'));
  for(const i of l.items.filter(i=>i.kind==='block')){assert.equal(rotateItem(l,i.id,1),false);assert.equal(canPlace(l,'mirror',i),false);assert.equal(storeItem(l,i.id),i.movable);}
  assert.ok(moveItem(l,'school-crate-0',{x:1,y:9}));assert.equal(moveItem(l,'school-crate-1',{x:1,y:9}),false);
});
check('真实十次反射与一次聚焦，三处途经后同路抵达，接收约55.08%',()=>{
  const l=solve(),t=traceLevel(l);assert.ok(isLightReady(l,t));assert.ok(Math.abs(t.qualifiedReceived.beacon-0.95**10*0.92)<1e-8);assert.equal(t.interactionLimit,false);assert.equal(t.loopStopped,false);
  for(const i of l.items.filter(i=>i.kind==='waypoint'))assert.ok(t.waypointPasses[i.id].some(p=>p.deliveredTo==='beacon'));
});
check('九面镜缺任一面或朝向错误不可通过，缺凸透镜或方向错误不可通过',()=>{
  for(const i of solve().items.filter(i=>i.inInventory===false&&i.kind==='mirror'&&i.movable)){
    const l=solve();storeItem(l,i.id);assert.equal(isLightReady(l,traceLevel(l)),false);
    const b=solve();b.items.find(p=>p.id===i.id).angle+=90;assert.equal(isLightReady(b,traceLevel(b)),false);
  }
  const l=solve();storeItem(l,'lens');assert.equal(isLightReady(l,traceLevel(l)),false);const b=solve();b.items.find(i=>i.id==='lens').angle=90;assert.equal(isLightReady(b,traceLevel(b)),false);
});
check('掠过课桌、死路和仅直达终点不能冒充三处同路途经',()=>{
  for(const id of ['school-pass-0','school-pass-1','school-pass-2']){const l=solve();const p=l.items.find(i=>i.id===id);p.x+=0.3;p.y+=0.3;assert.equal(isLightReady(l,traceLevel(l)),false);}
  const l=solve();storeItem(l,'mirror-8');const t=traceLevel(l);assert.ok(t.waypointPasses['school-pass-0'].length);assert.equal(t.qualifiedReceived.beacon,0);assert.equal(isLightReady(l,t),false);
  const gate=new WinGate();assert.equal(gate.update(false,1),false);for(let n=0;n<7;n++)gate.update(true,0.1);assert.ok(gate.won);gate.reset();assert.equal(gate.won,false);
});
check('改名、整体镜像仍按实际光路判定，提示坐标不参与胜负',()=>{
  const l=solve();for(const i of l.items){i.id=`copy-${i.id}`;i.x=12-i.x;i.angle=(180-i.angle+360)%360;}
  l.hintPositions=[];assert.ok(isLightReady(l,traceLevel(l)));
});
check('开阔教室有多向空位，家具不再围出答案；上半段存在不同排的真实替代解',()=>{
  const l=createLevel(12),fixed=l.items.filter(i=>!i.movable),blocked=new Set(fixed.map(i=>`${i.x},${i.y}`));
  assert.equal(fixed.filter(i=>i.kind==='block').length,31);
  let branches=0,clearSquares=0;
  for(let y=1;y<=11;y++)for(let x=1;x<=11;x++)if(!blocked.has(`${x},${y}`)){
    const neighbors=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>x+dx>=1&&x+dx<=11&&y+dy>=1&&y+dy<=11&&!blocked.has(`${x+dx},${y+dy}`));
    if(neighbors.length>=3)branches++;
    if(x<11&&y<11&&[[1,0],[0,1],[1,1]].every(([dx,dy])=>!blocked.has(`${x+dx},${y+dy}`)))clearSquares++;
  }
  assert.ok(branches>=25);assert.ok(clearSquares>=10);
  for(const row of [2,4]){const b=solve();for(const id of ['mirror-5','mirror-6']){const p=b.items.find(i=>i.id===id);assert.ok(moveItem(b,id,{x:p.x,y:row}));}assert.ok(isLightReady(b,traceLevel(b)));}
});
let minimum=Infinity;
check('放宽全棋盘转向搜索仍至少九面可移动镜，高于上一关七面',()=>{
  const l=createLevel(12),fixed=l.items.filter(i=>!i.movable),points=fixed.filter(i=>i.kind==='waypoint'),dirs=[[1,0],[0,1],[-1,0],[0,-1]],start=fixed.find(i=>i.kind==='source');
  const queue=[{x:start.x,y:start.y,d:0,count:0,mask:0}],seen=new Map();
  while(queue.length){queue.sort((a,b)=>a.count-b.count);const c=queue.shift(),key=`${c.x},${c.y},${c.d},${c.mask}`;if((seen.get(key)??Infinity)<=c.count)continue;seen.set(key,c.count);
    const [dx,dy]=dirs[c.d];let mask=c.mask;
    for(let step=1;step<l.size;step++){
      const x=c.x+dx*step,y=c.y+dy*step;if(x<1||y<1||x>l.size||y>l.size)break;
      const hit=fixed.find(i=>i.x===x&&i.y===y);if(hit?.kind==='block')break;
      if(hit?.kind==='waypoint'){mask|=1<<points.indexOf(hit);continue;}
      if(hit?.kind==='beacon'){if(mask===7){minimum=c.count;}break;}
      if(hit?.kind==='mirror'){const v=reflected({x:dx,y:dy},hit.angle);queue.push({x,y,d:dirs.findIndex(([a,b])=>Math.hypot(a-v.x,b-v.y)<1e-6),count:c.count,mask});break;}
      if(!hit)for(const turn of [1,2,3])queue.push({x,y,d:(c.d+turn)%4,count:c.count+1,mask});
    }
    if(minimum<Infinity)break;
  }
  assert.equal(minimum,9);
});
check('重开恢复杂物与十件光学库存；只有第四级提示含推荐坐标',()=>{
  const l=createLevel(12);assert.equal(l.items.filter(i=>i.inInventory).length,10);assert.equal(l.items.filter(i=>i.movable&&!i.inInventory).length,2);assert.equal(l.hintPositions.length,10);assert.ok(l.hints.slice(0,3).every(h=>!/[（(]\d+,\d+[）)]/.test(h)));
});
writeFileSync('qa/school-optics-report.json',JSON.stringify({checks:verified.length,verified,minimumMovableMirrors:minimum,received:traceLevel(solve()).received.beacon},null,2));

