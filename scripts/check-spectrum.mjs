import { pauseAction, useHint } from './browser-environment.mjs';
import { prepareDebugNavigation, selectLevel } from './browser-environment.mjs';
import { dismissStoryOpening } from './browser-environment.mjs';
import {isEnvironmentRequest,isolateBrowserEnvironment} from './browser-environment.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { levelSummaries } from '../src/level.ts';

const url = process.env.GAME_URL || 'http://127.0.0.1:4177';
const entry = new URL(url); entry.searchParams.set('level', '7');
const evidence = resolve('qa'); await mkdir(evidence, { recursive: true });
const reports = [];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const solution = [['prism', 'prism', 3, 7, 0], ['mirror', 'mirror', 7, 1, 0], ['mirror', 'mirror-2', 5, 5, 0], ['mirror', 'mirror-3', 7, 7, 0], ['mirror', 'mirror-4', 7, 5, 0], ['mirror', 'mirror-5', 7, 9, 0], ['mirror', 'mirror-6', 7, 11, 0], ['mirror', 'mirror-7', 7, 13, 0], ['mirror', 'mirror-8', 4, 1, 135], ['mirror', 'mirror-9', 12, 7, 135]];
for (const [name, executablePath] of [['chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'], ['edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']]) {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], remoteRequests = [], verified = [];
  const environmentRequests = await isolateBrowserEnvironment(page); await prepareDebugNavigation(page);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !isEnvironmentRequest(message.location().url)) errors.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith(url) && !request.url().startsWith('data:') && !isEnvironmentRequest(request.url())) remoteRequests.push(request.url()); });
  const state = () => page.evaluate(() => window.__warmLight.state());
  const item = async id => (await state()).level.items.find(item => item.id === id);
  const count = async kind => Number(await page.locator(`[data-count="${kind}"]`).textContent());
  const point = (position, height = 0.2) => page.evaluate(({ position, height }) => window.__warmLight.screenPoint(position, height), { position, height });
  const itemPoint = id => page.evaluate(id => window.__warmLight.itemPoint(id), id);
  const center = async locator => { await locator.scrollIntoViewIfNeeded(); const bounds = await locator.boundingBox(); assert.ok(bounds); return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }; };
  const drag = async (start, end) => { await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 14 }); await page.mouse.up(); };
  const place = async (kind, position) => drag(await center(page.locator(`[data-kind="${kind}"] .item-thumbnail`)), await point(position));
  const move = async (id, position) => drag(await itemPoint(id), await point(position, 0.62));
  const store = async id => drag(await itemPoint(id), await center(page.locator('#inventory')));
  const rotate = async (id, angle) => {
    const p = await itemPoint(id); await page.mouse.click(p.x, p.y, { button: 'right' });
    await page.locator(`#rotation-menu [data-angle="${angle}"]`).click(); assert.equal((await item(id)).angle, angle);
  };
  const shot = suffix => page.screenshot({ path: resolve(evidence, `${name}-spectrum-${suffix}.png`), fullPage: true });
  const solve = async () => {
    for (const [kind, id, x, y, angle] of solution) { await place(kind, { x, y }); if (angle) await rotate(id, angle); assert.equal((await item(id)).inInventory, false, id); }
    await page.waitForFunction(() => window.__warmLight.state().won);
  };
  try {
    await page.goto(entry.href, { waitUntil: 'networkidle' }); await dismissStoryOpening(page); await page.waitForFunction(() => window.__warmLight);
    assert.equal((await state()).level.chapter, 3); assert.equal((await state()).level.size, 13); assert.match(await page.title(), /第三章第1关/);
    assert.equal(await page.locator('body').getAttribute('data-theme'), 'experiment');
    assert.equal(await count('mirror'), 9); assert.equal(await count('prism'), 1);
    assert.equal((await state()).atmosphere.experiment.gardens, 7);
    assert.ok((await state()).atmosphere.experiment.clouds >= 4); verified.push('peripheral-cloud-decoration');
    const regions = (await state()).level.colorRegions; assert.equal(regions.length, 7);
    for (const region of regions) {
      const checkpoint = (await state()).level.items.find(item => item.kind === 'colorWaypoint' && item.color === region.color);
      assert.ok(checkpoint.x >= region.minX && checkpoint.x <= region.maxX && checkpoint.y >= region.minY && checkpoint.y <= region.maxY);
    }
    const blocks = (await state()).level.items.filter(item => item.kind === 'block'); assert.equal(blocks.length, 8);
    assert.ok(blocks.every(block => regions.some(region => region.color === block.color && block.x >= region.minX && block.x <= region.maxX && block.y >= region.minY && block.y <= region.maxY)));
    verified.push('eight-obstacles-match-region-colors');
    verified.push('seven-distinct-themed-regions-with-matching-checkpoints'); assert.equal((await state()).atmosphere.experiment.rainbowVisible, false);
    assert.equal(await page.locator('.level-navigation').count(), 0);
    await shot('initial'); verified.push('direct-chapter3-url', 'pale-blue-white-theme', 'thirteen-by-thirteen', 'seven-color-gardens', 'ten-inventory-pieces', 'all-existing-level-navigation');
    for (const id of ['source', 'fixed', 'fixed-green', 'fixed-orange', 'spectrum-block-0', 'spectrum-block-4', 'color-red', 'color-green', 'beacon']) {
      const before = await item(id), p = await itemPoint(id);
      await page.mouse.click(p.x, p.y, { button: 'right' }); assert.equal(await page.locator('#rotation-menu [data-angle]').count(), 0);
      await page.keyboard.press('Escape'); await move(id, { x: 1, y: 1 }); assert.deepEqual(await item(id), before);
    }
    await place('prism', { x: 9, y: 4 }); assert.equal(await count('prism'), 1);
    await place('mirror', { x: 7, y: 3 }); assert.equal(await count('mirror'), 9);
    await place('mirror', { x: 5, y: 2 }); assert.equal(await count('mirror'), 9);
    verified.push('old-shortcut-cells-blocked-without-item-loss');
    await place('prism', { x: 14, y: 7 }); assert.equal(await count('prism'), 1);
    verified.push('fixed-items-locked', 'color-ring-occupancy', 'out-of-bounds-no-loss');
    const cancelStart = await center(page.locator('[data-kind="prism"] .item-thumbnail')), cancelEnd = await point({ x: 3, y: 7 });
    await page.mouse.move(cancelStart.x, cancelStart.y); await page.mouse.down(); await page.mouse.move(cancelEnd.x, cancelEnd.y, { steps: 12 });
    await page.keyboard.press('Escape'); await page.mouse.up(); assert.equal(await count('prism'), 1); verified.push('cancel-prism-drag');
    await place('prism', { x: 3, y: 7 }); assert.equal((await state()).prismSplits, 1);
    await shot('split');
    for (const angle of [90, 180, 270, 0]) { await rotate('prism', angle); assert.equal((await state()).prismSplits, angle === 0 ? 1 : 0); }
    await rotate('prism', 270); await store('prism'); assert.equal(await count('prism'), 1);
    await place('prism', { x: 3, y: 7 }); assert.equal((await item('prism')).angle, 270);
    await page.mouse.click((await itemPoint('prism')).x, (await itemPoint('prism')).y); await page.keyboard.press('e');
    assert.equal((await item('prism')).angle, 0); await page.keyboard.press('q'); assert.equal((await item('prism')).angle, 270); await rotate('prism', 0);
    verified.push('seven-distinct-rays', 'prism-full-four-directions', 'wrong-prism-angle-blocks', 'prism-store-keeps-angle', 'prism-q-e');
    for (let step = 1; step <= 4; step++) {
      await useHint(page); const hint = await page.locator('#hint-content').innerText();
      if (step < 4) assert.doesNotMatch(hint, /\(\d+,\d+\)/); else assert.match(hint, /\(7,13\)/);
    }
    await shot('hint'); await pauseAction(page, 'restart'); await dismissStoryOpening(page); assert.equal((await state()).hintStep, 0); verified.push('four-hints-last-only-coordinates');
    for (const [kind, id, x, y, angle] of solution.slice(0, -1)) { await place(kind, { x, y }); if (angle) await rotate(id, angle); }
    assert.equal((await state()).spectrum.filter(color => color.arrived).length, 6);
    await page.waitForTimeout(700); assert.equal((await state()).won, false); assert.equal((await state()).atmosphere.experiment.rainbowVisible, false);
    await shot('six-colors'); verified.push('six-colors-cannot-win', 'bridge-hidden-before-win');
    await store('mirror'); assert.equal((await state()).spectrum.filter(color => color.arrived).length, 5);
    await place('mirror', { x: 7, y: 1 }); assert.equal((await state()).spectrum.filter(color => color.arrived).length, 6);
    verified.push('progress-recomputed-no-accumulation');
    await place('mirror', { x: 12, y: 6 }); await rotate('mirror-9', 135);
    const previewStart = await itemPoint('mirror-9'), previewEnd = await point({ x: 12, y: 7 }, 0.62);
    await page.mouse.move(previewStart.x, previewStart.y); await page.mouse.down(); await page.mouse.move(previewEnd.x, previewEnd.y, { steps: 18 }); await page.waitForTimeout(750);
    assert.equal((await state()).ready, true); assert.equal((await state()).won, false); assert.equal((await state()).atmosphere.experiment.rainbowVisible, false);
    await page.mouse.up(); await page.waitForFunction(() => window.__warmLight.state().won);
    await page.waitForFunction(() => window.__warmLight.state().atmosphere.experiment.rainbowProgress === 1);
    near((await state()).qualifiedReceived.beacon, 0.31454112244897964);
    assert.equal((await state()).spectrum.filter(color => color.arrived).length, 7);
    assert.equal(await page.locator('#step-count').textContent(), '3 / 3'); assert.equal(await page.locator('#next-level').isVisible(), levelSummaries.findIndex(entry => entry.number === 7) < levelSummaries.length - 1);
    await shot('solved'); await page.locator('#continue').click(); await shot('rainbow-bridge');
    verified.push('preview-cannot-win', 'seven-current-arrivals', 'actual-energy-31-percent', 'win-only-rainbow-bridge', 'bridge-fully-raised');
    await pauseAction(page, 'restart'); await dismissStoryOpening(page); assert.equal((await state()).won, false);
    await page.waitForFunction(() => !window.__warmLight.state().atmosphere.experiment.rainbowVisible);
    assert.equal((await state()).spectrum.filter(color => color.passed).length, 0); assert.equal(await count('mirror'), 9); assert.equal(await count('prism'), 1);
    verified.push('restart-clears-seven-routes-and-bridge');
    await place('prism', { x: 3, y: 7 });
    for (const pitch of [30, 85]) {
      await page.locator('#open-settings').click(); await page.locator('#pitch').fill(String(pitch)); await page.locator('#pitch').dispatchEvent('input'); await page.locator('#done-settings').click();
      await move('prism', { x: 2, y: 7 }); assert.equal((await item('prism')).x, 2);
      await move('prism', { x: 3, y: 7 }); assert.equal((await state()).prismSplits, 1);
    }
    await page.locator('#open-settings').click(); await page.locator('#reset-settings').click(); await page.locator('#done-settings').click();
    const blank = await point({ x: 1, y: 11 }); await drag(blank, { x: blank.x + 60, y: blank.y });
    assert.ok(Math.abs((await state()).view.rotation) > 0.2);
    await move('prism', { x: 2, y: 7 }); assert.equal((await item('prism')).x, 2); await move('prism', { x: 3, y: 7 }); assert.equal((await state()).prismSplits, 1);
    await page.locator('#reset-view').click(); verified.push('prism-drag-at-30-and-85', 'prism-drag-after-rotation');
    await selectLevel(page, 5); await dismissStoryOpening(page);
    for (const [id, x, y, angle] of [['mirror', 2, 2, 135], ['mirror-2', 5, 5, 45], ['mirror-3', 7, 5, 45], ['mirror-4', 7, 7, 135]]) { await place('mirror', { x, y }); await rotate(id, angle); }
    await page.waitForFunction(() => window.__warmLight.state().won); await page.locator('#next-level').click(); await dismissStoryOpening(page);
    const next = levelSummaries[levelSummaries.findIndex(entry => entry.number === 5) + 1];
    assert.equal((await state()).level.number, next.number); assert.equal((await state()).won, false);
    if (next.number !== 7) await selectLevel(page, 7); await dismissStoryOpening(page);
    await page.goBack(); await dismissStoryOpening(page); assert.equal((await state()).level.number, next.number === 7 ? 5 : next.number); assert.equal(await page.locator('#spectrum-status').evaluate(element => !element.hidden), false);
    assert.equal((await state()).atmosphere.experiment, undefined);
    await page.goForward(); await dismissStoryOpening(page); assert.equal((await state()).level.number, 7); assert.equal(await count('prism'), 1);
    verified.push('street-next-follows-current-order', 'third-chapter-entry-and-history-cleanup');
    for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true);
      for (const selector of ['#toggle-inventory', '#toggle-inventory', '[data-kind="prism"]', '#inventory', '#return-home']) {
        const bounds = await page.locator(selector).boundingBox(); assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height, `${selector} outside ${viewport.width}`);
      }
      await shot(String(viewport.width)); verified.push(`layout-${viewport.width}`);
    }
    await solve(); await page.waitForFunction(() => window.__warmLight.state().atmosphere.experiment.rainbowProgress === 1);
    await page.locator('#continue').click(); await shot('mobile-solved'); verified.push('mobile-complete-with-ten-real-drags');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await pauseAction(page, 'restart'); await dismissStoryOpening(page); await solve();
    assert.equal((await state()).atmosphere.experiment.rainbowProgress, 1); verified.push('reduced-motion-complete');
    assert.deepEqual(errors, []); assert.deepEqual(remoteRequests, []); verified.push('no-console-errors', 'offline-assets');
    reports.push({ browser: name, status: 'passed', solvedEnergy: 0.31454112244897964, errors, remoteRequests, environmentRequests, verified });
    console.log(`${name}: spectrum passed (${verified.length} features)`);
  } catch (error) { await shot('failure').catch(() => {}); console.error(name, JSON.stringify(await state().catch(() => null))); throw error; }
  finally { await browser.close(); }
}
await writeFile(resolve(evidence, 'spectrum-report.json'), JSON.stringify(reports, null, 2));
