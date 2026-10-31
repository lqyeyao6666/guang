import { pauseAction, useHint } from './browser-environment.mjs';
import { prepareDebugNavigation, selectLevel } from './browser-environment.mjs';
import { dismissStoryOpening } from './browser-environment.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const url = process.env.GAME_URL || 'http://127.0.0.1:4177';
const evidence = resolve('qa');
await mkdir(evidence, { recursive: true });
const results = [];
for (const [browserName, executablePath] of [
  ['chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'],
  ['edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
]) {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await prepareDebugNavigation(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.addInitScript(() => {
      window.__soundOscillators = 0;
      const original = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (...args) {
        window.__soundOscillators++;
        return original.apply(this, args);
      };
    });
    await page.goto(new URL('?level=1', url).href, { waitUntil: 'networkidle' }); await dismissStoryOpening(page);
    await page.waitForFunction(() => window.__warmLight);
    const starts = () => page.evaluate(() => window.__soundOscillators);
    const waitForStarts = async count => page.waitForFunction(count => window.__soundOscillators >= count, count);
    await page.locator('#open-settings').click();
    await waitForStarts(2);
    assert.equal(await page.locator('#sound-effects-enabled').isChecked(), true);
    const verified = ['button-click-sound'];

    await page.locator('#sound-effects-enabled').uncheck();
    const mutedAt = await starts();
    await page.locator('#done-settings').click();
    await page.waitForTimeout(40);
    assert.equal(await starts(), mutedAt, 'the independent effects switch mutes UI buttons');
    await page.reload({ waitUntil: 'networkidle' }); await dismissStoryOpening(page);
    await page.waitForFunction(() => window.__warmLight);
    await page.locator('#open-settings').click();
    assert.equal(await page.locator('#sound-effects-enabled').isChecked(), false);
    assert.equal(await starts(), 0, 'the muted preference survives reload');
    await page.locator('#done-settings').click();
    assert.equal(await starts(), 0);
    await page.locator('#open-settings').click();
    await page.locator('#sound-effects-enabled').check();
    const enabledAt = await starts();
    await page.locator('#done-settings').click();
    await waitForStarts(enabledAt + 2);
    await page.reload({ waitUntil: 'networkidle' }); await dismissStoryOpening(page);
    await page.waitForFunction(() => window.__warmLight);
    await page.locator('#open-settings').click();
    assert.equal(await page.locator('#sound-effects-enabled').isChecked(), true, 'the enabled preference survives reload');
    await page.locator('#done-settings').click();
    verified.push('effects-toggle-and-persistence');

    const thumbnail = await page.locator('[data-kind="mirror"] .item-thumbnail').boundingBox();
    const destination = await page.evaluate(() => window.__warmLight.screenPoint({ x: 4, y: 4 }));
    const beforeDrag = await starts();
    await page.mouse.move(thumbnail.x + thumbnail.width / 2, thumbnail.y + thumbnail.height / 2);
    await page.mouse.down();
    await page.mouse.move(destination.x, destination.y, { steps: 12 });
    await page.mouse.up();
    await waitForStarts(beforeDrag + 4);
    assert.equal((await page.evaluate(() => window.__warmLight.state().level.items.find(item => item.id === 'mirror').x)), 4);
    verified.push('drag-pickup-and-placement-sounds');

    const beforeRotate = await starts();
    await page.keyboard.press('e');
    await waitForStarts(beforeRotate + 3);
    assert.equal((await page.evaluate(() => window.__warmLight.state().level.items.find(item => item.id === 'mirror').angle)), 45);
    verified.push('mirror-rotation-sound');
    assert.deepEqual(errors, []);
    results.push({ browser: browserName, status: 'passed', verified, errors });
    console.log(`${browserName}: ${verified.join(', ')} passed`);
  } catch (error) {
    results.push({ browser: browserName, status: 'failed', errors: [...errors, String(error)] });
    throw error;
  } finally {
    await browser.close();
  }
}
await writeFile(resolve(evidence, 'sfx-report.json'), `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
