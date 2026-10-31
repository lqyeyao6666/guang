import { pauseAction, useHint } from './browser-environment.mjs';
import { prepareDebugNavigation, selectLevel } from './browser-environment.mjs';
import { dismissStoryOpening } from './browser-environment.mjs';
import {levelSummaries} from '../src/level.ts';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {isEnvironmentRequest,isolateBrowserEnvironment} from './browser-environment.mjs';
import {PHOTO_LEFT_TURNS,PHOTO_RIGHT_TURNS} from '../src/photoelectric-level.ts';
import {sensorPosition,refractionRails,refractionMirrors} from './refraction-solution.mjs';
const url=process.env.GAME_URL||'http://127.0.0.1:4177',reports=[];
await mkdir('qa',{recursive:true});
for(const [name,executablePath]of [['chrome','C:/Program Files/Google/Chrome/Application/chrome.exe'],['edge','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']]){
  const browser=await chromium.launch({executablePath,headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],remoteRequests=[],verified=[];
  const environmentRequests=await isolateBrowserEnvironment(page); await prepareDebugNavigation(page);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!isEnvironmentRequest(m.location().url))errors.push(m.text());});
  page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:')&&!isEnvironmentRequest(r.url()))remoteRequests.push(r.url());});
  const state=()=>page.evaluate(()=>window.__warmLight.state()),item=async id=>(await state()).level.items.find(i=>i.id===id);
  const point=(p,height=.2)=>page.evaluate(({p,height})=>window.__warmLight.screenPoint(p,height),{p,height});
  const itemPoint=id=>page.evaluate(id=>window.__warmLight.itemPoint(id),id);
  const center=async locator=>{const b=await locator.boundingBox();assert.ok(b);return {x:b.x+b.width/2,y:b.y+b.height/2};};
  const drag=async(a,b)=>{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();};
  const place=async(kind,p)=>drag(await center(page.locator(`[data-kind="${kind}"] .item-thumbnail`)),await point(p));
  const move=async(id,p)=>drag(await itemPoint(id),await point(p,.62));
  const store=async id=>drag(await itemPoint(id),await center(page.locator('#inventory')));
  const positioned=async(id,x,y)=>{const a=await item(id);assert.equal(a.inInventory,false,id);assert.equal(a.x,x,id);assert.equal(a.y,y,id);};
  const rotate=async(id,angle)=>{const p=await itemPoint(id);await page.mouse.click(p.x,p.y,{button:'right'});await page.locator(`#rotation-menu [data-angle="${angle}"]`).click();assert.equal((await item(id)).angle,angle);};
  const intensity=async n=>{await page.locator('#photo-intensity').fill(String(n));await page.locator('#photo-intensity').dispatchEvent('input');assert.equal((await state()).level.photoelectric.intensity,n/100);};
  const wavelength=async n=>{await page.locator(`[data-wavelength="${n}"]`).click();assert.equal((await state()).level.photoelectric.wavelengthNm,n);};
  const mirrors=async()=>{for(const [n,[x,y,angle]]of [...PHOTO_LEFT_TURNS,...PHOTO_RIGHT_TURNS].entries()){const id=n?`mirror-${n+1}`:'mirror';await place('mirror',{x,y});await positioned(id,x,y);await rotate(id,angle);}};
  const solve=async()=>{await mirrors();await place('lens',{x:5,y:3});await positioned('lens',5,3);await place('concaveLens',{x:15,y:12});await positioned('concave',15,12);await intensity(100);await wavelength(460);await page.waitForFunction(()=>window.__warmLight.state().won);};
  const restart=async()=>{await pauseAction(page, 'restart'); await dismissStoryOpening(page);const s=await state();assert.equal(s.won,false);assert.equal(s.photoelectric.relayOn,false);assert.equal(s.level.photoelectric.wavelengthNm,650);};
  const shot=suffix=>page.screenshot({path:resolve(`qa/${name}-photoelectric-${suffix}.png`),fullPage:true});
  const pitch=async n=>{await page.locator('#open-settings').click();await page.locator('#pitch').fill(String(n));await page.locator('#pitch').dispatchEvent('input');await page.locator('#done-settings').click();};
  try{
    await page.goto(`${url}/?level=14`,{waitUntil:'networkidle'}); await dismissStoryOpening(page);await page.waitForFunction(()=>window.__warmLight);
    assert.match(await page.title(),/第三章第4关/);assert.equal(await page.locator('.level-navigation').count(), 0);assert.ok(await page.locator('#photo-controls').isVisible());assert.ok(await page.locator('#photoelectric-status').evaluate(element => !element.hidden));
    for(const selector of ['#toggle-inventory','#toggle-inventory','#toggle-inventory'])assert.equal(await page.locator(selector).isVisible(),false);
    const garden=(await state()).atmosphere.photoelectric.garden;assert.deepEqual(garden,{planters:9,trees:6,glasshouse:true,laboratoryBench:true,atomSculpture:true,pond:true});
    assert.equal((await state()).atmosphere.photoelectric.islands,2);assert.equal((await state()).atmosphere.photoelectric.rightPowered,false);assert.equal((await state()).atmosphere.photoelectric.rainbowVisible,false);await shot('initial');
    verified.push('direct-level14-and-all-old-navigation','two-separated-islands-no-rainbow','laboratory-and-garden-scenery','new-controls-and-science-status-only');
    for(const id of ['photocathode','powered-source','photo-wall-0','fixed-launch']){const before=await item(id);await move(id,{x:4,y:4});assert.deepEqual(await item(id),before);}
    for(const p of [{x:9,y:9},{x:10,y:2},{x:2,y:2}]){await place('mirror',p);assert.equal((await item('mirror')).inInventory,true);}
    verified.push('fixed-plate-sources-mirrors-obstacles-locked','gap-battery-and-occupied-tiles-reject-drops');
    await mirrors();await intensity(100);await wavelength(530);assert.equal((await state()).photoelectric.currentMicroamps,0);assert.equal((await state()).photoelectric.emitting,false);
    await wavelength(650);assert.equal((await state()).photoelectric.currentMicroamps,0);await wavelength(460);await intensity(25);
    const weak=await state();assert.ok(weak.photoelectric.emitting);assert.ok(!weak.photoelectric.relayOn);assert.equal(weak.atmosphere.photoelectric.electronsVisible,true);assert.equal(weak.atmosphere.photoelectric.rightPowered,false);await shot('weak-photocurrent');
    await intensity(100);const brighter=await state();assert.ok(Math.abs(brighter.photoelectric.currentMicroamps-weak.photoelectric.currentMicroamps*4)<1e-8);assert.equal(brighter.photoelectric.maxKineticEv,weak.photoelectric.maxKineticEv);assert.equal(brighter.photoelectric.relayOn,false);
    verified.push('twelve-mirrors-placed-and-rotated-with-real-input','red-and-green-cannot-emit-at-full-power','weak-blue-emits-without-powering-right-island','intensity-changes-current-not-electron-energy','unfocused-current-cannot-enable-relay');
    const begin=await center(page.locator('[data-kind="lens"] .item-thumbnail')),end=await point({x:5,y:3});
    await page.mouse.move(begin.x,begin.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:12});await page.waitForTimeout(750);
    const preview=await state();assert.equal(preview.photoelectric.relayOn,true);assert.equal(preview.atmosphere.photoelectric.rightPowered,false);assert.equal(preview.won,false);
    await page.keyboard.press('Escape');await page.mouse.up();assert.equal((await item('lens')).inInventory,true);assert.equal((await state()).photoelectric.relayOn,false);
    await place('lens',{x:5,y:3});await positioned('lens',5,3);await page.waitForTimeout(100);
    const powered=await state();assert.equal(powered.photoelectric.relayOn,true);assert.equal(powered.atmosphere.photoelectric.rightPowered,true);assert.ok(Math.abs(powered.photoelectric.currentMicroamps-2.7173739563865245)<1e-8);assert.equal(powered.photoelectric.coverage,.6);assert.equal(powered.won,false);await shot('relay-on');
    verified.push('convex-lens-preview-cannot-energize-actual-right-lamp','escape-restores-inventory-and-committed-current','photocurrent-relay-enables-independent-source','right-lamp-on-still-needs-wide-illumination');
    await wavelength(650);assert.equal((await state()).photoelectric.relayOn,false);assert.equal((await state()).atmosphere.photoelectric.rightPowered,false);assert.ok((await state()).beamPaths.every(s=>s.sourceId==='source'));await wavelength(405);assert.equal((await state()).photoelectric.relayOn,true);await wavelength(460);
    verified.push('frequency-change-immediately-cuts-power-no-latch','violet-also-powers-relay');
    await place('concaveLens',{x:15,y:13});await positioned('concave',15,13);await page.waitForTimeout(700);assert.equal((await state()).photoelectric.coverage,1);assert.ok((await state()).qualifiedReceived.beacon<.54);assert.equal((await state()).won,false);
    const a=await itemPoint('concave'),b=await point({x:15,y:12},.62);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.waitForTimeout(750);
    assert.equal((await state()).ready,true);assert.equal((await state()).won,false);assert.equal((await state()).atmosphere.photoelectric.lanternsLit,0);
    await page.mouse.up();await page.waitForFunction(()=>window.__warmLight.state().won);assert.ok(Math.abs((await state()).qualifiedReceived.beacon-.5635704494791666)<1e-8);assert.equal((await state()).atmosphere.photoelectric.lanternsLit,6);assert.match(await page.locator('#signal-text').innerText(),/花灯屏已铺满/);await page.locator('#continue').click();await shot('victory');
    verified.push('excessive-spread-fails-energy-despite-full-coverage','winning-preview-does-not-light-garden-or-win','committed-focusing-and-spreading-wins','actual-victory-lights-six-garden-lanterns');
    await restart();assert.equal((await state()).level.items.filter(i=>i.inInventory).length,14);assert.equal((await state()).atmosphere.photoelectric.lanternsLit,0);verified.push('restart-resets-frequency-intensity-inventory-and-garden');
    for(let n=1;n<=4;n++){await useHint(page);const text=await page.locator('#hint-content').innerText();if(n<4)assert.doesNotMatch(text,/\(\d+,\d+\)/);else assert.match(text,/\(5,3\)/);}await useHint(page);assert.equal(await page.locator('#hint-content').evaluate(element => !element.hidden),false);verified.push('four-hints-only-final-coordinates-and-collapsible');
    await restart();for(const n of [30,85]){await pitch(n);await place('mirror',{x:3,y:13});await positioned('mirror',3,13);await store('mirror');assert.equal((await item('mirror')).inInventory,true);}await pitch(53);
    const blank=await point({x:4,y:15});await drag(blank,{x:blank.x+65,y:blank.y});assert.ok(Math.abs((await state()).view.rotation)>.2);await place('mirror',{x:3,y:13});await positioned('mirror',3,13);await rotate('mirror',135);await store('mirror');await place('mirror',{x:3,y:14});await positioned('mirror',3,14);assert.equal((await item('mirror')).angle,135);await page.locator('#reset-view').click();verified.push('drag-and-store-at30-and85-pitch','rotated-board-drag-and-stored-angle');
    await selectLevel(page, 13); await dismissStoryOpening(page);assert.equal(await page.locator('#photo-controls').isVisible(),false);assert.equal((await state()).atmosphere.photoelectric,undefined);
    await move('rail-a',sensorPosition);await page.waitForFunction(()=>window.__warmLight.state().level.aquarium.gateOpen);
    for(const [id,x,y,angle]of refractionRails){await move(id,{x,y});if((await item(id)).angle!==angle)await rotate(id,angle);}
    for(const [id,x,y,angle]of refractionMirrors){await place('mirror',{x,y});await rotate(id,angle);}
    await page.waitForFunction(()=>window.__warmLight.state().won);await page.locator('#next-level').click(); await dismissStoryOpening(page);assert.equal((await state()).level.number,14);verified.push('prior-refraction-level-still-completes','refraction-next-enters-photoelectric');
    await wavelength(460);await selectLevel(page, 3); await dismissStoryOpening(page);assert.equal((await state()).atmosphere.photoelectric,undefined);assert.equal(await page.locator('#photo-controls').isVisible(),false);await page.goBack(); await dismissStoryOpening(page);assert.equal((await state()).level.number,14);assert.equal((await state()).level.photoelectric.wavelengthNm,650);await page.goForward(); await dismissStoryOpening(page);assert.equal((await state()).level.number,3);await selectLevel(page, 14); await dismissStoryOpening(page);verified.push('night-theme-cleans-up-experiment-scenery','history-restores-fresh-photoelectric-state');
    for(const viewport of [{width:1366,height:768},{width:1280,height:720},{width:1024,height:768},{width:390,height:844}]){await page.setViewportSize(viewport);await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));for(const selector of ['#toggle-inventory','#photo-controls','#toggle-inventory','[data-kind="concaveLens"]','#inventory', '#return-home']){const box=await page.locator(selector).boundingBox();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,`${selector} outside ${viewport.width}`);}const box=await page.locator('#inventory').boundingBox(),card=await page.locator('#inventory').boundingBox();assert.ok(box.y+box.height<=card.y+card.height+1);await shot(String(viewport.width));verified.push(`layout-${viewport.width}`);}
    await solve();await page.locator('#continue').click();await shot('mobile-victory');verified.push('mobile-fourteen-piece-complete-puzzle');
    await page.emulateMedia({reducedMotion:'reduce'});await restart();await solve();assert.equal((await state()).atmosphere.photoelectric.lanternsLit,6);await page.locator('#continue').click();await shot('reduced-motion');verified.push('reduced-motion-puzzle-and-victory');
    assert.deepEqual(errors,[]);assert.deepEqual(remoteRequests,[]);verified.push('zero-browser-errors','offline-local-assets');reports.push({browser:name,status:'passed',errors,remoteRequests,environmentRequests,verified});console.log(`${name}: ${verified.length} photoelectric browser checks passed`);
  }catch(error){await shot('failure').catch(()=>{});const s=await state().catch(()=>null);console.error(name,JSON.stringify(s&&{photoelectric:s.photoelectric,atmosphere:s.atmosphere,won:s.won,dragging:s.dragging,items:s.level.items.filter(i=>i.movable)}));throw error;}finally{await browser.close();}
}
await writeFile('qa/photoelectric-report.json',JSON.stringify(reports,null,2));
