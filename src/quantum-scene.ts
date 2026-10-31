import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {Item,Level} from './level.ts';
import type {QuantumState} from './quantum-optics.ts';
import {photonDetection} from './quantum-optics.ts';
import {photoelectricItem} from './photoelectric-scene.ts';

const paint=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.04});
function box(w:number,h:number,d:number,color:string,x=0,y=0,z=0){const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,Math.min(.06,w/3,h/3,d/3)),paint(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;}
function orb(r:number,color:string,x=0,y=0,z=0){const m=new THREE.Mesh(new THREE.SphereGeometry(r,14,10),paint(color));m.position.set(x,y,z);m.castShadow=true;return m;}
function sign(text:string,w:number,h:number){const c=document.createElement('canvas');c.width=768;c.height=160;const ctx=c.getContext('2d')!;ctx.font='500 48px "Microsoft YaHei"';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#6e91a4';ctx.fillText(text,384,80);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));}
export function quantumItem(item:Item):THREE.Group {
  const root=new THREE.Group();
  if(item.kind==='source'||item.kind==='photocell'){root.add(photoelectricItem(item));if(item.kind==='photocell')root.rotation.y=-item.angle*Math.PI/180;return root;}
  if(item.kind==='beamSplitter'){
    root.add(box(.72,.14,.68,'#c4dce3',0,.35));
    const glass=new THREE.Mesh(new THREE.BoxGeometry(.82,.53,.045),new THREE.MeshPhysicalMaterial({color:'#99d0da',transparent:true,opacity:.55,roughness:.12,metalness:.15,depthWrite:false}));glass.position.y=.73;root.add(glass);
    for(const x of [-.43,.43])root.add(box(.045,.63,.08,'#7fa9b7',x,.73));root.add(box(.88,.045,.08,'#d5ebec',0,1.03));
    return root;
  }
  if(item.kind==='photonSource'){
    root.add(box(.68,.22,.65,'#c5cede',0,.39));root.add(box(.52,.45,.50,'#b2c6d8',0,.71));
    const face=orb(.16,'#b9d6ed',.28,.74,0);face.name='quantum-emitter';root.add(face);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.20,.026,10,36),paint('#e7f5fa'));rim.rotation.y=Math.PI/2;rim.position.set(.3,.74,0);root.add(rim);
    const cap=orb(.08,'#a6c8b8',0,1.04);cap.name='quantum-power';root.add(cap);return root;
  }
  const wide=item.id==='detector-a',width=wide?1.45:.83;
  root.add(box(width+.18,.18,.52,'#c6d8d7',0,.36));root.add(box(width,.70,.09,'#aec9d2',0,.81));
  const panel=box(width-.10,.59,.025,'#e5f2ee',0,.81,.065);panel.name='quantum-detector-panel';root.add(panel);
  const label=sign(wide?'A':'B',.24,.22);label.position.set(0,1.30,.06);root.add(label);
  const points=new THREE.Group();points.name='quantum-dots';
  for(let i=0;i<32;i++){const dot=new THREE.Mesh(new THREE.CircleGeometry(.04,10),new THREE.MeshBasicMaterial({color:'#d8b47f',transparent:true,opacity:0}));dot.position.set(Math.sin(i*2.399)*(.1+(i%7)*width/22),.56+(i%6)*.085,.084);points.add(dot);}root.add(points);
  const flash=orb(.10,'#eecb94',0,.82,.12);flash.name='quantum-click';flash.visible=false;root.add(flash);
  root.rotation.y=-(item.angle-90)*Math.PI/180;return root;
}

export class QuantumGarden {
  readonly root=new THREE.Group();
  private committed:QuantumState|undefined;
  private readonly fish:THREE.Group[]=[];
  private readonly clouds:THREE.Group[]=[];
  private readonly windows:THREE.Mesh[]=[];
  private readonly path:THREE.Mesh[]=[];
  private readonly counts={a:0,b:0,miss:0};
  private lastTime:number|null=null;private clock=0;private pulse=-1;private lastClick:'a'|'b'|null=null;private victory=0;
  constructor(level:Level){
    const center=(level.size+1)/2,at=(g:THREE.Group,x:number,z:number)=>{g.position.set(x-center,0,z-center);this.root.add(g);return g;};
    const label=(text:string,x:number,z:number,w=4)=>{const p=sign(text,w,.42);p.rotation.x=-Math.PI/2;p.position.set(x-center,.21,z-center);this.root.add(p);};
    label('Ⅰ · 选色与光电准备',4,.6,5);label('Ⅱ · 一束光，两种回答',13.8,.6,6);
    const slot=new THREE.Mesh(new THREE.TorusGeometry(.40,.023,8,48),paint('#95bdc8'));slot.rotation.x=Math.PI/2;slot.position.set(15-center,.27,10-center);this.root.add(slot);
    for(const item of level.items.filter(i=>i.rail)){
      const g=at(new THREE.Group(),18.5,item.y);for(const side of [-1,1])g.add(box(1.4,.065,.055,'#8ba6b9',0,.24,side*.24));
      for(const x of [-.5,0,.5])g.add(box(.025,.045,.38,'#d8e8ec',x,.27));for(const x of [-.69,.69])g.add(box(.10,.13,.60,'#c1d4de',x,.26));label(item.id==='phase-c'?'C':'D',19.5,item.y,.38);
    }
    // A real 3x3 water cell. All non-optical foliage remains inside its reserved area.
    const water=level.quantum!.water,tank=at(new THREE.Group(),water.minX+1.5,water.minY+1.5);tank.name='quantum-water-cell';
    tank.add(box(3.08,.16,3.08,'#bed9e2',0,.24));tank.add(box(2.96,.05,2.96,'#e1dfcb',0,.35));
    const glass=new THREE.MeshPhysicalMaterial({color:'#bce3ed',transparent:true,opacity:.15,roughness:.1,depthWrite:false,side:THREE.DoubleSide});
    const volume=new THREE.Mesh(new THREE.BoxGeometry(3,.65,3),glass);volume.position.y=.73;tank.add(volume);
    for(const side of [-1,1]){const p=new THREE.Mesh(new THREE.PlaneGeometry(3,1.1),glass);p.position.set(side*1.5,.92,0);p.rotation.y=Math.PI/2;tank.add(p);const q=p.clone();q.position.set(0,.92,side*1.5);q.rotation.y=0;tank.add(q);for(const z of [-1.5,1.5])tank.add(box(.04,1.1,.04,'#a9cbd5',side*1.5,.92,z));tank.add(box(3.02,.045,.05,'#dbedf1',0,1.46,side*1.5));}
    for(let i=0;i<5;i++){const f=new THREE.Group(),body=orb(.13,['#e9b381','#d9c68d','#a9cfbc','#b4c3dd','#e1b5b5'][i]);body.scale.set(1.5,.85,.6);f.add(body);const tail=new THREE.Mesh(new THREE.ConeGeometry(.10,.14,3),paint('#dfbb95'));tail.rotation.z=Math.PI/2;tail.position.x=-.21;f.add(tail);tank.add(f);this.fish.push(f);}
    for(const x of [-1.15,1.1])for(let n=0;n<3;n++){const leaf=orb(.10,'#a7c9af',x+(n-1)*.08,.54,1.1);leaf.scale.set(.45,2.8,.65);tank.add(leaf);}
    // Preparation bench and instruments, set on ledges outside playable cells.
    const bench=at(new THREE.Group(),3.8,-.05);bench.add(box(3.3,.12,1.05,'#ccdce4',0,.66));for(const x of [-1.2,1.2])bench.add(box(.12,.65,.75,'#aac3d0',x,.33));
    for(let n=0;n<4;n++){bench.add(orb(.18,['#bacfe6','#bddccf','#e4d6b5','#c5c8df'][n],n*.65-1,.92));bench.add(box(.10,.23,.10,'#dcebf0',n*.65-1,1.12));}
    const notice=at(new THREE.Group(),.1,.1);notice.add(box(1.1,.9,.09,'#c6dbe5',0,.99));notice.add(box(.08,.65,.08,'#a1bdcc',0,.4));const eq=sign('E = hν',.96,.35);eq.position.set(0,1.04,.055);notice.add(eq);
    // Frosted greenhouse with flowers, alongside the little observatory dome.
    const house=at(new THREE.Group(),12.7,-.08);house.name='quantum-glasshouse';house.add(box(3.0,.15,1.4,'#d2e1dd',0,.06));
    const glazing=new THREE.Mesh(new THREE.BoxGeometry(2.8,.95,1.2),new THREE.MeshPhysicalMaterial({color:'#c8e6e8',transparent:true,opacity:.25,roughness:.1,depthWrite:false}));glazing.position.y=.65;house.add(glazing);
    for(const x of [-1.4,0,1.4])for(const z of [-.6,.6])house.add(box(.05,1.12,.05,'#edf4ee',x,.65,z));
    for(const z of [-.63,.63])for(const side of [-1,1]){const roof=box(1.55,.06,.06,'#eef5ef',side*.70,1.39,z);roof.rotation.z=-side*.32;house.add(roof);}house.add(box(.06,.06,1.3,'#edf4ee',0,1.63));
    for(const x of [-.9,0,.9]){house.add(box(.3,.22,.32,'#d2bda7',x,.26));house.add(orb(.25,'#b4cba8',x,.55));}
    const dome=at(new THREE.Group(),17.7,-.1);dome.name='quantum-observatory';dome.add(box(1.65,.65,1.35,'#d2e1eb',0,.36));const roof=orb(.88,'#bdd4e4',0,.76);roof.scale.y=.62;dome.add(roof);dome.add(box(.14,.14,1.13,'#8eafc3',0,1.17,-.24));
    for(const [side,z]of [[0,3],[0,7],[0,11],[0,15],[20,2],[20,6],[20,10],[20,14],[20,18]]){
      const planter=at(new THREE.Group(),side,z);planter.add(box(.65,.25,1.2,'#d4ded2',0,.08));
      for(let n=0;n<3;n++){planter.add(box(.035,.26,.035,'#98b9a2',0,.30,(n-1)*.31));const f=orb(.15,['#d7c3d8','#e4c1a6','#dddbad'][n],0,.49,(n-1)*.31);f.scale.y=.65;planter.add(f);}
    }
    for(const [x,z]of [[0,5],[0,9],[0,13],[0,18],[20,4],[20,8],[20,12],[20,16]]){const g=at(new THREE.Group(),x,z);g.add(box(.4,.16,.5,'#d8e4df',0,.08));g.add(box(.10,.72,.10,'#b3ac99',0,.42));const crown=orb(.40,x<8?'#bad1d4':'#b9d1bc',0,1);crown.scale.set(.9,1.3,.9);g.add(crown);}
    for(const [x,z]of [[0,16],[20,7]]){const person=at(new THREE.Group(),x,z);person.add(box(.26,.44,.21,'#ecf2ef',0,.48));person.add(orb(.15,'#e7c9ae',0,.86));const hair=orb(.16,'#a2a5a4',0,.94);hair.scale.y=.55;person.add(hair);for(const side of [-1,1])person.add(box(.065,.26,.09,'#97aeba',side*.075,.14));}
    // Three houses and a walking path make the final scene recall the game's three chapters.
    for(let i=0;i<3;i++){const g=at(new THREE.Group(),3.4+i*5.3,20);g.add(box(2.0,1.15,1.0,['#e6d8bd','#c6d9df','#d1dfd3'][i],0,.55));const roof=box(2.2,.17,1.25,'#b8c7c9',0,1.2);g.add(roof);
      for(const x of [-.48,.48]){const w=box(.38,.39,.035,'#a7c0cf',x,.75,.52);w.name='quantum-ending-window';g.add(w);this.windows.push(w);}g.add(box(.32,.65,.035,'#adbcbb',0,.33,.52));}
    for(let n=0;n<16;n++){const p=orb(.075,'#d5e7e1',2+n,.13,19.9+Math.sin(n*.7)*.18);p.name='quantum-ending-path';p.position.x-=center;p.position.z-=center;this.root.add(p);this.path.push(p);}
    const end=sign('每一束光，都有自己的回答。',7,.5);end.position.set(10-center,.4,21-center);end.rotation.x=-Math.PI/2;this.root.add(end);
    for(const [i,[x,z]]of [[-10,-7],[-10,4],[10,-8],[11,2],[11,9],[-5,-11],[3,-11],[-5,11]].entries()){const g=new THREE.Group();g.position.set(x,-.12,z);g.userData.phase=i;for(let n=0;n<5;n++){const puff=orb(.52+n%2*.13,'#fcffff',Math.sin(n*2)*.58,0,Math.cos(n*2)*.28);puff.scale.set(1,.47,.75);g.add(puff);}this.clouds.push(g);this.root.add(g);}
  }
  setTrace(state:QuantumState|undefined,preview:boolean){if(!preview){this.committed=state;if(!state?.powered){this.counts.a=0;this.counts.b=0;this.counts.miss=0;this.pulse=-1;this.clock=0;}}}
  update(time:number,won:boolean,items:Map<string,THREE.Group>){
    const delta=this.lastTime===null?0:Math.min(.1,Math.max(0,time-this.lastTime));this.lastTime=time;this.clock+=delta;
    const s=this.committed,active=!!s?.powered;
    const cap=items.get('photon-source')?.getObjectByName('quantum-power') as THREE.Mesh|undefined;if(cap)(cap.material as THREE.MeshStandardMaterial).color.set(active?'#a6cfb7':'#aabac5');
    const emitter=items.get('photon-source')?.getObjectByName('quantum-emitter') as THREE.Mesh|undefined;if(emitter){const m=emitter.material as THREE.MeshStandardMaterial;m.emissive.set('#a2c8ec');m.emissiveIntensity=active?.38:.01;}
    const pulse=Math.floor(this.clock*5);if(active&&pulse!==this.pulse){this.pulse=pulse;const sample=((pulse+1)*.618033988749895)%1;this.lastClick=photonDetection(s?.probabilityA??0,s?.probabilityB??0,sample);this.counts[this.lastClick??'miss']++;}
    for(const side of ['a','b']as const){const root=items.get(`detector-${side}`),flash=root?.getObjectByName('quantum-click'),dots=root?.getObjectByName('quantum-dots');if(flash)flash.visible=active&&this.lastClick===side&&this.clock*5%1<.48;if(dots)dots.children.forEach((dot,i)=>((dot as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity=i<Math.min(32,this.counts[side])?.75:0);}
    this.fish.forEach((f,i)=>{const phase=time*.2+i*1.4;f.position.set(Math.cos(phase)*(.6+i%2*.25),.66+(i%3)*.13,Math.sin(phase)*.8);f.rotation.y=phase+.5;});
    this.clouds.forEach(g=>g.position.y=-.12+Math.sin(time*.25+g.userData.phase)*.035);
    this.victory=won?(time===0?1:Math.min(1,this.victory+delta*.35)):0;
    this.windows.forEach((w,i)=>{const on=this.victory>(i+1)/8,m=w.material as THREE.MeshStandardMaterial;m.color.set(on?'#eddfb5':'#a7c0cf');m.emissive.set('#f0d49c');m.emissiveIntensity=on?.65:.01;});
    this.path.forEach((p,i)=>{const on=this.victory>(i+1)/19,m=p.material as THREE.MeshStandardMaterial;m.emissive.set('#ead4a6');m.emissiveIntensity=on?.65:.01;m.color.set(on?'#e7d9b3':'#d5e7e1');});
  }
  state(){return {powered:!!this.committed?.powered,closed:!!this.committed?.closed,probabilityA:this.committed?.probabilityA??0,probabilityB:this.committed?.probabilityB??0,counts:{...this.counts},lastClick:this.lastClick,celebrating:this.victory>0,windowsLit:this.windows.filter((_,i)=>this.victory>(i+1)/8).length,fish:5,trees:8,planters:9,houses:3,glasshouse:true,observatory:true,scientists:2,rainbowVisible:false};}
}
