import { pauseAction, useHint } from './browser-environment.mjs';
import { prepareDebugNavigation, selectLevel } from './browser-environment.mjs';
import { dismissStoryOpening } from './browser-environment.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { forestVisible } from '../src/forest-path.ts';

const url = process.env.GAME_URL || 'http://127.0.0.1:4177';
const evidence = resolve('qa'); await mkdir(evidence, { recursive: true });
const solution = [['mirror', 2, 7, 135], ['mirror-2', 5, 7, 45], ['mirror-3', 5, 8, 45], ['mirror-4', 9, 5, 45], ['mirror-5', 6, 5, 45], ['mirror-6', 6, 2, 135]];
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
  const forest = async () => (await state()).atmosphere.forest;
  const item = async id => (await state()).level.items.find(item => item.id === id);
  const count = () => page.locator('[data-count="mirror"]').textContent().then(Number);
  const point = (position, height = 0.2) => page.evaluate(({ position, height }) => window.__warmLight.screenPoint(position, height), { position, height });
  const itemPoint = id => page.evaluate(id => window.__warmLight.itemPoint(id), id);
  const center = async locator => { await locator.scrollIntoViewIfNeeded(); const b = await locator.boundingBox(); assert.ok(b); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const startDrag = async (start, end) => { await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 14 }); };
  const place = async position => { await startDrag(await center(page.locator('[data-kind="mirror"] .item-thumbnail')), await point(position)); await page.mouse.up(); };
  const rotate = async (id, angle) => {
    const p = await itemPoint(id); await page.mouse.click(p.x, p.y, { button: 'right' });
    await page.locator(`#rotation-menu [data-angle="${angle}"]`).click();
    assert.equal((await item(id)).angle, angle);
  };
  const put = async ([id, x, y, angle]) => {
    assert.ok((await forest()).visibleCells.includes(`${x},${y}`), `${id} placement should be visible`);
    await place({ x, y }); assert.equal((await item(id)).inInventory, false); await rotate(id, angle);
  };
  const shot = async suffix => { await page.waitForTimeout(150); await page.screenshot({ path: resolve(evidence, `${name}-forest-${suffix}.png`), fullPage: true }); };
  const verifyMask = async () => {
    const s = await state(), expected = [];
    for (let y = 1; y <= 9; y++) for (let x = 1; x <= 9; x++) if (forestVisible(s.level, { segments: s.beamPaths }, { x, y })) expected.push(`${x},${y}`);
    assert.deepEqual(s.atmosphere.forest.visibleCells, expected);
  };
  try {
    await page.goto(`${url}/?level=5`, { waitUntil: 'networkidle' }); await dismissStoryOpening(page);
    await selectLevel(page, 8); await dismissStoryOpening(page); await page.waitForTimeout(250);
    assert.equal((await state()).level.chapterLevel, 3); assert.equal((await state()).level.size, 9);
    assert.equal(await count(), 6); assert.equal((await state()).atmosphere.street, undefined);
    assert.equal(await page.locator('body').getAttribute('data-setting'), 'forest');
    assert.match(await page.title(), /第二章第3关/); assert.match(await page.locator('.board-label').innerText(), /9 × 9/);
    assert.equal((await forest()).cabinLit, false); assert.equal((await forest()).windowGlow, 0.025);
    assert.ok((await forest()).visibleCells.length < 30); await verifyMask();
    assert.equal(await page.locator('[data-item="fixed-forest"]').isVisible(), false);
    await shot('initial');
    verified.push('breakfast-preserved-forest-third-level', '9x9-six-mirrors-two-fixed', 'campfire-and-moonlit-cabin', 'initial-majority-hidden', 'no-hidden-labels', 'exact-one-cell-mask');

    const hidden = await itemPoint('fixed-forest'); await page.mouse.click(hidden.x, hidden.y, { button: 'right' });
    assert.equal(await page.locator('#rotation-menu').isVisible(), false);
    await place({ x: 5, y: 4 }); assert.equal(await count(), 6);
    await place({ x: 2, y: 8 }); assert.equal(await count(), 6);
    const fixed = await item('fixed'), p = await itemPoint('fixed');
    await startDrag(p, await point({ x: 3, y: 8 })); await page.mouse.up(); assert.deepEqual(await item('fixed'), fixed);
    verified.push('hidden-picking-rejected', 'dark-and-occupied-drops-retain-inventory', 'fixed-mirror-immutable');

    for (let n = 0; n < 4; n++) {
      await useHint(page); const text = await page.locator('#hint-content').innerText();
      if (n < 3) assert.doesNotMatch(text, /\([1-9],[1-9]\)/); else assert.match(text, /\(9,5\)/);
    }
    verified.push('four-hints-coordinates-only-last');
    await pauseAction(page, 'restart'); await dismissStoryOpening(page);
    const initialHero = (await forest()).traveller; await page.waitForTimeout(900);
    const movedHero = (await forest()).traveller;
    assert.ok(Math.hypot(movedHero.x - initialHero.x, movedHero.y - initialHero.y) > 0.15);
    verified.push('traveller-walks-along-current-firelight');

    await put(solution[0]);
    assert.ok((await forest()).visibleCells.includes('5,7')); await verifyMask();
    const opacity = async cell => (await forest()).visibility.find(entry => entry.cell === cell).opacity;
    const rising = await opacity('5,7'); assert.ok(rising > 0 && rising < 1);
    await page.waitForTimeout(200); assert.ok(await opacity('5,7') > rising);
    await page.waitForTimeout(850); assert.equal(await opacity('5,7'), 1);
    await rotate('mirror', 45); assert.equal((await forest()).visibleCells.includes('5,7'), false);
    const falling = await opacity('5,7'); assert.ok(falling > 0 && falling < 1);
    await page.waitForTimeout(200); assert.ok(await opacity('5,7') < falling);
    await verifyMask(); await rotate('mirror', 135);
    await page.waitForTimeout(900); assert.equal(await opacity('5,7'), 1);
    verified.push('smooth-fade-in-and-out', 'fade-reversal-preserves-brightness');
    await put(solution[1]);
    await page.waitForTimeout(600);
    const heroBefore = (await forest()).traveller; await rotate('mirror', 45);
    const heroAfter = (await forest()).traveller;
    assert.ok(Math.hypot(heroAfter.x - heroBefore.x, heroAfter.y - heroBefore.y) < 1.1);
    assert.equal((await forest()).visibleCells.includes('5,7'), false);
    await page.waitForTimeout(950);
    assert.ok((await forest()).recoveryMarkers.some(marker => marker.id === 'mirror-2' && marker.opacity > 0.8));
    const lost = await itemPoint('mirror-2'); await page.mouse.click(lost.x, lost.y, { button: 'right' });
    assert.equal(await page.locator('#rotation-menu [data-angle]').count(), 0);
    await shot('dark-recovery');
    await page.locator('[data-recover="mirror-2"]').click(); assert.equal((await item('mirror-2')).inInventory, true);
    assert.equal((await item('mirror-2')).angle, 45); assert.equal(await count(), 5);
    await rotate('mirror', 135); await put(solution[1]); await rotate('mirror', 45); await page.waitForTimeout(850);
    await startDrag(await itemPoint('mirror-2'), await center(page.locator('#inventory'))); await page.mouse.up();
    assert.equal((await item('mirror-2')).inInventory, true); assert.equal(await count(), 5);
    await rotate('mirror', 135); await put(solution[1]);
    verified.push('light-discovers-next-route', 'old-visibility-clears', 'dark-device-recovery-marker', 'dark-right-click-recovery-retains-angle', 'dark-marker-drag-recovery', 'traveller-retraces-without-teleport');

    for (const fixture of solution.slice(2, 5)) await put(fixture);
    await shot('exploring'); await verifyMask();
    await place({ x: 6, y: 2 }); await rotate('mirror-6', 90);
    // Turning by Q from 90 to 135 commits the last light path, so test preview by moving it first.
    const last = await itemPoint('mirror-6');
    await startDrag(last, await center(page.locator('#inventory'))); await page.mouse.up();
    assert.equal(await count(), 1); assert.equal((await item('mirror-6')).angle, 90);
    await place({ x: 6, y: 2 }); await rotate('mirror-6', 135);
    await page.waitForFunction(() => window.__warmLight.state().won);
    assert.equal((await forest()).cabinLit, true); assert.ok((await forest()).windowGlow > 1);
    assert.ok(Math.abs((await state()).received.beacon - 0.95 ** 8 * 0.16 / 0.42) < 1e-7);
    await shot('won'); await page.locator('#continue').click();
    await page.waitForFunction(() => { const f = window.__warmLight.state().atmosphere.forest; return !f.traveller.moving && Math.abs(f.traveller.x - 8) < 0.01; }, null, { timeout: 35000 });
    await shot('home');
    verified.push('eight-reflections-real-win', 'windows-light-only-after-win', 'traveller-reaches-front-door', 'store-retains-angle');

    await pauseAction(page, 'restart'); await dismissStoryOpening(page); await page.waitForTimeout(120);
    assert.equal(await count(), 6); assert.equal((await state()).won, false); assert.equal((await forest()).cabinLit, false);
    assert.equal((await forest()).windowGlow, 0.025); assert.equal((await state()).level.number, 8); await verifyMask();
    // Prepare the last mirror in a different bright cell, where its angle cannot complete the route.
    for (const fixture of solution.slice(0, 5)) await put(fixture);
    await place({ x: 6, y: 3 }); await rotate('mirror-6', 135);
    const inventoryEnd = await center(page.locator('#inventory'));
    await startDrag(await itemPoint('mirror-6'), inventoryEnd); await page.mouse.up();
    assert.equal((await state()).won, false);
    await startDrag(await center(page.locator('[data-kind="mirror"] .item-thumbnail')), await point({ x: 6, y: 2 }));
    await page.waitForTimeout(900);
    assert.equal((await state()).ready, true); assert.equal((await state()).won, false); assert.equal((await forest()).cabinLit, false);
    await page.keyboard.press('Escape'); await page.mouse.up(); assert.equal(await count(), 1);
    assert.equal((await state()).won, false); assert.equal((await forest()).cabinLit, false);
    verified.push('restart-restores-darkness-and-inventory', 'winning-preview-does-not-light-cabin', 'escape-cancels-without-loss');

    // Full completion on a narrow screen, with the same real drag / context-menu controls.
    await pauseAction(page, 'restart'); await dismissStoryOpening(page); await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    for (const fixture of solution) await put(fixture);
    await page.waitForFunction(() => window.__warmLight.state().won); await shot('mobile-won');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight), false);
    verified.push('390x844-full-interactive-completion');

    await page.setViewportSize({ width: 1366, height: 768 }); await pauseAction(page, 'restart'); await dismissStoryOpening(page);
    for (const pitch of [30, 85]) {
      await page.locator('#open-settings').click();
      await page.locator('#pitch').evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }, String(pitch));
      await page.locator('#done-settings').click(); await put(solution[0]);
      await pauseAction(page, 'restart'); await dismissStoryOpening(page);
    }
    const canvas = page.locator('.scene canvas'), bounds = await canvas.boundingBox();
    await startDrag({ x: bounds.x + bounds.width * 0.45, y: bounds.y + bounds.height * 0.72 }, { x: bounds.x + bounds.width * 0.65, y: bounds.y + bounds.height * 0.72 }); await page.mouse.up();
    await put(solution[0]); await shot('rotated');
    verified.push('30-and-85-degree-dragging', 'rotated-view-dragging');
    await selectLevel(page, 5); await dismissStoryOpening(page); assert.equal((await state()).atmosphere.forest, undefined); assert.ok((await state()).atmosphere.street);
    await page.goBack(); await dismissStoryOpening(page); assert.equal((await state()).level.number, 8); assert.equal((await state()).won, false);
    await selectLevel(page, 7); await dismissStoryOpening(page); assert.equal((await state()).atmosphere.forest, undefined); assert.equal((await state()).level.theme, 'experiment');
    verified.push('chapter-switch-cleans-forest', 'browser-history-resets-forest', 'experiment-preserved');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await selectLevel(page, 8); await dismissStoryOpening(page);
    for (const fixture of solution) await put(fixture);
    await page.waitForFunction(() => window.__warmLight.state().won);
    assert.equal((await forest()).cabinLit, true); assert.equal((await forest()).traveller.moving, false);
    assert.ok(Math.abs((await forest()).traveller.x - 8) < 0.01);
    verified.push('reduced-motion-reaches-home');
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    verified.push('no-console-errors-or-remote-assets');
    reports.push({ browser: name, checks: verified.length, verified, errors, remote }); console.log(`${name}: ${verified.length} forest checks passed`);
  } catch (error) {
    await page.screenshot({ path: resolve(evidence, `${name}-forest-failure.png`), fullPage: true });
    reports.push({ browser: name, verified, errors, error: String(error) }); throw error;
  } finally {
    await writeFile(resolve(evidence, 'forest-report.json'), JSON.stringify(reports, null, 2)); await browser.close();
  }
}
