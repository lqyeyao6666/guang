import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {RuralCrowd} from '../src/rural-crowd.ts';
const crowd=new RuralCrowd(),verified=[];
crowd.update(1,false);const before=crowd.state();
for(let n=1;n<=180;n++)crowd.update(1+n/60,false);
const active=crowd.state();assert.equal(active.audience,10);assert.equal(active.chattingAdults,6);assert.equal(active.playingChildren,3);
assert.ok(active.people.filter(p=>p.role==='runner').every(p=>{const q=before.people.find(q=>q.name===p.name);return Math.hypot(p.position[0]-q.position[0],p.position[2]-q.position[2])>.5}));
assert.ok(active.people.slice(0,6).some((p,i)=>Math.abs(p.armAngles[0]-before.people[i].armAngles[0])>.1));verified.push('six-adults-chat-independently','three-children-follow-curved-routes');
let previous=active;
for(let n=1;n<=1200;n++){
 crowd.update(4+n/60,true);const next=crowd.state();
 for(let i=0;i<9;i++){assert.ok(Math.hypot(...next.people[i].position.map((v,k)=>v-previous.people[i].position[k]))<.08);assert.ok(next.people[i].position[0]>4.6)}
 previous=next;
}
const seated=crowd.state();assert.equal(seated.audiencePhase,'watching');assert.equal(seated.treeChildren,1);assert.equal(seated.shoulderChildren,1);assert.ok(seated.people[8].position[1]>.5);
assert.ok(new Set(seated.people.slice(0,8).map(p=>p.position[2].toFixed(1))).size>=6);verified.push('continuous-walk-and-climb-no-teleport','people-stay-right-outside-board','irregular-seats-tree-and-parent-shoulder');
crowd.reset();assert.equal(crowd.state().audiencePhase,'chatting-and-playing');verified.push('restart-restores-chatting-and-playing');
writeFileSync('qa/rural-crowd-report.json',JSON.stringify({checks:verified.length,verified},null,2));console.log(`${verified.length} crowd checks passed`);
