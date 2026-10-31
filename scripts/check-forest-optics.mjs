import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createLevel, levelSummaries, canPlace, moveItem, rotateItem, storeItem } from '../src/level.ts';
import { traceLevel, reflected, isLightReady, WinGate } from '../src/optics.ts';
import { forestVisible, forestRoute, ForestWalker } from '../src/forest-path.ts';

let checks = 0; const verified = [];
const check = (name, run) => { run(); checks++; verified.push(name); console.log(`PASS ${name}`); };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
export const forestSolution = [['mirror', 2, 7, 135], ['mirror-2', 5, 7, 45], ['mirror-3', 5, 8, 45], ['mirror-4', 9, 5, 45], ['mirror-5', 6, 5, 45], ['mirror-6', 6, 2, 135]];
const solve = () => {
  const level = createLevel(8);
  for (const [id, x, y, angle] of forestSolution) {
    assert.ok(forestVisible(level, traceLevel(level), { x, y }), `${id} must be discoverable from the preceding light`);
    assert.ok(moveItem(level, id, { x, y })); level.items.find(item => item.id === id).angle = angle;
  }
  return level;
};
check('保留早餐和原有章节，森林新增为第二章第三关，9×9 六镜两固定镜', () => {
  assert.equal(createLevel(5).setting, 'street'); assert.equal(createLevel(7).theme, 'experiment');
  const level = createLevel(8), numbers = levelSummaries.map(entry => entry.number);
  assert.deepEqual(numbers.slice(numbers.indexOf(5), numbers.indexOf(5) + 4), [5, 8, 9, 12]);
  assert.equal(level.size, 9); assert.equal(level.chapterLevel, 3); assert.equal(level.setting, 'forest');
  assert.equal(level.items.filter(item => item.inInventory).length, 6);
  assert.equal(level.items.filter(item => item.kind === 'mirror' && !item.movable).length, 2);
  assert.equal(level.items.filter(item => item.kind === 'block').length, 30);
  assert.equal(level.items.some(item => item.kind === 'lens'), false);
});
check('探索路线可逐镜发现，八次真实反射接收 25.2732%，连续 0.6 秒通关', () => {
  const level = solve(), result = traceLevel(level);
  near(result.received.beacon, 0.95 ** 8 * 0.16 / 0.42);
  assert.ok(isLightReady(level, result)); assert.deepEqual(result.blocked, []);
  assert.deepEqual(result.touched, ['fixed', 'mirror', 'mirror-2', 'mirror-3', 'fixed-forest', 'mirror-4', 'mirror-5', 'mirror-6', 'beacon']);
  const gate = new WinGate(); gate.update(true, 0.3, level.holdSeconds); assert.equal(gate.won, false);
  gate.update(false, 0.1, level.holdSeconds); near(gate.elapsed, 0);
  for (let n = 0; n < 6; n++) gate.update(true, 0.1, level.holdSeconds);
  assert.equal(gate.won, true);
});
check('六面镜子每一面均不可省略，错误朝向不通关', () => {
  for (const [id] of forestSolution) {
    const missing = solve(); assert.ok(storeItem(missing, id)); assert.equal(isLightReady(missing, traceLevel(missing)), false);
    const wrong = solve(); assert.ok(rotateItem(wrong, id, 1)); assert.equal(isLightReady(wrong, traceLevel(wrong)), false);
  }
});
check('障碍占格且实际截光，固定器件不能移动、旋转或收纳', () => {
  const level = createLevel(8), result = traceLevel(level);
  assert.ok(result.blocked.includes('forest-block-6')); near(result.received.beacon, 0);
  for (const item of level.items.filter(item => !item.movable)) {
    assert.equal(canPlace(level, 'mirror', item), false);
    assert.equal(moveItem(level, item.id, { x: 3, y: 4 }), false);
    assert.equal(rotateItem(level, item.id, 1), false); assert.equal(storeItem(level, item.id), false);
  }
});
check('全棋盘放宽转向搜索仍至少需要六面可移动镜，高于早餐四镜', () => {
  const level = createLevel(8), dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const fixed = level.items.filter(item => !item.inInventory), start = fixed.find(item => item.kind === 'source');
  const queue = [{ x: start.x, y: start.y, d: 0, count: 0 }], visited = new Map(); let minimum = Infinity;
  while (queue.length) {
    queue.sort((a, b) => a.count - b.count); const current = queue.shift();
    const key = `${current.x},${current.y},${current.d}`;
    if ((visited.get(key) ?? Infinity) <= current.count) continue; visited.set(key, current.count);
    const [dx, dy] = dirs[current.d];
    for (let distance = 1; distance <= level.size; distance++) {
      const x = current.x + dx * distance, y = current.y + dy * distance;
      if (x < 1 || y < 1 || x > level.size || y > level.size) break;
      const item = fixed.find(item => item.x === x && item.y === y);
      if (item?.kind === 'block') break;
      if (item?.kind === 'beacon') { minimum = current.count; break; }
      if (item?.kind === 'mirror') {
        const ray = reflected({ x: dx, y: dy }, item.angle);
        const d = dirs.findIndex(([nx, ny]) => Math.hypot(nx - ray.x, ny - ray.y) < 1e-6);
        queue.push({ x, y, d, count: current.count }); break;
      }
      if (!item) for (const turn of [1, 2, 3]) queue.push({ x, y, d: (current.d + turn) % 4, count: current.count + 1 });
    }
    if (minimum !== Infinity) break;
  }
  // Permitting inconsistent revisits makes this a lower bound; the real solution meets it.
  assert.equal(minimum, 6);
});
check('光束和木屋附近一格可见，边界之外隐藏，旧视野不会累计', () => {
  const level = createLevel(8), initial = traceLevel(level);
  assert.ok(forestVisible(level, initial, { x: 2, y: 7 }));
  assert.ok(forestVisible(level, initial, { x: 7, y: 1 }));
  assert.equal(forestVisible(level, initial, { x: 5, y: 7 }), false);
  assert.equal(forestVisible(level, initial, { x: 6, y: 1 }), false);
  assert.equal(forestVisible(level, initial, { x: 10, y: 2 }), false);
  moveItem(level, 'mirror', { x: 2, y: 7 }); level.items.find(item => item.id === 'mirror').angle = 135;
  assert.ok(forestVisible(level, traceLevel(level), { x: 5, y: 7 }));
  storeItem(level, 'mirror'); assert.equal(forestVisible(level, traceLevel(level), { x: 5, y: 7 }), false);
  const toy = { ...initial, segments: [{ start: { x: 4, y: 5 }, end: { x: 6, y: 5 } }] };
  assert.ok(forestVisible(level, toy, { x: 3, y: 4 }));
  assert.equal(forestVisible(level, toy, { x: 2, y: 4 }), false);
});
check('只有第四级提示给坐标，最后一级仍不强制揭露隐藏区域', () => {
  const level = createLevel(8); assert.equal(level.hints.length, 4);
  assert.ok(level.hints.slice(0, 3).every(hint => !/\([1-9],[1-9]\)/.test(hint)));
  assert.match(level.hints[3], /\(9,5\)/); assert.equal(level.hintPositions.length, 6);
});
check('行人跟随实际光路，改光路时沿来路回退，全程连续且不穿越障碍', () => {
  const level = solve(), route = forestRoute(traceLevel(level)), walker = new ForestWalker(route[0]);
  walker.follow(route);
  for (let n = 0; n < 1200; n++) {
    const previous = { ...walker.position }; walker.update(1 / 60);
    assert.ok(Math.hypot(walker.position.x - previous.x, walker.position.y - previous.y) <= 1.25 / 60 + 1e-6);
    for (const block of level.items.filter(item => item.kind === 'block')) assert.ok(Math.abs(walker.position.x - block.x) >= 0.46 || Math.abs(walker.position.y - block.y) >= 0.46);
  }
  near(walker.position.x, route.at(-1).x); near(walker.position.y, route.at(-1).y); assert.equal(walker.moving, false);
  const initialRoute = forestRoute(traceLevel(createLevel(8))); walker.follow(initialRoute);
  const before = { ...walker.position }; walker.update(0.02);
  assert.ok(Math.hypot(walker.position.x - before.x, walker.position.y - before.y) <= 0.025 + 1e-6);
  walker.finish(); near(walker.position.x, initialRoute.at(-1).x); near(walker.position.y, initialRoute.at(-1).y);
});
console.log(`${checks} 项森林规则检查通过。`);
writeFileSync('qa/forest-optics-report.json', JSON.stringify({ checks, verified, minimumMovableMirrors: 6, received: 0.95 ** 8 * 0.16 / 0.42 }, null, 2));
