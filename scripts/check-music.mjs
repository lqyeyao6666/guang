import { pauseAction, useHint } from './browser-environment.mjs';
import { prepareDebugNavigation, selectLevel } from './browser-environment.mjs';
import { dismissStoryOpening, isolateBrowserEnvironment, isEnvironmentRequest } from './browser-environment.mjs';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = resolve(root, 'qa');
const url = process.env.GAME_URL || 'http://127.0.0.1:4177';
await mkdir(evidence, { recursive: true });
const tracks = JSON.parse(await readFile(resolve(root, 'public/music/tracks.json'), 'utf8')).tracks;
assert.equal(tracks.length, 3);
for (const track of tracks) {
  for (const directory of ['public', 'dist']) {
    const data = await readFile(resolve(root, directory, 'music', track.file));
    assert.equal(createHash('sha256').update(data).digest('hex'), track.sha256);
  }
  assert.equal(track.fullDecode, 'passed');
  assert.ok(track.seamSampleStep < .12);
}
const reports = [];
for (const [name, executablePath] of [
  ['chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'],
  ['edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
]) {
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const environmentRequests = await isolateBrowserEnvironment(page); await prepareDebugNavigation(page);
  const errors = [], remoteRequests = [], verified = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !isEnvironmentRequest(message.location().url)) errors.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith(url) && !request.url().startsWith('data:') && !isEnvironmentRequest(request.url())) remoteRequests.push(request.url()); });
  const music = () => page.evaluate(() => window.__warmLight.music());
  const ready = chapter => page.waitForFunction(chapter => {
    const state = window.__warmLight.music();
    return state.activeChapter === chapter && state.playing && state.rms > .00005;
  }, chapter);
  const setVolume = async value => {
    await page.locator('#music-volume').evaluate((input, value) => {
      input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  };
  const openSettings = async () => { await page.locator('#open-settings').click(); };
  const closeSettings = async () => { await page.locator('#done-settings').click(); };
  const level = async (number, chapter) => {
    await selectLevel(page, number); await dismissStoryOpening(page);
    if (await page.locator('#layer-guide').isVisible()) await page.locator('#dismiss-layer-guide').click();
    await ready(chapter);
  };
  try {
    // Existing view preferences migrate without losing their values or music defaults.
    await context.addInitScript(() => {
      if (!localStorage.getItem('warm-light.settings.v1')) localStorage.setItem('warm-light.settings.v1', JSON.stringify({ pitch: 62, rotationSpeed: 1.2 }));
    });
    await page.goto(url, { waitUntil: 'networkidle' }); await dismissStoryOpening(page);
    await page.waitForFunction(() => window.__warmLight);
    assert.equal((await music()).context, 'locked');
    assert.equal((await music()).playing, false);
    assert.equal((await music()).enabled, true);
    assert.equal((await music()).volume, .5);
    assert.equal(await page.evaluate(() => window.__warmLight.state().view.pitch), 62);
    verified.push('autoplay-waits-for-interaction', 'existing-settings-migrate');
    await page.locator('#home-motion').click();
    await ready(1);
    assert.equal((await music()).error, null);
    verified.push('trusted-home-click-starts-real-audio');
    await page.locator('[data-home-chapter="2"]').click();
    assert.equal((await music()).activeChapter, 1);
    verified.push('home-slideshow-does-not-shuffle-music');
    await page.locator('#start-game').click(); await dismissStoryOpening(page);
    await ready(1);
    await page.waitForTimeout(300);
    const position = (await music()).position;
    await level(2, 1);
    assert.ok((await music()).position >= position);
    await pauseAction(page, 'restart'); await dismissStoryOpening(page);
    assert.ok((await music()).position >= position);
    await level(4, 1);
    await level(6, 1);
    verified.push('all-four-garden-levels-use-track-one', 'same-chapter-and-restart-keep-position');
    await level(3, 2);
    assert.ok((await music()).voices <= 2);
    await page.waitForTimeout(1200);
    assert.equal((await music()).voices, 1);
    await level(5, 2); await level(8, 2);
    await level(7, 3);
    assert.ok((await music()).voices <= 2);
    await page.waitForTimeout(1200);
    assert.equal((await music()).voices, 1);
    verified.push('all-three-night-levels-use-track-two', 'experiment-uses-track-three', 'crossfade-releases-outgoing-voice');
    for (const number of [1, 3, 7, 3, 1, 7]) {
      await selectLevel(page, number); await dismissStoryOpening(page);
      assert.ok((await music()).voices <= 2);
    }
    await ready(3);
    await page.waitForTimeout(1300);
    assert.equal((await music()).voices, 1);
    verified.push('rapid-chapter-navigation-cancels-stale-loads', 'no-accumulated-players');
    await page.goBack(); await dismissStoryOpening(page); await ready(1);
    await page.goForward(); await dismissStoryOpening(page); await ready(3);
    await pauseAction(page, 'return-home');
    await ready(3);
    await page.locator('#start-game').click(); await dismissStoryOpening(page);
    await ready(3);
    verified.push('history-selects-correct-track', 'home-and-resume-continue-current-track');
    await openSettings();
    await setVolume(37);
    assert.equal((await music()).volume, .37);
    assert.equal(await page.locator('#music-volume-value').innerText(), '37%');
    await page.screenshot({ path: resolve(evidence, `${name}-music-settings-desktop.png`), fullPage: true });
    await page.locator('#music-volume').focus(); await page.keyboard.press('Home');
    await page.waitForFunction(() => window.__warmLight.music().context === 'suspended');
    assert.equal((await music()).rms, 0);
    await page.keyboard.press('End'); await ready(3);
    assert.equal((await music()).volume, 1);
    await setVolume(37);
    await page.locator('#music-enabled').uncheck();
    await page.waitForFunction(() => window.__warmLight.music().context === 'suspended');
    const paused = (await music()).position;
    await page.waitForTimeout(180);
    assert.equal((await music()).position, paused);
    await closeSettings();
    await page.reload({ waitUntil: 'networkidle' }); await dismissStoryOpening(page);
    assert.equal((await music()).enabled, false);
    assert.equal((await music()).volume, .37);
    assert.equal((await music()).playing, false);
    await openSettings();
    assert.equal((await music()).context, 'locked');
    await page.locator('#music-enabled').check(); await ready(3);
    await page.locator('#reset-settings').click();
    assert.equal((await music()).enabled, true);
    assert.equal((await music()).volume, .5);
    await closeSettings();
    verified.push('volume-adjusts-live', 'keyboard-volume-zero-suspends', 'mute-freezes-position', 'music-preferences-persist', 'muted-refresh-stays-silent', 'default-settings-restore-music');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => window.__warmLight.music().context === 'suspended');
    const hiddenPosition = (await music()).position;
    await page.waitForTimeout(180);
    assert.equal((await music()).position, hiddenPosition);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await ready(3);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await page.waitForFunction(() => window.__warmLight.music().context === 'suspended');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow')));
    await ready(3);
    verified.push('hidden-page-pauses-clock', 'visible-page-resumes', 'pagehide-pageshow-pause-and-resume');
    await page.setViewportSize({ width: 390, height: 844 });
    await openSettings();
    await page.locator('#music-enabled').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#music-enabled').isVisible(), true);
    await page.screenshot({ path: resolve(evidence, `${name}-music-settings-mobile.png`), fullPage: true });
    await setVolume(62);
    assert.equal((await music()).volume, .62);
    await closeSettings();
    await page.setViewportSize({ width: 844, height: 390 });
    await openSettings();
    await page.locator('#music-volume').scrollIntoViewIfNeeded();
    await page.locator('#music-enabled').uncheck();
    await page.locator('#music-enabled').check(); await ready(3);
    await closeSettings();
    verified.push('mobile-music-controls', 'short-landscape-settings-scroll');
    // Measure the decoded assets themselves at their boundaries, including MP3 trim.
    const decoded = await page.evaluate(async tracks => {
      const context = new OfflineAudioContext(2, 1, 44100);
      const results = [];
      for (const track of tracks) {
        const response = await fetch('/music/' + track.file);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        let step = 0;
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          const data = buffer.getChannelData(ch);
          step = Math.max(step, Math.abs(data[0] - data[data.length - 1]));
        }
        results.push({ chapter: track.chapter, duration: buffer.duration, seamStep: step });
      }
      return results;
    }, tracks);
    for (const track of decoded) {
      assert.ok(Math.abs(track.duration - tracks[track.chapter - 1].loopSeconds) < .03);
      assert.ok(track.seamStep < .12);
    }
    verified.push('three-assets-decode-with-gapless-trim', 'three-loop-waveform-boundaries');
    // Chapter two is the short seamless ambient loop; keep the live wrap check
    // bounded while still measuring an actual playback cycle in both browsers.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await level(3, 2);
    console.log(`${name}: chapter routing, controls, persistence and lifecycle passed; checking a real loop...`);
    const wrap = await page.evaluate(() => new Promise((resolveWrap, reject) => {
      let previous = window.__warmLight.music().position;
      let lowestRms = Infinity;
      const started = performance.now();
      const timer = setInterval(() => {
        const state = window.__warmLight.music();
        if (state.position > state.duration - .6 || state.position < .6) lowestRms = Math.min(lowestRms, state.rms);
        if (state.position < previous - .5 && state.position < 1) {
          clearInterval(timer); resolveWrap({ lowestRms, voices: state.voices, playing: state.playing });
        } else if (performance.now() - started > 80000) {
          clearInterval(timer); reject(new Error('Music did not wrap within one loop.'));
        }
        previous = state.position;
      }, 50);
    }));
    assert.equal(wrap.playing, true); assert.equal(wrap.voices, 1);
    assert.ok(wrap.lowestRms > .00005);
    verified.push('actual-loop-repeats-with-continuous-audio');
    // A fresh page also starts correctly from the keyboard, not just mouse input.
    await page.goto(url, { waitUntil: 'networkidle' }); await dismissStoryOpening(page);
    assert.equal((await music()).context, 'locked');
    await page.keyboard.press('Enter'); await ready(1);
    verified.push('keyboard-first-interaction-starts-music');
    assert.deepEqual(errors, []); assert.deepEqual(remoteRequests, []);
    reports.push({ browser: name, status: 'passed', verified, decoded, wrap, errors, remoteRequests, environmentRequests });
    console.log(`${name}: ${verified.length} music checks passed.`);
  } catch (error) {
    await page.screenshot({ path: resolve(evidence, `${name}-music-failure.png`), fullPage: true }).catch(() => {});
    reports.push({ browser: name, status: 'failed', message: String(error), verified, errors, remoteRequests, environmentRequests, music: await music().catch(() => null) });
    await writeFile(resolve(evidence, 'music-report.json'), JSON.stringify(reports, null, 2));
    throw error;
  } finally { await browser.close(); }
}
await writeFile(resolve(evidence, 'music-report.json'), JSON.stringify(reports, null, 2));
console.log('Chapter music checks passed in Chrome and Edge.');
