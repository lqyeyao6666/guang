import { pauseAction, useHint } from './browser-environment.mjs';
import { prepareDebugNavigation, selectLevel } from './browser-environment.mjs';
import { dismissStoryOpening } from './browser-environment.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const url = process.env.GAME_URL || 'http://127.0.0.1:4177', evidence = resolve('qa');
await mkdir(evidence, { recursive: true });
const solution = [['mirror', 2, 9, 45], ['mirror-2', 5, 9, 135], ['mirror-3', 5, 8, 135], ['mirror-4', 7, 8, 135], ['mirror-5', 7, 5, 45], ['mirror-6', 4, 5, 45], ['mirror-7', 4, 2, 135]];
const reports = [];
for (const [name, executablePath] of [['chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'], ['edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']]) {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await prepareDebugNavigation(page);
  const verified = [], errors = [], remote = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith(url) && !request.url().startsWith('data:')) remote.push(request.url()); });
  const state = () => page.evaluate(() => window.__warmLight.state());
  const story = async () => (await state()).atmosphere.rural;
  const item = async id => (await state()).level.items.find(item => item.id === id);
  const count = kind => page.locator(`[data-count="${kind}"]`).textContent().then(Number);
  const point = (position, height = 0.2) => page.evaluate(({ position, height }) => window.__warmLight.screenPoint(position, height), { position, height });
  const itemPoint = id => page.evaluate(id => window.__warmLight.itemPoint(id), id);
  const center = async locator => { await locator.scrollIntoViewIfNeeded(); const b = await locator.boundingBox(); assert.ok(b); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const startDrag = async (a, b) => { await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 16 }); };
  const drag = async (a, b) => { await startDrag(a, b); await page.mouse.up(); };
  const place = async (kind, position) => drag(await center(page.locator(`[data-kind="${kind}"] .item-thumbnail`)), await point(position));
  const store = async id => drag(await itemPoint(id), await center(page.locator('#inventory')));
  const clickItem = async (id, button = 'left') => { const p = await itemPoint(id); await page.mouse.click(p.x, p.y, { button }); };
  const rotate = async (id, angle) => { await clickItem(id, 'right'); await page.locator(`#rotation-menu [data-angle="${angle}"]`).click(); assert.equal((await item(id)).angle, angle); };
  const mirrors = async () => { for (const [id, x, y, angle] of solution) { await place('mirror', { x, y }); assert.equal((await item(id)).inInventory, false); await rotate(id, angle); } };
  const home = async id => { await clickItem(id); await page.waitForFunction(id => { const cow = window.__warmLight.state().level.items.find(item => item.id === id); return !cow.herdPath && cow.x === cow.home.x && cow.y === cow.home.y; }, id, { timeout: 25000 }); };
  const clear = async () => { for (const id of ['hay-1', 'hay-2', 'hay-3']) await store(id); await home('cow-flower'); await home('cow-brown'); };
  const shot = async suffix => { await page.waitForTimeout(180); await page.screenshot({ path: resolve(evidence, `${name}-rural-${suffix}.png`), fullPage: true }); };
  try {
    await page.goto(`${url}/?level=8`, { waitUntil: 'networkidle' }); await dismissStoryOpening(page);
    for (const [id, x, y, angle] of [['mirror', 2, 7, 135], ['mirror-2', 5, 7, 45], ['mirror-3', 5, 8, 45], ['mirror-4', 9, 5, 45], ['mirror-5', 6, 5, 45], ['mirror-6', 6, 2, 135]]) { await place('mirror', { x, y }); await rotate(id, angle); }
    await page.waitForFunction(() => window.__warmLight.state().won); await page.locator('#next-level').click(); await dismissStoryOpening(page);
    assert.equal((await state()).level.number, 9); assert.equal((await state()).level.chapterLevel, 4);
    assert.equal((await state()).level.size, 9); assert.equal(await count('mirror'), 7); assert.equal(await count('concaveLens'), 1);
    assert.equal((await state()).atmosphere.forest, undefined); assert.equal((await story()).audience, 10);
    assert.equal((await story()).audiencePhase, 'chatting-and-playing'); assert.equal((await story()).filmPlaying, false);
    assert.equal((await story()).cowsHome, 0); assert.match(await page.title(), /第二章第4关/);
    assert.match(await page.locator('.receiver-card .eyebrow').innerText(), /电影幕布/); await shot('initial');
    verified.push('forest-next-to-rural', '9x9-seven-mirrors-concave-lens', 'village-models-not-generic-blocks', 'ten-villagers-chat-and-play', 'initial-no-film');

    await clickItem('cow-flower'); assert.equal((await item('cow-flower')).herdPath, undefined);
    const beforeHay = await item('hay-1'); await drag(await itemPoint('hay-1'), await point({ x: 2, y: 5 }, 0.62));
    assert.deepEqual(await item('hay-1'), beforeHay);
    await startDrag(await itemPoint('hay-3'), await center(page.locator('#inventory'))); await page.keyboard.press('Escape'); await page.mouse.up();
    assert.equal((await item('hay-3')).inInventory, undefined);
    await drag(await itemPoint('hay-1'), await point({ x: 3, y: 4 }, 0.62)); assert.equal((await item('hay-1')).x, 3);
    await store('hay-1'); await clickItem('hay-2', 'right'); assert.equal(await page.locator('#rotation-menu [data-angle]').count(), 0);
    await page.locator('[data-recover="hay-2"]').click(); await store('hay-3');
    assert.equal(await count('hay'), 3); assert.equal(await page.locator('#hay-progress').innerText(), '3/3');
    verified.push('blocked-herding-rejected', 'hay-occupied-drop-restores', 'hay-escape-cancels', 'hay-real-move-and-storage', 'hay-cannot-rotate', 'three-hay-counter');

    await clickItem('cow-brown'); assert.equal((await item('cow-brown')).herdPath, undefined);
    await clickItem('cow-flower'); assert.ok((await item('cow-flower')).herdPath);
    const first = await item('cow-flower'); await page.waitForTimeout(160); const moved = await item('cow-flower');
    assert.ok(Math.hypot(first.x - moved.x, first.y - moved.y) > 0.02); assert.ok(Math.hypot(first.x - moved.x, first.y - moved.y) < 0.9);
    await place('mirror', { x: 6, y: 5 }); assert.equal(await count('mirror'), 7);
    await page.locator('#open-settings').click(); const paused = await item('cow-flower'); await page.waitForTimeout(400);
    assert.equal((await item('cow-flower')).x, paused.x); assert.equal((await item('cow-flower')).y, paused.y);
    await page.locator('#done-settings').click(); await shot('herding');
    await page.waitForFunction(() => window.__warmLight.state().atmosphere.rural.cowsHome === 1, null, { timeout: 25000 });
    await clickItem('cow-brown', 'right'); await page.locator('[data-herd="cow-brown"]').click();
    await page.waitForFunction(() => window.__warmLight.state().atmosphere.rural.cowsHome === 2, null, { timeout: 25000 });
    assert.equal(await page.locator('#cow-progress').innerText(), '2/2');
    verified.push('cow-order-needs-open-passage', 'cow-walk-continuous', 'herd-path-reserved-against-placement', 'settings-pauses-herding', 'click-and-context-herd-controls', 'both-cows-reach-own-pen-slots');

    for (let n = 0; n < 4; n++) { await useHint(page); const h = await page.locator('#hint-content').innerText(); if (n < 3) assert.doesNotMatch(h, /\([1-9],[1-9]\)/); else assert.match(h, /\(6,2\)/); }
    await mirrors(); await page.waitForTimeout(800);
    assert.ok((await state()).received.beacon > 0.57); assert.equal((await state()).ready, false);
    assert.equal((await story()).filmPlaying, false); assert.equal((await story()).audiencePhase, 'chatting-and-playing');
    verified.push('four-hints-only-last-has-coordinates', 'bright-narrow-light-cannot-win');

    await place('concaveLens', { x: 6, y: 5 }); await rotate('concave', 0); assert.equal((await state()).ready, false);
    await store('concave'); assert.equal((await item('concave')).angle, 0);
    await startDrag(await center(page.locator('[data-kind="concaveLens"] .item-thumbnail')), await point({ x: 6, y: 2 }));
    await page.waitForTimeout(900); assert.equal((await state()).ready, true); assert.equal((await state()).won, false);
    assert.equal((await story()).filmPlaying, false); assert.equal((await story()).seatProgress, 0); await shot('preview');
    await page.mouse.up(); await page.waitForFunction(() => window.__warmLight.state().won);
    await page.waitForFunction(() => window.__warmLight.state().atmosphere.rural.audiencePhase === 'watching');
    assert.ok(Math.abs((await state()).received.beacon - 0.5812826636056546) < 1e-7);
    assert.equal(await page.locator('#screen-progress').innerText(), '100%'); assert.equal((await story()).filmPlaying, true);
    await page.locator('#continue').click(); await page.waitForTimeout(350); await shot('watching');
    verified.push('concave-angle-stored', 'winning-preview-neither-seats-nor-projects', 'committed-full-width-projection-wins', 'all-ages-sit-on-ground', 'animated-film-plays');

    await pauseAction(page, 'restart'); await dismissStoryOpening(page); assert.equal((await state()).level.number, 9); assert.equal((await story()).cowsHome, 0);
    assert.equal((await story()).filmPlaying, false); assert.equal((await story()).seatProgress, 0);
    assert.equal(await count('mirror'), 7); assert.equal(await count('concaveLens'), 1); assert.equal(await count('hay'), 0);
    verified.push('restart-restores-cows-hay-film-and-inventory');

    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 390, height: 844 });
    await clear(); await mirrors(); await place('concaveLens', { x: 6, y: 2 }); await rotate('concave', 0);
    await page.waitForFunction(() => window.__warmLight.state().won); assert.equal((await story()).seatProgress, 1);
    await shot('mobile-watching'); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight), false);
    verified.push('390x844-full-interactive-completion', 'reduced-motion-ends-seated');
    await page.locator('#next-level').click(); await dismissStoryOpening(page); assert.equal((await state()).level.number, 12);
    assert.ok((await state()).atmosphere.school); await selectLevel(page, 7); await dismissStoryOpening(page);
    assert.equal((await state()).atmosphere.rural, undefined); assert.ok((await state()).atmosphere.experiment);
    await page.goBack(); await dismissStoryOpening(page); assert.equal((await state()).level.number, 12); await page.goBack(); await dismissStoryOpening(page); assert.equal((await state()).level.number, 9); assert.equal((await story()).filmPlaying, false);
    await selectLevel(page, 5); await dismissStoryOpening(page); assert.ok((await state()).atmosphere.street); assert.equal((await state()).atmosphere.rural, undefined);
    verified.push('rural-next-to-school', 'history-restores-uncompleted-rural', 'street-preserved');
    await selectLevel(page, 9); await dismissStoryOpening(page); await page.setViewportSize({ width: 1366, height: 768 });
    for (const pitch of [30, 85]) {
      await page.locator('#open-settings').click(); await page.locator('#pitch').evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }, String(pitch));
      await page.locator('#done-settings').click(); await store('hay-3'); assert.equal(await count('hay'), 1); await pauseAction(page, 'restart'); await dismissStoryOpening(page);
    }
    const blank = await point({ x: 4, y: 9 }); await drag(blank, { x: blank.x + 90, y: blank.y });
    assert.ok(Math.abs((await state()).view.rotation) > 0.2); await store('hay-3'); assert.equal(await count('hay'), 1);
    await shot('rotated'); verified.push('30-and-85-degree-hay-drag', 'rotated-view-hay-drag');
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1024, height: 768 }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true);
      await shot(String(viewport.width)); verified.push(`layout-${viewport.width}`);
    }
    assert.deepEqual(errors, []); assert.deepEqual(remote, []); verified.push('no-console-errors-or-remote-assets');
    reports.push({ browser: name, checks: verified.length, verified, errors, remote }); console.log(`${name}: ${verified.length} rural checks passed`);
  } catch (error) {
    await shot('failure').catch(() => {}); reports.push({ browser: name, verified, errors, error: String(error) }); throw error;
  } finally { await writeFile(resolve(evidence, 'rural-report.json'), JSON.stringify(reports, null, 2)); await browser.close(); }
}
