import { pauseAction, useHint } from './browser-environment.mjs';
import { prepareDebugNavigation, selectLevel } from './browser-environment.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { levelSummaries } from '../src/level.ts';
import { dismissStoryOpening, isolateBrowserEnvironment, isEnvironmentRequest } from './browser-environment.mjs';

const url = process.env.GAME_URL || 'http://127.0.0.1:4177';
const qa = resolve('qa');
await mkdir(qa, { recursive: true });
const report = [];
const motifs = { 1:'拐角', 2:'透镜', 4:'云', 6:'两盏', 11:'底面', 3:'灯塔', 5:'扫帚', 8:'木屋', 9:'稻草', 12:'教室', 7:'七种', 10:'红与绿', 13:'鱼缸', 14:'继电器', 15:'探测' };

for (const [name, executablePath] of [
  ['chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'],
  ['edge', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],
]) {
  const browser = await chromium.launch({ executablePath, headless:true, args:['--enable-webgl','--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport:{width:1440,height:1000} });
  page.setDefaultTimeout(10000);
  const errors=[], remote=[], checks=[];
  const environmentRequests=await isolateBrowserEnvironment(page); await prepareDebugNavigation(page);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!isEnvironmentRequest(m.location().url))errors.push(m.text());});
  page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:')&&!isEnvironmentRequest(r.url()))remote.push(r.url());});
  const state=()=>page.evaluate(()=>window.__warmLight.state());
  const dismissGuide=async()=>{if(await page.locator('#layer-guide').isVisible())await page.locator('#dismiss-layer-guide').click();};
  const dismissOpening=()=>dismissStoryOpening(page);
  const go=async (number,inspectOpening=false)=>{
    if((await state()).level.number!==number)await selectLevel(page, number);
    if(!inspectOpening){await dismissOpening();await dismissGuide();}
  };
  const boxInside=async selector=>{
    const b=await page.locator(selector).boundingBox(); const {width,height}=page.viewportSize();
    assert.ok(b&&b.x>=-1&&b.y>=-1&&b.x+b.width<=width+1&&b.y+b.height<=height+1,`${selector} outside ${width}x${height}`);
  };
  try {
    await page.goto(`${url}/?level=1`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__warmLight);
    for(const entry of levelSummaries) {
      await go(entry.number,true);
      assert.equal(await page.locator('#storybook-dialog').isVisible(),true,'every new level opens its story');
      assert.equal(await page.locator('#layer-guide').isVisible(),false,'mechanics guide waits until story closes');
      assert.equal(await page.locator('#storybook-dialog').getAttribute('data-opening'),'true');
      assert.equal(await page.locator('#spirit-bubble').isVisible(),false,'spirit speaks only after level story closes');
      assert.equal(await page.locator('#storybook-title').innerText(),entry.title);
      await page.locator('#finish-story').click();
      if(entry.chapterLevel===1){
        assert.equal(await page.locator('#spirit-bubble').isVisible(),true,'chapter spirit now speaks beside board');
        assert.equal(await page.locator('#scene #light-spirit').count(),1);
        assert.equal(await page.locator('#light-spirit').innerText(),'','orb has no visible name label');
        await boxInside('#spirit-bubble');
        await page.screenshot({path:resolve(qa,`${name}-spirit-chapter-${entry.chapter}.png`)});
        await page.locator('#next-spirit').click();
        assert.equal(await page.locator('#spirit-page').innerText(),'2 / 3');
        await page.locator('#next-spirit').click();
        assert.equal(await page.locator('#spirit-tips li').count(),3);
        await page.locator('#next-spirit').click();
        assert.equal(await page.locator('#spirit-bubble').isVisible(),false);
      } else assert.equal(await page.locator('#spirit-bubble').isVisible(),false,'ordinary levels do not repeat the chapter story');
      if([4,11].includes(entry.number))assert.equal(await page.locator('#layer-guide').isVisible(),true,'story then mechanics guide');
      await dismissGuide();
      assert.ok((await page.locator('#story-whisper').innerText()).length>5);
      await boxInside('#read-story');
      const before=await state();
      await page.locator('#read-story').click();
      assert.equal(await page.locator('#storybook-title').innerText(),entry.title);
      assert.ok((await page.locator('#storybook-letter').innerText()).includes(motifs[entry.number]),`story theme ${entry.title}`);
      assert.equal(await page.locator('#storybook-reply').isVisible(),false,'reply waits for an actual win');
      await boxInside('#storybook-dialog');
      await page.keyboard.press('q'); await page.keyboard.press('e');
      await page.mouse.wheel(0,300);
      const during=await state();
      assert.equal(during.view.zoom,before.view.zoom,'reading never zooms the board');
      assert.equal(during.moves,before.moves);
      assert.deepEqual(during.level.items,before.level.items,'reading never edits the puzzle');
      if([1,8,14].includes(entry.number))await page.screenshot({path:resolve(qa,`${name}-storybook-${entry.number}.png`)});
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#storybook-dialog').isVisible(),false);
      assert.equal(await page.locator('#read-story').evaluate(e=>e===document.activeElement),true,'reader focus restored');
    }
    checks.push('all-level-matched-stories','all-15-levels-automatic-opening','three-chapter-spirit-prologues','level-story-then-board-spirit-order','three-practical-tips-per-chapter','story-before-layer-and-cube-guide','no-early-replies','wheel-and-keyboard-isolation','escape-and-focus-return');
    console.log(`${name}: ${levelSummaries.length} chapter stories and reader controls passed`);

    await go(1);
    const anchorBefore = await page.locator('#light-spirit').boundingBox();
    await page.locator('#zoom-in').click();
    await page.waitForTimeout(100);
    const anchorAfter = await page.locator('#light-spirit').boundingBox();
    assert.ok(Math.abs(anchorAfter.x-anchorBefore.x)+Math.abs(anchorAfter.y-anchorBefore.y)>1,'companion follows board projection while zooming');
    await page.locator('#reset-view').click();
    await page.locator('#light-spirit').click();
    const motionBefore = await page.locator('.spirit-flight').evaluate(e=>getComputedStyle(e).transform);
    await page.waitForTimeout(300);
    assert.notEqual(await page.locator('.spirit-flight').evaluate(e=>getComputedStyle(e).transform),motionBefore,'light hovers gently');
    assert.equal(await page.locator('.spirit-wake').count(),2,'short bounded trail uses two wisps');
    assert.equal(await page.locator('.spirit-mote').count(),2,'fixed mote count cannot accumulate');
    for(const selector of ['.spirit-flight','.spirit-wake-one','.spirit-mote-one'])assert.equal(await page.locator(selector).evaluate(e=>getComputedStyle(e).pointerEvents),'none','decorative trail never intercepts drags');
    checks.push('projected-companion-follows-zoom','gentle-hover-motion','two-wisps-two-motes-no-accumulation','trail-never-intercepts-input');
    const center=async locator=>{const b=await locator.boundingBox();assert.ok(b);return{x:b.x+b.width/2,y:b.y+b.height/2};};
    const from=await center(page.locator('[data-kind="mirror"] .item-thumbnail'));
    const to=await page.evaluate(()=>window.__warmLight.screenPoint({x:5,y:2},.2));
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:14});await page.mouse.up();
    assert.equal((await state()).level.items.find(i=>i.id==='mirror').inInventory,false,'board remains playable while spirit speaks');
    const item=await page.evaluate(()=>window.__warmLight.itemPoint('mirror'));
    await page.mouse.click(item.x,item.y,{button:'right'});
    // Finish the route and open the reader in one task, before the 0.6s win hold can elapse.
    await page.evaluate(()=>{document.querySelector('#rotation-menu [data-angle="45"]').click();document.querySelector('#read-story').click();});
    assert.equal((await state()).ready,true);
    await page.waitForTimeout(850);
    assert.equal((await state()).won,false,'reading pauses the actual win hold');
    assert.equal(await page.locator('#storybook-reply').isVisible(),false);
    await page.locator('#finish-story').click();
    await page.waitForFunction(()=>window.__warmLight.state().won);
    assert.equal(await page.locator('#celebration').isVisible(),true);
    await page.locator('#continue').click();
    await page.locator('#read-story').click();
    assert.equal(await page.locator('#storybook-reply').isVisible(),true);
    assert.equal(await page.locator('#storybook-poem').innerText(),await page.locator('#completion-text').innerText());
    await page.screenshot({path:resolve(qa,`${name}-storybook-reply.png`)});
    await page.locator('#close-story').click();
    await pauseAction(page, 'return-home');
    assert.match(await page.locator('.home-intro').innerText(),/拾光人/);
    await page.locator('#start-game').click();
    await page.locator('#read-story').click();
    assert.equal(await page.locator('#storybook-reply').isVisible(),true,'home resume keeps actual win reply');
    await page.locator('#close-story').click();
    await pauseAction(page, 'restart');
    assert.equal(await page.locator('#storybook-dialog').isVisible(),true,'restart automatically retells level story');
    assert.equal(await page.locator('#spirit-bubble').isVisible(),false,'restart waits for level story');
    assert.equal(await page.locator('#storybook-reply').isVisible(),false,'restart clears the reply');
    await page.locator('#finish-story').click();
    assert.equal(await page.locator('#spirit-bubble').isVisible(),false,'restart skips chapter prologue');
    for(let n=0;n<4;n++)await useHint(page);
    await useHint(page);assert.equal(await page.locator('#hint-content').evaluate(element => !element.hidden),false);
    await useHint(page);assert.equal(await page.locator('#hint-content').evaluate(element => !element.hidden),true);
    await pauseAction(page, 'restart');
    await dismissOpening();
    checks.push('real-drag-and-rotation-win','reader-pauses-win-hold','actual-win-unlocks-poem','home-resume-keeps-reply','restart-clears-reply-and-opens-level-story','final-hint-collapse-preserved');

    // Direct links, history and cancellation must not revive a stale mechanics guide.
    await page.goto(`${url}/?level=3`,{waitUntil:'networkidle'});
    assert.equal(await page.locator('#spirit-bubble').isVisible(),false);
    await page.locator('#close-story').click();
    assert.equal(await page.locator('#spirit-bubble').isVisible(),true);
    assert.equal(await page.locator('#storybook-dialog').isVisible(),false);
    await page.locator('#close-spirit').click();
    await page.locator('#light-spirit').click();
    assert.equal(await page.locator('#spirit-bubble').isVisible(),true,'chapter can be reread beside the board');
    const beforeSpirit = await state();
    await page.locator('#next-spirit').click();
    assert.deepEqual((await state()).view,beforeSpirit.view,'orb and dialogue clicks never rotate the board');
    await page.keyboard.press('Escape');
    await selectLevel(page, 4);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#layer-guide').isVisible(),true);
    await dismissGuide();
    await selectLevel(page, 2);await dismissOpening();
    await page.goBack();assert.equal(await page.locator('#storybook-dialog').isVisible(),true);
    await dismissOpening();await dismissGuide();
    await page.goForward();await dismissOpening();
    assert.equal(await page.locator('#layer-guide').isVisible(),false,'history leaves no stale guide');
    checks.push('direct-link-prologue','chapter-close','orb-replays-chapter','spirit-clicks-never-orbit-board','escape-continues-to-mechanics-guide','history-retells-current-story','no-stale-guide-after-navigation');

    for(const size of [{width:1280,height:720},{width:1024,height:768},{width:390,height:844},{width:844,height:390}]) {
      await page.setViewportSize(size);
      for(const entry of size.width===390?levelSummaries:[levelSummaries[0],levelSummaries.find(e=>e.number===3),levelSummaries.find(e=>e.number===7)]) {
        await go(entry.number);
        if(size.width===390){const board=await page.locator('#scene canvas').boundingBox();assert.ok(board.width>300&&board.height>190,`${entry.title}: story keeps enough board space`);}
        await boxInside('#read-story');
        await page.locator('#read-story').click();
        await boxInside('#storybook-dialog');
        await page.locator('#finish-story').click();
        // Short landscape windows exercise the scrolling reader; the existing
        // game layout reserves its playable board for desktop and portrait sizes.
        if (size.height < 500) continue;
        await page.locator('#light-spirit').click();
        await boxInside('#spirit-bubble');
        const inside=await page.evaluate(()=>{
          const b=document.querySelector('#spirit-bubble').getBoundingClientRect(),s=document.querySelector('#scene').getBoundingClientRect();
          return b.left>=s.left && b.right<=s.right && b.top>=s.top && b.bottom<=s.bottom;
        });
        assert.ok(inside,'spirit dialogue fits inside scene without clipping');
        const zoom=(await state()).view.zoom;
        await page.locator('#spirit-reading').hover();await page.mouse.wheel(0,300);
        assert.equal((await state()).view.zoom,zoom,'bubble scroll never zooms board');
        if(entry.chapterLevel===1&&(size.width===390||size.width===844))await page.screenshot({path:resolve(qa,`${name}-spirit-${entry.chapter}-${size.width}.png`)});
        await page.locator('#next-spirit').click();await page.locator('#next-spirit').click();
        await page.locator('#close-spirit').click();
        assert.equal(await page.locator('#storybook-dialog').isVisible(),false);
      }
      assert.equal(await page.evaluate(()=>document.scrollingElement.scrollTop),0,'page stays fixed');
      if(size.width===390){await go(1);await page.locator('#read-story').click();await page.screenshot({path:resolve(qa,`${name}-storybook-mobile.png`)});await page.keyboard.press('Escape');}
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.spirit-flight').evaluate(e=>getComputedStyle(e).animationName),'none','reduced motion stops hovering and keeps soft light');
    await page.locator('#read-story').click();await page.locator('#close-story').click();
    assert.equal(await page.locator('#storybook-dialog').count(),1);
    assert.equal(await page.locator('#read-story').count(),1);
    checks.push('all-level-mobile-reader','three-chapter-desktop-and-portrait-spirit','short-and-narrow-window-reader-fit','reader-and-spirit-internal-scrolling','orb-and-bubble-fit-portrait-board-in-all-15-levels','reduced-motion','one-reusable-reader');
    assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
    report.push({browser:name,levelCount:levelSummaries.length,checks,errors,remote,environmentRequests});
    console.log(`${name}: ${checks.length} storybook integration checks passed`);
  } finally { await browser.close(); }
}
await writeFile(resolve(qa,'storybook-report.json'),JSON.stringify(report,null,2));
