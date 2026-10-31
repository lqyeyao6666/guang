import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { levelSummaries } from '../src/level.ts';
import { isolateBrowserEnvironment, isEnvironmentRequest, prepareDebugNavigation, dismissStoryOpening, pauseAction } from './browser-environment.mjs';

const url = process.env.GAME_URL || 'http://127.0.0.1:4177';
await mkdir('qa', { recursive: true });
const reports = [];
for (const [name, executablePath] of [
  ['chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'],
  ['edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
]) {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  const environmentRequests = await isolateBrowserEnvironment(page); await prepareDebugNavigation(page);
  const errors = [], remote = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !isEnvironmentRequest(message.location().url)) errors.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith(url) && !request.url().startsWith('data:') && !isEnvironmentRequest(request.url())) remote.push(request.url()); });
  const state = () => page.evaluate(() => window.__warmLight.state());
  const go = async number => {
    await page.goto(`${url}/?level=${number}`, { waitUntil: 'networkidle' });
    await dismissStoryOpening(page);
    if (await page.locator('#layer-guide').isVisible()) await page.locator('#dismiss-layer-guide').click();
  };
  const box = selector => page.locator(selector).boundingBox();
  const center = async selector => { await page.locator(selector).scrollIntoViewIfNeeded(); const b = await box(selector); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const point = target => page.evaluate(target => window.__warmLight.screenPoint(target), target);
  const itemPoint = id => page.evaluate(id => window.__warmLight.itemPoint(id), id);
  const drag = async (from, to) => { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 18 }); await page.mouse.up(); };
  const shot = suffix => page.screenshot({ path: resolve('qa', `${name}-hud-${suffix}.png`) });
  const inside = async selector => {
    const b = await box(selector), size = page.viewportSize();
    assert.ok(b && b.x >= -1 && b.y >= -1 && b.x + b.width <= size.width + 1 && b.y + b.height <= size.height + 1, `${selector} clipped at ${size.width}x${size.height}`);
  };
  try {
    await go(1);
    const scene = await box('#scene'), canvas = await box('#scene canvas');
    assert.deepEqual([scene.x, scene.y, scene.width, scene.height], [0, 0, 1440, 1000]);
    assert.equal(canvas.width, 1440); assert.equal(canvas.height, 1000);
    assert.equal(await page.locator('.sidebar').count(), 0);
    assert.equal(await page.locator('#scene #hint').count(), 0);
    assert.equal(await page.locator('#settings-dialog #hint').count(), 1);
    assert.equal(await page.locator('#settings-dialog #restart').count(), 1);
    assert.equal(await page.locator('#settings-dialog #return-home').count(), 1);
    assert.equal(await page.locator('#inventory .inventory-name').first().isVisible(), false);
    assert.equal(await page.locator('#inventory [data-kind]:visible').count(), 3);
    assert.equal(await page.locator('#brightness-goal').innerText(), '30%');
    assert.equal(await page.locator('#brightness-current').innerText(), '0%');
    await shot('garden-1440');
    checks.push('full-window-scene', 'sidebar-removed', 'compact-icons-and-counts', 'threshold-line', 'pause-menu-actions', 'no-inspiration-on-board');

    const before = await point({ x: 5, y: 2 });
    await page.locator('#toggle-inventory').click();
    assert.equal(await page.locator('#toggle-inventory').getAttribute('aria-expanded'), 'true');
    assert.ok(await page.locator('[data-kind="mirror"] .item-description').isVisible());
    assert.equal(await page.locator('#inventory-details').isVisible(), true);
    assert.deepEqual(await point({ x: 5, y: 2 }), before, 'opening tray never moves optical coordinates');
    await shot('expanded-1440');
    await drag(await center('[data-kind="mirror"] .item-thumbnail'), before);
    assert.equal(await page.locator('#toggle-inventory').getAttribute('aria-expanded'), 'false');
    assert.equal((await state()).level.items.find(i => i.id === 'mirror').inInventory, false);
    let p = await itemPoint('mirror'); await page.mouse.click(p.x, p.y, { button: 'right' }); await page.locator('[data-angle="45"]').click();
    await page.waitForFunction(() => window.__warmLight.state().won);
    assert.equal(await page.locator('#brightness-current').innerText(), '34%');
    assert.equal(await page.locator('#brightness').getAttribute('data-ready'), 'true');
    await page.locator('#continue').click();
    await drag(await itemPoint('mirror'), await center('#inventory'));
    assert.equal((await state()).level.items.find(i => i.id === 'mirror').inInventory, true);
    assert.equal((await state()).level.items.find(i => i.id === 'mirror').angle, 45);
    await drag(await center('[data-kind="mirror"]'), await center('#open-settings'));
    assert.equal((await state()).level.items.find(i => i.id === 'mirror').inInventory, true, 'HUD drop is invalid');
    checks.push('expanded-descriptions', 'expand-does-not-move-board', 'expanded-drag-auto-collapses', 'real-win-updates-brightness', 'compact-tray-recovery-keeps-angle', 'hud-drop-rejected');

    await page.locator('#open-settings').click();
    const zoom = (await state()).view.zoom; await page.mouse.wheel(0, -200); assert.equal((await state()).view.zoom, zoom);
    await page.locator('#return-home').click();
    assert.equal(await page.locator('#start-screen').isVisible(), true);
    await page.locator('#home-settings').click(); assert.equal(await page.locator('#pause-actions').isVisible(), false); await page.locator('#done-settings').click();
    await page.locator('#start-game').click(); await pauseAction(page, 'restart'); await dismissStoryOpening(page);
    assert.equal((await state()).won, false); assert.equal((await state()).level.items.find(i => i.id === 'mirror').inInventory, true);
    checks.push('settings-pauses-zoom', 'return-home-and-resume', 'home-settings-no-puzzle-actions', 'restart-in-settings');

    for (const size of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size);
      for (const entry of (size.width === 390 ? levelSummaries : levelSummaries.filter(e => [1, 4, 11, 3, 14, 15].includes(e.number)))) {
        await go(entry.number);
        for (const selector of ['#inventory', '#toggle-inventory', '#open-settings', '#brightness', '#read-story', '#reset-view']) await inside(selector);
        const game = await box('#scene'); assert.equal(game.width, size.width); assert.equal(game.height, size.height);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight), true);
        assert.equal(await page.locator('#brightness-goal').innerText(), `${Math.round((await state()).level.threshold * 100)}%`);
        const expandedBefore = (await state()).view;
        await page.locator('#toggle-inventory').click(); await inside('#inventory');
        assert.deepEqual((await state()).view, expandedBefore);
        const visibleDescriptions = page.locator('[data-kind]:visible .item-description'); assert.ok(await visibleDescriptions.count() > 0);
        if ([1, 3, 15].includes(entry.number)) await shot(`expanded-${entry.number}-${size.width}`);
        await page.locator('#toggle-inventory').click();
        if ([1, 3, 15].includes(entry.number)) await shot(`level-${entry.number}-${size.width}`);
      }
      checks.push(`collapsed-expanded-and-full-canvas-${size.width}x${size.height}`);
    }
    await page.setViewportSize({ width: 390, height: 844 }); await go(15);
    const last = page.locator('[data-kind="lens"]');
    await page.locator('#inventory-next').click(); await page.locator('#inventory-next').click();
    await last.scrollIntoViewIfNeeded(); await inside('[data-kind="lens"]');
    assert.ok(await page.locator('#quantum-controls').isVisible());
    await page.locator('#toggle-inventory').click(); assert.ok(await page.locator('#quantum-status').isVisible());
    await page.locator('#toggle-inventory').click();
    await go(14); assert.ok(await page.locator('#photo-controls').isVisible());
    await page.locator('[data-wavelength="460"]').click(); assert.equal((await state()).level.photoelectric.wavelengthNm, 460);
    await go(4); await page.locator('#show-layer-guide').click(); await page.locator('#edit-upper').click(); assert.equal((await state()).layers.active, 1);
    checks.push('mobile-inventory-paging', 'quantum-records-and-expanded-readout', 'photo-controls-usable', 'layer-guide-target-still-interactive');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await go(1); await page.locator('#toggle-inventory').click(); await inside('#inventory');
    checks.push('reduced-motion-tray');
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    reports.push({ browser: name, status: 'passed', checks, errors, remote, environmentRequests });
    console.log(`${name}: ${checks.length} full-screen HUD checks passed`);
  } catch (error) { await shot('failure').catch(() => {}); throw error; }
  finally { await browser.close(); }
}
await writeFile(resolve('qa/hud-report.json'), JSON.stringify(reports, null, 2));
