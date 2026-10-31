import { pauseAction, useHint } from './browser-environment.mjs';
import { prepareDebugNavigation, selectLevel } from './browser-environment.mjs';
import { dismissStoryOpening } from './browser-environment.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {SCHOOL_TURNS} from '../src/school-level.ts';
import {isEnvironmentRequest,isolateBrowserEnvironment} from './browser-environment.mjs';
const url=process.env.GAME_URL||'http://127.0.0.1:4177',reports=[];
for(const [name,executablePath] of [['chrome','C:/Program Files/Google/Chrome/Application/chrome.exe'],['edge','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']]){
 const browser=await chromium.launch({executablePath,headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),verified=[],errors=[],remote=[];
 await isolateBrowserEnvironment(page); await prepareDebugNavigation(page);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!isEnvironmentRequest(m.location().url))errors.push(m.text())});page.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:')&&!isEnvironmentRequest(r.url()))remote.push(r.url())});
 const state=()=>page.evaluate(()=>window.__warmLight.state()),school=async()=>(await state()).atmosphere.school;
 const item=async id=>(await state()).level.items.find(i=>i.id===id);
 const center=async locator=>{const b=await locator.boundingBox();assert.ok(b);return{x:b.x+b.width/2,y:b.y+b.height/2}};
 const ip=id=>page.evaluate(id=>window.__warmLight.itemPoint(id),id),point=p=>page.evaluate(p=>window.__warmLight.screenPoint(p),p);
 const start=async(a,b)=>{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12})};
 const drag=async(a,b)=>{await start(a,b);await page.mouse.up()};
 const place=async(kind,p)=>drag(await center(page.locator(`[data-kind="${kind}"] .item-thumbnail`)),await point(p));
 const store=async id=>drag(await ip(id),await center(page.locator('#inventory')));
 const rotate=async(id,a)=>{const p=await ip(id);await page.mouse.click(p.x,p.y,{button:'right'});await page.locator(`[data-angle="${a}"]`).click();assert.equal((await item(id)).angle,a)};
 const mirrors=async()=>{for(const [n,[x,y,a]] of SCHOOL_TURNS.entries()){const id=n?`mirror-${n+1}`:'mirror';await place('mirror',{x,y});assert.equal((await item(id)).inInventory,false,`place ${id} at ${x},${y}`);await rotate(id,a)}};
 const clear=async()=>{for(const id of ['school-crate-0','school-crate-1']){await store(id);assert.ok((await item(id)).inInventory)}};
 const shot=async suffix=>page.screenshot({path:`qa/${name}-school-${suffix}.png`,fullPage:true});
 try{
  await page.goto(`${url}/?level=12`,{waitUntil:'networkidle'}); await dismissStoryOpening(page);assert.equal((await state()).level.chapterLevel,5);assert.equal((await school()).phase,'anxious');assert.ok((await school()).studentCount>=8);assert.equal((await school()).brightness,0);
  assert.equal(await page.locator('[data-count="mirror"]').innerText(),'9');assert.match(await page.title(),/第二章第5关/);assert.equal(await page.locator('#rural-status').evaluate(element => !element.hidden),false);
  const before=await school();await page.waitForTimeout(850);const after=await school();assert.ok(after.students.some((p,n)=>Math.abs(p.headYaw-before.students[n].headYaw)>0.1));assert.ok(new Set(after.students.map(p=>p.headYaw.toFixed(2))).size>5);
  await shot('initial');verified.push('direct-entry-night-11x11-nine-mirrors','anxious-independent-student-movement','initial-dark-no-study');
  const crate=await item('school-crate-0');await drag(await ip(crate.id),await point({x:2,y:10}));assert.deepEqual(await item(crate.id),crate);
  await start(await ip(crate.id),await center(page.locator('#inventory')));await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(await item(crate.id),crate);
  await clear();verified.push('occupied-crate-drop-restores','escape-crate-drag-restores','both-book-crates-real-storage');
  for(let n=1;n<=3;n++){await useHint(page);assert.equal((await state()).hintStep,n);assert.equal(/[（(]\d+,\d+[）)]/.test(await page.locator('#hint-content').innerText()),false)}
  await useHint(page);assert.match(await page.locator('#hint-content').innerText(),/\(2,8\)/);await useHint(page);assert.equal(await page.locator('#hint-content').evaluate(element => !element.hidden),false);verified.push('four-tier-hints-only-last-coordinates','reference-hint-can-collapse');
  await mirrors();assert.equal((await state()).ready,false);assert.equal((await school()).powered,false);assert.equal((await state()).won,false);
  verified.push('all-nine-mirrors-real-drag-and-rotation','unfocused-light-insufficient');
  await place('lens',{x:8,y:5});assert.ok((await item('lens')).inInventory===false);assert.equal((await state()).ready,false);await rotate('lens',0);
  await store('lens');assert.equal((await item('lens')).angle,0);await pauseAction(page, 'restart'); await dismissStoryOpening(page);
  // Replay without hints for a clean final view and a committed-vs-preview win check.
  await clear();await mirrors();await place('lens',{x:1,y:9});await rotate('lens',0);await store('lens');
  await start(await center(page.locator('[data-kind="lens"] .item-thumbnail')),await point({x:8,y:5}));await page.waitForTimeout(900);
  assert.equal((await state()).ready,true);assert.equal((await state()).won,false);assert.equal((await school()).powered,false);assert.equal((await school()).brightness,0);
  await page.mouse.up();await page.waitForFunction(()=>window.__warmLight.state().won);await page.waitForFunction(()=>window.__warmLight.state().atmosphere.school.phase==='studying');
  assert.ok(Math.abs((await state()).qualifiedReceived.beacon-0.5508379840993083)<1e-6);assert.equal(await page.locator('#waypoint-value').innerText(),'3 / 3');
  assert.ok((await school()).students.every(p=>p.headPitch>0.3&&Math.abs(p.headYaw)<0.03));
  const studyBefore=await school();await page.waitForTimeout(400);const studyAfter=await school();assert.ok(studyAfter.students.some((p,n)=>p.mode==='writing'&&Math.abs(p.writingAngle-studyBefore.students[n].writingAngle)>0.02));
  await shot('studying');verified.push('lens-storage-keeps-angle','ready-preview-never-powers-classroom','actual-win-powers-and-fades-light','three-passages-and-55-percent-energy','students-read-or-write-after-win');
  await pauseAction(page, 'restart'); await dismissStoryOpening(page);assert.equal((await school()).phase,'anxious');assert.equal((await school()).brightness,0);assert.equal((await state()).level.items.filter(i=>i.inInventory).length,10);
  assert.equal((await item('school-crate-0')).inInventory,undefined);verified.push('restart-resets-all-crates-mirrors-light-and-students');
  await selectLevel(page, 9); await dismissStoryOpening(page);assert.ok((await state()).atmosphere.rural);assert.equal((await state()).atmosphere.school,undefined);
  await page.goBack(); await dismissStoryOpening(page);assert.equal((await state()).level.number,12);assert.equal((await school()).phase,'anxious');
  await selectLevel(page, 7); await dismissStoryOpening(page);assert.ok((await state()).atmosphere.experiment);assert.equal((await state()).atmosphere.school,undefined);await page.goBack(); await dismissStoryOpening(page);
  verified.push('rural-and-spectrum-preserved','history-restores-school-initial-state');
  await page.setViewportSize({width:1366,height:768});
  for(const pitch of [30,85]){await page.locator('#open-settings').click();await page.locator('#pitch').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))},String(pitch));await page.locator('#done-settings').click();await store('school-crate-0');assert.ok((await item('school-crate-0')).inInventory);await pauseAction(page, 'restart'); await dismissStoryOpening(page);}
  await page.locator('#open-settings').click();await page.locator('#reset-settings').click();await page.locator('#done-settings').click();
  const blank=await point({x:1,y:9});await drag(blank,{x:blank.x+90,y:blank.y});assert.ok(Math.abs((await state()).view.rotation)>0.2);await store('school-crate-0');assert.ok((await item('school-crate-0')).inInventory);await page.locator('#reset-view').click();
  verified.push('30-and-85-degree-crate-drag','rotated-view-crate-drag');
  for(const viewport of [{width:1280,height:720},{width:1024,height:768},{width:390,height:844}]){await page.setViewportSize(viewport);await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true);await shot(String(viewport.width));verified.push(`layout-${viewport.width}`)}
  await page.emulateMedia({reducedMotion:'reduce'});await pauseAction(page, 'restart'); await dismissStoryOpening(page);await clear();await mirrors();await place('lens',{x:8,y:5});await rotate('lens',0);await page.waitForFunction(()=>window.__warmLight.state().won);assert.equal((await school()).brightness,1);await shot('mobile-studying');verified.push('390x844-complete-real-drag-solve','reduced-motion-immediate-study');
  await page.locator('#next-level').click(); await dismissStoryOpening(page);assert.equal((await state()).level.number,7);verified.push('school-next-to-chapter-three');assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);verified.push('no-console-errors-no-remote-assets');
  reports.push({browser:name,checks:verified.length,verified,errors,remote});console.log(`${name}: ${verified.length} school checks passed`);
 }catch(error){await shot('failure').catch(()=>{});reports.push({browser:name,verified,errors,error:String(error)});throw error}
 finally{await writeFile('qa/school-report.json',JSON.stringify(reports,null,2));await browser.close()}
}
