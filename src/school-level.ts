import type { Item, Level } from './level.ts';

export const SCHOOL_TURNS = [[2,8,135],[5,8,135],[5,6,45],[3,6,45],[3,3,135],[7,3,45],[7,10,45],[10,10,135],[10,5,45]] as const;
// Spaced classroom rows and scattered supplies leave broad areas and many plausible turns.
// These are independent furniture positions, never a filled-in wall around the solution.
const FURNITURE = [[5,5],[2,6],[6,6],[3,7],[6,7],[1,8],[6,8],[3,9],[5,9],[6,10],[9,11],[1,1],[3,1],[5,1],[7,1],[9,1],[11,1],[1,3],[9,3],[11,3],[1,5],[11,5],[1,7],[9,7],[11,7],[9,9],[1,11],[3,11],[5,11],[7,11],[11,11]];
export function createSchoolLevel(): Level {
  const furniture: Item[]=[];
  for(const [x,y] of FURNITURE) {
    const index=furniture.length, type=index<11?index%3:index%7;
    furniture.push({id:`school-${type===0?'cabinet':type===1?'chair':type===2?'books':'desk'}-${index}`,kind:'block',name:type===0?'固定教具柜':type===1?'固定椅子':type===2?'固定书本箱':'固定课桌',x,y,angle:0,movable:false,rotatable:false});
  }
  return {
    number:12,chapter:2,chapterLevel:5,theme:'night',setting:'school',size:11,threshold:0.53,holdSeconds:0.6,
    title:'把晚自习还给教室',introduction:'突然停电了。让光穿过桌椅与讲台，陪同学们继续今晚的学习。',
    hints:[
      '<b>01 · 停电后，先理清过道</b>带把手的书箱可以搬到空格或收回物品栏，其余课桌、椅子和教具柜是固定障碍。两张带通光圆环的课桌与讲台留有通道；同一束光要经过三处通道，最后抵达应急灯。',
      '<b>02 · 先到教室另一头</b>起点固定镜先把光送向上方。第一张通光桌后继续向上，再向左绕过课桌，沿前排向右走。别急着直接照应急灯，还有第二张课桌需要经过。',
      '<b>03 · 从桌下回来，向讲台聚拢</b>从教室右侧一路向下，穿过第二张桌子后折回上方。九面可移动镜分段接力，最后一段朝左，穿过讲台。用凸透镜把光聚在应急灯上；只经过桌子但没继续抵达终点不算完成。',
      '<b>04 · 一条晚读光路</b>先收回两只可搬书箱。平面镜依次：(2,8)、135°；(5,8)、135°；(5,6)、45°；(3,6)、45°；(3,3)、135°；(7,3)、45°；(7,10)、45°；(10,10)、135°；(10,5)、45°。凸透镜 (8,5)、0°，应急灯在 (6,5)。',
    ],
    hintPositions:[...SCHOOL_TURNS.map(([x,y])=>({x,y})),{x:8,y:5}],
    items:[
      {id:'source',kind:'source',name:'走廊备用灯',x:1,y:10,angle:0,movable:false,rotatable:false},
      {id:'fixed',kind:'mirror',name:'走廊固定镜',x:2,y:10,angle:135,movable:false,rotatable:false},
      ...SCHOOL_TURNS.map((_,i):Item=>({id:i?`mirror-${i+1}`:'mirror',kind:'mirror',name:'平面镜',x:1,y:1,angle:0,movable:true,rotatable:true,inInventory:true})),
      {id:'lens',kind:'lens',name:'凸透镜',x:1,y:1,angle:90,movable:true,rotatable:true,inInventory:true},
      ...[[4,8,'第一课桌通道'],[9,10,'第二课桌通道'],[7,5,'讲台通道']].map(([x,y,name],i):Item=>({id:`school-pass-${i}`,kind:'waypoint',name:String(name),x:Number(x),y:Number(y),angle:0,movable:false,rotatable:false,requiredDirections:1,requiredSources:1})),
      {id:'beacon',kind:'beacon',name:'教室应急灯',x:6,y:5,angle:0,movable:false,rotatable:false},
      ...[[2,9],[6,3]].map(([x,y],i):Item=>({id:`school-crate-${i}`,kind:'block',name:'可搬书箱',x,y,angle:0,movable:true,rotatable:false})),
      ...furniture,
    ],
  };
}

