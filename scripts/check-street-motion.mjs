import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StreetStory } from '../src/street.ts';
import { createLevel } from '../src/level.ts';

const checked = [];
const check = (name, run) => { run(); checked.push(name); console.log(`PASS ${name}`); };
const story = new StreetStory(createLevel(5));
const positionDistance = (a, b) => Math.hypot(...a.map((value, index) => value - b[index]));
check('两人持续在各自道路范围内移动扫地，完成整个往返而非原地摆动', () => {
  const ranges = [{ min: Infinity, max: -Infinity }, { min: Infinity, max: -Infinity }];
  for (let time = 1; time <= 46; time += 0.1) {
    story.update(time, false);
    const current = story.state();
    assert.equal(current.workers, 'sweeping');
    current.poses.forEach((pose, index) => {
      const [x, y, z] = pose.position, bounds = pose.patrolBounds;
      assert.ok(x >= bounds.minX - 1e-6 && x <= bounds.maxX + 1e-6);
      assert.ok(z >= bounds.minZ - 1e-6 && z <= bounds.maxZ + 1e-6);
      assert.ok(Math.abs(y + 0.56) < 1e-6);
      assert.equal(pose.bowlVisible, false); assert.equal(pose.breadVisible, false);
      ranges[index].min = Math.min(ranges[index].min, z); ranges[index].max = Math.max(ranges[index].max, z);
    });
  }
  assert.ok(ranges[0].max - ranges[0].min > 1.2);
  assert.ok(ranges[1].max - ranges[1].min > 2.7);
});
check('通关从当前位置起步，人物不跳回固定起点', () => {
  story.update(46, false);
  const before = story.state(); story.update(46, true);
  const after = story.state();
  assert.equal(after.workers, 'walking-to-curb');
  before.poses.forEach((pose, index) => assert.ok(positionDistance(pose.position, after.poses[index].position) < 1e-6));
});
check('通关步行不穿过棋盘或阳台，两人不相撞，最后到路边再坐下', () => {
  let previous = story.state(), phases = new Set();
  for (let time = 46.05; time <= 59; time += 0.05) {
    story.update(time, true); const current = story.state(); phases.add(current.workers);
    current.poses.forEach((pose, index) => {
      const [x, , z] = pose.position;
      assert.ok(Math.abs(x) > 3.9 || z > 3.9, 'worker entered the board');
      assert.ok(!(x > -4.85 && x < -3.2 && z > 1 && z < 2.9), 'worker entered the balcony building');
      assert.ok(positionDistance(pose.position, previous.poses[index].position) < 0.081, 'worker teleported');
      if (pose.phase === 'sitting-down' || pose.phase === 'breakfast') {
        assert.ok(Math.hypot(x - pose.curb.x, z - pose.curb.z) < 1e-6);
      }
    });
    assert.ok(positionDistance(current.poses[0].position, current.poses[1].position) > 0.6);
    previous = current;
  }
  assert.ok(phases.has('walking-to-curb')); assert.ok(phases.has('sitting-down')); assert.ok(phases.has('breakfast'));
});
check('路沿坐姿与早餐只在通关后出现，餐具握在手中', () => {
  const current = story.state(); assert.equal(current.workers, 'breakfast');
  for (const pose of current.poses) {
    assert.ok(pose.hipHeight < 0.2 && pose.legAngle < -1);
    assert.equal(pose.bowlVisible, true); assert.equal(pose.breadVisible, true);
  }
});
check('重新开始恢复道路巡扫并收起食物', () => {
  story.update(60, false); const current = story.state();
  assert.equal(current.workers, 'sweeping'); assert.equal(current.progress, 0);
  current.poses.forEach(pose => {
    assert.equal(pose.bowlVisible, false);
    assert.ok(Math.abs(pose.position[0]) > 4 && pose.position[2] >= pose.patrolBounds.minZ && pose.position[2] <= pose.patrolBounds.maxZ);
  });
});
check('减少动态效果时直接切换为路沿就餐姿势', () => {
  story.update(0, false); story.update(0, true);
  assert.equal(story.state().workers, 'breakfast');
  assert.ok(story.state().poses.every(pose => pose.bowlVisible && pose.hipHeight < 0.2));
});
const evidence = resolve(dirname(fileURLToPath(import.meta.url)), '../qa');
await mkdir(evidence, { recursive: true });
await writeFile(resolve(evidence, 'street-motion-report.json'), JSON.stringify({ status: 'passed', checks: checked }, null, 2));
