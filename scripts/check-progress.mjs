import { pauseAction, useHint } from './browser-environment.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { levelSummaries } from '../src/level.ts';
import { GameProgress, normalizeProgress, nextPlayable, isUnlocked, progressStorageKey, debugStorageKey } from '../src/progress.ts';
import { dismissStoryOpening, isolateBrowserEnvironment, isEnvironmentRequest } from './browser-environment.mjs';

// Rule checks use separate in-memory stores, never the player's browser profile.
const savedLocal = new Map(), savedSession = new Map();
globalThis.localStorage = { getItem: key => savedLocal.get(key) ?? null, setItem: (key, value) => savedLocal.set(key, value) };
globalThis.sessionStorage = { getItem: key => savedSession.get(key) ?? null, setItem: (key, value) => savedSession.set(key, value), removeItem: key => savedSession.delete(key) };
const rules = [];
const check = (name, fn) => { fn(); rules.push(name); };
check('broken-and-sparse-progress-cannot-skip-levels', () => {
  for (const value of [null, 'oops', { completed: 'all' }, { completed: [2, 4, 15] }]) assert.deepEqual(normalizeProgress(value), { completed: [] });
  assert.deepEqual(normalizeProgress({ completed: [4, 1, 2, 2, 999, 15] }), { completed: [1, 2, 4] });
});
check('new-game-and-password-guard', () => {
  const p = new GameProgress(); assert.equal(nextPlayable(p.data), 1);
  assert.equal(p.canPlay(2), false); assert.equal(p.authenticate('12345'), false);
  assert.equal(p.authenticate('123456'), true); assert.equal(p.canPlay(15), true);
  assert.equal(p.complete(15), false); assert.deepEqual(p.data.completed, []);
  p.setDebug(false); assert.equal(p.canPlay(15), false);
});
check('all-fifteen-unlock-in-chapter-order-and-survive-reload', () => {
  const p = new GameProgress();
  for (const [i, entry] of levelSummaries.entries()) {
    assert.equal(nextPlayable(p.data), entry.number);
    for (const [j, other] of levelSummaries.entries()) assert.equal(isUnlocked(p.data, other.number), j <= i);
    assert.equal(p.complete(entry.number), true); assert.equal(p.complete(entry.number), false);
    assert.deepEqual(new GameProgress().data, p.data);
  }
  assert.equal(nextPlayable(p.data), 15); assert.equal(p.data.completed.length, 15);
});
check('reset-and-storage-refusal', () => {
  const p = new GameProgress(); p.reset(); assert.deepEqual(new GameProgress().data, { completed: [] });
  localStorage.setItem = () => { throw new Error('storage disabled'); };
  assert.equal(p.complete(1), true); assert.equal(p.saved, false); assert.equal(p.canPlay(2), true);
});

const url = process.env.GAME_URL || 'http://127.0.0.1:4177';
await mkdir(resolve('qa'), { recursive: true });
const report = [];
for (const [browserName, executablePath] of [
  ['chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'],
  ['edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
]) {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const environmentRequests = await isolateBrowserEnvironment(page);
  const errors = [], remote = [], checks = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !isEnvironmentRequest(message.location().url)) errors.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith(url) && !request.url().startsWith('data:') && !isEnvironmentRequest(request.url())) remote.push(request.url()); });
  const state = () => page.evaluate(() => window.__warmLight.state());
  const progress = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{"completed":[]}'), progressStorageKey);
  const shot = name => page.screenshot({ path: resolve('qa', `${browserName}-progress-${name}.png`) });
  const unlockDebug = async () => {
    await page.locator((await page.evaluate(() => window.__warmLight.home().visible)) ? '#home-settings' : '#open-settings').click();
    if (!await page.locator('#debug-tools').evaluate(element => element.open)) await page.locator('#debug-tools summary').click();
    if (await page.locator('#debug-login').isVisible()) {
      await page.locator('#debug-password').fill('123456'); await page.locator('#debug-password').press('Enter');
    }
  };
  const debugJump = async number => {
    await unlockDebug(); await page.locator('#debug-level').selectOption(String(number)); await page.locator('#debug-jump').click();
    await dismissStoryOpening(page);
    if (await page.locator('#layer-guide').isVisible()) await page.locator('#dismiss-layer-guide').click();
  };
  const drag = async (kind, target, commit = true) => {
    const box = await page.locator(`[data-kind="${kind}"] .item-thumbnail`).boundingBox();
    const point = await page.evaluate(target => window.__warmLight.screenPoint(target), target);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(point.x, point.y, { steps: 18 }); if (commit) await page.mouse.up();
  };
  const rotate = async (id, angle) => {
    const point = await page.evaluate(id => window.__warmLight.itemPoint(id), id);
    await page.mouse.click(point.x, point.y, { button: 'right' }); await page.locator(`[data-angle="${angle}"]`).click();
  };
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('#home-levels').click();
    assert.equal(await page.locator('[data-choose-level]').count(), 15);
    assert.equal(await page.locator('[data-choose-level]:disabled').count(), 14);
    assert.equal(await page.locator('[data-chapter-group]').count(), 3);
    await shot('new-selection');
    await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => document.activeElement.id), 'home-levels');
    checks.push('new-save-only-first-unlocked', 'three-chapter-selection', 'picker-escape-restores-focus');

    await page.goto(`${url}/?level=15`, { waitUntil: 'networkidle' });
    assert.equal(await page.evaluate(() => window.__warmLight.home().visible), true);
    assert.equal(await page.locator('#levels-dialog').isVisible(), true);
    assert.equal((await state()).level.number, 1);
    assert.equal(new URL(page.url()).searchParams.has('level'), false);
    await page.locator('#close-levels').click();
    checks.push('locked-direct-url-returns-home');

    await page.locator('#home-settings').click(); await page.locator('#debug-tools summary').click();
    await page.locator('#debug-password').fill('wrong'); await page.locator('#debug-password').press('Enter');
    assert.match(await page.locator('#debug-message').innerText(), /不正确/);
    assert.equal(await page.locator('#debug-panel').isVisible(), false); assert.equal(await page.locator('#debug-password').inputValue(), '');
    await page.locator('#debug-password').fill('123456'); await page.locator('#debug-password').press('Enter');
    assert.equal(await page.locator('#debug-panel').isVisible(), true);
    await page.locator('#debug-level').selectOption('15'); await page.locator('#debug-jump').click(); await dismissStoryOpening(page);
    assert.equal((await state()).level.number, 15); assert.deepEqual((await progress()).completed, []);
    assert.equal(await page.locator('#next-level').isVisible(), false);
    await page.reload({ waitUntil: 'networkidle' }); await dismissStoryOpening(page); assert.equal((await state()).level.number, 15);
    checks.push('wrong-password-no-access', 'correct-password-and-enter-key', 'debug-jump-does-not-unlock', 'per-tab-debug-survives-reload', 'last-level-has-no-next');

    const other = await context.newPage(); await isolateBrowserEnvironment(other); await other.goto(`${url}/?level=15`, { waitUntil: 'networkidle' });
    assert.equal(await other.evaluate(() => window.__warmLight.home().visible), true); await other.close();
    await unlockDebug(); await page.locator('#exit-debug').click();
    assert.equal(await page.evaluate(() => window.__warmLight.home().visible), true);
    assert.equal((await state()).won, false);
    checks.push('debug-not-shared-with-new-tab', 'exit-debug-invalidates-locked-layout');

    await page.locator('#home-levels').click(); await page.locator('[data-choose-level="1"]').click();
    assert.equal(await page.locator('#storybook-dialog').isVisible(), true);
    await page.locator('#close-story').click(); assert.equal(await page.locator('#spirit-bubble').isVisible(), true);
    await page.locator('#close-spirit').click();
    assert.equal(await page.locator('.brand,.site-header,.page-footer,.level-navigation').count(), 0);
    const board = await page.locator('#scene').boundingBox(); assert.ok(board.width > 1050 && board.height > 830);
    checks.push('home-pick-keeps-story-then-spirit', 'play-screen-no-brand-or-jump-bar', 'larger-desktop-play-surface');

    await drag('mirror', { x: 5, y: 2 }); await rotate('mirror', 45);
    await page.locator('#open-settings').click(); await page.waitForTimeout(750);
    assert.equal((await state()).won, false); assert.deepEqual((await progress()).completed, []);
    await page.locator('#done-settings').click(); await page.waitForFunction(() => window.__warmLight.state().won);
    assert.deepEqual((await progress()).completed, [1]);
    await pauseAction(page, 'return-home'); await page.locator('#home-levels').click();
    assert.equal(await page.locator('[data-choose-level="1"]').getAttribute('data-status'), 'complete');
    assert.equal(await page.locator('[data-choose-level="2"]').isEnabled(), true);
    assert.equal(await page.locator('[data-choose-level="4"]').isEnabled(), false);
    await shot('first-complete'); await page.keyboard.press('Escape');
    checks.push('settings-pause-never-records-win', 'real-win-saves-once', 'one-win-unlocks-exactly-one');

    await page.reload({ waitUntil: 'networkidle' }); await page.locator('#start-game').click(); await dismissStoryOpening(page);
    assert.equal((await state()).level.number, 2);
    await drag('mirror', { x: 5, y: 6 }); await rotate('mirror', 135); await page.waitForTimeout(700);
    assert.equal((await state()).won, false); assert.deepEqual((await progress()).completed, [1]);
    await drag('lens', { x: 3, y: 2 }, false); await page.waitForTimeout(700);
    assert.equal((await state()).won, false); assert.deepEqual((await progress()).completed, [1]); await page.mouse.up();
    await rotate('lens', 0); await page.waitForFunction(() => window.__warmLight.state().won);
    assert.deepEqual((await progress()).completed, [1, 2]);
    await page.locator('#next-level').click(); await dismissStoryOpening(page); await page.locator('#dismiss-layer-guide').click();
    assert.equal((await state()).level.number, 4);
    await pauseAction(page, 'restart'); await dismissStoryOpening(page); assert.deepEqual((await progress()).completed, [1, 2]);
    checks.push('reload-continues-first-unfinished', 'insufficient-light-no-completion', 'drag-preview-no-completion', 'second-win-unlocks-id-four', 'next-level-in-chapter-order', 'restart-preserves-progress');

    // Cross-chapter boundary uses a save fixture, never a production bypass.
    await page.evaluate(({ key, completed }) => localStorage.setItem(key, JSON.stringify({ completed })), { key: progressStorageKey, completed: levelSummaries.slice(0, 5).map(entry => entry.number) });
    await page.goto(url, { waitUntil: 'networkidle' }); await page.locator('#home-levels').click();
    assert.equal(await page.locator('[data-choose-level="3"]').isEnabled(), true);
    assert.equal(await page.locator('[data-choose-level="5"]').isEnabled(), false);
    await page.keyboard.press('Escape');
    checks.push('chapter-boundary-unlocks-only-next-chapter-first');

    await debugJump(15);
    for (const size of [{ width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 640 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size);
      for (const selector of ['#brightness', '#open-settings', '#toggle-inventory', '#inventory']) {
        const b = await page.locator(selector).boundingBox(); assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= size.width + 1 && b.y + b.height <= size.height + 1, `${selector} outside ${size.width}x${size.height}`);
      }
      const gameBoard = await page.locator('#scene').boundingBox(); assert.ok(gameBoard.height > 180 && gameBoard.width > 300);
      await shot(`game-${size.width}x${size.height}`);
      await pauseAction(page, 'return-home'); await page.locator('#home-levels').click();
      const zoom = (await state()).view.zoom; await page.mouse.wheel(0, 300); await page.keyboard.press('q'); assert.equal((await state()).view.zoom, zoom);
      const b = await page.locator('#levels-dialog').boundingBox(); assert.ok(b.x >= 0 && b.y >= 0 && b.y + b.height <= size.height + 1);
      await page.locator('[data-choose-level="15"]').scrollIntoViewIfNeeded(); await shot(`picker-${size.width}x${size.height}`);
      await page.keyboard.press('Escape'); await page.locator('#start-game').click();
      checks.push(`game-and-picker-layout-${size.width}x${size.height}`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await unlockDebug();
    assert.equal(await page.locator('#reset-progress').innerText(), '重置游戏');
    await page.locator('#reset-progress').click();
    assert.equal(await page.locator('#reset-progress').getAttribute('aria-expanded'), 'true');
    await shot('reset-game-confirm');
    await page.locator('#cancel-reset-progress').click();
    assert.equal(await page.locator('#reset-progress').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'reset-progress');
    assert.equal((await progress()).completed.length, 5);
    await page.locator('#reset-settings').click(); assert.equal((await progress()).completed.length, 5);
    await page.locator('#pitch').focus(); await page.locator('#pitch').press('End');
    await page.locator('#music-enabled').setChecked(false);
    await page.locator('#sound-effects-enabled').setChecked(false);
    const preservedSettings = await page.evaluate(() => localStorage.getItem('warm-light.settings.v1'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#reset-progress').click(); await shot('reset-game-confirm-mobile');
    await page.locator('#cancel-reset-progress').click();
    await page.locator('#reset-progress').click(); await page.locator('#confirm-reset-progress').click();
    assert.deepEqual((await progress()).completed, []);
    assert.equal(await page.evaluate(() => localStorage.getItem('warm-light.settings.v1')), preservedSettings);
    assert.equal((await state()).view.pitch, 85);
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), debugStorageKey), null);
    assert.equal(await page.evaluate(() => window.__warmLight.home().visible), true);
    assert.equal((await state()).won, false); assert.equal((await state()).level.number, 1);
    await page.locator('#home-levels').click(); assert.equal(await page.locator('[data-choose-level]:disabled').count(), 14); await page.keyboard.press('Escape');
    await page.goBack(); assert.equal(await page.evaluate(() => window.__warmLight.home().visible), true);
    assert.equal((await state()).level.number, 1);
    await page.reload({ waitUntil: 'networkidle' }); await page.locator('#start-game').click(); await dismissStoryOpening(page); assert.equal((await state()).level.number, 1);
    checks.push('reset-game-button-in-debug-panel', 'reset-confirm-expanded-state', 'cancel-reset-restores-button-focus', 'reset-game-confirm-mobile', 'reset-game-keeps-view-music-sfx-preferences', 'cancel-reset-keeps-save', 'reset-settings-keeps-progress', 'confirmed-reset-clears-save-and-debug', 'reset-clears-active-layout', 'history-cannot-reopen-locked-level', 'reset-survives-reload');

    const observer = await context.newPage(); await isolateBrowserEnvironment(observer); await observer.goto(url, { waitUntil: 'networkidle' });
    await observer.evaluate(key => { localStorage.setItem(key, '{"completed":[1]}'); }, progressStorageKey);
    await page.waitForFunction(() => window.__warmLight.home().visible);
    assert.equal((await state()).level.number, 2); await observer.close();
    checks.push('other-tab-progress-change-invalidates-old-layout');
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    report.push({ browser: browserName, status: 'passed', checks, errors, remote, environmentRequests });
    console.log(`${browserName}: ${checks.length} progression and layout checks passed`);
  } catch (error) {
    await shot('failure').catch(() => {}); console.error(browserName, error); throw error;
  } finally { await browser.close(); }
}
await writeFile(resolve('qa/progress-report.json'), JSON.stringify({ rules, browsers: report }, null, 2));
