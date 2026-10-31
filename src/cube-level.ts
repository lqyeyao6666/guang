import type { Item, Level } from './level.ts';
import { CUBE_FACES } from './cube-space.ts';

export const CUBE_SOLUTION = [
  { mirrors: [[2,6,135],[2,4,135]], angle: 0 },
  { mirrors: [[2,2,135],[2,4,45]], angle: 0 },
  { mirrors: [[2,2,135],[4,2,45]], angle: 90 },
  { mirrors: [[2,6,45],[2,4,135]], angle: 0 },
  { mirrors: [[2,6,45],[4,6,135]], angle: 270 },
  { mirrors: [[6,6,135],[6,4,45]], angle: 180 },
] as const;
export const CUBE_FACE_ORDER = [0,1,2,5,3,4] as const;

export function createCubeLevel(): Level {
  const points = [[2,5],[2,3],[3,2],[2,5],[3,6],[6,5]];
  const entries = [[4,2,135],[2,4,135],[4,6,45],[2,4,45],[4,6,135]];
  const obstacles = [
    [[3,6],[2,3],[5,2],[5,5],[6,3],[1,3]],
    [[1,2],[2,5],[3,3],[5,2],[6,6],[7,6]],
    [[2,1],[5,2],[1,6],[3,6],[6,5],[5,6]],
    [[1,6],[2,3],[3,3],[5,6],[6,2],[6,6]],
    [[2,7],[5,6],[1,2],[3,3],[5,2],[6,5]],
    [[7,6],[6,3],[2,2],[3,3],[2,6],[5,2]],
  ];
  const items: Item[] = [
    { id:'source',kind:'source',name:'唯一的白光灯',x:1,y:6,layer:0,angle:0,power:1,movable:false,rotatable:false },
    { id:'beacon',kind:'beacon',name:'悬浮光心',x:4,y:4,layer:-1,angle:0,movable:false,rotatable:false },
  ];
  CUBE_FACES.forEach((face,layer) => {
    if (layer>0) {
      const [x,y,angle] = entries[layer-1];
      items.push({id:`cube-entry-${layer}`,kind:'mirror',name:`${face.name}接光固定镜`,x,y,layer,angle,movable:false,rotatable:false});
    }
    const [x,y] = points[layer];
    items.push({id:`cube-point-${layer}`,kind:'cubeWaypoint',name:`${face.name}途经点`,x,y,layer,angle:0,movable:false,rotatable:false});
    for (let i=0;i<2;i++) items.push({id:`cube-mirror-${layer}-${i}`,kind:'mirror',name:'平面镜',x:1,y:1,layer:0,angle:0,movable:true,rotatable:true,inInventory:true});
    items.push({id:`cube-core-${layer}`,kind:'coreMirror',name:'向心分光镜',x:4,y:4,layer:0,angle:0,movable:true,rotatable:true,inInventory:true});
    obstacles[layer].forEach(([x,y],i) => items.push({id:`cube-block-${layer}-${i}`,kind:'block',name:'软角积木',x,y,layer,angle:0,movable:false,rotatable:false}));
  });
  return {
    number:11,chapter:1,chapterLevel:5,theme:'garden',cube:true,layers:6,size:7,
    title:'六面里的同一束光',introduction:'走过六面小径，让六束光在立方体中心相遇。',
    threshold:.18,holdSeconds:.6,items,
    hints:[
      '<b>01 · 从底面开始点亮</b>初始只有底面有光。先用镜子绕过灯前的积木，再向中心引光。每面的向心分光镜把一部分光送入中央，余光沿棱边送到下一面，接力顺序是底 → 右 → 后 → 顶 → 左 → 前。',
      '<b>02 · 每一面，各自到达</b>选面后其余五面暂时隐藏；可切全景观察。每面用平面镜引光穿过本面的圆环，再送到中央的圆形向心座。一个面完成后再做下一个，六路必须同时存在。',
      '<b>03 · 让箭头接住来光</b>每面通常需要两面平面镜。在向心座放一枚向心分光镜，箭头须沿光前进的方向。它兼顾中央汇光与下一面的接力；转错会阻断下游，少放一枚则无法汇齐六路。固定镜不能搬动，软角积木会挡光。',
      '<b>04 · 六条小径的位置</b>各面平面镜：底 (2,6)135°、(2,4)135°；右 (2,2)135°、(2,4)45°；后 (2,2)135°、(4,2)45°；顶 (6,6)135°、(6,4)45°；左 (2,6)45°、(2,4)135°；前 (2,6)45°、(4,6)135°。每面的 (4,4) 放向心分光镜，底/右/后/顶/左/前依次为0°/0°/90°/180°/0°/270°。圆环只显示当前面的位置。',
    ],
    hintPositions:CUBE_SOLUTION.flatMap((face,layer)=>[...face.mirrors.map(([x,y])=>({x,y,layer})),{x:4,y:4,layer}]),
  };
}
