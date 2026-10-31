import type { Item, Level } from './level.ts';

export const PHOTO_LEFT_TURNS = [[3,13,135],[7,13,135],[7,10,45],[2,10,45],[2,6,135],[3,6,135],[3,3,135]] as const;
export const PHOTO_RIGHT_TURNS = [[16,5,45],[16,9,135],[12,9,135],[12,14,45],[15,14,135]] as const;
export const PHOTO_WAVELENGTHS = [
  { nm:650, name:'红', color:'red' }, { nm:530, name:'绿', color:'green' },
  { nm:460, name:'蓝', color:'blue' }, { nm:405, name:'紫', color:'violet' },
] as const;

export function createPhotoelectricLevel():Level {
  // Irregular scattered obstacles leave branches; no row or column contains a three-block wall.
  const walls = [[2,2],[5,6],[7,1],[1,10],[3,17],[6,2],[8,5],[6,9],[3,9],[7,9],[1,14],[3,12],[1,15],[2,4],[6,15],[4,6],[8,14],[7,17],[2,15],[2,17],[6,17],[7,16],[4,9],[8,10],[8,1],[7,8],[5,12],[2,12],[17,12],[14,10],[14,1],[17,4],[12,7],[11,6],[13,1],[11,10],[14,2],[13,10],[17,9],[17,5],[16,13],[10,11],[17,7],[10,3],[15,3],[16,11],[14,6],[15,2],[10,12],[10,1],[13,16]];
  return {
    number:14,chapter:3,chapterLevel:4,theme:'experiment',setting:'photoelectric',size:17,
    title:'让电子捎去一盏灯',introduction:'选对光的频率，聚光唤醒感光板；再把另一座岛的花灯照亮。',threshold:.54,holdSeconds:.6,
    photoelectric:{splitColumn:9,wavelengthNm:650,intensity:.5,workFunctionEv:2.46,quantumEfficiency:.12,sourceMicrowatts:100,relayThresholdMicroamps:2.3},
    hints:[
      '<b>01 · 先跨过频率的门槛</b>左区是单色实验灯。感光板用钠阴极作教学模型，只有波长短于约504纳米的光才能打出电子。红光、绿光再亮也无效；蓝光和紫光都可以。上方可以切换颜色、调节光强。',
      '<b>02 · 有电子，还要有足够的电流</b>左区光路要绕过散布的实验隔板。把光聚到感光板上，增加被接收的光子数；在频率合适时，加亮或聚光才会增大光电流，电子的最大动能不会因此增加。达到继电器门槛后，右区独立电源立即接通，不会储存先前的照射。',
      '<b>03 · 一边聚拢，一边铺开</b>左边用凸透镜，右边需要凹透镜。右区灯亮后，用余下的镜子绕过花园障碍，再从下方向上照进花灯屏，让光铺满整面。不能把左区的光直接跨过断口；只有电线传递控制信号。',
      '<b>04 · 一条完整的电光回信</b>选蓝光460nm，光强100%。左区七镜：(3,13)135°、(7,13)135°、(7,10)45°、(2,10)45°、(2,6)135°、(3,6)135°、(3,3)135°；凸透镜(5,3)0°，感光板位于(7,3)。右区五镜：(16,5)45°、(16,9)135°、(12,9)135°、(12,14)45°、(15,14)135°；凹透镜(15,12)90°。也可选紫光405nm、100%光强。',
    ],
    hintPositions:[...[...PHOTO_LEFT_TURNS,...PHOTO_RIGHT_TURNS].map(([x,y])=>({x,y})),{x:5,y:3},{x:15,y:12}],
    reservedCells:[{x:10,y:2},{x:10,y:4}],
    items:[
      {id:'source',kind:'source',name:'单色实验灯',x:1,y:16,angle:0,movable:false,rotatable:false},
      {id:'fixed-launch',kind:'mirror',name:'左区固定镜',x:3,y:16,angle:135,movable:false,rotatable:false},
      {id:'photocathode',kind:'photocell',name:'真空光电管 · 感光板',x:7,y:3,angle:0,movable:false,rotatable:false},
      {id:'powered-source',kind:'source',name:'右区电源灯',x:11,y:3,angle:90,movable:false,rotatable:false},
      {id:'fixed-right',kind:'mirror',name:'右区固定镜',x:11,y:5,angle:45,movable:false,rotatable:false},
      {id:'beacon',kind:'beacon',name:'光幕花灯',x:15,y:10,angle:270,screenHalfWidth:.7,movable:false,rotatable:false},
      ...Array.from({length:12},(_,n):Item=>({id:n?`mirror-${n+1}`:'mirror',kind:'mirror',name:'平面镜',x:1,y:1,angle:0,movable:true,rotatable:true,inInventory:true})),
      {id:'lens',kind:'lens',name:'凸透镜',x:1,y:1,angle:0,movable:true,rotatable:true,inInventory:true},
      {id:'concave',kind:'concaveLens',name:'凹透镜',x:1,y:1,angle:90,movable:true,rotatable:true,inInventory:true},
      ...walls.map(([x,y],n):Item=>({id:`photo-wall-${n}`,kind:'block',name:x<9?'固定实验隔板':'固定花园隔板',x,y,color:x<9?'cyan':'blue',angle:0,movable:false,rotatable:false})),
    ],
  };
}
