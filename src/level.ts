import { createQuantumLevel } from './quantum-level.ts';
import type { QuantumConfig } from './quantum-level.ts';
import { createCubeLevel } from './cube-level.ts';
import { createSchoolLevel } from './school-level.ts';
import { createRefractionLevel } from './refraction-level.ts';
import { createPhotoelectricLevel } from './photoelectric-level.ts';
export type ItemKind = 'source' | 'mirror' | 'lens' | 'beacon' | 'liftMirror' | 'balloonMirror' | 'block' | 'waypoint' | 'prism' | 'colorWaypoint' | 'concaveLens' | 'hay' | 'cow' | 'splitter' | 'mixer' | 'booster' | 'powerWaypoint' | 'combiner' | 'cubeWaypoint' | 'coreMirror' | 'sensor' | 'gate' | 'photocell' | 'beamSplitter' | 'photonSource' | 'photonDetector';
export const SPECTRUM = [
  { id: 'red', name: '红', color: '#ee746b', slope: -1.5 },
  { id: 'orange', name: '橙', color: '#f5aa59', slope: -1 },
  { id: 'yellow', name: '黄', color: '#e9c94f', slope: -0.5 },
  { id: 'green', name: '绿', color: '#79bb83', slope: 0 },
  { id: 'cyan', name: '青', color: '#52bec4', slope: 0.5 },
  { id: 'blue', name: '蓝', color: '#739bea', slope: 1 },
  { id: 'violet', name: '紫', color: '#b18bd9', slope: 1.5 },
] as const;
export type SpectrumColor = typeof SPECTRUM[number]['id'];
export interface ColorRegion {
  color: SpectrumColor;
  name: string;
  minX: number; maxX: number; minY: number; maxY: number;
  scenery: Point;
  label: Point;
}
export interface Point { x: number; y: number; layer?: number }
export const LAYER_GAP = 3;
export interface Item extends Point {
  id: string;
  kind: ItemKind;
  name: string;
  angle: number;
  movable: boolean;
  rotatable: boolean;
  power?: number;
  inInventory?: boolean;
  allowedLayers?: readonly number[];
  requiredDirections?: number;
  requiredSources?: number;
  color?: SpectrumColor;
  home?: Point;
  herdPath?: Point[];
  herdTravel?: number;
  screenHalfWidth?: number;
  socket?:Point;
  rail?: { axis:'x'|'y'; fixed:number; min:number; max:number; step:number };
}
export interface Level {
  number: LevelNumber;
  chapter: 1 | 2 | 3;
  chapterLevel: number;
  theme: 'garden' | 'night' | 'experiment';
  setting?: 'street' | 'forest' | 'rural' | 'school' | 'aquarium' | 'photoelectric' | 'quantum';
  title: string;
  introduction: string;
  hints: readonly string[];
  hintPositions: readonly Point[];
  size: number;
  threshold: number;
  holdSeconds: number;
  items: Item[];
  layers?: number;
  holes?: readonly Point[];
  colorRegions?: readonly ColorRegion[];
  penCells?: readonly Point[];
  reservedCells?:readonly Point[];
  fusion?: boolean;
  cube?: boolean;
  aquarium?: { minX:number; minY:number; size:number; index:number; gateOpen:boolean; sensorCharge:number };
  quantum?: QuantumConfig;
  photoelectric?: {splitColumn:number;wavelengthNm:number;intensity:number;workFunctionEv:number;quantumEfficiency:number;sourceMicrowatts:number;relayThresholdMicroamps:number};
}

export const levelSummaries = [
  { number: 1, chapter: 1, chapterLevel: 1, title: '第一束光', topic: '反射' },
  { number: 2, chapter: 1, chapterLevel: 2, title: '把光聚拢', topic: '聚焦' },
  { number: 4, chapter: 1, chapterLevel: 3, title: '云上的回信', topic: '双层' },
  { number: 6, chapter: 1, chapterLevel: 4, title: '两束光的约定', topic: '交汇' },
  { number: 11, chapter: 1, chapterLevel: 5, title: '六面里的同一束光', topic: '立方' },
  { number: 3, chapter: 2, chapterLevel: 1, title: '为夜航点灯', topic: '夜航' },
  { number: 5, chapter: 2, chapterLevel: 2, title: '天亮前的早饭', topic: '留灯' },
  { number: 8, chapter: 2, chapterLevel: 3, title: '循着火光回家', topic: '归林' },
  { number: 9, chapter: 2, chapterLevel: 4, title: '村口的露天电影', topic: '放映' },
  { number: 12, chapter: 2, chapterLevel: 5, title: '把晚自习还给教室', topic: '晚读' },
  { number: 7, chapter: 3, chapterLevel: 1, title: '把七种颜色还给天空', topic: '分光' },
  { number: 10, chapter: 3, chapterLevel: 2, title: '让光一起长大', topic: '合光' },
  { number: 13, chapter: 3, chapterLevel: 3, title: '水面另一侧的来信', topic: '折射' },
  { number: 14, chapter: 3, chapterLevel: 4, title: '让电子捎去一盏灯', topic: '光电' },
  { number: 15, chapter: 3, chapterLevel: 5, title: '一束光的两种回答', topic: '光子' },
] as const;
export type LevelNumber = typeof levelSummaries[number]['number'];

export function createLevel(number: LevelNumber = 1): Level {
  if (number === 15) return createQuantumLevel();
  if (number === 14) return createPhotoelectricLevel();
  if (number === 13) return createRefractionLevel();
  if (number === 12) return createSchoolLevel();
  if (number === 11) return createCubeLevel();
  if (number === 10) return {
    number: 10, chapter: 3, chapterLevel: 2, theme: 'experiment', fusion: true,
    title: '让光一起长大', introduction: '先合成，再增强。让两束有来历的光穿过圆环，一起启动云端激光。',
    size: 15, threshold: 0.12, holdSeconds: 0.6,
    colorRegions: [
      { color: 'red', name: '珊瑚实验庭', minX: 7, maxX: 15, minY: 1, maxY: 3, scenery: { x: 13, y: 2 }, label: { x: 11.5, y: 1.1 } },
      { color: 'orange', name: '蜜橙蘑菇园', minX: 1, maxX: 6, minY: 4, maxY: 8, scenery: { x: 2, y: 5 }, label: { x: 3, y: 4.1 } },
      { color: 'yellow', name: '金色合光庭', minX: 7, maxX: 15, minY: 4, maxY: 7, scenery: { x: 12, y: 6 }, label: { x: 11, y: 7.2 } },
      { color: 'green', name: '薄荷分流园', minX: 1, maxX: 6, minY: 1, maxY: 3, scenery: { x: 2, y: 2 }, label: { x: 3.2, y: 1.1 } },
      { color: 'cyan', name: '青晶合光庭', minX: 7, maxX: 15, minY: 8, maxY: 15, scenery: { x: 13, y: 14 }, label: { x: 11, y: 14.7 } },
      { color: 'blue', name: '蓝色静湖', minX: 1, maxX: 6, minY: 9, maxY: 11, scenery: { x: 2, y: 10 }, label: { x: 3, y: 9.1 } },
      { color: 'violet', name: '紫晶观测园', minX: 1, maxX: 6, minY: 12, maxY: 15, scenery: { x: 3, y: 14 }, label: { x: 3, y: 15.2 } },
    ],
    hints: [
      '<b>01 · 颜色相同，来历不同</b>白光先经三棱镜分成七色。红＋绿合成黄，绿＋蓝合成青；合成光再与原生同色光进入增强器。原生黄、青单独照圆环无效。光路交叉不自动混色，必须进入标有配方的合光器。',
      '<b>02 · 一束绿光，两份任务</b>固定分流器把原生绿光分成向上、向右两路，各分一半能量。上路参与合黄，下路绕行参与合青。合光器自动削弱较强一路以平衡色比；增强器只叠加能量，不凭空放大。',
      '<b>03 · 排除杂色，继续送达</b>橙光、紫光会被旧镜折进实验装置，用可搬动的挡光块截住它们。小块只挡实际穿过块体的光，放在旁边不能隔空遮挡。上路合成黄先向右、下、右；下路合成青先向上、右、下。两个增强圆环之后，光还要分别转向中央合束器。先后点亮不累计。',
      '<b>04 · 一套完整实验</b>三棱镜 (3,8)、0°。挡光块放 (6,5)、(4,10)，第三块可备用。八面平面镜：(9,2)、45°；(9,4)、45°；(9,8)、45°；(9,12)、135°；(7,11)、135°；(11,11)、45°；(14,4)、45°；(14,12)、135°。合成黄、青分别接入增强器，再经两枚圆环汇入中央合束器。',
    ],
    hintPositions: [{ x: 3, y: 8 }, { x: 6, y: 5 }, { x: 4, y: 10 }, ...[[9, 2], [9, 4], [9, 8], [9, 12], [7, 11], [11, 11], [14, 4], [14, 12]].map(([x,y]) => ({x,y}))],
    items: [
      { id: 'source', kind: 'source', name: '白光实验灯', x: 1, y: 8, angle: 0, movable: false, rotatable: false },
      { id: 'prism', kind: 'prism', name: '三棱镜', x: 3, y: 8, angle: 0, movable: true, rotatable: true, inInventory: true },
      ...Array.from({ length: 8 }, (_, i): Item => ({ id: i ? `mirror-${i+1}` : 'mirror', kind: 'mirror', name: '平面镜', x: 1, y: 1, angle: 0, movable: true, rotatable: true, inInventory: true })),
      ...Array.from({ length: 3 }, (_, i): Item => ({ id: `shade-${i+1}`, kind: 'block', name: '可搬挡光块', x: 1, y: 1, angle: 0, movable: true, rotatable: false, inInventory: true })),
      { id: 'split-green', kind: 'splitter', name: '绿光分流 ↑→', color: 'green', x: 7, y: 8, angle: 0, movable: false, rotatable: false },
      { id: 'mix-yellow', kind: 'mixer', name: '红＋绿 → 黄', color: 'yellow', x: 7, y: 2, angle: 0, movable: false, rotatable: false },
      { id: 'mix-cyan', kind: 'mixer', name: '绿＋蓝 → 青 ↑', color: 'cyan', x: 7, y: 12, angle: 270, movable: false, rotatable: false },
      { id: 'boost-yellow', kind: 'booster', name: '原生黄＋合成黄 →', color: 'yellow', x: 11, y: 4, angle: 0, movable: false, rotatable: false },
      { id: 'boost-cyan', kind: 'booster', name: '原生青＋合成青 →', color: 'cyan', x: 11, y: 12, angle: 0, movable: false, rotatable: false },
      { id: 'power-yellow', kind: 'powerWaypoint', name: '增强黄途经', color: 'yellow', x: 13, y: 4, angle: 0, movable: false, rotatable: false },
      { id: 'power-cyan', kind: 'powerWaypoint', name: '增强青途经', color: 'cyan', x: 13, y: 12, angle: 0, movable: false, rotatable: false },
      { id: 'final-combiner', kind: 'combiner', name: '双增强光合束 →', x: 14, y: 8, angle: 0, movable: false, rotatable: false },
      { id: 'beacon', kind: 'beacon', name: '云端激光发射台', x: 15, y: 8, angle: 0, movable: false, rotatable: false },
      { id: 'stray-orange', kind: 'mirror', name: '橙路旧镜', x: 8, y: 3, angle: 90, movable: false, rotatable: false },
      { id: 'stray-violet', kind: 'mirror', name: '紫路旧镜', x: 5, y: 11, angle: 0, movable: false, rotatable: false },
      ...([[10,2,'red'],[4,5,'orange'],[15,6,'yellow'],[5,2,'green'],[9,14,'cyan'],[3,10,'blue'],[5,14,'violet']] as const).map(([x,y,color],i):Item => ({ id:`fusion-obstacle-${i}`, kind:'block',name:'固定主题障碍',x,y,color,angle:0,movable:false,rotatable:false })),
    ],
  };
  if (number === 9) return {
    number: 9, chapter: 2, chapterLevel: 4, theme: 'night', setting: 'rural',
    title: '村口的露天电影', introduction: '挪开稻草，赶牛回圈。把光展开，让全村等到今晚的电影。',
    size: 9, threshold: 0.57, holdSeconds: 0.6,
    penCells: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
    hints: [
      '<b>01 · 先收拾村口</b>稻草堆可以拖到空格，也能拖回物品栏。先清出牛圈门口与路上的稻草，点击牛或右键选择“赶回牛圈”。它们要沿真正畅通的路回家，不能穿过稻草或器件。',
      '<b>02 · 让路，再接光</b>先送靠上方的花牛回圈，再照顾另一头小黄牛。固定镜把光送向下沿：向右、向上，再向右，绕过田埂后折回幕布所在的行。七面镜子都能派上用场。',
      '<b>03 · 让整幅幕布亮起来</b>最后一段用凹透镜。它让光向外展开，不是聚焦；光轴顺着光束，离幕布至少留两格。凹透镜后直接到幕布，不要再转弯。两头牛都回圈，电影才安心开场。',
      '<b>04 · 一条放映路线</b>收纳三堆稻草，先送花牛、再送黄牛回圈。平面镜：(2,9)、45°；(5,9)、135°；(5,8)、135°；(7,8)、135°；(7,5)、45°；(4,5)、45°；(4,2)、135°。凹透镜：(6,2)、0°，把光展开到 (8,2) 的幕布。',
    ],
    hintPositions: [{ x: 2, y: 9 }, { x: 5, y: 9 }, { x: 5, y: 8 }, { x: 7, y: 8 }, { x: 7, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 2 }, { x: 6, y: 2 }],
    items: [
      { id: 'source', kind: 'source', name: '老式放映机', x: 1, y: 8, angle: 0, movable: false, rotatable: false, power: 1 },
      { id: 'fixed', kind: 'mirror', name: '村口固定镜', x: 2, y: 8, angle: 45, movable: false, rotatable: false },
      ...Array.from({ length: 7 }, (_, index): Item => ({ id: index ? `mirror-${index + 1}` : 'mirror', kind: 'mirror', name: '平面镜', x: 3, y: 4, angle: 0, movable: true, rotatable: true, inInventory: true })),
      { id: 'concave', kind: 'concaveLens', name: '凹透镜', x: 3, y: 4, angle: 90, movable: true, rotatable: true, inInventory: true },
      { id: 'beacon', kind: 'beacon', name: '露天电影幕布', x: 8, y: 2, angle: 0, screenHalfWidth: 0.8, movable: false, rotatable: false },
      ...[[2, 3], [6, 5], [2, 9]].map(([x, y], index): Item => ({ id: `hay-${index + 1}`, kind: 'hay', name: '可搬稻草堆', x, y, angle: 0, movable: true, rotatable: false })),
      { id: 'cow-flower', kind: 'cow', name: '小花牛', x: 7, y: 5, home: { x: 1, y: 1 }, angle: 0, movable: false, rotatable: false },
      { id: 'cow-brown', kind: 'cow', name: '小黄牛', x: 5, y: 8, home: { x: 1, y: 2 }, angle: 180, movable: false, rotatable: false },
      ...[[1, 3], [1, 6], [1, 7], [1, 9], [2, 5], [2, 6], [3, 1], [3, 2], [3, 6], [3, 7], [4, 1], [4, 6], [5, 3], [5, 6], [5, 7], [6, 1], [6, 3], [6, 4], [6, 6], [6, 9], [7, 3], [7, 4], [7, 9], [8, 1], [8, 6], [8, 7], [8, 8], [8, 9], [9, 2], [9, 3], [9, 4], [9, 7], [9, 8]].map(([x, y], index): Item => ({ id: `rural-block-${index}`, kind: 'block', name: index < 8 ? '固定矮石墙' : '固定田埂花木', x, y, angle: 0, movable: false, rotatable: false })),
    ],
  };
  if (number === 8) return {
    number: 8, chapter: 2, chapterLevel: 3, theme: 'night', setting: 'forest',
    title: '循着火光回家',
    introduction: '森林睡着了。试着把火光引向前方，陪赶夜路的人回家。',
    size: 9, threshold: 0.25, holdSeconds: 0.6,
    hints: [
      '<b>01 · 先照亮脚边</b>只有当前光束周围一格和木屋周围一格可以看清。树木与岩石会挡光；在亮处放镜子，再右键调整方向，让火光探进黑暗。光移开后会渐渐变暗，已放镜子留下回收标记，可拖回物品栏或右键收回。',
      '<b>02 · 林中有两面旧镜子</b>起点固定镜让火光向上走。先向右探路，在树墙前转向下方，再向右接到另一面固定镜。跟着火光的人会在前方等待，也会沿来路退回。',
      '<b>03 · 从林子的另一侧回来</b>远处的固定镜把光送向上方。接下来向左、向上，再向右走进木屋；需要六面可移动镜接力。可以在已经照亮的地方试错，没有失败惩罚。',
      '<b>04 · 一条回家的小径</b>六面平面镜依次放在 (2,7)、135°；(5,7)、45°；(5,8)、45°；(9,5)、45°；(6,5)、45°；(6,2)、135°。经两面固定镜，火光最终到达 (8,2) 的小木屋。圆环只在当前可见区域显示。',
    ],
    hintPositions: [{ x: 2, y: 7 }, { x: 5, y: 7 }, { x: 5, y: 8 }, { x: 9, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 2 }],
    items: [
      { id: 'source', kind: 'source', name: '林间篝火', x: 1, y: 8, angle: 0, movable: false, rotatable: false, power: 1 },
      { id: 'fixed', kind: 'mirror', name: '起点固定镜', x: 2, y: 8, angle: 135, movable: false, rotatable: false },
      { id: 'fixed-forest', kind: 'mirror', name: '林间固定镜', x: 9, y: 8, angle: 135, movable: false, rotatable: false },
      ...Array.from({ length: 6 }, (_, index): Item => ({ id: index ? `mirror-${index + 1}` : 'mirror', kind: 'mirror', name: '平面镜', x: 3, y: 4, angle: 0, movable: true, rotatable: true, inInventory: true })),
      { id: 'beacon', kind: 'beacon', name: '小木屋', x: 8, y: 2, angle: 0, movable: false, rotatable: false },
      ...[[1, 1], [1, 6], [1, 7], [2, 2], [2, 3], [2, 5], [2, 6], [2, 9], [3, 1], [3, 2], [3, 3], [3, 6], [4, 1], [4, 2], [4, 3], [4, 5], [4, 8], [5, 2], [5, 6], [6, 6], [6, 7], [6, 9], [7, 1], [7, 4], [7, 6], [7, 9], [8, 4], [8, 6], [9, 1], [9, 3]].map(([x, y], index): Item => ({ id: `forest-block-${index}`, kind: 'block', name: index % 3 ? '固定松树' : '覆苔岩石', x, y, angle: 0, movable: false, rotatable: false })),
    ],
  };
  if (number === 7) return {
    number: 7, chapter: 3, chapterLevel: 1, theme: 'experiment',
    title: '把七种颜色还给天空',
    introduction: '让白光散成七色，途经各自的花园，再一起搭起彩虹桥。',
    size: 13, threshold: 0.30, holdSeconds: 0.6,
    colorRegions: [
      { color: 'red', name: '珊瑚石庭', minX: 7, maxX: 13, minY: 1, maxY: 4, scenery: { x: 12, y: 3 }, label: { x: 10, y: 1.15 } },
      { color: 'orange', name: '蜜橙蘑菇园', minX: 1, maxX: 6, minY: 4, maxY: 7, scenery: { x: 2, y: 6.2 }, label: { x: 2.8, y: 4.15 } },
      { color: 'yellow', name: '金色花田', minX: 7, maxX: 13, minY: 5, maxY: 7, scenery: { x: 12, y: 6 }, label: { x: 10, y: 5.15 } },
      { color: 'green', name: '薄荷小森林', minX: 1, maxX: 6, minY: 1, maxY: 3, scenery: { x: 2, y: 2.2 }, label: { x: 2.8, y: 1.15 } },
      { color: 'cyan', name: '青晶浅滩', minX: 1, maxX: 6, minY: 8, maxY: 9, scenery: { x: 2, y: 9 }, label: { x: 2.8, y: 8.15 } },
      { color: 'blue', name: '蓝色静湖', minX: 7, maxX: 13, minY: 8, maxY: 13, scenery: { x: 12, y: 11 }, label: { x: 10.5, y: 12.3 } },
      { color: 'violet', name: '紫晶梦境', minX: 1, maxX: 6, minY: 10, maxY: 13, scenery: { x: 2, y: 12 }, label: { x: 2.8, y: 10.15 } },
    ],
    hints: [
      '<b>01 · 七色也要学会绕路</b>三棱镜箭头顺着白光，分出的七色各经本色区域里的圆环，再一起抵达汇虹台。带实心方底的珊瑚石、蘑菇墙、花箱、树篱、冰岩和晶簇会占格挡光；云朵和小景观仍只是装饰。',
      '<b>02 · 橙光别急着折回</b>上方的珊瑚石堵住了直达的转弯通道。橙光先经过蘑菇园的圆环，再用两面镜子曲折前进，接向中右侧的固定镜；其他五束斜光可以沿各自通道折回。',
      '<b>03 · 绿光从另一侧回来</b>起点固定镜把绿光送进左上森林。穿过绿色圆环后，在最上行转向右方，借远处的固定镜向下走，再补一面镜子从终点右侧送光进去。七路须同时抵达，不累计之前的点亮。',
      '<b>04 · 一条可行的小径</b>三棱镜 (3,7)、0°。平面镜：红 (7,1)、0°；橙 (5,5)、0° 与 (7,7)、0°；黄 (7,5)、0°；青 (7,9)、0°；蓝 (7,11)、0°；紫 (7,13)、0°；绿 (4,1)、135° 与 (12,7)、135°。橙光借 (9,5) 固定镜折返，绿光借 (12,1) 固定镜从右侧接回汇虹台。',
    ],
    hintPositions: [{ x: 3, y: 7 }, { x: 7, y: 1 }, { x: 5, y: 5 }, { x: 7, y: 7 }, { x: 7, y: 5 }, { x: 7, y: 9 }, { x: 7, y: 11 }, { x: 7, y: 13 }, { x: 4, y: 1 }, { x: 12, y: 7 }],
    items: [
      { id: 'source', kind: 'source', name: '白光实验灯', x: 1, y: 7, angle: 0, movable: false, rotatable: false, power: 1 },
      { id: 'prism', kind: 'prism', name: '三棱镜', x: 3, y: 7, angle: 0, movable: true, rotatable: true, inInventory: true },
      { id: 'fixed', kind: 'mirror', name: '森林边固定镜', x: 4, y: 7, angle: 135, movable: false, rotatable: false },
      { id: 'fixed-green', kind: 'mirror', name: '远端固定镜', x: 12, y: 1, angle: 45, movable: false, rotatable: false },
      { id: 'fixed-orange', kind: 'mirror', name: '橙路折返固定镜', x: 9, y: 5, angle: 0, movable: false, rotatable: false },
      ...Array.from({ length: 9 }, (_, index): Item => ({ id: index === 0 ? 'mirror' : `mirror-${index + 1}`, kind: 'mirror', name: '平面镜', x: 1, y: 1, angle: 0, movable: true, rotatable: true, inInventory: true })),
      ...SPECTRUM.map((color, index): Item => ({ id: `color-${color.id}`, kind: 'colorWaypoint', name: `${color.name}色途经点`, color: color.id, x: [9, 4, 9, 4, 5, 9, 5][index], y: [4, 6, 6, 2, 8, 9, 10][index], angle: 0, movable: false, rotatable: false })),
      { id: 'beacon', kind: 'beacon', name: '汇虹台', x: 11, y: 7, angle: 0, movable: false, rotatable: false },
      ...([
        [7, 3, 'red', '珊瑚石墙'], [11, 2, 'red', '珊瑚石台'], [2, 5, 'orange', '蘑菇矮墙'],
        [13, 5, 'yellow', '金色花箱'], [5, 2, 'green', '薄荷树篱'], [3, 9, 'cyan', '青晶岩台'],
        [10, 11, 'blue', '蓝色冰岩'], [3, 12, 'violet', '紫晶石台'],
      ] as const).map(([x, y, color, name], index): Item => ({ id: `spectrum-block-${index}`, kind: 'block', color, name, x, y, angle: 0, movable: false, rotatable: false })),
    ],
  };
  if (number === 6) return {
    number: 6, chapter: 1, chapterLevel: 4, theme: 'garden',
    title: '两束光的约定',
    introduction: '从两个方向经过途经点，再把两束光一起送到终点。',
    size: 7, threshold: 0.75, holdSeconds: 0.6,
    hints: [
      '<b>01 · 两盏灯，一个约定</b>两盏固定光源各送出半份能量。把两条光路分别接向中间的途经点，从不同方向穿过它，再继续前往同一个信标。',
      '<b>02 · 先接两条来路</b>左侧固定镜把 A 的光送向棋盘上方，右下固定镜把 B 的光送向左方。用平面镜分别将它们送进途经点所在的行和列。',
      '<b>03 · 经过以后，还要到达</b>从左边经过途经点的光，还需在最右列转向终点；另一束借上方的固定镜向右走。两条末段各放一枚凸透镜，让焦点落在两格外的信标。',
      '<b>04 · 一条可行的小径</b>平面镜：(2,4)、135°；(7,4)、135°；(4,5)、45°。凸透镜：(7,3)、90°；(5,1)、0°。两束光分别从左侧、下侧穿过 (4,4)，再聚焦到 (7,1) 的信标。',
    ],
    hintPositions: [{ x: 2, y: 4 }, { x: 7, y: 4 }, { x: 4, y: 5 }, { x: 7, y: 3 }, { x: 5, y: 1 }],
    items: [
      { id: 'source', kind: 'source', name: '光源 A', x: 1, y: 6, angle: 0, movable: false, rotatable: false, power: 0.5 },
      { id: 'source-b', kind: 'source', name: '光源 B', x: 6, y: 7, angle: 270, movable: false, rotatable: false, power: 0.5 },
      { id: 'fixed', kind: 'mirror', name: 'A 路固定镜', x: 2, y: 6, angle: 135, movable: false, rotatable: false },
      { id: 'fixed-b', kind: 'mirror', name: 'B 路固定镜', x: 6, y: 5, angle: 45, movable: false, rotatable: false },
      { id: 'fixed-top', kind: 'mirror', name: '终段固定镜', x: 4, y: 1, angle: 135, movable: false, rotatable: false },
      { id: 'waypoint', kind: 'waypoint', name: '双向途经点', x: 4, y: 4, angle: 0, movable: false, rotatable: false, requiredDirections: 2, requiredSources: 2 },
      ...['mirror', 'mirror-2', 'mirror-3'].map((id): Item => ({ id, kind: 'mirror', name: '平面镜', x: 3, y: 4, angle: 0, movable: true, rotatable: true, inInventory: true })),
      ...['lens', 'lens-2'].map((id): Item => ({ id, kind: 'lens', name: '凸透镜', x: 3, y: 4, angle: 0, movable: true, rotatable: true, inInventory: true })),
      { id: 'beacon', kind: 'beacon', name: '终点信标', x: 7, y: 1, angle: 0, movable: false, rotatable: false },
      ...[[3, 2], [3, 3], [3, 5], [3, 6], [5, 6], [7, 6]].map(([x, y], index): Item => ({ id: `crossing-block-${index}`, kind: 'block', name: '软角积木', x, y, angle: 0, movable: false, rotatable: false })),
    ],
  };
  if (number === 5) return {
    number: 5, chapter: 2, chapterLevel: 2, theme: 'night', setting: 'street',
    title: '天亮前的早饭',
    introduction: '她把阳台的灯留着。绕过花箱，把光送到路边早餐。',
    size: 7, threshold: 0.27, holdSeconds: 0.6,
    hints: [
      '<b>01 · 阳台还留着灯</b>光已经被起点固定镜送向上方。花箱和围挡既占格，也会挡光；先找到能把光送到另一面固定镜的通道。',
      '<b>02 · 看看路边早餐周围</b>路边接光处的左侧和上方都有障碍，只能从右边送光进去。先在最右侧留下一面转向的镜子，再往回找路。',
      '<b>03 · 接过围挡的缺口</b>第二面固定镜把光送向下方。用两面同一行的镜子把它接到最右侧，再用末端镜子把光向左送入路边早餐；加上最初的一面，需要四面可移动镜。',
      '<b>04 · 一条可行的小径</b>四面平面镜：第 2 列第 2 行，135°；第 5 列第 5 行，45°；第 7 列第 5 行，45°；第 7 列第 7 行，135°。光绕过花箱和围挡，经六次反射照到路边早餐。圆环标出了位置。',
    ],
    hintPositions: [{ x: 2, y: 2 }, { x: 5, y: 5 }, { x: 7, y: 5 }, { x: 7, y: 7 }],
    items: [
      { id: 'source', kind: 'source', name: '阳台吊灯', x: 1, y: 6, angle: 0, movable: false, rotatable: false, power: 1 },
      { id: 'fixed', kind: 'mirror', name: '楼边固定镜', x: 2, y: 6, angle: 135, movable: false, rotatable: false },
      { id: 'fixed-street', kind: 'mirror', name: '路口固定镜', x: 5, y: 2, angle: 45, movable: false, rotatable: false },
      ...['mirror', 'mirror-2', 'mirror-3', 'mirror-4'].map((id): Item => ({ id, kind: 'mirror', name: '平面镜', x: 3, y: 4, angle: 0, movable: true, rotatable: true, inInventory: true })),
      { id: 'beacon', kind: 'beacon', name: '路边早餐', x: 6, y: 7, angle: 0, movable: false, rotatable: false },
      ...[[4, 3], [4, 4], [4, 5], [6, 1], [6, 2], [6, 3], [5, 7], [6, 6]].map(([x, y], index): Item => ({ id: `street-block-${index}`, kind: 'block', name: x === 4 || x === 5 ? '固定花箱' : '施工围挡', x, y, angle: 0, movable: false, rotatable: false })),
    ],
  };
  if (number === 4) return {
    number: 4, chapter: 1, chapterLevel: 3, theme: 'garden',
    title: '云上的回信',
    introduction: '让光穿过洞口，借红气球镜把暖意送上楼。',
    size: 7, layers: 2, holes: [{ x: 5, y: 3, layer: 1 }],
    threshold: 0.65, holdSeconds: 0.6,
    hints: [
      '<b>01 · 分层看看</b>用棋盘旁的“操作下层 / 操作上层”切换。另一层会暂时透明。下层的固定镜已把光向上方格送出，先接住它。',
      '<b>02 · 一束光上楼</b>用平面镜把光转到洞口正下方，再用向上反射镜将它送上楼。升光镜的箭头要与入射光前进方向一致。红气球镜只在上层接住竖直光，再沿箭头水平送出。',
      '<b>03 · 绕过方块，再聚焦</b>洞口旁的障碍块挡住了三个方向。把光送向上层固定镜，再用平面镜转向信标。最后让凸透镜的焦点落在两格外的信标上。',
      '<b>04 · 一条可行的小径</b>下层：平面镜 (3,3)、135°；升光镜 (5,3)、0°。上层：气球镜 (5,3)、270°；平面镜 (2,1)、135°；凸透镜 (2,3)、90°。圆环分别标在两层。',
    ],
    hintPositions: [{ x: 3, y: 3, layer: 0 }, { x: 5, y: 3, layer: 0 }, { x: 5, y: 3, layer: 1 }, { x: 2, y: 1, layer: 1 }, { x: 2, y: 3, layer: 1 }],
    items: [
      { id: 'source', kind: 'source', name: '白光光源', x: 1, y: 6, layer: 0, angle: 0, movable: false, rotatable: false, power: 1 },
      { id: 'fixed', kind: 'mirror', name: '下层固定镜', x: 3, y: 6, layer: 0, angle: 135, movable: false, rotatable: false },
      { id: 'fixed-upper', kind: 'mirror', name: '上层固定镜', x: 5, y: 1, layer: 1, angle: 45, movable: false, rotatable: false },
      ...['mirror', 'mirror-2'].map((id): Item => ({ id, kind: 'mirror', name: '平面镜', x: 4, y: 4, layer: 0, angle: 0, movable: true, rotatable: true, inInventory: true })),
      { id: 'lift', kind: 'liftMirror', name: '向上反射镜', x: 4, y: 4, layer: 0, angle: 0, movable: true, rotatable: true, inInventory: true, allowedLayers: [0] },
      { id: 'balloon', kind: 'balloonMirror', name: '红气球镜', x: 4, y: 4, layer: 1, angle: 0, movable: true, rotatable: true, inInventory: true, allowedLayers: [1] },
      { id: 'lens', kind: 'lens', name: '凸透镜', x: 4, y: 4, layer: 1, angle: 0, movable: true, rotatable: true, inInventory: true },
      { id: 'beacon', kind: 'beacon', name: '上层信标', x: 2, y: 5, layer: 1, angle: 0, movable: false, rotatable: false },
      ...[
        { x: 4, y: 5, layer: 0 }, { x: 5, y: 6, layer: 0 },
        { x: 4, y: 3, layer: 1 }, { x: 6, y: 3, layer: 1 }, { x: 5, y: 4, layer: 1 }, { x: 3, y: 4, layer: 1 },
      ].map((position, index): Item => ({ ...position, id: `block-${index}`, kind: 'block', name: '软角积木', angle: 0, movable: false, rotatable: false })),
    ],
  };
  if (number === 3) return {
    number: 3, chapter: 2, chapterLevel: 1, theme: 'night',
    title: '为夜航点灯',
    introduction: '接起五次反射，让灯塔为海上的小船指路。',
    hints: [
      '<b>01 · 从小灯出发</b>小灯右边的固定镜把光送向棋盘下沿。先接住这束光，再观察灯塔下方那面固定镜。',
      '<b>02 · 从终点往回想</b>灯塔下方的固定镜需要接到从右向左的光，才能把它向上送入灯塔。它所在的那一行，就是最后一面可移动镜的目的地。',
      '<b>03 · 画一条折返的路</b>用三面镜子依次让光向右、向上、向左。把中间两面镜子放在同一列，将下沿的光接到终点固定镜所在的那一行。',
      '<b>04 · 一条可行的航线</b>三面平面镜依次放在：第 2 列第 7 行，45°；第 6 列第 7 行，135°；第 6 列第 3 行，45°。光经两面固定镜、三面可移动镜抵达灯塔。圆环标出了位置。',
    ],
    hintPositions: [{ x: 2, y: 7 }, { x: 6, y: 7 }, { x: 6, y: 3 }],
    size: 7, threshold: 0.29, holdSeconds: 0.6,
    items: [
      { id: 'source', kind: 'source', name: '白光小灯', x: 1, y: 6, angle: 0, movable: false, rotatable: false, power: 1 },
      { id: 'fixed', kind: 'mirror', name: '起点固定镜', x: 2, y: 6, angle: 45, movable: false, rotatable: false },
      { id: 'fixed-harbor', kind: 'mirror', name: '灯塔固定镜', x: 1, y: 3, angle: 45, movable: false, rotatable: false },
      ...['mirror', 'mirror-2', 'mirror-3'].map((id): Item => ({ id, kind: 'mirror', name: '平面镜', x: 4, y: 4, angle: 0, movable: true, rotatable: true, inInventory: true })),
      { id: 'beacon', kind: 'beacon', name: '夜航灯塔', x: 1, y: 2, angle: 0, movable: false, rotatable: false },
    ],
  };
  if (number === 1) return {
    number: 1,
    chapter: 1, chapterLevel: 1, theme: 'garden',
    title: '第一束光',
    introduction: '拖出一面平面镜，接住固定镜送来的光。',
    hints: [
      '<b>01 · 观察光的转弯</b>固定平面镜已经把向右的光反射向上。沿着白光看看，它还没有照到左侧的信标。',
      '<b>02 · 接上另一面镜子</b>从物品栏拖出平面镜，让它同时处在向上的光束上、信标所在的那一行。',
      '<b>03 · 让白光向左走</b>右键点击你放下的镜子，选择倾斜的镜面。观察朝向改变后，光会向左还是向右反射。',
      '<b>04 · 一条可行的小径</b>平面镜：第 5 列第 2 行，45°（\\）。白光经固定镜向上，再经这面镜子向左抵达信标。圆环标出了位置。',
    ],
    hintPositions: [{ x: 5, y: 2 }],
    size: 7,
    // 入门关只学习反射；沿用真实光束接收比例，下一关再提高强度要求。
    threshold: 0.30,
    holdSeconds: 0.6,
    items: [
      { id: 'source', kind: 'source', name: '白光光源', x: 1, y: 6, angle: 0, movable: false, rotatable: false, power: 1 },
      { id: 'fixed', kind: 'mirror', name: '固定平面镜', x: 5, y: 6, angle: 135, movable: false, rotatable: false },
      { id: 'mirror', kind: 'mirror', name: '平面镜', x: 3, y: 4, angle: 0, movable: true, rotatable: true, inInventory: true },
      { id: 'beacon', kind: 'beacon', name: '终点信标', x: 1, y: 2, angle: 0, movable: false, rotatable: false },
    ],
  };
  return {
    number: 2,
    chapter: 1, chapterLevel: 2, theme: 'garden',
    title: '把光聚拢',
    introduction: '接好两次反射，再用凸透镜让光聚拢。',
    hints: [
      '<b>01 · 让光拐个弯</b>从物品栏拖出平面镜，放在白色光束上。右键点击它，选择让光向上走的朝向。',
      '<b>02 · 借固定镜的力量</b>让第一面镜子与固定镜处在同一列，把光送过去。',
      '<b>03 · 让光聚拢</b>从物品栏拖出凸透镜，让光轴与光束平行。焦点在透镜前方两格。',
      '<b>04 · 一条可行的小径</b>平面镜：第 5 列第 6 行，135°（/）。凸透镜：第 3 列第 2 行，0°。圆环标出了位置。',
    ],
    hintPositions: [{ x: 5, y: 6 }, { x: 3, y: 2 }],
    size: 7,
    threshold: 0.75,
    holdSeconds: 0.6,
    items: [
      { id: 'source', kind: 'source', name: '白光光源', x: 1, y: 6, angle: 0, movable: false, rotatable: false, power: 1 },
      { id: 'mirror', kind: 'mirror', name: '平面镜', x: 3, y: 4, angle: 0, movable: true, rotatable: true, inInventory: true },
      { id: 'fixed', kind: 'mirror', name: '固定平面镜', x: 5, y: 2, angle: 45, movable: false, rotatable: false },
      { id: 'lens', kind: 'lens', name: '凸透镜', x: 3, y: 5, angle: 90, movable: true, rotatable: true, inInventory: true },
      { id: 'beacon', kind: 'beacon', name: '终点信标', x: 1, y: 2, angle: 0, movable: false, rotatable: false },
    ],
  };
}

export function canPlace(level: Level, id: string, position: Point): boolean {
  if(level.reservedCells?.some(p=>p.x===position.x&&p.y===position.y&&(p.layer??0)===(position.layer??0)))return false;
  if(level.photoelectric&&position.x===level.photoelectric.splitColumn)return false;
  const item = level.items.find(candidate => candidate.id === id);
  const layer = position.layer ?? item?.layer ?? 0;
  if(level.quantum) {
    if(position.x===level.quantum.splitColumn)return false;
    const socket=level.items.find(i=>i.socket)?.socket;
    if(item?.socket&&(position.x!==item.socket.x||position.y!==item.socket.y))return false;
    if(socket&&position.x===socket.x&&position.y===socket.y&&!item?.socket)return false;
  }
  if(level.aquarium||level.quantum) {
    const tank=level.aquarium??level.quantum!.water;
    if(position.x>=tank.minX&&position.x<=tank.minX+tank.size&&position.y>=tank.minY&&position.y<=tank.minY+tank.size)return false;
    if(item?.rail) {
      const rail=item.rail,other=rail.axis==='x'?'y':'x',coordinate=position[rail.axis];
      return (position.layer??0)===0&&Math.abs(position[other]-rail.fixed)<1e-6&&coordinate>=rail.min&&coordinate<=rail.max
        &&Math.abs((coordinate-rail.min)/rail.step-Math.round((coordinate-rail.min)/rail.step))<1e-6
        &&!level.items.some(i=>i.id!==id&&!i.inInventory&&Math.hypot(i.x-position.x,i.y-position.y)<.72);
    }
    if(level.items.some(i=>i.rail&&Math.abs(position[i.rail.axis==='x'?'y':'x']-i.rail.fixed)<.48&&position[i.rail.axis]>=i.rail.min&&position[i.rail.axis]<=i.rail.max))return false;
  }
  return Number.isInteger(position.x) && Number.isInteger(position.y)
    && (!level.cube || (item?.kind === 'coreMirror' ? position.x === (level.size+1)/2 && position.y === (level.size+1)/2 : position.x !== (level.size+1)/2 || position.y !== (level.size+1)/2))
    && Number.isInteger(layer) && layer >= 0 && layer < (level.layers ?? 1)
    && (!item?.allowedLayers || item.allowedLayers.includes(layer))
    && (!level.holes?.some(hole => (hole.layer ?? 1) === layer && hole.x === position.x && hole.y === position.y) || item?.kind === 'balloonMirror')
    && position.x >= 1 && position.y >= 1 && position.x <= level.size && position.y <= level.size
    && !level.penCells?.some(cell => cell.x === position.x && cell.y === position.y)
    && !level.items.some(cow => cow.herdPath?.some(cell => cell.x === position.x && cell.y === position.y))
    && !level.items.some(item => !item.inInventory && item.id !== id && (item.layer ?? 0) === layer && item.x === position.x && item.y === position.y);
}

export function moveItem(level: Level, id: string, position: Point): boolean {
  const item = level.items.find(candidate => candidate.id === id);
  if (!item?.movable || !canPlace(level, id, position)) return false;
  Object.assign(item, position, { layer: position.layer ?? item.layer ?? 0, inInventory: false });
  return true;
}

export function rotateItem(level: Level, id: string, steps: number): boolean {
  const item = level.items.find(candidate => candidate.id === id);
  if (!item?.rotatable || item.inInventory) return false;
  const vertical = item.kind === 'liftMirror' || item.kind === 'balloonMirror' || item.kind === 'prism' || item.kind === 'coreMirror';
  const period = vertical ? 360 : 180;
  item.angle = ((item.angle + steps * (vertical ? 90 : 45)) % period + period) % period;
  return true;
}

export function storeItem(level: Level, id: string): boolean {
  const item = level.items.find(candidate => candidate.id === id);
  if (!item?.movable || item.inInventory || item.rail) return false;
  item.inInventory = true;
  return true;
}

export function snapItemPosition(item:Item, position:Point):Point {
  if(!item.rail)return {...position,x:Math.round(position.x),y:Math.round(position.y)};
  const rail=item.rail,coordinate=Math.max(rail.min,Math.min(rail.max,rail.min+Math.round((position[rail.axis]-rail.min)/rail.step)*rail.step));
  return rail.axis==='x'?{x:coordinate,y:rail.fixed,layer:0}:{x:rail.fixed,y:coordinate,layer:0};
}
