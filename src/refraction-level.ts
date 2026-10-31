import type { Item, Level } from './level.ts';

export function createRefractionLevel(): Level {
  return {
    number: 13, chapter: 3, chapterLevel: 3, theme: 'experiment', setting: 'aquarium',
    title: '水面另一侧的来信', introduction: '先借水中的折射打开门，再沿四段滑轨，把光接回小小的水族馆。',
    size: 15, threshold: .20, holdSeconds: .6,
    aquarium: { minX: 6.5, minY: 5.5, size: 3, index: 4 / 3, gateOpen: false, sensorCharge: 0 },
    hints: [
      '<b>01 · 水会让光拐弯</b>鱼缸占九格。斜光入水偏向法线，出水再偏离法线；平行的两侧让出射方向恢复，却留下位置偏移。先沿出水后的白光找 A 镜，拖动时会吸附滑轨刻度。',
      '<b>02 · 先给门一个信号</b>A 镜先用平放的镜面，把穿过鱼缸的光送往感应器。正式放下并持续照亮后，门会解锁并保持打开，重开才复位。拖动预览不会开门。',
      '<b>03 · 再接一封长长的回信</b>开门后，重新调整 A 镜的位置和角度。四面滑轨镜都要接到这束出水光，后半段再用五面平面镜，穿过两枚观测环并送到水族灯。滑轨镜不能离轨或收纳；普通镜保持原有操作。',
      '<b>04 · 一套水边实验</b>先把 A 镜拖到 (12,2.5)、0°，等待感应门解锁。再把 A 镜改到 (12,3)、45°；B (10,4.5)、90°；C (14,7.5)、90°；D (9.5,10.75)、0°。五面普通镜依次为 (4,7)、90°；(10,2)、0°；(13,4)、90°；(10,6)、90°；(15,10)、90°。出水偏移须实际接住，两枚观测环之后再到水族灯。',
    ],
    hintPositions: [{x:12,y:2.5},{x:12,y:3},{x:10,y:4.5},{x:14,y:7.5},{x:9.5,y:10.75},{x:4,y:7},{x:10,y:2},{x:13,y:4},{x:10,y:6},{x:15,y:10}],
    items: [
      {id:'source',kind:'source',name:'水边实验灯',x:1,y:13,angle:0,movable:false,rotatable:false},
      {id:'fixed-launch',kind:'mirror',name:'斜射固定镜',x:3,y:13,angle:180-Math.atan2(4,3)*90/Math.PI,movable:false,rotatable:false},
      {id:'rail-a',kind:'mirror',name:'A 滑轨镜',x:12,y:5,angle:0,movable:true,rotatable:true,rail:{axis:'y',fixed:12,min:1.5,max:5.5,step:.5}},
      {id:'rail-b',kind:'mirror',name:'B 滑轨镜',x:10,y:3.5,angle:90,movable:true,rotatable:true,rail:{axis:'y',fixed:10,min:3.5,max:5.5,step:.5}},
      {id:'rail-c',kind:'mirror',name:'C 滑轨镜',x:14,y:9.5,angle:90,movable:true,rotatable:true,rail:{axis:'y',fixed:14,min:6,max:9.5,step:.5}},
      {id:'rail-d',kind:'mirror',name:'D 滑轨镜',x:6,y:10.75,angle:0,movable:true,rotatable:true,rail:{axis:'x',fixed:10.75,min:6,max:11.5,step:.5}},
      ...Array.from({length:5},(_,i):Item=>({id:i?`mirror-${i+1}`:'mirror',kind:'mirror',name:'平面镜',x:1,y:1,angle:0,movable:true,rotatable:true,inInventory:true})),
      {id:'sensor',kind:'sensor',name:'折射光感应器',x:14,y:5,angle:0,movable:false,rotatable:false},
      {id:'gate',kind:'gate',name:'光控升降门',x:12,y:9,angle:0,movable:false,rotatable:false},
      {id:'observe-a',kind:'waypoint',name:'回信观测环',x:9,y:3,angle:0,movable:false,rotatable:false,requiredDirections:1,requiredSources:1},
      {id:'observe-b',kind:'waypoint',name:'水族观测环',x:11,y:7,angle:0,movable:false,rotatable:false,requiredDirections:1,requiredSources:1},
      {id:'beacon',kind:'beacon',name:'水族灯',x:14,y:11,angle:0,movable:false,rotatable:false},
      ...([[2,8],[4,4],[5,9],[6,12],[8,12],[11,14],[13,13],[15,4],[11,1],[6,2]] as const).map(([x,y],i):Item=>({id:`lab-block-${i}`,kind:'block',name:'固定实验花台',x,y,angle:0,movable:false,rotatable:false,color:'cyan'})),
    ],
  };
}
