import { pauseAction, useHint } from './browser-environment.mjs';
import { prepareDebugNavigation, selectLevel } from './browser-environment.mjs';
import { dismissStoryOpening } from './browser-environment.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = resolve(root, 'qa');
const url = process.env.GAME_URL || 'http://127.0.0.1:4177';
await mkdir(evidence, { recursive: true });
const configurations = [
  { name: 'chrome', executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' },
  { name: 'edge', executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' },
];
const reports = [];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
for (const configuration of configurations) {
  const browser = await chromium.launch({ executablePath: configuration.executablePath, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await prepareDebugNavigation(page);
  const errors = [], remoteRequests = [], verified = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith(url) && !request.url().startsWith('data:')) remoteRequests.push(request.url()); });
  const state = () => page.evaluate(() => window.__warmLight.state());
  const actor = async () => (await state()).atmosphere.street;
  const count = () => page.locator('[data-count="mirror"]').textContent().then(Number);
  const item = async id => (await state()).level.items.find(item => item.id === id);
  const point = (position, height = 0.2) => page.evaluate(({ position, height }) => window.__warmLight.screenPoint(position, height), { position, height });
  const itemPoint = id => page.evaluate(id => window.__warmLight.itemPoint(id), id);
  const center = async locator => { const box = await locator.boundingBox(); assert.ok(box); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; };
  const drag = async (start, end) => {
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 18 }); await page.mouse.up();
  };
  const place = async position => drag(await center(page.locator('[data-kind="mirror"] .item-thumbnail')), await point(position));
  const move = async (id, position) => drag(await itemPoint(id), await point(position, 0.62));
  const rotate = async (id, angle) => {
    const p = await itemPoint(id); await page.mouse.click(p.x, p.y, { button: 'right' });
    await page.locator(`#rotation-menu [data-angle="${angle}"]`).click();
    assert.equal((await item(id)).angle, angle);
  };
  const shot = async name => {
    await page.waitForFunction(() => !document.querySelector('#toast')?.classList.contains('visible'));
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(evidence, `${configuration.name}-street-${name}.png`), fullPage: true });
  };
  const solve = async () => {
    for (const [id, x, y, angle] of [['mirror', 2, 2, 135], ['mirror-2', 5, 5, 45], ['mirror-3', 7, 5, 45], ['mirror-4', 7, 7, 135]]) {
      await place({ x, y }); await rotate(id, angle);
    }
    await page.waitForFunction(() => window.__warmLight.state().won);
  };
  try {
    // Reach the new story by completing the harbor, using actual inventory gestures.
    await page.goto(`${url}/?level=3`, { waitUntil: 'networkidle' }); await dismissStoryOpening(page);
    for (const [id, x, y, angle] of [['mirror', 2, 7, 45], ['mirror-2', 6, 7, 135], ['mirror-3', 6, 3, 45]]) {
      await place({ x, y }); await rotate(id, angle);
    }
    await page.waitForFunction(() => window.__warmLight.state().won);
    await page.locator('#next-level').click(); await dismissStoryOpening(page);
    assert.equal((await state()).level.number, 5);
    assert.equal((await state()).level.chapterLevel, 2);
    assert.equal(new URL(page.url()).searchParams.get('level'), '5');
    assert.match(await page.title(), /第二章第2关/);
    assert.equal(await page.locator('body').getAttribute('data-setting'), 'street');
    assert.equal((await state()).atmosphere.boats, 0);
    assert.equal(await count(), 4);
    assert.equal(await page.locator('[data-total="mirror"]').textContent(), ' / 6');
    assert.equal((await actor()).workers, 'sweeping');
    assert.equal((await actor()).woman, true);
    assert.ok((await actor()).leaves > 30);
    assert.equal((await item('source')).name, '阳台吊灯');
    assert.equal((await state()).level.items.filter(item => item.kind === 'block').length, 8);
    assert.doesNotMatch(await page.locator('#inventory').innerText(), /早饭桌|长椅/);
    const sweepStart = (await actor()).poses.map(pose => pose.position);
    await page.waitForTimeout(2000);
    (await actor()).poses.forEach((pose, index) => {
      assert.ok(Math.hypot(pose.position[0] - sweepStart[index][0], pose.position[2] - sweepStart[index][2]) > 0.08);
      assert.ok(pose.position[0] >= pose.patrolBounds.minX && pose.position[0] <= pose.patrolBounds.maxX);
      assert.ok(pose.position[2] >= pose.patrolBounds.minZ && pose.position[2] <= pose.patrolBounds.maxZ);
    });
    await shot('initial');
    verified.push('harbor-next-to-street', 'street-night-setting', 'balcony-pendant-woman-leaves', 'four-mirror-inventory', 'initial-sweeping', 'workers-patrol-on-road', 'roadside-breakfast-ui');

    for (let step = 1; step <= 4; step++) {
      await useHint(page);
      const hint = await page.locator('#hint-content').innerText();
      if (step < 4) assert.doesNotMatch(hint, /第 [1-7] 列|第 [1-7] 行/);
      else assert.match(hint, /第 7 列第 7 行/);
    }
    await shot('hint');
    await pauseAction(page, 'restart'); await dismissStoryOpening(page);
    await place({ x: 4, y: 4 });
    assert.equal(await count(), 4);
    const blockBefore = await item('street-block-1');
    const blockPoint = await itemPoint('street-block-1');
    await page.mouse.click(blockPoint.x, blockPoint.y, { button: 'right' });
    assert.equal(await page.locator('#rotation-menu [data-angle]').count(), 0);
    await page.keyboard.press('e'); await page.keyboard.press('Escape');
    await move('street-block-1', { x: 3, y: 4 });
    assert.deepEqual(await item('street-block-1'), blockBefore);
    verified.push('four-hints-coordinates-last-only', 'obstacle-occupancy', 'obstacle-fixed-lock');

    for (const [id, x, y, angle] of [['mirror', 2, 2, 135], ['mirror-2', 5, 5, 45], ['mirror-3', 7, 5, 45], ['mirror-4', 6, 5, 135]]) {
      await place({ x, y }); await rotate(id, angle);
    }
    near((await state()).received.beacon, 0);
    assert.ok((await state()).blocked.includes('street-block-5'));
    assert.equal((await actor()).workers, 'sweeping');
    await shot('blocked');
    const start = await itemPoint('mirror-4'), end = await point({ x: 7, y: 7 }, 0.62);
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 18 });
    await page.waitForTimeout(750);
    near((await state()).received.beacon, 0.95 ** 6 * 0.16 / 0.42);
    assert.equal((await state()).won, false);
    assert.equal((await actor()).workers, 'sweeping');
    assert.ok((await actor()).poses.every(pose => !pose.bowlVisible && pose.phase === 'sweeping'));
    await page.mouse.up();
    await page.waitForFunction(() => window.__warmLight.state().won);
    assert.equal((await actor()).workers, 'walking-to-curb');
    assert.equal(await page.locator('#next-level').isVisible(), true);
    await page.locator('#continue').click();
    await page.waitForFunction(() => window.__warmLight.state().atmosphere.street.workers === 'breakfast');
    assert.ok((await actor()).poses.every(pose => pose.bowlVisible && pose.breadVisible && pose.legAngle < -1 && pose.hipHeight < 0.5));
    assert.equal(await page.locator('#next-level').isVisible(), false);
    await shot('breakfast');
    verified.push('obstacles-block-real-rays', 'six-reflection-solution', 'preview-keeps-workers-sweeping', 'victory-walk-to-curb', 'victory-sit-transition', 'seated-breakfast-pose-and-food');

    await drag(await itemPoint('mirror-2'), await center(page.locator('#inventory')));
    assert.equal(await count(), 1);
    assert.equal((await item('mirror-2')).angle, 45);
    await place({ x: 5, y: 5 }); near((await state()).received.beacon, 0.95 ** 6 * 0.16 / 0.42);
    await move('mirror-2', { x: 5, y: 4 });
    await move('mirror-3', { x: 7, y: 4 });
    near((await state()).received.beacon, 0.95 ** 6 * 0.16 / 0.42);
    verified.push('independent-four-mirror-storage', 'alternative-real-route');

    for (const pitch of [30, 85]) {
      await page.locator('#open-settings').click();
      await page.locator('#pitch').focus(); await page.locator('#pitch').press(pitch === 30 ? 'Home' : 'End');
      await page.locator('#done-settings').click();
      await move('mirror-3', { x: 7, y: 5 });
      assert.equal((await item('mirror-3')).y, 5);
      await move('mirror-3', { x: 7, y: 4 });
      near((await state()).received.beacon, 0.95 ** 6 * 0.16 / 0.42);
    }
    await page.locator('#open-settings').click(); await page.locator('#reset-settings').click(); await page.locator('#done-settings').click();
    await pauseAction(page, 'restart'); await dismissStoryOpening(page);
    await page.waitForFunction(() => window.__warmLight.state().atmosphere.street.workers === 'sweeping');
    assert.equal(await count(), 4); assert.equal((await state()).hintStep, 0);
    assert.ok((await actor()).poses.every(pose => !pose.bowlVisible && pose.phase === 'sweeping'));
    await selectLevel(page, 3); await dismissStoryOpening(page);
    assert.equal((await state()).atmosphere.boats, 3); assert.equal((await state()).atmosphere.street, undefined);
    await page.goBack(); await dismissStoryOpening(page); assert.equal((await state()).level.number, 5);
    assert.equal((await actor()).workers, 'sweeping');
    await page.goForward(); await dismissStoryOpening(page); assert.equal((await state()).level.number, 3);
    verified.push('street-drag-at-30-and-85', 'restart-restores-sweeping', 'harbor-street-theme-cleanup', 'street-browser-history');

    for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport); await selectLevel(page, 5); await dismissStoryOpening(page);
      await page.waitForTimeout(200);
      const layout = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }));
      assert.ok(layout.sw <= layout.w && layout.sh <= layout.h);
      for (const selector of ['#open-settings', '#inventory', '#toggle-inventory', '#open-settings']) {
        const bounds = await page.locator(selector).boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height);
      }
      const sceneBounds = await page.locator('#scene').boundingBox();
      for (const pose of (await actor()).poses) {
        const area = pose.patrolBounds;
        for (const x of [area.minX, area.maxX]) for (const z of [area.minZ, area.maxZ]) {
          const head = await point({ x: x + 4, y: z + 4 }, 0.75);
          assert.ok(head.x >= sceneBounds.x + 8 && head.x <= sceneBounds.x + sceneBounds.width - 8, 'patrol is clipped horizontally');
          assert.ok(head.y >= sceneBounds.y + 15 && head.y <= sceneBounds.y + sceneBounds.height - 15, 'patrol is clipped vertically');
        }
      }
      await shot(`${viewport.width}`); verified.push(`street-layout-${viewport.width}`);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await pauseAction(page, 'restart'); await dismissStoryOpening(page); await solve();
    await page.locator('#continue').click();
    await page.waitForFunction(() => window.__warmLight.state().atmosphere.street.workers === 'breakfast');
    await shot('breakfast-390');
    verified.push('mobile-four-mirror-victory', 'reduced-motion-breakfast');
    await page.goto(`${url}/?level=5`, { waitUntil: 'networkidle' }); await dismissStoryOpening(page);
    assert.equal((await actor()).workers, 'sweeping'); assert.equal(await count(), 4);
    assert.equal((await state()).won, false);
    assert.deepEqual(errors, []); assert.deepEqual(remoteRequests, []);
    verified.push('direct-street-url-initial-state', 'no-console-errors', 'offline-assets');
    reports.push({ browser: configuration.name, status: 'passed', solvedEnergy: 0.95 ** 6 * 0.16 / 0.42, verified, errors, remoteRequests });
    console.log(`${configuration.name}: ${verified.length} street checks passed, including sweeping → sitting → breakfast.`);
  } catch (error) {
    await shot('failure').catch(() => {});
    console.error(configuration.name, JSON.stringify(await state().catch(() => null)), errors);
    throw error;
  } finally { await browser.close(); }
}
await writeFile(resolve(evidence, 'street-report.json'), JSON.stringify(reports, null, 2));
