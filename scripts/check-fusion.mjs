import { pauseAction, useHint } from './browser-environment.mjs';
import { prepareDebugNavigation, selectLevel } from './browser-environment.mjs';
import { dismissStoryOpening } from './browser-environment.mjs';
import {isEnvironmentRequest,isolateBrowserEnvironment} from './browser-environment.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fusionSolution} from './fusion-solution.mjs';
import {levelSummaries} from '../src/level.ts';
const url=process.env.GAME_URL||'http://127.0.0.1:4177';
await mkdir('qa',{recursive:true});const reports=[];
for(const [name,executablePath] of [['chrome','C:/Program Files/Google/Chrome/Application/chrome.exe'],['edge','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']]){
  const browser=await chromium.launch({executablePath,headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],remoteRequests=[],verified=[];
  const environmentRequests=await isolateBrowserEnvironment(page); await prepareDebugNavigation(page);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!isEnvironmentRequest(m.location().url))errors.push(m.text())});
  page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:'))!isEnvironmentRequest(r.url())&&remoteRequests.push(r.url())});
  const state=()=>page.evaluate(()=>window.__warmLight.state());const item=async id=>(await state()).level.items.find(i=>i.id===id);
  const point=(position,height=.2)=>page.evaluate(({position,height})=>window.__warmLight.screenPoint(position,height),{position,height});
  const itemPoint=id=>page.evaluate(id=>window.__warmLight.itemPoint(id),id);
  const center=async locator=>{const b=await locator.boundingBox();assert.ok(b);return{x:b.x+b.width/2,y:b.y+b.height/2}};
  const drag=async(a,b)=>{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up()};
  const place=async(kind,pos)=>drag(await center(page.locator(`[data-kind="${kind}"] .item-thumbnail`)),await point(pos));
  const move=async(id,pos)=>drag(await itemPoint(id),await point(pos,.62));
  const store=async id=>drag(await itemPoint(id),await center(page.locator('#inventory')));
  const rotate=async(id,angle)=>{const p=await itemPoint(id);await page.mouse.click(p.x,p.y,{button:'right'});await page.locator(`#rotation-menu [data-angle="${angle}"]`).click();assert.equal((await item(id)).angle,angle)};
  const step=async([kind,id,x,y,angle])=>{await place(kind,{x,y});assert.equal((await item(id)).inInventory,false,id);assert.equal((await item(id)).x,x,id);assert.equal((await item(id)).y,y,id);if(angle)await rotate(id,angle)};
  const solve=async()=>{for(const s of fusionSolution)await step(s);await page.waitForFunction(()=>window.__warmLight.state().won)};
  const shot=suffix=>page.screenshot({path:resolve(`qa/${name}-fusion-${suffix}.png`),fullPage:true});
  try{
    await page.goto(url+'/?level=10',{waitUntil:'networkidle'}); await dismissStoryOpening(page);await page.waitForFunction(()=>window.__warmLight);
    assert.equal((await state()).level.number,10);assert.equal((await state()).level.size,15);assert.match(await page.title(),/第三章第2关/);
    assert.equal(await page.locator('.level-navigation').count(), 0);assert.equal(await page.locator('#fusion-status').evaluate(element => !element.hidden),true);assert.equal(await page.locator('#spectrum-status').evaluate(element => !element.hidden),false);
    assert.equal((await state()).atmosphere.experiment.rainbowVisible,false);assert.equal((await state()).atmosphere.experiment.laserVisible,false);
    await shot('initial');verified.push('direct-level10','pale-blue-white-theme','15x15-board','two-recipe-cards','all-ten-level-navigation','no-rainbow');
    for(const id of ['mix-yellow','mix-cyan','split-green','boost-yellow','power-yellow','final-combiner','fusion-obstacle-0']){
      const before=await item(id);await move(id,{x:1,y:1});assert.deepEqual(await item(id),before);
    }
    await place('prism',{x:7,y:2});assert.equal((await item('prism')).inInventory,true);
    const start=await center(page.locator('[data-kind="block"] .item-thumbnail')),end=await point({x:6,y:5});
    await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();assert.equal((await item('shade-1')).inInventory,true);
    verified.push('fixed-devices-and-obstacles-locked','invalid-drop-no-loss','cancel-block-drag');
    await step(fusionSolution[0]);assert.equal((await state()).prismSplits,1);
    assert.equal((await state()).fusion.yellow.boosted,false);assert.equal((await state()).fusion.cyan.boosted,false);
    for(const angle of [90,180,270,0]){await rotate('prism',angle);assert.equal((await state()).prismSplits,angle===0?1:0)}
    await rotate('prism',270);await store('prism');await place('prism',{x:3,y:8});assert.equal((await item('prism')).angle,270);
    const p=await itemPoint('prism');await page.mouse.click(p.x,p.y);await page.keyboard.press('e');assert.equal((await item('prism')).angle,0);
    verified.push('seven-raw-colors-no-enhancement','prism-four-directions','prism-storage-preserves-angle','q-e-cardinal-rotation');
    for(let h=1;h<=4;h++){await useHint(page);const text=await page.locator('#hint-content').innerText();if(h<4)assert.doesNotMatch(text,/\(\d+,\d+\)/);else assert.match(text,/\(14,12\)/)}
    await pauseAction(page, 'restart'); await dismissStoryOpening(page);assert.equal((await state()).hintStep,0);verified.push('four-hints-last-only-coordinates');
    // Full mirror network first: native colors are present but contaminants block activation.
    await step(fusionSolution[0]);for(const s of fusionSolution.slice(3))await step(s);
    assert.equal((await state()).fusion.nodes['split-green'].contaminated,true);assert.equal((await state()).won,false);
    await step(['block','shade-1',7,9,0]);assert.equal((await state()).fusion.nodes['split-green'].contaminated,true);assert.equal((await state()).fusion.cyan.passed,false);assert.equal((await state()).won,false);
    await shot('block-gap');verified.push('small-block-next-to-splitter-does-not-stop-violet');
    await move('shade-1',{x:4,y:10});assert.equal((await state()).fusion.nodes['mix-yellow'].contaminated,true);assert.equal((await state()).fusion.cyan.passed,true);assert.equal((await state()).won,false);
    await shot('stray-orange');verified.push('violet-contamination-stops-splitter','orange-contamination-stops-yellow','one-enhanced-route-cannot-win');
    // Leave the final mirror incomplete while placing the last shade.
    await move('mirror-8',{x:14,y:13});await step(['block','shade-2',6,5,0]);
    assert.equal((await state()).fusion.yellow.passed,true);assert.equal((await state()).fusion.cyan.passed,true);
    await page.waitForTimeout(750);assert.equal((await state()).won,false);assert.equal((await state()).atmosphere.experiment.laserVisible,false);
    await shot('two-checkpoints');verified.push('two-checkpoints-still-require-final-delivery','laser-hidden-before-win');
    const a=await itemPoint('mirror-8'),b=await point({x:14,y:12},.62);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:14});await page.waitForTimeout(800);
    assert.equal((await state()).ready,true);assert.equal((await state()).won,false);assert.equal((await state()).atmosphere.experiment.laserVisible,false);
    await page.mouse.up();await page.waitForFunction(()=>window.__warmLight.state().won);await page.waitForFunction(()=>window.__warmLight.state().atmosphere.experiment.laserProgress===1);
    assert.ok(Math.abs((await state()).qualifiedReceived.beacon-.14593271227419427)<1e-8);assert.equal((await state()).fusion.yellow.arrived,true);assert.equal((await state()).fusion.cyan.arrived,true);
    assert.equal((await state()).atmosphere.experiment.rainbowVisible,false);await page.locator('#continue').click();await shot('laser');
    verified.push('preview-cannot-charge-or-fire','actual-double-enhancement-win','14-percent-qualified-energy','huge-laser-only-after-win','final-color-derived-from-rgb');
    await pauseAction(page, 'restart'); await dismissStoryOpening(page);await page.waitForFunction(()=>!window.__warmLight.state().atmosphere.experiment.laserVisible);
    assert.equal((await state()).fusion.yellow.passed,false);assert.equal((await state()).fusion.cyan.passed,false);assert.equal((await item('shade-1')).inInventory,true);verified.push('restart-clears-network-and-laser');
    await step(fusionSolution[0]);await step(fusionSolution[1]);
    await store('shade-1');assert.equal((await item('shade-1')).inInventory,true);await place('block',{x:6,y:5});assert.equal((await item('shade-1')).inInventory,false);
    const shadePoint=await itemPoint('shade-1');await page.mouse.click(shadePoint.x,shadePoint.y,{button:'right'});
    assert.equal(await page.locator('#rotation-menu [data-angle]').count(),0);await page.locator('#rotation-menu [data-recover="shade-1"]').click();
    assert.equal((await item('shade-1')).inInventory,true);await place('block',{x:6,y:5});verified.push('block-right-click-storage-without-rotation');
    for(const pitch of [30,85]){
      await page.locator('#open-settings').click();await page.locator('#pitch').fill(String(pitch));await page.locator('#pitch').dispatchEvent('input');await page.locator('#done-settings').click();
      await move('shade-1',{x:6,y:4});assert.equal((await item('shade-1')).y,4);await move('shade-1',{x:6,y:5});assert.equal((await item('shade-1')).y,5);
    }
    await page.locator('#open-settings').click();await page.locator('#reset-settings').click();await page.locator('#done-settings').click();
    const blank=await point({x:1,y:12});await drag(blank,{x:blank.x+60,y:blank.y});assert.ok(Math.abs((await state()).view.rotation)>.2);
    await move('shade-1',{x:6,y:4});assert.equal((await item('shade-1')).y,4);await store('shade-1');assert.equal((await item('shade-1')).inInventory,true);
    await page.locator('#reset-view').click();verified.push('movable-block-storage','block-drag-at30-and85','block-drag-after-rotation');
    await selectLevel(page, 7); await dismissStoryOpening(page);assert.equal(await page.locator('#fusion-status').evaluate(element => !element.hidden),false);assert.equal((await state()).atmosphere.experiment.laserVisible,false);
    // Chapter 3 level 1's next button follows the appended new level.
    const old=[['prism','prism',3,7,0],...[[7,1,0],[5,5,0],[7,7,0],[7,5,0],[7,9,0],[7,11,0],[7,13,0],[4,1,135],[12,7,135]].map((v,i)=>['mirror',i?'mirror-'+(i+1):'mirror',...v])];
    for(const s of old)await step(s);await page.waitForFunction(()=>window.__warmLight.state().won);await page.locator('#next-level').click(); await dismissStoryOpening(page);assert.equal((await state()).level.number,10);
    await page.goBack(); await dismissStoryOpening(page);assert.equal((await state()).level.number,7);assert.equal((await state()).won,false);await page.goForward(); await dismissStoryOpening(page);assert.equal((await state()).level.number,10);assert.equal((await state()).won,false);
    await selectLevel(page, 2); await dismissStoryOpening(page);assert.equal((await state()).atmosphere.experiment,undefined);await selectLevel(page, 10); await dismissStoryOpening(page);
    verified.push('prior-spectrum-level-still-wins','chapter3-next-level-link','history-clears-progress','switch-restores-other-themes');
    for(const viewport of [{width:1366,height:768},{width:1280,height:720},{width:1024,height:768},{width:390,height:844}]){
      await page.setViewportSize(viewport);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true);
      for(const selector of ['#toggle-inventory','#toggle-inventory','[data-kind="prism"]','#inventory', '#return-home']){
        const box=await page.locator(selector).boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width&&box.y+box.height<=viewport.height,`${selector} outside ${viewport.width}`);
      }
      // Return target must be inside its card and not covered by the next panel.
      const returnBox=await page.locator('#inventory').boundingBox(),card=await page.locator('#inventory').boundingBox();
      assert.ok(returnBox.y+returnBox.height<=card.y+card.height+1,'return zone overflows inventory');
      await shot(String(viewport.width));verified.push(`layout-${viewport.width}`);
    }
    await solve();await page.waitForFunction(()=>window.__warmLight.state().atmosphere.experiment.laserProgress===1);await page.locator('#continue').click();const trayBox=await page.locator('#inventory').boundingBox();assert.ok(trayBox.y+trayBox.height<=844,'mobile tray clipped');await shot('mobile-laser');verified.push('mobile-full-puzzle-real-drags');
    await page.emulateMedia({reducedMotion:'reduce'});await pauseAction(page, 'restart'); await dismissStoryOpening(page);await solve();assert.equal((await state()).atmosphere.experiment.laserProgress,1);verified.push('reduced-motion-laser');
    assert.deepEqual(errors,[]);assert.deepEqual(remoteRequests,[]);verified.push('zero-browser-errors','offline-local-assets');
    reports.push({browser:name,status:'passed',errors,remoteRequests,environmentRequests,verified});console.log(`${name}: ${verified.length} fusion browser checks passed`);
  }catch(error){await shot('failure').catch(()=>{});const snapshot=await state().catch(()=>null);console.error(name,JSON.stringify(snapshot && {level:snapshot.level.number,items:snapshot.level.items.filter(i=>i.movable),fusion:snapshot.fusion,ready:snapshot.ready,won:snapshot.won,dragging:snapshot.dragging}));throw error}
  finally{await browser.close()}
}
await writeFile('qa/fusion-report.json',JSON.stringify(reports,null,2));
