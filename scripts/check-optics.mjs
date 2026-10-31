import assert from 'node:assert/strict';
import { createLevel, levelSummaries, canPlace, moveItem, rotateItem, storeItem } from '../src/level.ts';
import { traceLevel, reflected, beamWidth, captureFraction, isLightReady, waypointProgress, WinGate } from '../src/optics.ts';
import { normalizeSettings } from '../src/settings.ts';

let checks = 0;
const check = (name, callback) => { callback(); checks++; console.log(`PASS ${name}`); };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
const solved = () => {
  const level = createLevel(2);
  Object.assign(level.items.find(item => item.id === 'mirror'), { x: 5, y: 6, angle: 135, inInventory: false });
  Object.assign(level.items.find(item => item.id === 'lens'), { x: 3, y: 2, angle: 0, inInventory: false });
  return level;
};

check('各关初始均不能点亮，第一关仅有一固定一可移动平面镜', () => {
  assert.deepEqual(levelSummaries.filter(entry => [1, 2, 4, 6, 3, 5, 7].includes(entry.number)).map(entry => entry.number), [1, 2, 4, 6, 3, 5, 7]);
  for (const { number } of levelSummaries) near(traceLevel(createLevel(number)).received.beacon, 0);
  const first = createLevel();
  assert.equal(first.number, 1);
  assert.equal(first.items.filter(item => item.kind === 'mirror').length, 2);
  assert.equal(first.items.filter(item => item.kind === 'mirror' && !item.movable).length, 1);
  assert.equal(first.items.filter(item => item.inInventory).length, 1);
  assert.equal(first.items.some(item => item.kind === 'lens'), false);
  assert.deepEqual(traceLevel(first).touched, ['fixed']);
});
check('第一关只靠两次真实反射即可通关', () => {
  const level = createLevel(1);
  assert.ok(moveItem(level, 'mirror', { x: 5, y: 2 }));
  assert.ok(rotateItem(level, 'mirror', 1));
  const result = traceLevel(level);
  near(result.received.beacon, 0.95 ** 2 * 0.16 / 0.42);
  assert.ok(result.received.beacon >= level.threshold);
  assert.deepEqual(result.touched, ['fixed', 'mirror', 'beacon']);
  assert.equal(result.focused, false);
  const gate = new WinGate();
  for (let frame = 0; frame < 6; frame++) gate.update(result.received.beacon >= level.threshold, 0.1, level.holdSeconds);
  assert.equal(gate.won, true);
});
check('第一关错误位置与朝向不可通关，解法不依赖提示坐标', () => {
  // 枚举所有格子与四种朝向，防止漏解或绕开反射直接点亮。
  const wins = [];
  for (let x = 1; x <= 7; x++) for (let y = 1; y <= 7; y++) for (const angle of [0, 45, 90, 135]) {
    const level = createLevel(1);
    if (!moveItem(level, 'mirror', { x, y })) continue;
    level.items.find(item => item.id === 'mirror').angle = angle;
    const result = traceLevel(level);
    if (result.received.beacon >= level.threshold) {
      assert.deepEqual(result.touched, ['fixed', 'mirror', 'beacon']);
      wins.push({ x, y, angle });
    }
  }
  assert.deepEqual(wins, [{ x: 5, y: 2, angle: 45 }]);
});
check('关卡创建互相独立，各关提示各自四级', () => {
  const first = createLevel(1);
  assert.ok(moveItem(first, 'mirror', { x: 5, y: 2 }));
  for (const { number } of levelSummaries) {
    const level = createLevel(number);
    assert.equal(level.items.find(item => item.kind === 'mirror' && item.movable && !item.rail).inInventory, true);
    assert.equal(level.hints.length, 4);
    assert.ok(level.hints.slice(0, 3).every(hint => !/第 [1-7] 列|第 [1-7] 行/.test(hint)));
  }
  assert.equal(createLevel(2).threshold, 0.75);
});
check('标准解法接收 83.03% 能量', () => {
  const result = traceLevel(solved());
  near(result.received.beacon, 0.8303);
  assert.deepEqual(result.touched, ['mirror', 'fixed', 'lens', 'beacon']);
});
check('移除透镜后仅接收 34.38%', () => {
  const level = solved();
  level.items = level.items.filter(item => item.kind !== 'lens');
  near(traceLevel(level).received.beacon, 0.95 ** 2 * 0.16 / 0.42);
});
check('光轴未对准时不能激活', () => {
  const level = solved();
  level.items.find(item => item.id === 'lens').angle = 90;
  assert.ok(traceLevel(level).received.beacon < level.threshold);
});
check('焦距不足、超出焦距均不能激活', () => {
  for (const column of [2, 4]) {
    const level = solved();
    level.items.find(item => item.id === 'lens').x = column;
    assert.ok(traceLevel(level).received.beacon < level.threshold);
  }
});
check('双面反射方向、能量守恒', () => {
  for (let angle = 0; angle < 180; angle += 45) {
    const direction = reflected({ x: 1, y: 0 }, angle);
    near(Math.hypot(direction.x, direction.y), 1);
    const reverse = reflected({ x: -direction.x, y: -direction.y }, angle);
    near(reverse.x, -1);
    near(reverse.y, 0);
  }
  const upward = reflected({ x: 1, y: 0 }, 135);
  near(upward.x, 0);
  near(upward.y, -1);
  const leftward = reflected(upward, 45);
  near(leftward.x, -1);
  near(leftward.y, 0);
});
check('光束收束、扩散与偏心接收', () => {
  near(beamWidth(0), 0.42);
  near(beamWidth(2), 0.1);
  near(beamWidth(4), 0.42);
  near(captureFraction(0.1, 0), 1);
  near(captureFraction(0.1, 0.16), 0.5);
  near(captureFraction(0.1, 0.27), 0);
});
check('多个光源按实际接收累加，不按布局判定', () => {
  const level = { size: 7, threshold: 0.75, holdSeconds: 0.6, items: [
    { id: 'a', kind: 'source', x: 1, y: 3, angle: 0, power: 1 },
    { id: 'b', kind: 'source', x: 6, y: 3, angle: 180, power: 1 },
    { id: 'target', kind: 'beacon', x: 4, y: 3, angle: 0 },
  ] };
  near(traceLevel(level).received.target, 2 * 0.16 / 0.42);
  assert.ok(traceLevel(level).received.target >= level.threshold);
});
check('镜面闭环有限终止', () => {
  const level = { size: 7, threshold: 0.75, holdSeconds: 0.6, items: [
    { id: 'a', kind: 'source', x: 2, y: 4, angle: 0 },
    { id: 'one', kind: 'mirror', x: 5, y: 4, angle: 135 },
    { id: 'two', kind: 'mirror', x: 5, y: 2, angle: 45 },
    { id: 'three', kind: 'mirror', x: 1, y: 2, angle: 135 },
    { id: 'four', kind: 'mirror', x: 1, y: 4, angle: 45 },
  ] };
  const result = traceLevel(level);
  assert.ok(result.loopStopped);
  assert.ok(result.segments.length <= 12);
  assert.ok(result.segments.every(segment => Number.isFinite(segment.end.x) && Number.isFinite(segment.end.y)));
});
check('最多 32 次光学交互', () => {
  const level = { size: 40, items: [{ id: 'a', kind: 'source', x: 1, y: 1, angle: 0 }, ...Array.from({ length: 35 }, (_, index) => ({ id: `lens-${index}`, kind: 'lens', x: index + 2, y: 1, angle: 90 }))] };
  const result = traceLevel(level);
  assert.ok(result.interactionLimit);
  assert.equal(result.segments.length, 32);
});
check('各关的越界、占用格与固定器件均拒绝修改', () => {
  for (const { number } of levelSummaries) {
    const level = createLevel(number);
    const source = level.items.find(item => item.kind === 'source');
    const mirror = level.items.find(item => item.kind === 'mirror' && item.movable && !item.rail);
    assert.equal(canPlace(level, mirror.id, source), false);
    assert.equal(moveItem(level, mirror.id, { x: 0, y: 4 }), false);
    assert.equal(moveItem(level, mirror.id, { x: 2.5, y: 4 }), false);
    assert.equal(moveItem(level, 'fixed', { x: 4, y: 4 }), false);
    assert.equal(rotateItem(level, 'fixed', 1), false);
    assert.ok(moveItem(level, mirror.id, { x: 3, y: 4 }));
    assert.ok(rotateItem(level, mirror.id, -1));
    assert.equal(mirror.angle, 135);
  }
});
check('通关需要连续充能，打断后重新计时', () => {
  const gate = new WinGate();
  for (let frame = 0; frame < 5; frame++) gate.update(true, 0.1);
  assert.equal(gate.won, false);
  gate.update(false, 0.1);
  near(gate.elapsed, 0);
  for (let frame = 0; frame < 6; frame++) gate.update(true, 0.1);
  assert.equal(gate.won, true);
  gate.reset();
  assert.equal(gate.won, false);
  gate.update(true, 10);
  assert.equal(gate.won, false);
});
check('物品栏中的器件不遮挡格子，不影响光路', () => {
  const level = solved();
  const count = level.items.length;
  assert.ok(storeItem(level, 'lens'));
  near(traceLevel(level).received.beacon, 0.95 ** 2 * 0.16 / 0.42);
  assert.ok(storeItem(level, 'mirror'));
  near(traceLevel(level).received.beacon, 0);
  assert.equal(rotateItem(level, 'mirror', 1), false);
  assert.equal(storeItem(level, 'fixed'), false);
  assert.equal(storeItem(level, 'source'), false);
  assert.ok(canPlace(level, 'lens', { x: 5, y: 6 }));
  assert.ok(moveItem(level, 'mirror', { x: 5, y: 6 }));
  assert.ok(moveItem(level, 'lens', { x: 3, y: 2 }));
  near(traceLevel(level).received.beacon, 0.8303);
  assert.equal(level.items.length, count);
  assert.equal(level.items.find(item => item.id === 'mirror').angle, 135);
});
check('设置异常值使用默认值或限制到有效范围', () => {
  assert.deepEqual(normalizeSettings(null), { pitch: 53, rotationSpeed: 1, musicEnabled: true, musicVolume: 0.5, soundEffectsEnabled: true });
  assert.deepEqual(normalizeSettings({ pitch: 200, rotationSpeed: -1 }), { pitch: 85, rotationSpeed: 0.5, musicEnabled: true, musicVolume: 0.5, soundEffectsEnabled: true });
  assert.deepEqual(normalizeSettings({ pitch: NaN, rotationSpeed: Infinity }), { pitch: 53, rotationSpeed: 1, musicEnabled: true, musicVolume: 0.5, soundEffectsEnabled: true });
  assert.deepEqual(normalizeSettings({ pitch: 65, rotationSpeed: 1.2, musicEnabled: false, musicVolume: 8, soundEffectsEnabled: false }), { pitch: 65, rotationSpeed: 1.2, musicEnabled: false, musicVolume: 1, soundEffectsEnabled: false });
  assert.equal(normalizeSettings({ musicVolume: -1 }).musicVolume, 0);
  assert.equal(normalizeSettings({ musicEnabled: 'false', musicVolume: NaN }).musicEnabled, true);
  assert.equal(normalizeSettings({ musicVolume: Infinity }).musicVolume, 0.5);
  assert.equal(normalizeSettings({ soundEffectsEnabled: 'false' }).soundEffectsEnabled, true);
});

const nightSolved = (column = 6) => {
  const level = createLevel(3);
  for (const [id, x, y, angle] of [['mirror', 2, 7, 45], ['mirror-2', column, 7, 135], ['mirror-3', column, 3, 45]]) {
    assert.ok(moveItem(level, id, { x, y }));
    level.items.find(item => item.id === id).angle = angle;
  }
  return level;
};
check('第二章第一关使用两面固定镜、三面可移动镜及独立夜景', () => {
  const level = createLevel(3);
  assert.equal(level.chapter, 2);
  assert.equal(level.chapterLevel, 1);
  assert.equal(level.theme, 'night');
  assert.equal(level.items.filter(item => item.kind === 'mirror' && !item.movable).length, 2);
  assert.equal(level.items.filter(item => item.inInventory).length, 3);
  assert.equal(level.items.some(item => item.kind === 'lens'), false);
  assert.deepEqual(traceLevel(level).touched, ['fixed']);
});
check('五次真实反射给灯塔送入 29.4774% 能量，公共光学参数不变', () => {
  const level = nightSolved();
  const result = traceLevel(level);
  near(result.received.beacon, 0.95 ** 5 * 0.16 / 0.42);
  assert.deepEqual(result.touched, ['fixed', 'mirror', 'mirror-2', 'mirror-3', 'fixed-harbor', 'beacon']);
  assert.equal(result.focused, false);
  const gate = new WinGate();
  for (let frame = 0; frame < 6; frame++) gate.update(result.received.beacon >= level.threshold, 0.1, level.holdSeconds);
  assert.equal(gate.won, true);
});
check('夜航缺一面镜、错误朝向均不通关，替代路线也能通关', () => {
  for (const id of ['mirror', 'mirror-2', 'mirror-3']) {
    const missing = nightSolved();
    storeItem(missing, id);
    assert.ok(traceLevel(missing).received.beacon < missing.threshold);
    const wrong = nightSolved();
    rotateItem(wrong, id, 1);
    assert.ok(traceLevel(wrong).received.beacon < wrong.threshold);
  }
  for (const column of [3, 4, 5, 7]) {
    const level = nightSolved(column);
    assert.ok(traceLevel(level).received.beacon >= level.threshold);
  }
});
check('枚举所有两面可移动镜布局，不能绕过三镜挑战', () => {
  const level = createLevel(3);
  const cells = [];
  for (let x = 1; x <= level.size; x++) for (let y = 1; y <= level.size; y++) {
    if (canPlace(level, 'mirror', { x, y })) cells.push({ x, y });
  }
  const first = level.items.find(item => item.id === 'mirror');
  const second = level.items.find(item => item.id === 'mirror-2');
  // Identical mirrors: unordered pairs cover all placements; parallel faces cover one-mirror paths too.
  for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) {
    Object.assign(first, cells[a], { inInventory: false });
    Object.assign(second, cells[b], { inInventory: false });
    for (const angleA of [0, 45, 90, 135]) for (const angleB of [0, 45, 90, 135]) {
      first.angle = angleA; second.angle = angleB;
      assert.ok(traceLevel(level).received.beacon < level.threshold, `unexpected shortcut ${JSON.stringify([first, second])}`);
    }
  }
});
check('多个同类镜子收放独立，第二面固定镜不可修改', () => {
  const level = nightSolved();
  assert.ok(storeItem(level, 'mirror-2'));
  assert.equal(level.items.filter(item => item.inInventory).length, 1);
  assert.equal(level.items.find(item => item.id === 'mirror').inInventory, false);
  assert.ok(moveItem(level, 'mirror-2', { x: 6, y: 7 }));
  assert.equal(level.items.find(item => item.id === 'mirror-2').angle, 135);
  assert.ok(traceLevel(level).received.beacon >= level.threshold);
  assert.equal(moveItem(level, 'fixed-harbor', { x: 4, y: 4 }), false);
  assert.equal(rotateItem(level, 'fixed-harbor', 1), false);
  assert.equal(storeItem(level, 'fixed-harbor'), false);
});
const stackedSolved = () => {
  const level = createLevel(4);
  for (const [id, x, y, layer, angle] of [
    ['mirror', 3, 3, 0, 135], ['lift', 5, 3, 0, 0], ['balloon', 5, 3, 1, 270],
    ['mirror-2', 2, 1, 1, 135], ['lens', 2, 3, 1, 90],
  ]) {
    assert.ok(moveItem(level, id, { x, y, layer }));
    level.items.find(item => item.id === id).angle = angle;
  }
  return level;
};
check('双层关保持第一章主题与现有夜航链接，拥有真实洞口与新器件', () => {
  const level = createLevel(4);
  assert.deepEqual(levelSummaries.filter(entry => [1, 2, 4, 6, 3, 5, 7].includes(entry.number)).map(entry => [entry.chapter, entry.chapterLevel]), [[1, 1], [1, 2], [1, 3], [1, 4], [2, 1], [2, 2], [3, 1]]);
  assert.equal(level.theme, 'garden');
  assert.equal(level.layers, 2);
  assert.equal(level.items.find(item => item.id === 'source').layer, 0);
  assert.equal(level.items.find(item => item.id === 'beacon').layer, 1);
  assert.equal(level.items.filter(item => item.kind === 'block').length, 6);
  assert.equal(level.items.filter(item => item.inInventory).length, 5);
  assert.equal(createLevel(3).theme, 'night');
});
check('双层实际光路：六次反射、穿洞、上层聚焦后接收 67.63%', () => {
  const level = stackedSolved();
  const result = traceLevel(level);
  near(result.received.beacon, 0.95 ** 6 * 0.92);
  assert.ok(result.received.beacon >= level.threshold);
  assert.deepEqual(result.touched, ['fixed', 'mirror', 'lift', 'balloon', 'fixed-upper', 'mirror-2', 'lens', 'beacon']);
  assert.equal(result.segments.filter(segment => segment.start.layer !== segment.end.layer).length, 1);
  assert.ok(result.segments.some(segment => segment.start.layer === 1 && segment.end.layer === 1));
  assert.deepEqual(result.blocked, []);
});
check('实体上层地板挡光：没有洞或洞口不对齐均不可穿透', () => {
  for (const holes of [[], [{ x: 4, y: 3, layer: 1 }]]) {
    const level = stackedSolved(); level.holes = holes;
    const result = traceLevel(level);
    near(result.received.beacon, 0);
    assert.ok(result.blocked.includes('ceiling'));
    assert.equal(result.touched.includes('balloon'), false);
  }
});
check('没有红气球镜只会竖直出光，不会凭空变成水平光', () => {
  const level = stackedSolved(); storeItem(level, 'balloon');
  const result = traceLevel(level);
  assert.ok(result.blocked.includes('missing-balloon'));
  near(result.received.beacon, 0);
  assert.equal(result.segments.filter(segment => segment.start.layer === 1).length, 0);
});
check('升光镜入射朝向不对时挡光，红气球镜的三个错误方向均被积木挡住', () => {
  for (const angle of [90, 180, 270]) {
    const level = stackedSolved(); level.items.find(item => item.id === 'lift').angle = angle;
    near(traceLevel(level).received.beacon, 0);
  }
  for (const angle of [0, 90, 180]) {
    const level = stackedSolved(); level.items.find(item => item.id === 'balloon').angle = angle;
    const result = traceLevel(level);
    near(result.received.beacon, 0);
    assert.ok(result.blocked.some(id => id.startsWith('block-')));
  }
});
check('双层关的每个可移动器件均不可省略，凸透镜仍须对准和对焦', () => {
  for (const id of ['mirror', 'mirror-2', 'lift', 'balloon', 'lens']) {
    const level = stackedSolved(); assert.ok(storeItem(level, id));
    assert.ok(traceLevel(level).received.beacon < level.threshold);
  }
  for (const change of [{ angle: 0 }, { y: 2 }, { y: 4 }]) {
    const level = stackedSolved(); Object.assign(level.items.find(item => item.id === 'lens'), change);
    assert.ok(traceLevel(level).received.beacon < level.threshold);
  }
});
check('分层占格和洞口规则：同坐标可上下叠放，新器件层限制与固定障碍生效', () => {
  const level = createLevel(4);
  assert.equal(moveItem(level, 'lift', { x: 5, y: 3, layer: 0 }), true);
  assert.equal(moveItem(level, 'balloon', { x: 5, y: 3, layer: 1 }), true);
  assert.equal(moveItem(level, 'mirror', { x: 5, y: 3, layer: 1 }), false);
  assert.equal(moveItem(level, 'lift', { x: 3, y: 2, layer: 1 }), false);
  assert.equal(moveItem(level, 'balloon', { x: 3, y: 2, layer: 0 }), false);
  assert.equal(moveItem(level, 'mirror', { x: 3, y: 2, layer: 2 }), false);
  assert.equal(moveItem(level, 'mirror', { x: 3, y: 2, layer: 0.5 }), false);
  assert.equal(moveItem(level, 'mirror', { x: 4, y: 3, layer: 1 }), false);
  assert.equal(moveItem(level, 'mirror', { x: 4, y: 3, layer: 0 }), true);
  for (const block of level.items.filter(item => item.kind === 'block')) {
    assert.equal(moveItem(level, block.id, { x: 7, y: 7, layer: block.layer }), false);
    assert.equal(storeItem(level, block.id), false);
    assert.equal(rotateItem(level, block.id, 1), false);
  }
});
check('积木真正挡光，只阻挡自己所在的一层', () => {
  const level = stackedSolved();
  Object.assign(level.items.find(item => item.id === 'block-0'), { x: 3, y: 4, layer: 1 });
  assert.ok(traceLevel(level).received.beacon >= level.threshold);
  level.items.find(item => item.id === 'block-0').layer = 0;
  const result = traceLevel(level);
  near(result.received.beacon, 0);
  assert.ok(result.blocked.includes('block-0'));
});
check('两种竖向镜支持完整 360 度与收纳后保留方向', () => {
  const level = stackedSolved();
  assert.ok(rotateItem(level, 'lift', -1));
  assert.equal(level.items.find(item => item.id === 'lift').angle, 270);
  assert.ok(rotateItem(level, 'lift', 1));
  assert.ok(storeItem(level, 'balloon'));
  assert.equal(rotateItem(level, 'balloon', 1), false);
  assert.ok(moveItem(level, 'balloon', { x: 5, y: 3, layer: 1 }));
  assert.equal(level.items.find(item => item.id === 'balloon').angle, 270);
  assert.ok(traceLevel(level).received.beacon >= level.threshold);
});
const streetSolved = (row = 5) => {
  const level = createLevel(5);
  for (const [id, x, y, angle] of [['mirror', 2, 2, 135], ['mirror-2', 5, row, 45], ['mirror-3', 7, row, 45], ['mirror-4', 7, 7, 135]]) {
    assert.ok(moveItem(level, id, { x, y }));
    level.items.find(item => item.id === id).angle = angle;
  }
  return level;
};
check('留灯街道保留夜景，四面可移动镜、两面固定镜及八个不可移动障碍', () => {
  const level = createLevel(5);
  assert.equal(level.chapter, 2); assert.equal(level.chapterLevel, 2);
  assert.equal(level.theme, 'night'); assert.equal(level.setting, 'street');
  assert.equal(level.items.filter(item => item.inInventory).length, 4);
  assert.equal(level.items.filter(item => item.kind === 'mirror' && !item.movable).length, 2);
  assert.equal(level.items.filter(item => item.kind === 'block').length, 8);
  assert.equal(level.items.some(item => item.kind === 'lens'), false);
});
check('六次真实反射照到路边早餐，接收 28.0035%，满足 27% 连续充能', () => {
  const level = streetSolved(), result = traceLevel(level);
  near(result.received.beacon, 0.95 ** 6 * 0.16 / 0.42);
  assert.deepEqual(result.touched, ['fixed', 'mirror', 'fixed-street', 'mirror-2', 'mirror-3', 'mirror-4', 'beacon']);
  assert.deepEqual(result.blocked, []);
  assert.equal(result.focused, false);
  const gate = new WinGate();
  for (let frame = 0; frame < 6; frame++) gate.update(result.received.beacon >= level.threshold, 0.1, level.holdSeconds);
  assert.equal(gate.won, true);
});
check('街道每面镜子均不可省略，错误朝向不通关，另一路径仍然有效', () => {
  for (const id of ['mirror', 'mirror-2', 'mirror-3', 'mirror-4']) {
    const missing = streetSolved(); storeItem(missing, id);
    assert.ok(traceLevel(missing).received.beacon < missing.threshold);
    const wrong = streetSolved(); rotateItem(wrong, id, 1);
    assert.ok(traceLevel(wrong).received.beacon < wrong.threshold);
  }
  const alternate = streetSolved(4);
  assert.ok(traceLevel(alternate).received.beacon >= alternate.threshold);
});
check('围挡真的阻光，不能占格或收走；落叶不会产生额外光学对象', () => {
  const level = streetSolved();
  const third = level.items.find(item => item.id === 'mirror-3');
  third.x = 6; third.angle = 135;
  const result = traceLevel(level);
  near(result.received.beacon, 0);
  assert.ok(result.blocked.includes('street-block-5'));
  for (const block of level.items.filter(item => item.kind === 'block')) {
    assert.equal(canPlace(level, 'mirror', block), false);
    assert.equal(moveItem(level, block.id, { x: 3, y: 4 }), false);
    assert.equal(storeItem(level, block.id), false);
    assert.equal(rotateItem(level, block.id, 1), false);
  }
  assert.equal(level.items.length, 16);
});
check('全棋盘最短转向搜索：至少需要四面可移动镜，比夜航三镜更难', () => {
  const level = createLevel(5), directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const fixed = level.items.filter(item => !item.inInventory);
  const source = fixed.find(item => item.kind === 'source');
  const queue = [{ x: source.x, y: source.y, direction: 0, count: 0 }], visited = new Map();
  let minimum = Infinity;
  while (queue.length) {
    queue.sort((a, b) => a.count - b.count);
    const current = queue.shift(), key = `${current.x},${current.y},${current.direction}`;
    if ((visited.get(key) ?? Infinity) <= current.count) continue;
    visited.set(key, current.count);
    const [dx, dy] = directions[current.direction];
    for (let distance = 1; distance <= level.size; distance++) {
      const x = current.x + distance * dx, y = current.y + distance * dy;
      if (x < 1 || x > level.size || y < 1 || y > level.size) break;
      const item = fixed.find(item => item.x === x && item.y === y);
      if (item?.kind === 'block') break;
      if (item?.kind === 'beacon') { minimum = current.count; break; }
      if (item?.kind === 'mirror') {
        const reflectedRay = reflected({ x: dx, y: dy }, item.angle);
        const direction = directions.findIndex(([nx, ny]) => Math.abs(nx - reflectedRay.x) < 1e-6 && Math.abs(ny - reflectedRay.y) < 1e-6);
        queue.push({ x, y, direction, count: current.count }); break;
      }
      if (!item) for (const turn of [1, 2, 3]) queue.push({ x, y, direction: (current.direction + turn) % 4, count: current.count + 1 });
    }
    if (minimum !== Infinity) break;
  }
  // This relaxed search even permits inconsistent revisits, so its minimum is a lower bound.
  assert.equal(minimum, 4);
});
const crossingSolved = () => {
  const level = createLevel(6);
  for (const [id, x, y, angle] of [['mirror', 2, 4, 135], ['mirror-2', 7, 4, 135], ['mirror-3', 4, 5, 45], ['lens', 7, 3, 90], ['lens-2', 5, 1, 0]]) {
    assert.ok(moveItem(level, id, { x, y }));
    level.items.find(item => item.id === id).angle = angle;
  }
  return level;
};
const waypointToy = (items, threshold = 0.3) => ({ size: 7, threshold, holdSeconds: 0.6, items: [
  { id: 'point', kind: 'waypoint', x: 4, y: 4, requiredDirections: 2, requiredSources: 2 }, ...items,
] });
check('第四关保持暖色主题，两个固定光源、一个固定途经点与五件库存器件', () => {
  const level = createLevel(6);
  assert.equal(level.chapter, 1); assert.equal(level.chapterLevel, 4); assert.equal(level.theme, 'garden');
  assert.equal(level.layers ?? 1, 1);
  const sources = level.items.filter(item => item.kind === 'source');
  assert.equal(sources.length, 2); near(sources.reduce((sum, item) => sum + item.power, 0), 1);
  for (const item of [...sources, level.items.find(item => item.kind === 'waypoint')]) {
    assert.equal(moveItem(level, item.id, { x: 1, y: 1 }), false);
    assert.equal(rotateItem(level, item.id, 1), false); assert.equal(storeItem(level, item.id), false);
  }
  assert.equal(level.items.filter(item => item.inInventory).length, 5);
  assert.equal(level.items.filter(item => item.kind === 'block').length, 6);
});
check('两束光分别双向途经再到同一终点，六次反射、分别聚焦后共 78.8785%', () => {
  const level = crossingSolved(); const result = traceLevel(level);
  near(result.received.beacon, 0.95 ** 3 * 0.92);
  near(result.qualifiedReceived.beacon, result.received.beacon);
  const progress = waypointProgress(level, result, 'waypoint');
  assert.deepEqual(progress.directions, [0, 270]);
  assert.deepEqual(progress.deliveredSources, ['source', 'source-b']);
  assert.equal(progress.complete, true); assert.equal(isLightReady(level, result), true);
  const gate = new WinGate();
  for (let frame = 0; frame < 6; frame++) gate.update(isLightReady(level, result), 0.1, level.holdSeconds);
  assert.equal(gate.won, true);
});
check('每个可移动器件均不能省略，每束光单独都不足以过关', () => {
  for (const id of ['mirror', 'mirror-2', 'mirror-3', 'lens', 'lens-2']) {
    const level = crossingSolved(); storeItem(level, id);
    assert.equal(isLightReady(level, traceLevel(level)), false);
  }
  for (const id of ['source', 'source-b']) {
    const level = crossingSolved(); level.items.find(item => item.id === id).power = 0;
    assert.equal(isLightReady(level, traceLevel(level)), false);
  }
});
check('每条末段都必须正确聚焦，错误光轴和焦距均不能点亮', () => {
  for (const [id, changes] of [ ['lens', { angle: 0 }], ['lens', { y: 2 }], ['lens-2', { angle: 90 }], ['lens-2', { x: 6 }] ]) {
    const level = crossingSolved(); Object.assign(level.items.find(item => item.id === id), changes);
    assert.equal(isLightReady(level, traceLevel(level)), false);
  }
});
check('双向经过但其中一路未到终点，能量达标也不能通关', () => {
  const level = waypointToy([
    { id: 'a', kind: 'source', x: 1, y: 4, angle: 0 },
    { id: 'b', kind: 'source', x: 4, y: 7, angle: 270 },
    { id: 'beacon', kind: 'beacon', x: 7, y: 4, angle: 0 },
  ]);
  const result = traceLevel(level);
  assert.ok(result.qualifiedReceived.beacon >= level.threshold);
  assert.equal(waypointProgress(level, result, 'point').directions.length, 2);
  assert.equal(waypointProgress(level, result, 'point').deliveredSources.length, 1);
  assert.equal(isLightReady(level, result), false);
});
check('两光源从相同方向途经并抵达，仍然不能冒充两个来向', () => {
  const level = waypointToy([
    { id: 'a', kind: 'source', x: 1, y: 4, angle: 0 },
    { id: 'b', kind: 'source', x: 2, y: 4, angle: 0 },
    { id: 'beacon', kind: 'beacon', x: 7, y: 4, angle: 0 },
  ], 0.5);
  const result = traceLevel(level);
  assert.ok(result.qualifiedReceived.beacon >= level.threshold);
  assert.equal(waypointProgress(level, result, 'point').deliveredSources.length, 2);
  assert.equal(waypointProgress(level, result, 'point').deliveredDirections.length, 1);
  assert.equal(isLightReady(level, result), false);
});
check('绕过途经点直达终点的光不计入合格强度', () => {
  const level = waypointToy([
    { id: 'a', kind: 'source', x: 1, y: 1, angle: 0 },
    { id: 'b', kind: 'source', x: 7, y: 7, angle: 270 },
    { id: 'beacon', kind: 'beacon', x: 7, y: 1, angle: 0 },
  ], 0.7);
  const result = traceLevel(level);
  assert.ok(result.received.beacon >= level.threshold);
  near(result.qualifiedReceived.beacon, 0); assert.equal(isLightReady(level, result), false);
});
check('同一束光绕行两次途经并抵达，仍不能代替两个光源', () => {
  const level = waypointToy([
    { id: 'a', kind: 'source', x: 1, y: 4, angle: 0 },
    { id: 'one', kind: 'mirror', x: 6, y: 4, angle: 135 },
    { id: 'two', kind: 'mirror', x: 6, y: 2, angle: 45 },
    { id: 'three', kind: 'mirror', x: 4, y: 2, angle: 135 },
    { id: 'beacon', kind: 'beacon', x: 4, y: 6, angle: 0 },
  ]);
  const result = traceLevel(level); const progress = waypointProgress(level, result, 'point');
  assert.ok(result.qualifiedReceived.beacon >= level.threshold);
  assert.equal(progress.deliveredDirections.length, 2); assert.equal(progress.deliveredSources.length, 1);
  assert.equal(isLightReady(level, result), false);
});
check('途经记录按当前完整光路重算，不能先后点亮两条路积累过关', () => {
  const level = crossingSolved();
  storeItem(level, 'mirror'); const first = traceLevel(level);
  assert.equal(waypointProgress(level, first, 'waypoint').deliveredSources.length, 1);
  moveItem(level, 'mirror', { x: 2, y: 4 }); storeItem(level, 'mirror-3');
  const second = traceLevel(level);
  assert.equal(waypointProgress(level, second, 'waypoint').deliveredSources.length, 1);
  assert.equal(isLightReady(level, second), false);
});
check('判定不依赖推荐坐标，整盘旋转 90 度后仍按真实光路通过', () => {
  const level = crossingSolved();
  for (const item of level.items) {
    const oldX = item.x; item.x = 8 - item.y; item.y = oldX;
    item.angle = (item.angle + 90) % (item.kind === 'source' ? 360 : 180);
  }
  const result = traceLevel(level);
  near(result.qualifiedReceived.beacon, 0.788785); assert.equal(isLightReady(level, result), true);
});
check('枚举 10080 种两镜布局，不能用两面镜接通双向途经与同一终点', () => {
  const level = createLevel(6), first = level.items.find(item => item.id === 'mirror'), second = level.items.find(item => item.id === 'mirror-2');
  const cells = [];
  for (let x = 1; x <= 7; x++) for (let y = 1; y <= 7; y++) if (canPlace(level, first.id, { x, y })) cells.push({ x, y });
  let combinations = 0;
  for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) {
    Object.assign(first, cells[a], { inInventory: false }); Object.assign(second, cells[b], { inInventory: false });
    for (const angleA of [0, 45, 90, 135]) for (const angleB of [0, 45, 90, 135]) {
      first.angle = angleA; second.angle = angleB; combinations++;
      assert.equal(waypointProgress(level, traceLevel(level), 'waypoint').complete, false);
    }
  }
  assert.equal(combinations, 10080);
});
console.log(`\n${checks} optical and interaction checks passed.`);
