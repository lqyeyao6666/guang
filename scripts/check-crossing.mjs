import { pauseAction, useHint } from './browser-environment.mjs';
import { prepareDebugNavigation, selectLevel } from './browser-environment.mjs';
import { dismissStoryOpening } from './browser-environment.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEnvironmentRequest, isolateBrowserEnvironment } from './browser-environment.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = resolve(root, 'qa');
const url = process.env.GAME_URL || 'http://127.0.0.1:4177';
const entry = new URL(url); entry.searchParams.set('level', '6');
await mkdir(evidence, { recursive: true });
const reports = [];
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
for (const [name, executablePath] of [
  ['chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'],
  ['edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
]) {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const environmentRequests = await isolateBrowserEnvironment(page); await prepareDebugNavigation(page);
  const errors = [], remoteRequests = [], verified = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !isEnvironmentRequest(message.location().url)) errors.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith(url) && !request.url().startsWith('data:') && !isEnvironmentRequest(request.url())) remoteRequests.push(request.url()); });
  const state = () => page.evaluate(() => window.__warmLight.state());
  const item = async id => (await state()).level.items.find(item => item.id === id);
  const count = async kind => Number(await page.locator(`[data-count="${kind}"]`).textContent());
  const point = (position, height = 0.2) => page.evaluate(({ position, height }) => window.__warmLight.screenPoint(position, height), { position, height });
  const itemPoint = id => page.evaluate(id => window.__warmLight.itemPoint(id), id);
  const center = async locator => { await locator.scrollIntoViewIfNeeded(); const bounds = await locator.boundingBox(); assert.ok(bounds); return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }; };
  const drag = async (start, end) => {
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 18 }); await page.mouse.up();
  };
  const place = async (kind, position) => drag(await center(page.locator(`[data-kind="${kind}"] .item-thumbnail`)), await point(position));
  const move = async (id, position) => drag(await itemPoint(id), await point(position, 0.62));
  const store = async id => drag(await itemPoint(id), await center(page.locator('#inventory')));
  const rotate = async (id, angle) => {
    const p = await itemPoint(id); await page.mouse.click(p.x, p.y, { button: 'right' });
    await page.locator(`#rotation-menu [data-angle="${angle}"]`).click();
    assert.equal((await item(id)).angle, angle);
  };
  const shot = suffix => page.screenshot({ path: resolve(evidence, `${name}-crossing-${suffix}.png`), fullPage: true });
  const passes = async () => (await state()).waypointPasses.waypoint;
  const arrived = async () => new Set((await passes()).filter(pass => pass.deliveredTo === 'beacon').map(pass => pass.sourceId)).size;
  const solve = async () => {
    for (const [kind, id, x, y, angle] of [
      ['mirror', 'mirror', 2, 4, 135], ['mirror', 'mirror-2', 7, 4, 135], ['mirror', 'mirror-3', 4, 5, 45],
      ['lens', 'lens', 7, 3, 90], ['lens', 'lens-2', 5, 1, 0],
    ]) { await place(kind, { x, y }); await rotate(id, angle); }
    await page.waitForFunction(() => window.__warmLight.state().won);
  };
  try {
    await page.goto(entry.href, { waitUntil: 'networkidle' }); await dismissStoryOpening(page);
    await page.waitForFunction(() => window.__warmLight);
    assert.equal((await state()).level.chapter, 1); assert.equal((await state()).level.chapterLevel, 4);
    assert.equal(await page.locator('body').getAttribute('data-theme'), 'garden');
    assert.match(await page.title(), /第一章第4关/);
    assert.equal(await count('mirror'), 3); assert.equal(await count('lens'), 2);
    assert.equal(await page.locator('[data-total="source"]').textContent(), ' / 2');
    assert.equal(await page.locator('[data-detail="source"]').textContent(), '棋盘 2 · 固定 2');
    assert.equal(await page.locator('#layer-guide').isVisible(), false);
    assert.equal(await page.locator('#layer-controls').isVisible(), false);
    assert.match(await page.locator('#waypoint-value').innerText(), /0\s*\/\s*2/);
    verified.push('warm-theme', 'direct-chapter1-level4', 'two-fixed-source-counts', 'three-mirrors-two-lenses', 'initial-waypoint-zero');
    await shot('initial');
    for (const id of ['source', 'source-b', 'waypoint']) {
      const before = await item(id), p = await itemPoint(id);
      await page.mouse.click(p.x, p.y, { button: 'right' });
      assert.equal(await page.locator('#rotation-menu [role="menuitemradio"]').count(), 0);
      await page.keyboard.press('e'); await page.keyboard.press('Escape');
      await move(id, { x: 1, y: 1 }); assert.deepEqual(await item(id), before);
    }
    verified.push('both-sources-and-waypoint-locked');
    await place('mirror', { x: 4, y: 4 }); assert.equal(await count('mirror'), 3);
    const cancelledStart = await center(page.locator('[data-kind="mirror"] .item-thumbnail'));
    const cancelledEnd = await point({ x: 2, y: 4 });
    await page.mouse.move(cancelledStart.x, cancelledStart.y); await page.mouse.down();
    await page.mouse.move(cancelledEnd.x, cancelledEnd.y, { steps: 12 });
    await page.keyboard.press('Escape'); await page.mouse.up(); assert.equal(await count('mirror'), 3);
    verified.push('waypoint-occupancy', 'cancel-drag-no-loss');
    for (let step = 1; step <= 4; step++) {
      await useHint(page); const text = await page.locator('#hint-content').innerText();
      if (step < 4) assert.doesNotMatch(text, /\([1-7],[1-7]\)/); else assert.match(text, /\(7,4\)/);
    }
    await shot('hint'); await pauseAction(page, 'restart'); await dismissStoryOpening(page);
    assert.equal((await state()).hintStep, 0); assert.equal((await state()).ready, false);
    verified.push('four-hints', 'restart-resets-progress');

    await place('mirror', { x: 2, y: 4 }); await rotate('mirror', 135);
    assert.equal((await passes()).length, 1); assert.equal(await arrived(), 0);
    await place('mirror', { x: 7, y: 4 }); await rotate('mirror-2', 135);
    await place('lens', { x: 7, y: 3 }); await rotate('lens', 90);
    near((await state()).qualifiedReceived.beacon, 0.5 * 0.95 ** 3 * 0.92);
    await page.waitForTimeout(650); assert.equal((await state()).won, false);
    assert.match(await page.locator('#waypoint-value').innerText(), /1\s*\/\s*2/);
    await shot('one-route'); verified.push('one-source-not-enough', 'one-direction-counter');

    await store('mirror'); assert.equal(await count('mirror'), 2);
    await move('mirror-2', { x: 7, y: 5 });
    await place('mirror', { x: 4, y: 5 }); await rotate('mirror', 45);
    await place('lens', { x: 5, y: 1 }); await rotate('lens-2', 0);
    await page.waitForTimeout(650);
    assert.equal((await state()).won, false); assert.equal(await arrived(), 1);
    assert.match(await page.locator('#waypoint-value').innerText(), /1\s*\/\s*2/);
    near((await state()).qualifiedReceived.beacon, 0.5 * 0.95 ** 3 * 0.92);
    verified.push('no-sequential-pass-accumulation', 'per-source-delivery');
    await place('mirror', { x: 2, y: 4 }); await rotate('mirror-3', 135);
    assert.match(await page.locator('#waypoint-value').innerText(), /2\s*\/\s*2/);
    assert.equal(await arrived(), 1); assert.equal((await state()).ready, false);
    await shot('two-passes-one-arrival'); verified.push('two-passes-with-dead-end-not-ready');

    const previewStart = await itemPoint('mirror-2'), previewEnd = await point({ x: 7, y: 4 }, 0.62);
    await page.mouse.move(previewStart.x, previewStart.y); await page.mouse.down();
    await page.mouse.move(previewEnd.x, previewEnd.y, { steps: 18 }); await page.waitForTimeout(750);
    assert.equal((await state()).ready, true); assert.equal((await state()).won, false);
    assert.equal((await item('mirror-2')).y, 5);
    await page.mouse.up(); await page.waitForFunction(() => window.__warmLight.state().won);
    near((await state()).qualifiedReceived.beacon, 0.788785);
    assert.equal(await arrived(), 2); assert.deepEqual((await passes()).map(pass => pass.direction), [0, 270]);
    assert.equal(await page.locator('#step-count').textContent(), '3 / 3');
    await page.waitForTimeout(550); await shot('solved');
    await page.locator('#continue').click(); await shot('solved-clear');
    verified.push('preview-does-not-win', 'both-directions-delivered', 'both-lenses-focused', 'continuous-win', 'actual-energy-78-percent');

    await store('lens-2'); assert.equal(await count('lens'), 1); assert.equal((await item('lens-2')).angle, 0);
    assert.equal((await state()).ready, false);
    await place('lens', { x: 5, y: 1 }); assert.equal((await state()).ready, true);
    const blank = await point({ x: 7, y: 7 }); await drag(blank, { x: blank.x + 60, y: blank.y });
    assert.ok(Math.abs((await state()).view.rotation) > 0.25);
    await move('lens-2', { x: 6, y: 1 }); assert.equal((await state()).ready, false);
    await move('lens-2', { x: 5, y: 1 }); assert.equal((await state()).ready, true);
    verified.push('lens-return-orientation', 'rotated-view-drag');
    await pauseAction(page, 'restart'); await dismissStoryOpening(page);
    assert.equal((await state()).won, false); assert.equal((await passes()).length, 0);
    assert.equal(await count('mirror'), 3); assert.equal(await count('lens'), 2);
    await solve(); await page.locator('#next-level').click(); await dismissStoryOpening(page);
    assert.equal((await state()).level.number, 11); assert.equal(await page.locator('#waypoint-status').evaluate(element => !element.hidden), false);
    assert.equal(await page.locator('[data-kind="waypoint"]').isVisible(), false);
    assert.equal(await page.locator('body').getAttribute('data-theme'), 'garden');
    assert.equal(await page.locator('#layer-guide').isVisible(), true);
    assert.equal(await page.locator('#cube-controls').isVisible(), true);
    await page.goBack(); await dismissStoryOpening(page); assert.equal((await state()).level.number, 6);
    assert.equal((await state()).won, false); assert.equal((await passes()).length, 0);
    verified.push('restart-clears-both-routes', 'next-to-cube', 'waypoint-cleanup', 'history-restores-initial');

    for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true);
      for (const selector of ['#toggle-inventory', '#toggle-inventory', '[data-kind="waypoint"]', '#inventory', '#return-home']) {
        const bounds = await page.locator(selector).boundingBox();
        assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height, `${selector} outside ${viewport.width}`);
      }
      await shot(String(viewport.width)); verified.push(`layout-${viewport.width}`);
    }
    await solve(); await page.waitForTimeout(550); await shot('mobile-solved');
    await page.locator('#continue').click(); await shot('mobile-solved-clear'); verified.push('mobile-full-completion');
    assert.deepEqual(errors, []); assert.deepEqual(remoteRequests, []);
    verified.push('zero-console-errors', 'offline-assets');
    reports.push({ browser: name, status: 'passed', solvedEnergy: 0.788785, errors, remoteRequests, environmentRequests, verified });
    console.log(`${name}: crossing level passed (${verified.length} features)`);
  } catch (error) {
    await shot('failure').catch(() => {}); console.error(name, JSON.stringify(await state().catch(() => null)), errors); throw error;
  } finally { await browser.close(); }
}
await writeFile(resolve(evidence, 'crossing-report.json'), JSON.stringify(reports, null, 2));
