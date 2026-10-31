import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createLevel, levelSummaries, moveItem, storeItem, rotateItem, canPlace } from '../src/level.ts';
import { traceLevel, isLightReady, beamWidth, reflected, WinGate } from '../src/optics.ts';
import { herdCow, advanceHerds, cowAtHome } from '../src/rural-rules.ts';

const verified = [], check = (name, run) => { run(); verified.push(name); console.log(`PASS ${name}`); };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const solution = [['mirror', 2, 9, 45], ['mirror-2', 5, 9, 135], ['mirror-3', 5, 8, 135], ['mirror-4', 7, 8, 135], ['mirror-5', 7, 5, 45], ['mirror-6', 4, 5, 45], ['mirror-7', 4, 2, 135], ['concave', 6, 2, 0]];
function prepare() {
  const level = createLevel(9);
  for (const hay of level.items.filter(item => item.kind === 'hay')) assert.ok(storeItem(level, hay.id));
  for (const id of ['cow-flower', 'cow-brown']) {
    assert.equal(herdCow(level, id).ok, true);
    for (let n = 0; n < 300; n++) advanceHerds(level, 0.1);
  }
  return level;
}
function solve() {
  const level = prepare();
  for (const [id, x, y, angle] of solution) { assert.ok(moveItem(level, id, { x, y })); level.items.find(item => item.id === id).angle = angle; }
  return level;
}
check('乡村新增第二章第四关，保留森林、早餐及第三章，七镜与凹透镜独立库存', () => {
  assert.deepEqual(levelSummaries.slice(levelSummaries.findIndex(entry => entry.number === 8), levelSummaries.findIndex(entry => entry.number === 8) + 3).map(entry => entry.number), [8, 9, 12]);
  const level = createLevel(9); assert.equal(level.size, 9); assert.equal(level.chapterLevel, 4); assert.equal(level.setting, 'rural');
  assert.equal(level.items.filter(item => item.inInventory && item.kind === 'mirror').length, 7);
  assert.equal(level.items.filter(item => item.inInventory && item.kind === 'concaveLens').length, 1);
  assert.equal(level.items.filter(item => item.kind === 'hay').length, 3);
  assert.equal(level.items.filter(item => item.kind === 'cow').length, 2);
  assert.equal(isLightReady(level, traceLevel(level)), false);
});
check('三堆稻草实际占格挡光，可拖到空格或收纳，不能旋转，取消或越界不改变', () => {
  const level = createLevel(9); assert.ok(traceLevel(level).blocked.includes('hay-3'));
  for (const hay of level.items.filter(item => item.kind === 'hay')) {
    assert.equal(canPlace(level, 'mirror', hay), false); assert.equal(rotateItem(level, hay.id, 1), false);
    const before = { ...hay }; assert.equal(moveItem(level, hay.id, { x: 10, y: 0 }), false); assert.deepEqual(hay, before);
    assert.ok(storeItem(level, hay.id)); assert.equal(hay.inInventory, true);
  }
  assert.ok(moveItem(level, 'hay-1', { x: 3, y: 4 })); assert.equal(level.items.find(item => item.id === 'hay-1').inInventory, false);
});
check('牛不能收纳或拖动，通道没清出时不能开始回圈', () => {
  const level = createLevel(9);
  for (const cow of level.items.filter(item => item.kind === 'cow')) {
    assert.equal(storeItem(level, cow.id), false); assert.equal(moveItem(level, cow.id, cow.home), false); assert.equal(rotateItem(level, cow.id, 1), false);
    assert.equal(herdCow(level, cow.id).ok, false); assert.equal(cow.herdPath, undefined);
  }
});
check('先清稻草、花牛先走；预留整条通道，行走连续且不穿障碍或另一头牛', () => {
  const level = createLevel(9); level.items.filter(item => item.kind === 'hay').forEach(hay => storeItem(level, hay.id));
  assert.equal(herdCow(level, 'cow-brown').ok, false);
  for (const id of ['cow-flower', 'cow-brown']) {
    const cow = level.items.find(item => item.id === id); assert.equal(herdCow(level, id).ok, true);
    assert.ok(cow.herdPath.length > 5);
    for (const point of cow.herdPath) assert.equal(canPlace(level, 'mirror', point), false);
    assert.equal(herdCow(level, id).ok, false);
    for (let n = 0; n < 1500 && cow.herdPath; n++) {
      const before = { x: cow.x, y: cow.y }; advanceHerds(level, 1 / 60);
      assert.ok(Math.hypot(cow.x - before.x, cow.y - before.y) <= 2.2 / 60 + 1e-6);
      for (const item of level.items.filter(item => item.id !== id && !item.inInventory)) assert.ok(Math.abs(cow.x - item.x) >= 0.46 || Math.abs(cow.y - item.y) >= 0.46);
    }
    assert.ok(cowAtHome(cow)); assert.equal(cow.herdPath, undefined);
  }
  for (const point of level.penCells) assert.equal(canPlace(level, 'mirror', point), false);
});
check('两头牛仍是真实光学障碍，归圈前即使光线达标也不开映', () => {
  const level = solve(); const cow = level.items.find(item => item.kind === 'cow'); cow.x = 3; cow.y = 4;
  assert.ok(traceLevel(level).received.beacon >= level.threshold); assert.equal(isLightReady(level, traceLevel(level)), false);
  cow.x = 4; cow.y = 3; assert.ok(traceLevel(level).blocked.includes(cow.id));
});
check('八次反射及凹透镜展开两格后铺满幕布，接收约58.1283%，持续0.6秒通关', () => {
  const level = solve(), result = traceLevel(level), pass = result.projections.beacon[0];
  near(result.received.beacon, 0.95 ** 8 * 0.92 * 0.8 / 0.84); near(pass.halfWidth, 0.84); near(pass.coverage, 1);
  assert.equal(pass.spread, true); assert.equal(pass.aligned, true); assert.ok(isLightReady(level, result));
  assert.deepEqual(result.blocked, []); assert.equal(result.focused, false);
  const gate = new WinGate(); for (let n = 0; n < 5; n++) gate.update(true, 0.1, level.holdSeconds); assert.equal(gate.won, false);
  gate.update(true, 0.1, level.holdSeconds); assert.equal(gate.won, true);
});
check('七面镜子不可省略，错误朝向均不通关', () => {
  for (const [id] of solution.filter(([id]) => id !== 'concave')) {
    const missing = solve(); storeItem(missing, id); assert.equal(isLightReady(missing, traceLevel(missing)), false);
    const wrong = solve(); rotateItem(wrong, id, 1); assert.equal(isLightReady(wrong, traceLevel(wrong)), false);
  }
});
check('只有照到幕布仍不够：缺凹透镜、轴向错误、离幕布太近均无法展开全幅', () => {
  const missing = solve(); storeItem(missing, 'concave'); assert.ok(traceLevel(missing).received.beacon > missing.threshold);
  assert.equal(isLightReady(missing, traceLevel(missing)), false); near(traceLevel(missing).projections.beacon[0].coverage, 0.42 / 0.8);
  for (const angle of [45, 90, 135]) { const wrong = solve(); wrong.items.find(item => item.id === 'concave').angle = angle; assert.equal(isLightReady(wrong, traceLevel(wrong)), false); }
  const nearScreen = solve(); moveItem(nearScreen, 'concave', { x: 7, y: 2 }); assert.equal(isLightReady(nearScreen, traceLevel(nearScreen)), false);
});
check('凹透镜过远使亮度不足，半幅或反面照射均不能冒充完整投影', () => {
  const far = solve(); moveItem(far, 'concave', { x: 5, y: 2 }); assert.equal(isLightReady(far, traceLevel(far)), false);
  const wrongFace = solve(); wrongFace.items.find(item => item.kind === 'beacon').angle = 180; assert.equal(isLightReady(wrongFace, traceLevel(wrongFace)), false);
  const partial = solve(); partial.items.find(item => item.kind === 'beacon').y += 0.3;
  assert.ok(traceLevel(partial).projections.beacon[0].coverage < 1); assert.equal(isLightReady(partial, traceLevel(partial)), false);
});
check('凹透镜发散宽度连续增加，旧聚焦和白光宽度模型不变，收回不参与光路', () => {
  near(beamWidth(null), 0.42); near(beamWidth(2), 0.1);
  for (const d of [0, 0.5, 1, 2, 3]) near(beamWidth(null, { halfWidth: 0.42, travel: d }), 0.42 * (1 + d / 2));
  const level = solve(); storeItem(level, 'concave'); assert.equal(level.items.find(item => item.id === 'concave').angle, 0);
  assert.ok(moveItem(level, 'concave', { x: 6, y: 2 })); assert.ok(isLightReady(level, traceLevel(level)));
});
check('展开之后不能再反射冒充末段凹透镜，判定不依赖关卡号或推荐位置', () => {
  const item = (id, kind, x, y, angle = 0, extra = {}) => ({ id, kind, x, y, angle, movable: false, rotatable: false, ...extra });
  const toy = { size: 7, threshold: 0.4, items: [item('a', 'source', 1, 5), item('b', 'concaveLens', 3, 5), item('c', 'mirror', 5, 5, 135), item('d', 'beacon', 5, 2, 270, { screenHalfWidth: 0.8 })] };
  assert.ok(traceLevel(toy).received.d > toy.threshold); assert.equal(isLightReady(toy, traceLevel(toy)), false);
  toy.items = [item('a', 'source', 1, 5), item('c', 'mirror', 5, 5, 135), item('b', 'concaveLens', 5, 3, 90), item('d', 'beacon', 5, 1, 270, { screenHalfWidth: 0.8 })];
  assert.equal(isLightReady(toy, traceLevel(toy)), true);
});
check('全棋盘放宽转向搜索至少七面可移动镜，高于森林六镜，固定障碍均保持权限', () => {
  const level = prepare(), dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]], source = level.items.find(item => item.kind === 'source');
  const fixed = level.items.filter(item => ['block', 'mirror', 'beacon'].includes(item.kind) && !item.inInventory);
  const queue = [{ x: source.x, y: source.y, d: 0, count: 0 }], visited = new Map(); let minimum = Infinity;
  while (queue.length) {
    queue.sort((a, b) => a.count - b.count); const c = queue.shift(), key = `${c.x},${c.y},${c.d}`;
    if ((visited.get(key) ?? Infinity) <= c.count) continue; visited.set(key, c.count);
    const [dx, dy] = dirs[c.d];
    for (let n = 1; n <= level.size; n++) {
      const x = c.x + n * dx, y = c.y + n * dy; if (x < 1 || y < 1 || x > level.size || y > level.size) break;
      const hit = fixed.find(item => item.x === x && item.y === y);
      if (hit?.kind === 'block') break;
      if (hit?.kind === 'beacon') { if (c.d === 0) minimum = c.count; break; }
      if (hit?.kind === 'mirror') { const v = reflected({ x: dx, y: dy }, hit.angle); queue.push({ x, y, d: dirs.findIndex(([a, b]) => Math.hypot(a - v.x, b - v.y) < 1e-6), count: c.count }); break; }
      if (!hit) for (const turn of [1, 2, 3]) queue.push({ x, y, d: (c.d + turn) % 4, count: c.count + 1 });
    }
    if (minimum !== Infinity) break;
  }
  assert.equal(minimum, 7);
  for (const block of fixed.filter(item => item.kind === 'block')) { assert.equal(storeItem(level, block.id), false); assert.equal(moveItem(level, block.id, { x: 3, y: 4 }), false); }
});
check('重建关卡恢复三堆稻草、两头牛、全部光学库存；前三级提示不泄露坐标', () => {
  const level = createLevel(9); assert.equal(level.items.filter(item => item.herdPath).length, 0);
  assert.equal(level.items.filter(cowAtHome).length, 0); assert.equal(level.items.filter(item => item.inInventory).length, 8);
  assert.ok(level.hints.slice(0, 3).every(hint => !/\([1-9],[1-9]\)/.test(hint)));
  assert.equal(level.hintPositions.length, 8);
});
writeFileSync('qa/rural-optics-report.json', JSON.stringify({ checks: verified.length, verified, minimumMovableMirrors: 7, received: traceLevel(solve()).received.beacon }, null, 2));
console.log(`${verified.length} 项乡村规则检查通过。`);
