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
await mkdir(evidence, { recursive: true });
const reports = [];

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
  const home = () => page.evaluate(() => window.__warmLight.home());
  const game = () => page.evaluate(() => window.__warmLight.state());
  const shot = suffix => page.screenshot({ path: resolve(evidence, `${name}-home-${suffix}.png`), fullPage: true });
  const selectChapter = async index => {
    await page.locator(`[data-home-chapter="${index}"]`).click();
    await page.waitForFunction(() => !window.__warmLight.home().transitioning);
  };
  try {
    await page.goto(url, { waitUntil: 'networkidle' }); await dismissStoryOpening(page);
    await page.waitForFunction(() => window.__warmLight);
    assert.equal((await home()).visible, true);
    assert.equal(await page.locator('.game-layout').isVisible(), false);
    assert.equal(await page.locator('.game-layout').evaluate(element => element.inert), true);
    assert.equal((await game()).level.number, 1);
    assert.equal((await game()).won, false);
    assert.equal((await game()).hold, 0);
    verified.push('default-title-screen', 'underlying-game-inert', 'preview-never-wins-game');
    await shot('garden-1440');

    await page.waitForFunction(() => window.__warmLight.home().chapter === 2, undefined, { timeout: 16000 });
    await page.waitForFunction(() => !window.__warmLight.home().transitioning);
    await shot('night-1440');
    await page.waitForFunction(() => window.__warmLight.home().chapter === 3, undefined, { timeout: 16000 });
    await page.waitForFunction(() => !window.__warmLight.home().transitioning);
    await shot('experiment-1440');
    assert.equal((await home()).preview.experiment.rainbowProgress, 1);
    await page.waitForFunction(() => window.__warmLight.home().chapter === 1, undefined, { timeout: 16000 });
    verified.push('auto-garden-night-experiment-garden', 'soft-crossfade');
    console.log(`${name}: three backgrounds and automatic cycle passed`);

    await page.locator('#home-motion').click();
    const paused = await home();
    await page.waitForTimeout(350);
    assert.equal((await home()).elapsed, paused.elapsed);
    await selectChapter(1);
    assert.equal((await home()).chapter, 2);
    assert.equal((await home()).paused, true);
    verified.push('pause-slideshow', 'manual-chapter-switch-while-paused');

    const beforeSettings = await home();
    const beforeWheel = (await game()).view;
    await page.locator('#home-settings').click();
    assert.equal(await page.locator('#settings-dialog').isVisible(), true);
    await page.locator('#pitch').focus(); await page.locator('#pitch').press('End');
    await page.locator('#rotation-speed').focus(); await page.locator('#rotation-speed').press('End');
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(150);
    assert.equal((await home()).elapsed, beforeSettings.elapsed);
    assert.equal((await game()).view.zoom, beforeWheel.zoom);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#settings-dialog').isVisible(), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'home-settings');
    await page.reload({ waitUntil: 'networkidle' }); await dismissStoryOpening(page);
    assert.equal((await home()).visible, true);
    assert.equal((await game()).view.pitch, 85);
    assert.equal((await game()).view.rotationSpeed, 1.5);
    await page.locator('#home-settings').click();
    await page.locator('#reset-settings').click();
    await page.locator('#done-settings').click();
    verified.push('home-shared-settings', 'settings-save-reload', 'settings-pause-wheel', 'settings-escape-restores-focus', 'settings-reset-defaults');

    await page.locator('#home-controls').click();
    assert.equal(await page.locator('#controls-dialog').isVisible(), true);
    const guideText = await page.locator('#controls-dialog').innerText();
    for (const term of ['Q', 'E', 'Esc', '右键', '物品栏', '滚轮', '空白']) assert.ok(guideText.includes(term), term);
    const guideHome = await home();
    await page.mouse.wheel(0, -200);
    await page.keyboard.press('q'); await page.keyboard.press('e');
    await page.waitForTimeout(250);
    assert.equal((await home()).elapsed, guideHome.elapsed);
    assert.equal((await game()).moves, 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'home-controls');
    await page.locator('#home-controls').click(); await page.locator('#done-controls').click();
    await page.locator('#home-controls').click(); await page.locator('#close-controls').click();
    verified.push('six-control-instructions', 'guide-pauses-background', 'guide-keyboard-isolation', 'guide-escape-focus', 'guide-done-close-buttons');

    const initialView = (await game()).view;
    await page.mouse.move(850, 400); await page.mouse.wheel(0, 150);
    await page.mouse.move(900, 500); await page.mouse.down(); await page.mouse.move(1000, 500); await page.mouse.up();
    assert.deepEqual((await game()).view, initialView);
    assert.equal((await game()).dragging, false);
    verified.push('home-no-game-wheel-or-drag');

    await page.locator('#start-game').focus(); await page.keyboard.press('Enter'); await dismissStoryOpening(page);
    assert.equal((await home()).visible, false);
    assert.equal(new URL(page.url()).searchParams.get('level'), '1');
    assert.equal(await page.locator('.game-layout').isVisible(), true);
    assert.equal(await page.locator('canvas').count(), 1);
    await page.goBack(); await dismissStoryOpening(page); assert.equal((await home()).visible, true);
    await page.goForward(); await dismissStoryOpening(page); assert.equal((await home()).visible, false);
    verified.push('keyboard-start', 'starts-level-one', 'preview-canvases-detached', 'history-home-forward-game');

    const mirrorBox = await page.locator('[data-kind="mirror"] .item-thumbnail').boundingBox();
    const target = await page.evaluate(() => window.__warmLight.screenPoint({ x: 4, y: 2 }));
    await page.mouse.move(mirrorBox.x + mirrorBox.width / 2, mirrorBox.y + mirrorBox.height / 2);
    await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 18 }); await page.mouse.up();
    const placed = (await game()).level.items.find(item => item.id === 'mirror');
    assert.equal(placed.inInventory, false);
    await pauseAction(page, 'return-home');
    assert.equal((await home()).visible, true);
    assert.equal(await page.locator('#start-game span').innerText(), '继续旅程');
    await page.locator('#start-game').click(); await dismissStoryOpening(page);
    assert.deepEqual((await game()).level.items.find(item => item.id === 'mirror'), placed);
    verified.push('game-drag-after-start', 'return-home', 'resume-preserves-layout');

    await page.goto(`${url}/?level=4`, { waitUntil: 'networkidle' }); await dismissStoryOpening(page);
    assert.equal((await home()).visible, false);
    assert.equal(await page.locator('#layer-guide').isVisible(), true);
    await page.locator('#dismiss-layer-guide').click();
    await pauseAction(page, 'return-home');
    await page.locator('#start-game').click(); await dismissStoryOpening(page);
    assert.equal(await page.locator('#layer-guide').isVisible(), false);
    verified.push('direct-level-link', 'double-layer-guide-preserved');

    await pauseAction(page, 'return-home');
    await page.locator('#home-motion').click();
    for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 640 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      for (let index = 0; index < 3; index++) {
        await selectChapter(index);
        if (index === 2) assert.equal((await home()).preview.experiment.rainbowProgress, 1, 'paused preview must keep its full rainbow bridge');
        for (const selector of ['#home-title', '#start-game', '#home-settings', '#home-controls', '.home-chapters', '#home-motion']) {
          const rect = await page.locator(selector).boundingBox();
          assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= viewport.width + 1 && rect.y + rect.height <= viewport.height + 1, `${selector} outside ${viewport.width}×${viewport.height}`);
        }
        const spacing = await page.evaluate(() => ({ actions: document.querySelector('.home-secondary').getBoundingClientRect().bottom, footer: document.querySelector('.home-bottom').getBoundingClientRect().top }));
        assert.ok(spacing.actions < spacing.footer, 'menu must not overlap footer');
        await shot(`${index + 1}-${viewport.width}x${viewport.height}`);
      }
      await page.locator('#home-controls').click();
      const rect = await page.locator('#controls-dialog').boundingBox();
      assert.ok(rect.x >= 0 && rect.y >= 0 && rect.y + rect.height <= viewport.height);
      await shot(`controls-${viewport.width}x${viewport.height}`);
      await page.keyboard.press('Escape');
      const scroll = await page.evaluate(() => [scrollX, scrollY, document.documentElement.scrollWidth, innerWidth]);
      assert.equal(scroll[0], 0); assert.equal(scroll[1], 0); assert.ok(scroll[2] <= scroll[3]);
      verified.push(`three-backgrounds-and-guide-${viewport.width}x${viewport.height}`);
    }
    console.log(`${name}: settings, controls, navigation, gameplay and responsive layouts passed`);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url, { waitUntil: 'networkidle' }); await dismissStoryOpening(page);
    assert.equal((await home()).paused, true);
    const reduced = await home();
    await page.waitForTimeout(300);
    assert.equal((await home()).elapsed, reduced.elapsed);
    await selectChapter(2);
    assert.equal((await home()).chapter, 3);
    assert.equal((await home()).transitioning, false);
    await page.locator('#start-game').click(); await dismissStoryOpening(page);
    assert.equal((await home()).visible, false);
    verified.push('reduced-motion-pauses-auto-cycle', 'reduced-motion-manual-switch', 'mobile-start');
    assert.deepEqual(errors, []);
    assert.deepEqual(remoteRequests, []);
    reports.push({ browser: name, status: 'passed', errors, remoteRequests, environmentRequests, verified });
  } catch (error) {
    await shot('failure').catch(() => {});
    console.error(name, error, errors);
    throw error;
  } finally { await browser.close(); }
}
await writeFile(resolve(evidence, 'start-screen-report.json'), JSON.stringify(reports, null, 2));
console.log('Both browsers passed. Start-screen evidence saved in qa/.');
