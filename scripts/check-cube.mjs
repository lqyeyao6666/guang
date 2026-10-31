import { pauseAction, useHint } from './browser-environment.mjs';
import { prepareDebugNavigation, selectLevel } from './browser-environment.mjs';
import { dismissStoryOpening } from './browser-environment.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {CUBE_SOLUTION,CUBE_FACE_ORDER} from '../src/cube-level.ts';
import {isolateBrowserEnvironment,isEnvironmentRequest} from './browser-environment.mjs';
const url=process.env.GAME_URL||'http://127.0.0.1:4177';
await mkdir('qa',{recursive:true});const report=[];
for(const [browserName,executablePath] of [['chrome','C:/Program Files/Google/Chrome/Application/chrome.exe'],['edge','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']]) {
 const browser=await chromium.launch({executablePath,headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const environmentRequests=await isolateBrowserEnvironment(page); await prepareDebugNavigation(page);
 const errors=[],remoteRequests=[],verified=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!isEnvironmentRequest(message.location().url))errors.push(message.text());});
 page.on('request',request=>{if(!request.url().startsWith(url)&&!request.url().startsWith('data:')&&!isEnvironmentRequest(request.url()))remoteRequests.push(request.url());});
 const state=()=>page.evaluate(()=>window.__warmLight.state());
 const cube=()=>page.evaluate(()=>window.__warmLight.cubeState());
 const item=async id=>(await state()).level.items.find(item=>item.id===id);
 const count=async kind=>Number(await page.locator(`[data-count="${kind}"]`).textContent());
 const point=(position,height=.2)=>page.evaluate(({position,height})=>window.__warmLight.screenPoint(position,height),{position,height});
 const itemPoint=id=>page.evaluate(id=>window.__warmLight.itemPoint(id),id);
 const center=async locator=>{const b=await locator.boundingBox();assert.ok(b);return{x:b.x+b.width/2,y:b.y+b.height/2};};
 const drag=async(a,b)=>{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:15});await page.mouse.up();};
 const place=async(kind,position)=>{const id=(await state()).level.items.find(item=>item.kind===kind&&item.inInventory).id;await drag(await center(page.locator(`[data-kind="${kind}"] .item-thumbnail`)),await point(position));return id;};
 const rotate=async(id,angle)=>{const p=await itemPoint(id);await page.mouse.click(p.x,p.y,{button:'right'});await page.locator(`#rotation-menu [data-angle="${angle}"]`).click();assert.equal((await item(id)).angle,angle);};
 const store=async id=>{await drag(await itemPoint(id),await center(page.locator('#inventory')));assert.equal((await item(id)).inInventory,true);};
 const shot=suffix=>page.screenshot({path:`qa/${browserName}-cube-${suffix}.png`,fullPage:true});
 const solveFace=async layer=>{
  await page.locator(`[data-cube-face="${layer}"]`).click();
  for(const [x,y,angle] of CUBE_SOLUTION[layer].mirrors) {const id=await place('mirror',{x,y,layer});assert.deepEqual([(await item(id)).x,(await item(id)).y,(await item(id)).layer],[x,y,layer]);await rotate(id,angle);}
  const id=await place('coreMirror',{x:4,y:4,layer});await rotate(id,CUBE_SOLUTION[layer].angle);
 };
 try {
  await page.goto(`${url}/?level=11`,{waitUntil:'networkidle'}); await dismissStoryOpening(page);await page.waitForFunction(()=>window.__warmLight);
  assert.match(await page.title(),/第一章第5关/);assert.equal((await state()).level.items.filter(item=>item.kind==='source').length,1);assert.equal((await state()).level.layers,6);assert.deepEqual((await cube()).receiver,[0,0,0]);
  assert.equal(await count('mirror'),12);assert.equal(await count('coreMirror'),6);assert.equal((await cube()).progress.faces.filter(face=>face.passed).length,0);
  assert.ok((await state()).beamPaths.every(segment=>segment.start.layer===0 && segment.end.layer===0));
  verified.push('direct-chapter1-level5','six-real-faces','single-bottom-source','floating-center-at-origin','twelve-mirrors-six-inward-mirrors','initial-zero-passes','initial-five-faces-no-light');
  assert.ok(await page.locator('#layer-guide').isVisible());assert.ok(await page.locator('#cube-controls').evaluate(element=>element.classList.contains('guide-target')));await shot('guide');
  const zoom=(await state()).view.zoom;await page.mouse.move(200,500);await page.mouse.wheel(0,250);assert.equal((await state()).view.zoom,zoom);
  await page.mouse.click(30,350);assert.equal(await page.locator('#layer-guide').isVisible(),false);assert.equal((await state()).moves,0);
  await page.locator('#cube-guide').click();assert.ok(await page.locator('#layer-guide').isVisible());await page.locator('[data-cube-face="0"]').click();assert.equal(await page.locator('#layer-guide').isVisible(),false);assert.equal((await cube()).active,0);
  verified.push('entry-guide-highlight','guide-pauses-wheel','single-click-no-accidental-drag','guide-reopen-and-select-face');
  const baseline=(await state()).beamPaths;
  await page.locator('#cube-hide-others').click();assert.equal((await cube()).hideOthers,false);assert.deepEqual((await state()).beamPaths,baseline);
  await page.locator('#cube-hide-others').click();assert.equal((await cube()).hideOthers,true);
  for(let layer=0;layer<6;layer++) {await page.locator(`[data-cube-face="${layer}"]`).click();assert.equal((await cube()).active,layer);assert.deepEqual((await state()).beamPaths,baseline);}
  await page.locator('#cube-overview').click();assert.ok((await cube()).overview);await shot('initial-overview');
  const overviewCount=await count('mirror');await place('mirror',{x:2,y:2,layer:0});assert.equal(await count('mirror'),overviewCount);
  verified.push('six-face-navigation','hide-others-does-not-change-optics','transparent-mode','overview-readonly');
  await page.locator('[data-cube-face="0"]').click();
  for(const id of ['source','cube-point-0','cube-block-0-0']) {const p=await itemPoint(id);await page.mouse.click(p.x,p.y,{button:'right'});assert.equal(await page.locator('#rotation-menu [data-angle]').count(),0);await page.keyboard.press('Escape');}
  await place('coreMirror',{x:3,y:4,layer:0});assert.equal(await count('coreMirror'),6);
  await place('mirror',{x:4,y:4,layer:0});assert.equal(await count('mirror'),12);
  await place('mirror',{x:1,y:3,layer:0});assert.equal(await count('mirror'),12);
  const start=await center(page.locator('[data-kind="mirror"] .item-thumbnail'));await page.mouse.move(start.x,start.y);await page.mouse.down();const end=await point({x:2,y:2,layer:0});await page.mouse.move(end.x,end.y,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await count('mirror'),12);
  verified.push('fixed-devices-locked','center-socket-reserved','inward-mirror-placement-rule','block-occupancy','cancel-no-item-loss');
  for(let hint=1;hint<=4;hint++) {await useHint(page);assert.equal((await state()).hintStep,hint);if(hint<4)assert.doesNotMatch(await page.locator('#hint-content').textContent(),/\(\d+,\d+\)/);}
  await shot('hint');await pauseAction(page, 'restart'); await dismissStoryOpening(page);assert.equal((await state()).hintStep,0);assert.equal(await page.locator('#layer-guide').isVisible(),false);
  verified.push('four-hints-coordinates-last','restart-without-guide-repeat');
  for(const [order,layer] of CUBE_FACE_ORDER.slice(0,5).entries()) {await solveFace(layer);assert.equal((await cube()).progress.faces.filter(face=>face.arrived).length,order+1);assert.equal((await state()).won,false);await shot(`face-${layer}-connected`);}
  verified.push('actual-drag-on-five-face-planes','per-face-current-progress','five-routes-cannot-win');
  const lastLayer=CUBE_FACE_ORDER.at(-1),lastAngle=CUBE_SOLUTION[lastLayer].angle;
  await page.locator(`[data-cube-face="${lastLayer}"]`).click();
  for(const [x,y,angle] of CUBE_SOLUTION[lastLayer].mirrors) {const id=await place('mirror',{x,y,layer:lastLayer});await rotate(id,angle);}
  assert.equal((await cube()).progress.faces[lastLayer].passed,true);assert.equal((await cube()).progress.faces[lastLayer].arrived,false);assert.equal((await state()).won,false);
  const lastCore=await place('coreMirror',{x:4,y:4,layer:lastLayer});
  assert.equal((await state()).ready,false);
  const lastTurn=(await state()).level.items.find(item=>item.kind==='mirror'&&item.movable&&!item.inInventory&&item.layer===lastLayer&&item.x===4&&item.y===6);
  await store(lastTurn.id);await rotate(lastCore,lastAngle);await store(lastCore);
  await place('mirror',{x:lastTurn.x,y:lastTurn.y,layer:lastLayer});
  const coreStart=await center(page.locator('[data-kind="coreMirror"] .item-thumbnail')),coreEnd=await point({x:4,y:4,layer:lastLayer});
  await page.mouse.move(coreStart.x,coreStart.y);await page.mouse.down();await page.mouse.move(coreEnd.x,coreEnd.y,{steps:15});await page.waitForTimeout(750);assert.equal((await state()).won,false);await page.mouse.up();
  await page.waitForFunction(()=>window.__warmLight.state().won);
  assert.equal((await cube()).progress.faces.filter(face=>face.arrived).length,6);const solvedEnergy=(await state()).qualifiedReceived.beacon;assert.ok(solvedEnergy>=.18&&solvedEnergy<.2);
  assert.equal((await state()).beamPaths.filter(segment=>segment.core).length,6);await shot('solved');
  await page.locator('#continue').click();await page.locator('#cube-overview').click();await shot('solved-overview');
  verified.push('passed-without-center-not-enough','preview-does-not-win','inward-angle-required','six-beams-meet-center','continuous-six-route-win','energy-conservation');
  await page.locator(`[data-cube-face="${lastLayer}"]`).click();await store(lastCore);assert.equal((await cube()).progress.faces[lastLayer].arrived,false);const returned=await place('coreMirror',{x:4,y:4,layer:lastLayer});assert.equal((await item(returned)).angle,lastAngle);assert.equal((await state()).ready,true);
  verified.push('stored-inward-angle-preserved','progress-recomputes-after-return');
  await page.locator('#open-settings').click();await page.locator('#pitch').fill('30');await page.locator('#done-settings').click();
  const p30=await itemPoint(returned);await page.mouse.click(p30.x,p30.y,{button:'right'});await page.locator('[data-angle="180"]').click();assert.equal((await state()).ready,false);await rotate(returned,lastAngle);
  await page.locator('#open-settings').click();await page.locator('#pitch').fill('85');await page.locator('#done-settings').click();await store(returned);await place('coreMirror',{x:4,y:4,layer:lastLayer});assert.equal((await state()).ready,true);
  await page.locator('#open-settings').click();await page.locator('#reset-settings').click();await page.locator('#done-settings').click();
  const blank=await point({x:7,y:1,layer:lastLayer});await page.mouse.move(blank.x,blank.y);await page.mouse.down();await page.mouse.move(blank.x+80,blank.y,{steps:12});await page.mouse.up();assert.ok(Math.abs((await state()).view.rotation)>.1);await store(returned);await place('coreMirror',{x:4,y:4,layer:lastLayer});assert.equal((await state()).ready,true);
  verified.push('face-picking-at-pitch30','face-drag-at-pitch85','face-drag-after-orbit');
  await selectLevel(page, 6); await dismissStoryOpening(page);assert.equal(await page.locator('#cube-controls').isVisible(),false);assert.equal(await page.locator('#cube-status').evaluate(element => !element.hidden),false);assert.equal((await state()).layers.count,1);await page.goBack(); await dismissStoryOpening(page);assert.equal((await state()).level.number,11);assert.equal(await count('mirror'),12);assert.ok(await page.locator('#layer-guide').isVisible());await page.keyboard.press('Enter');
  verified.push('old-level-cleanup','history-initial-layout','guide-on-reentry');
  for(const [width,height] of [[1366,768],[1280,720],[1024,768],[390,844]]) {
   await page.setViewportSize({width,height});const layout=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));assert.equal(layout.sw,layout.w);assert.equal(layout.sh,layout.h);
   for(const selector of ['#cube-controls','#toggle-inventory','#toggle-inventory','#inventory','[data-kind="coreMirror"]']) {const b=await page.locator(selector).boundingBox();assert.ok(b.y>=0&&b.y+b.height<=height,`${selector} outside ${width}x${height}`);}
   await shot(`layout-${width}`);verified.push(`layout-${width}`);
  }
  await page.locator('#cube-guide').click();const guide=await page.locator('#layer-guide-card').boundingBox();assert.ok(guide.y>=0&&guide.y+guide.height<=844);await shot('mobile-guide');await page.keyboard.press('Escape');
  for(const layer of CUBE_FACE_ORDER) await solveFace(layer);await page.waitForFunction(()=>window.__warmLight.state().won);await shot('mobile-solved');await page.locator('#continue').click();await page.locator('#cube-overview').click();await shot('mobile-solved-overview');
  verified.push('mobile-guide-fits','mobile-eighteen-piece-completion');
  await pauseAction(page, 'restart'); await dismissStoryOpening(page);assert.equal(await count('mirror'),12);assert.equal(await count('coreMirror'),6);assert.equal((await cube()).progress.faces.filter(face=>face.arrived).length,0);assert.equal((await state()).won,false);
  verified.push('restart-clears-all-six-routes');
  assert.deepEqual(errors,[]);assert.deepEqual(remoteRequests,[]);verified.push('zero-game-console-errors','local-assets-only');
  report.push({browser:browserName,status:'passed',solvedEnergy,verified,errors,remoteRequests,environmentRequests});console.log(`${browserName}: ${verified.length} cube browser checks passed.`);
 } catch(error) {await shot('failure').catch(()=>{});console.error(browserName,JSON.stringify(await cube().catch(()=>null)));throw error;} finally {await browser.close();}
}
await writeFile('qa/cube-report.json',JSON.stringify(report,null,2));
