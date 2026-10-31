import {createLevel,moveItem,storeItem} from '../src/level.ts';
import {QUANTUM_STOCK} from '../src/quantum-level.ts';
import {traceLevel} from '../src/optics.ts';
import {advanceQuantumExperiment} from '../src/quantum-optics.ts';
export const quantumMirrors=QUANTUM_STOCK.map(([x,y,angle],n)=>[n?`mirror-${n+1}`:'mirror',x,y,angle]);
export const quantumExtras=[['prism',3,16,270],['lens',4,5,135],['concave',15,14,90]];
export function quantumSetup(){const l=createLevel(15);for(const i of l.items.filter(i=>i.kind==='block'&&i.movable))storeItem(l,i.id);for(const [id,x,y,angle]of [...quantumMirrors,...quantumExtras]){if(!moveItem(l,id,{x,y}))throw Error(`invalid ${id}`);l.items.find(i=>i.id===id).angle=angle;}moveItem(l,'phase-d',{x:18,y:10});return l;}
export function record(l){for(let n=0;n<10;n++)advanceQuantumExperiment(l,traceLevel(l),.1);return traceLevel(l);}
export function quantumSolved(){const l=quantumSetup();record(l);moveItem(l,'recombiner',{x:15,y:10});record(l);moveItem(l,'phase-c',{x:18.5,y:12});moveItem(l,'phase-d',{x:18.5,y:10});record(l);return l;}
