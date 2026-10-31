import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createLevel, SPECTRUM, moveItem, rotateItem, storeItem, canPlace } from '../src/level.ts';
import { traceLevel, isLightReady, spectrumProgress, WinGate } from '../src/optics.ts';

const verified = [];
const check = (name, run) => { run(); verified.push(name); console.log(`PASS ${name}`); };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
export const spectrumSolution = [
  ['prism', 3, 7, 0], ['mirror', 7, 1, 0], ['mirror-2', 5, 5, 0], ['mirror-3', 7, 7, 0],
  ['mirror-4', 7, 5, 0], ['mirror-5', 7, 9, 0], ['mirror-6', 7, 11, 0], ['mirror-7', 7, 13, 0],
  ['mirror-8', 4, 1, 135], ['mirror-9', 12, 7, 135],
];
const solved = () => {
  const level = createLevel(7);
  for (const [id, x, y, angle] of spectrumSolution) { assert.ok(moveItem(level, id, { x, y })); level.items.find(item => item.id === id).angle = angle; }
  return level;
};
const expected = (5 * 0.95 + 0.95 ** 3 + 0.95 ** 4) * 0.90 / 7 * 0.16 / 0.42;
check('三面固定镜分布在不同列行，橙绿两路增加转折，其余五色保持畅通', () => {
  const level = solved(), mirrors = level.items.filter(item => item.kind === 'mirror' && !item.movable);
  assert.deepEqual(mirrors.map(item => [item.x, item.y, item.angle]), [[4, 7, 135], [12, 1, 45], [9, 5, 0]]);
  const result = traceLevel(level);
  for (const band of SPECTRUM) {
    const segments = result.segments.filter(segment => segment.color === band.id);
    near(result.spectrumReceived[band.id], 0.90 / 7 * 0.95 ** (band.id === 'green' ? 4 : band.id === 'orange' ? 3 : 1) * 0.16 / 0.42);
    assert.ok(segments.some(segment => Math.abs(segment.end.x - 11) < 1e-8 && Math.abs(segment.end.y - 7) < 1e-8));
  }
});
check('八个同色主题障碍不可操作、占格，每一个都按实体边界截光', () => {
  const level = createLevel(7), blocks = level.items.filter(item => item.kind === 'block');
  assert.equal(blocks.length, 8);
  for (const block of blocks) {
    const region = level.colorRegions.find(region => block.x >= region.minX && block.x <= region.maxX && block.y >= region.minY && block.y <= region.maxY);
    assert.equal(block.color, region.color);
    assert.equal(canPlace(level, 'mirror', block), false); assert.equal(moveItem(level, block.id, { x: 1, y: 1 }), false);
    assert.equal(rotateItem(level, block.id, 1), false); assert.equal(storeItem(level, block.id), false);
    const isolated = { ...level, items: [
      { id: 'test-light', kind: 'source', x: block.x, y: block.y - 1, angle: 90, power: 1 },
      block, { id: 'beacon', kind: 'beacon', x: block.x, y: block.y + 1, angle: 0 },
    ] };
    const result = traceLevel(isolated); assert.deepEqual(result.blocked, [block.id]); near(result.received.beacon, 0);
    near(result.segments[0].end.y, block.y - 0.46);
  }
});
check('旧的直接镜位被障碍占住，不能沿旧解法通关；障碍不侵入新解法', () => {
  const level = createLevel(7);
  assert.equal(moveItem(level, 'mirror', { x: 7, y: 3 }), false);
  assert.equal(moveItem(level, 'mirror', { x: 5, y: 2 }), false);
  assert.equal(isLightReady(level, traceLevel(level)), false);
  const result = traceLevel(solved()); assert.equal(isLightReady(solved(), result), true); assert.deepEqual(result.blocked, []);
});
check('七块不同颜色的矩形主题区域覆盖棋盘，每块恰有一个对应色途经点', () => {
  const level = createLevel(7); assert.equal(level.colorRegions.length, 7);
  for (let x = 1; x <= level.size; x++) for (let y = 1; y <= level.size; y++) {
    assert.equal(level.colorRegions.filter(region => x >= region.minX && x <= region.maxX && y >= region.minY && y <= region.maxY).length, 1, `${x},${y}`);
  }
  for (const region of level.colorRegions) {
    const points = level.items.filter(item => item.kind === 'colorWaypoint' && item.x >= region.minX && item.x <= region.maxX && item.y >= region.minY && item.y <= region.maxY);
    assert.equal(points.length, 1); assert.equal(points[0].color, region.color);
    assert.ok((region.maxX - region.minX + 1) * (region.maxY - region.minY + 1) >= 12);
    assert.ok(region.scenery.x >= region.minX && region.scenery.x <= region.maxX && region.scenery.y >= region.minY && region.scenery.y <= region.maxY);
  }
});
check('第三章单层十三格，十件库存、三面固定镜、七个不可移动同色途经点', () => {
  const level = createLevel(7);
  assert.equal(level.chapter, 3); assert.equal(level.size, 13); assert.equal(level.theme, 'experiment');
  assert.equal(level.items.filter(item => item.inInventory).length, 10);
  assert.equal(level.items.filter(item => item.kind === 'mirror' && !item.movable).length, 3);
  assert.equal(level.items.filter(item => item.kind === 'colorWaypoint').length, 7);
  assert.equal(isLightReady(level, traceLevel(level)), false);
  for (const point of level.items.filter(item => item.kind === 'colorWaypoint')) {
    assert.equal(moveItem(level, point.id, { x: 1, y: 1 }), false);
    assert.equal(rotateItem(level, point.id, 1), false); assert.equal(storeItem(level, point.id), false);
    assert.equal(canPlace(level, 'prism', point), false);
  }
});
check('白光分七色、总能量九成、分光角度有序且每色不重复', () => {
  const level = createLevel(7); moveItem(level, 'prism', { x: 3, y: 7 });
  const result = traceLevel(level), outgoing = result.segments.filter(segment => segment.start.x === 3 && segment.start.y === 7 && segment.color);
  assert.equal(result.prismSplits, 1); assert.equal(outgoing.length, 7);
  assert.deepEqual(outgoing.map(segment => segment.color), SPECTRUM.map(color => color.id));
  near(outgoing.reduce((sum, ray) => sum + ray.power, 0), 0.90);
  outgoing.forEach((ray, index) => near((ray.end.y - ray.start.y) / (ray.end.x - ray.start.x), SPECTRUM[index].slope));
});
check('三棱镜朝向错误挡光，四朝向旋转、收回和无效放置保留状态', () => {
  const level = createLevel(7); moveItem(level, 'prism', { x: 3, y: 7 });
  for (const angle of [90, 180, 270, 0]) {
    rotateItem(level, 'prism', 1); assert.equal(level.items.find(item => item.id === 'prism').angle, angle);
    assert.equal(traceLevel(level).prismSplits, angle === 0 ? 1 : 0);
  }
  rotateItem(level, 'prism', -1); storeItem(level, 'prism');
  assert.equal(traceLevel(level).prismSplits, 0);
  assert.equal(moveItem(level, 'prism', { x: 14, y: 7 }), false);
  moveItem(level, 'prism', { x: 3, y: 7 }); assert.equal(level.items.find(item => item.id === 'prism').angle, 270);
});
check('七路真实反射经过同色点后汇聚，接收约31.4541%，连续0.6秒通关', () => {
  const level = solved(), result = traceLevel(level);
  near(result.received.beacon, expected); near(result.qualifiedReceived.beacon, expected);
  assert.equal(isLightReady(level, result), true);
  assert.ok(spectrumProgress(level, result).every(color => color.passed && color.arrived && color.energy > 0));
  const gate = new WinGate(); for (let frame = 0; frame < 5; frame++) gate.update(true, 0.1);
  assert.equal(gate.won, false); gate.update(false, 0.1); assert.equal(gate.elapsed, 0);
  for (let frame = 0; frame < 6; frame++) gate.update(isLightReady(level, result), 0.1); assert.equal(gate.won, true);
});
for (const [id] of spectrumSolution) {
  check(`移除${id}不能通关`, () => { const level = solved(); storeItem(level, id); assert.equal(isLightReady(level, traceLevel(level)), false); });
}
check('每面可移动镜的另外三种朝向均不能代替原光路', () => {
  for (const [id, , , correct] of spectrumSolution.filter(([id]) => id !== 'prism')) for (const angle of [0, 45, 90, 135].filter(angle => angle !== correct)) {
    const level = solved(); level.items.find(item => item.id === id).angle = angle;
    assert.equal(isLightReady(level, traceLevel(level)), false, `${id}:${angle}`);
  }
});
check('白光照到彩色点不会染色或假点亮', () => {
  const level = createLevel(7); level.items = level.items.filter(item => item.kind !== 'mirror');
  const point = level.items.find(item => item.id === 'color-red'); Object.assign(point, { x: 3, y: 7 });
  const result = traceLevel(level); assert.equal(result.colorPasses[point.id].length, 0); assert.equal(result.prismSplits, 0);
  assert.equal(isLightReady(level, result), false);
});
check('颜色不匹配不能通过；原始能量充足也必须通过同色点', () => {
  const level = solved(); const red = level.items.find(item => item.id === 'color-red'), blue = level.items.find(item => item.id === 'color-blue');
  [red.color, blue.color] = [blue.color, red.color]; const result = traceLevel(level);
  near(result.received.beacon, expected); assert.ok(result.qualifiedReceived.beacon < 0.30);
  assert.equal(spectrumProgress(level, result).filter(color => color.arrived).length, 5);
  assert.equal(isLightReady(level, result), false);
});
check('七色全部经过但末段未抵达不通关', () => {
  const level = solved(); level.items.push({ id: 'stop', kind: 'block', name: '测试挡块', x: 10, y: 7, angle: 0, movable: false, rotatable: false });
  // Move the collector away without changing the seven paths through their checkpoints.
  Object.assign(level.items.find(item => item.id === 'beacon'), { x: 13, y: 7 });
  const result = traceLevel(level); assert.ok(spectrumProgress(level, result).every(color => color.passed));
  assert.ok(spectrumProgress(level, result).every(color => !color.arrived)); assert.equal(isLightReady(level, result), false);
});
check('单色死路真实挡光、先后照亮不累计，恢复后重新计算', () => {
  const level = solved(); storeItem(level, 'mirror'); let result = traceLevel(level);
  assert.equal(spectrumProgress(level, result).filter(color => color.arrived).length, 6);
  moveItem(level, 'mirror', { x: 7, y: 1 }); storeItem(level, 'mirror-7'); result = traceLevel(level);
  assert.equal(spectrumProgress(level, result).find(color => color.id === 'red').arrived, true);
  assert.equal(spectrumProgress(level, result).find(color => color.id === 'violet').arrived, false);
  assert.equal(isLightReady(level, result), false);
  moveItem(level, 'mirror-7', { x: 7, y: 13 }); assert.equal(isLightReady(level, traceLevel(level)), true);
});
check('判定来自几何和颜色，不依赖关卡号、提示、器件ID或推荐坐标', () => {
  const level = solved(); level.size = 14; level.hintPositions = []; level.hints = [];
  for (const item of level.items) { item.x += 1; if (item.kind === 'mirror' && item.movable) item.id = `alternative-${item.id}`; }
  for (const region of level.colorRegions) { region.minX++; region.maxX++; region.scenery.x++; region.label.x++; }
  const result = traceLevel(level); near(result.qualifiedReceived.beacon, expected); assert.equal(isLightReady(level, result), true);
});
check('彩色光再次撞三棱镜不增殖，循环/交互上限仍有限', () => {
  const level = solved(); level.items.push({ id: 'second-prism', kind: 'prism', name: '测试三棱镜', x: 4, y: 5, angle: 270, movable: false, rotatable: false });
  const result = traceLevel(level); assert.equal(result.prismSplits, 1); assert.ok(result.blocked.includes('second-prism')); assert.ok(result.segments.length < 8 * 32);
});
check('三级提示无坐标，第四级列出十件器件，重建关卡清空全部进度', () => {
  const level = createLevel(7); assert.equal(level.hints.length, 4);
  assert.ok(level.hints.slice(0, 3).every(hint => !/\(\d+,\d+\)/.test(hint)));
  assert.equal(level.hintPositions.length, 10); assert.match(level.hints[3], /135°/);
  assert.equal(spectrumProgress(level, traceLevel(level)).filter(color => color.passed).length, 0);
});
await mkdir('qa', { recursive: true });
await writeFile('qa/spectrum-optics-report.json', JSON.stringify({ status: 'passed', checks: verified.length, solvedEnergy: expected, verified }, null, 2));
console.log(`\n${verified.length} spectrum optics checks passed.`);
