import type {Item,Level,Point} from './level.ts';

export const QUANTUM_PREP=[[6,13,90],[2,9,0],[1,10,90],[4,13,0],[6,11,90],[2,7,90]] as const;
export const QUANTUM_UPPER=[[10,4,135],[12,4,45],[12,7,135],[11,7,45],[11,2,135],[15,2,45]] as const;
export const QUANTUM_LOWER=[[13,10,45],[13,15,135],[10,15,45],[10,12,135]] as const;
export const QUANTUM_STOCK=[...QUANTUM_PREP,...QUANTUM_UPPER,...QUANTUM_LOWER];
export interface QuantumConfig {
  splitColumn:number;water:{minX:number;minY:number;size:number;index:number};wavelengthNm:number;phaseWavelength:number;
  records:{open:boolean;a:boolean;b:boolean};fingerprint:string;charge:number;charging:string;
}
export function createQuantumLevel():Level {
  const socket={x:15,y:10};
  const protectedCells=new Set<string>();
  const protect=(points:readonly Point[])=>{for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],steps=Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y))*2;for(let n=0;n<=steps;n++)protectedCells.add(`${Math.round(a.x+(b.x-a.x)*n/steps)},${Math.round(a.y+(b.y-a.y)*n/steps)}`);}};
  protect([{x:1,y:18},{x:3,y:18},{x:3,y:16},...QUANTUM_PREP.map(([x,y])=>({x,y})),{x:6,y:3}]);
  protect([{x:9,y:10},{x:10,y:10},...QUANTUM_UPPER.map(([x,y])=>({x,y})),socket,{x:15,y:16}]);
  for(const x of [18,18.5,19])protect([{x:10,y:10},...QUANTUM_LOWER.map(([x,y])=>({x,y})),{x,y:12},{x,y:10},socket,{x:14,y:10}]);
  for(let x=14;x<=18;x++)for(let y=10;y<=14;y++)protectedCells.add(`${x},${y}`);
  for(const p of [{x:3,y:16},{x:4,y:5},{x:6,y:3},{x:15,y:14},{x:4,y:15},{x:10,y:8}])protectedCells.add(`${p.x},${p.y}`);
  let seed=310527;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};const walls:Point[]=[];
  for(const [min,max,count]of [[1,7,21],[9,19,25]]){let tries=0;while(walls.filter(p=>p.x>=min&&p.x<=max).length<count&&tries++<10000){const x=min+Math.floor(random()*(max-min+1)),y=1+Math.floor(random()*19);if(protectedCells.has(`${x},${y}`)||walls.some(p=>p.x===x&&p.y===y))continue;const b=new Set([...walls,{x,y}].map(p=>`${p.x},${p.y}`));if([...b].some(k=>{const [a,c]=k.split(',').map(Number);return b.has(`${a+1},${c}`)&&b.has(`${a+2},${c}`)||b.has(`${a},${c+1}`)&&b.has(`${a},${c+2}`);}))continue;walls.push({x,y});}}
  return {
    number:15,chapter:3,chapterLevel:5,theme:'experiment',setting:'quantum',size:19,title:'一束光的两种回答',
    introduction:'先接通实验电源，再让同一束单光子的两条可能通道，给出明暗相反的回答。',threshold:.35,holdSeconds:.6,
    quantum:{splitColumn:8,water:{minX:14.5,minY:10.5,size:3,index:4/3},wavelengthNm:460,phaseWavelength:2,records:{open:false,a:false,b:false},fingerprint:'',charge:0,charging:''},
    hints:[
      '<b>01 · 光先给出电信号</b>左区仍是普通白光。用三棱镜取出蓝光，绕过隔板，再以凸透镜聚到感光板。两块带把手的挡光块也需要处理。光电流接通独立电源后，右侧专用发射器才产生单光子；普通灯调暗不能代替它。',
      '<b>02 · 先留下粒子的记录</b>先让合束镜留在物品栏。接通分束镜之后的上、下两路，让它们分别落在A、B探测器。A屏较宽，需要末段凹透镜展开；B直接接收。每次发射最多出现一个探测点，损耗时可能没有落点。保持布局片刻，留下开放实验记录。',
      '<b>03 · 两条可能的路，相互影响</b>把合束镜装到圆形插座。两个滑轨镜应在同一列，水中的光程比空气长。一起微移滑轨镜，观察A、B探测概率怎样交换；只挡住一路、出口，或换掉基础镜路，都不能代替干涉。光程用缩放刻度展示，不必计算纳米。',
      '<b>04 · 一套完整的终局实验</b>先收回两块挡光块。三棱镜(3,16)270°。左区六镜：(6,13)90°、(2,9)0°、(1,10)90°、(4,13)0°、(6,11)90°、(2,7)90°；凸透镜(4,5)135°。上路六镜：(10,4)135°、(12,4)45°、(12,7)135°、(11,7)45°、(11,2)135°、(15,2)45°；下路四镜：(13,10)45°、(13,15)135°、(10,15)45°、(10,12)135°。两轨镜先同到x=18；凹透镜(15,14)90°。不开合束镜先录开放实验，再装合束镜(15,10)135°，录B明A暗；最后两轨镜同到x=18.5，录A明B暗。',
    ],
    hintPositions:[...QUANTUM_STOCK.map(([x,y])=>({x,y})),{x:3,y:16},{x:4,y:5},{x:15,y:14},socket,{x:18,y:12},{x:18,y:10}],
    items:[
      {id:'source',kind:'source',name:'准备区白灯',x:1,y:18,angle:0,movable:false,rotatable:false},
      {id:'fixed-launch',kind:'mirror',name:'固定起步镜',x:3,y:18,angle:135,movable:false,rotatable:false},
      {id:'power-cathode',kind:'photocell',name:'蓝光感光板',x:6,y:3,angle:315,screenHalfWidth:.24,movable:false,rotatable:false},
      {id:'photon-source',kind:'photonSource',name:'单光子发射器',x:9,y:10,angle:0,movable:false,rotatable:false},
      {id:'splitter-first',kind:'beamSplitter',name:'固定半透半反镜',x:10,y:10,angle:135,movable:false,rotatable:false},
      {id:'recombiner',kind:'beamSplitter',name:'合束镜',...socket,socket,angle:135,movable:true,rotatable:true,inInventory:true},
      {id:'detector-a',kind:'photonDetector',name:'A · 宽幅探测屏',x:15,y:16,angle:90,screenHalfWidth:.7,movable:false,rotatable:false},
      {id:'detector-b',kind:'photonDetector',name:'B · 计数探测器',x:14,y:10,angle:180,screenHalfWidth:.42,movable:false,rotatable:false},
      {id:'phase-c',kind:'mirror',name:'C · 光程滑轨镜',x:18,y:12,angle:135,movable:true,rotatable:true,rail:{axis:'x',fixed:12,min:18,max:19,step:.5}},
      {id:'phase-d',kind:'mirror',name:'D · 光程滑轨镜',x:19,y:10,angle:45,movable:true,rotatable:true,rail:{axis:'x',fixed:10,min:18,max:19,step:.5}},
      ...QUANTUM_STOCK.map((_,n):Item=>({id:n?`mirror-${n+1}`:'mirror',kind:'mirror',name:'平面镜',x:1,y:1,angle:0,movable:true,rotatable:true,inInventory:true})),
      {id:'prism',kind:'prism',name:'三棱镜',x:1,y:1,angle:0,movable:true,rotatable:true,inInventory:true},
      {id:'lens',kind:'lens',name:'凸透镜',x:1,y:1,angle:0,movable:true,rotatable:true,inInventory:true},
      {id:'concave',kind:'concaveLens',name:'凹透镜',x:1,y:1,angle:90,movable:true,rotatable:true,inInventory:true},
      ...[{x:4,y:15},{x:10,y:8}].map((p,n):Item=>({id:`shutter-${n}`,kind:'block',name:'可搬遮光块',...p,angle:0,movable:true,rotatable:false})),
      ...walls.map((p,n):Item=>({id:`quantum-wall-${n}`,kind:'block',name:p.x<8?'实验仪器箱':'花园石台',...p,color:p.x<8?'cyan':n%2?'blue':'violet',angle:0,movable:false,rotatable:false})),
    ],
  };
}
