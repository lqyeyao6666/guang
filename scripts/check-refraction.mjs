import { pauseAction, useHint } from './browser-environment.mjs';
import { prepareDebugNavigation, selectLevel } from './browser-environment.mjs';
import { dismissStoryOpening } from './browser-environment.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isEnvironmentRequest, isolateBrowserEnvironment } from './browser-environment.mjs';
import { sensorPosition, refractionRails, refractionMirrors } from './refraction-solution.mjs';
import { fusionSolution } from './fusion-solution.mjs';
import { levelSummaries } from '../src/level.ts';

const url = process.env.GAME_URL || 'http://127.0.0.1:4177';
const reports = [];
await mkdir('qa', { recursive: true });
for (const [name, executablePath] of [
  ['chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'],
  ['edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
]) {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], remoteRequests = [], verified = [];
  const environmentRequests = await isolateBrowserEnvironment(page); await prepareDebugNavigation(page);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !isEnvironmentRequest(message.location().url)) errors.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith(url) && !request.url().startsWith('data:') && !isEnvironmentRequest(request.url())) remoteRequests.push(request.url()); });
  const state = () => page.evaluate(() => window.__warmLight.state());
  const item = async id => (await state()).level.items.find(entry => entry.id === id);
  const point = (position, height = .2) => page.evaluate(({ position, height }) => window.__warmLight.screenPoint(position, height), { position, height });
  const itemPoint = id => page.evaluate(id => window.__warmLight.itemPoint(id), id);
  const center = async locator => { const box = await locator.boundingBox(); assert.ok(box); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; };
  const drag = async (start, end) => { await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 12 }); await page.mouse.up(); };
  const move = async (id, position) => drag(await itemPoint(id), await point(position, .62));
  const place = async (kind, position) => drag(await center(page.locator(`[data-kind="${kind}"] .item-thumbnail`)), await point(position));
  const store = async id => drag(await itemPoint(id), await center(page.locator('#inventory')));
  const rotate = async (id, angle) => {
    const p = await itemPoint(id); await page.mouse.click(p.x, p.y, { button: 'right' });
    await page.locator(`#rotation-menu [data-angle="${angle}"]`).click(); assert.equal((await item(id)).angle, angle, id);
  };
  const positioned = async (id, x, y) => { const current = await item(id); assert.equal(current.x, x, id); assert.equal(current.y, y, id); assert.ok(!current.inInventory, id); };
  const rails = async () => { for (const [id, x, y, angle] of refractionRails) { await move(id, { x, y }); await positioned(id, x, y); if ((await item(id)).angle !== angle) await rotate(id, angle); } };
  const mirrors = async (list = refractionMirrors) => { for (const [id, x, y, angle] of list) { await place('mirror', { x, y }); await positioned(id, x, y); if (angle) await rotate(id, angle); } };
  const unlock = async () => { await move('rail-a', sensorPosition); await positioned('rail-a', 12, 2.5); await page.waitForFunction(() => window.__warmLight.state().level.aquarium.gateOpen); };
  const solve = async () => { await unlock(); await rails(); await mirrors(); await page.waitForFunction(() => window.__warmLight.state().won); };
  const shot = suffix => page.screenshot({ path: resolve(`qa/${name}-refraction-${suffix}.png`), fullPage: true });
  const restart = async () => { await pauseAction(page, 'restart'); await dismissStoryOpening(page); assert.equal((await state()).level.aquarium.gateOpen, false); assert.equal((await state()).won, false); };
  const pitch = async value => { await page.locator('#open-settings').click(); await page.locator('#pitch').fill(String(value)); await page.locator('#pitch').dispatchEvent('input'); await page.locator('#done-settings').click(); };
  try {
    await page.goto(`${url}/?level=13`, { waitUntil: 'networkidle' }); await dismissStoryOpening(page);
    await page.waitForFunction(() => window.__warmLight);
    assert.equal((await state()).level.number, 13); assert.match(await page.title(), /第三章第3关/);
    assert.equal(await page.locator('.level-navigation').count(), 0);
    assert.equal(await page.locator('#refraction-status').evaluate(element => !element.hidden), true);
    assert.equal(await page.locator('#fusion-status').evaluate(element => !element.hidden), false);
    assert.equal((await state()).atmosphere.aquarium.tankSize, 3);
    assert.equal((await state()).atmosphere.aquarium.fish, 5);
    assert.equal((await state()).atmosphere.aquarium.rainbowVisible, false);
    assert.equal((await state()).refraction.events.length, 2);
    assert.ok(Math.abs((await state()).refraction.events[0].incident - 53.13010235) < .00001);
    await shot('initial'); verified.push('direct-level13-and-navigation', '15x15-pale-blue-white-scene', '3x3-glass-tank-five-fish-clouds', 'two-real-snell-interfaces', 'no-rainbow-or-fusion-panel');

    for (const id of ['sensor', 'gate', 'fixed-launch', 'observe-a', 'lab-block-0']) { const before = await item(id); await move(id, { x: 1, y: 1 }); assert.deepEqual(await item(id), before); }
    await place('mirror', { x: 8, y: 7 }); assert.equal((await item('mirror')).inInventory, true);
    await place('mirror', { x: 12, y: 4 }); assert.equal((await item('mirror')).inInventory, true);
    const initialA = await item('rail-a'); await store('rail-a'); assert.deepEqual(await item('rail-a'), initialA);
    const a = await itemPoint('rail-a'), target = await point(sensorPosition, .62);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 12 });
    await page.waitForTimeout(800); assert.ok((await state()).refraction.sensorPower > .2);
    assert.equal((await state()).level.aquarium.gateOpen, false);
    await page.keyboard.press('Escape'); await page.mouse.up(); assert.deepEqual(await item('rail-a'), initialA);
    verified.push('fixed-nodes-and-obstacles-locked', 'tank-and-track-placement-reserved', 'rail-cannot-enter-inventory', 'sensor-preview-cannot-open-door', 'escape-restores-rail-position');

    await unlock(); await page.waitForFunction(() => window.__warmLight.state().atmosphere.aquarium.gateLift > 1);
    assert.equal((await state()).won, false); await shot('door-open');
    await move('rail-a', { x: 12, y: 4 }); assert.equal((await state()).level.aquarium.gateOpen, true);
    verified.push('actual-sensor-charge-opens-and-raises-door', 'door-latches-when-sensor-goes-dark');

    await rails(); await mirrors(refractionMirrors.slice(0, -1));
    const partial = await state(); assert.equal(partial.refraction.rails.length, 4); assert.equal(partial.refraction.observations.length, 2); assert.equal(partial.refraction.gateCrossed, true);
    await page.waitForTimeout(750); assert.equal((await state()).won, false); assert.equal((await state()).atmosphere.aquarium.celebrating, false);
    await shot('relay-incomplete'); verified.push('four-rails-and-both-observations-still-require-delivery', 'light-actually-crosses-open-door');

    await place('mirror', { x: 15, y: 12 }); await rotate('mirror-5', 90);
    const start = await itemPoint('mirror-5'), end = await point({ x: 15, y: 10 }, .62);
    await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.waitForTimeout(800); assert.equal((await state()).ready, true); assert.equal((await state()).won, false); assert.equal((await state()).atmosphere.aquarium.celebrating, false);
    await page.mouse.up(); await page.waitForFunction(() => window.__warmLight.state().won);
    assert.ok(Math.abs((await state()).qualifiedReceived.beacon - .21905788816934813) < 1e-8);
    assert.equal((await state()).refraction.delivered, true); assert.equal((await state()).atmosphere.aquarium.celebrating, true);
    await page.locator('#continue').click(); await shot('victory');
    verified.push('drag-preview-cannot-win-or-celebrate', 'committed-two-stage-puzzle-wins', '21-percent-energy-after-ten-reflections', 'aquarium-celebration-only-after-victory');

    await restart(); assert.equal((await item('rail-a')).y, 5); assert.equal((await item('rail-d')).x, 6);
    assert.ok((await state()).level.items.filter(i => i.movable && !i.rail).every(i => i.inInventory));
    assert.equal((await state()).atmosphere.aquarium.celebrating, false);
    await rails(); await mirrors(); assert.equal((await state()).blocked.includes('gate'), true); assert.equal((await state()).ready, false);
    verified.push('restart-resets-door-rails-inventory-and-celebration', 'closed-door-physically-blocks-completed-network');

    await restart();
    for (let h = 1; h <= 4; h++) { await useHint(page); const text = await page.locator('#hint-content').innerText(); if (h < 4) assert.doesNotMatch(text, /\(\d+,\d/); else assert.match(text, /\(12,2.5\)/); }
    verified.push('four-hints-only-last-reveals-positions');
    await restart();
    for (const value of [30, 85]) { await pitch(value); await move('rail-a', sensorPosition); await positioned('rail-a', 12, 2.5); await move('rail-a', { x: 12, y: 5 }); await positioned('rail-a', 12, 5); }
    await pitch(53);
    const blank = await point({ x: 1, y: 6 }); await drag(blank, { x: blank.x + 65, y: blank.y }); assert.ok(Math.abs((await state()).view.rotation) > .2);
    await move('rail-d', { x: 9.5, y: 10.75 }); await positioned('rail-d', 9.5, 10.75);
    await page.locator('#reset-view').click();
    await move('rail-a', { x: 12, y: 1 }); await positioned('rail-a', 12, 1.5);
    await move('rail-a', { x: 12, y: 7 }); await positioned('rail-a', 12, 5.5);
    await move('rail-a', { x: 10, y: 4.2 }); await positioned('rail-a', 12, 4);
    await rotate('rail-a', 135); const q = await itemPoint('rail-a'); await page.mouse.click(q.x, q.y); await page.keyboard.press('e'); assert.equal((await item('rail-a')).angle, 0);
    await place('mirror', { x: 4, y: 7 }); await rotate('mirror', 90); await store('mirror'); assert.equal((await item('mirror')).inInventory, true); await place('mirror', { x: 4, y: 7 }); assert.equal((await item('mirror')).angle, 90);
    verified.push('rail-drag-at30-and85-degrees', 'fractional-rail-drag-after-board-rotation', 'half-step-snap-and-both-end-stops', 'off-track-drag-projects-to-track', 'rail-right-click-and-q-e', 'ordinary-mirror-storage-preserves-angle');

    await selectLevel(page, 10); await dismissStoryOpening(page); assert.equal(await page.locator('#refraction-status').evaluate(element => !element.hidden), false); assert.equal((await state()).atmosphere.aquarium, undefined);
    for (const [kind, id, x, y, angle] of fusionSolution) { await place(kind, { x, y }); await positioned(id, x, y); if (angle) await rotate(id, angle); }
    await page.waitForFunction(() => window.__warmLight.state().won); await page.locator('#next-level').click(); await dismissStoryOpening(page); assert.equal((await state()).level.number, 13);
    await unlock(); await selectLevel(page, 2); await dismissStoryOpening(page); assert.equal((await state()).atmosphere.aquarium, undefined);
    await page.goBack(); await dismissStoryOpening(page); assert.equal((await state()).level.number, 13); assert.equal((await state()).level.aquarium.gateOpen, false);
    await page.goForward(); await dismissStoryOpening(page); assert.equal((await state()).level.number, 2); await selectLevel(page, 13); await dismissStoryOpening(page);
    verified.push('prior-fusion-level-still-wins', 'fusion-next-button-enters-refraction', 'other-themes-clean-up-tank-and-rails', 'history-resets-door-and-puzzle');

    for (const viewport of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(200);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight));
      for (const selector of ['#toggle-inventory', '#toggle-inventory', '[data-kind="mirror"]', '#inventory', '#return-home']) { const box = await page.locator(selector).boundingBox(); assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${selector} outside ${viewport.width}`); }
      const returnBox = await page.locator('#inventory').boundingBox(), card = await page.locator('#inventory').boundingBox(); assert.ok(returnBox.y + returnBox.height <= card.y + card.height + 1);
      await shot(String(viewport.width)); verified.push(`layout-${viewport.width}`);
    }
    await solve(); await page.locator('#continue').click(); await shot('mobile-victory'); verified.push('mobile-complete-puzzle-with-real-drags');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await restart(); await solve(); assert.equal((await state()).atmosphere.aquarium.gateLift, 1.15); await page.locator('#continue').click(); await shot('reduced-motion'); verified.push('reduced-motion-complete-puzzle-and-door');
    assert.deepEqual(errors, []); assert.deepEqual(remoteRequests, []); verified.push('zero-browser-errors', 'offline-local-assets');
    reports.push({ browser: name, status: 'passed', errors, remoteRequests, environmentRequests, verified }); console.log(`${name}: ${verified.length} refraction browser checks passed`);
  } catch (error) {
    await shot('failure').catch(() => {}); const snapshot = await state().catch(() => null);
    console.error(name, JSON.stringify(snapshot && { level: snapshot.level, refraction: snapshot.refraction, won: snapshot.won, ready: snapshot.ready, dragging: snapshot.dragging })); throw error;
  } finally { await browser.close(); }
}
await writeFile('qa/refraction-report.json', JSON.stringify(reports, null, 2));
