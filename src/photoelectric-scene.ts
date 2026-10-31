import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Item,Level } from './level.ts';
import type { PhotoelectricState } from './photoelectric-optics.ts';
import { SPECTRUM } from './level.ts';
import { PHOTO_WAVELENGTHS } from './photoelectric-level.ts';

const paint=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.04});
function block(w:number,h:number,d:number,color:string,x=0,y=0,z=0,r=.06) {
  const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,r),paint(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
function textSign(text:string,color:string,w:number,h:number) {
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle=color;ctx.font='500 44px "Microsoft YaHei"';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,384,64);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));return sign;
}
function tube(points:THREE.Vector3[],color:string,r=.03) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(16,points.length*10),r,8,false),paint(color));
}

// All scenery sits beyond the playable tiles; it never claims a cell or stops a ray.
function laboratoryGarden(center:number):THREE.Group {
  const garden=new THREE.Group();garden.name='photoelectric-garden';
  const at=(group:THREE.Group,x:number,z:number)=>{group.position.set(x-center,0,z-center);garden.add(group);return group;};
  const ball=(r:number,color:string,x:number,y:number,z:number)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),paint(color));m.position.set(x,y,z);m.castShadow=true;return m;};
  const planter=(x:number,z:number,right:boolean)=>{
    const bed=at(new THREE.Group(),x,z);bed.add(block(.58,.24,1.1,right?'#d4ded0':'#cedee6',0,.08));
    for(let i=0;i<3;i++){
      const pz=(i-1)*.30;bed.add(block(.035,.22,.035,'#91b6a4',0,.31,pz,.01));
      const flower=ball(.12,right?['#e8c1a9','#e6d9ac','#c8bada'][i]:['#c0dce4','#e9e8d2','#bdcedf'][i],0,.49,pz);flower.scale.y=.65;bed.add(flower);
      const leaf=ball(.10,'#a9c5ae',.1,.32,pz);leaf.scale.set(1,.35,.6);bed.add(leaf);
    }
  };
  for(const z of [3,6,10,14,16])planter(0,z,false);
  for(const z of [4,8,12,16])planter(18,z,true);
  for(const [x,z]of [[.1,1],[.1,8],[.1,12],[18,1],[18,6],[18,14]]){
    const tree=at(new THREE.Group(),x,z);tree.add(block(.38,.14,.45,'#d6e2dd',0,.03));tree.add(block(.10,.65,.10,'#b0a995',0,.36));
    const crown=ball(.36,x<9?'#b8d3d5':'#bfd5bd',0,.86,0);crown.scale.set(.85,1.25,.85);tree.add(crown);
    tree.add(ball(.24,'#d3e3ce',.16,.72,.05));
  }
  // A small glasshouse, with a pitched roof and seedlings visible through its walls.
  const house=at(new THREE.Group(),14.8,.05);house.name='photo-glasshouse';house.add(block(2.1,.15,1.2,'#d7e3de',0,.06));
  const glass=new THREE.Mesh(new THREE.BoxGeometry(1.85,.80,1.0),new THREE.MeshPhysicalMaterial({color:'#cee8eb',transparent:true,opacity:.25,roughness:.12,depthWrite:false}));glass.position.y=.55;house.add(glass);
  for(const x of [-.94,.94])for(const z of [-.52,.52])house.add(block(.05,.92,.05,'#f1f6ef',x,.56,z,.015));
  for(const z of [-.53,.53]){house.add(block(1.95,.06,.06,'#edf4ee',0,1.02,z,.02));for(const side of [-1,1]){const roof=block(1.08,.05,.06,'#edf4ee',side*.47,1.2,z,.015);roof.rotation.z=-side*.36;house.add(roof);}}
  house.add(block(.06,.06,1.12,'#edf4ee',0,1.39,0,.02));
  for(const x of [-.55,0,.55]){house.add(block(.26,.18,.28,'#d8bda5',x,.25));house.add(ball(.19,'#b4cda9',x,.46,0));}
  // Laboratory bench: books, three glass flasks and a little desk light.
  const bench=at(new THREE.Group(),4.5,.05);bench.name='photo-laboratory-bench';bench.add(block(2.25,.12,.8,'#d3dfe4',0,.66));
  for(const x of [-.85,.85])bench.add(block(.10,.62,.55,'#b6cbd6',x,.31));
  for(const [i,x]of [-.72,-.18,.38].entries()){
    const flask=ball(.18,['#badce9','#c7dcd1','#cbd0e5'][i],x,.89,0);bench.add(flask);bench.add(block(.10,.23,.10,'#dbeaf0',x,1.08));
  }
  for(let i=0;i<3;i++)bench.add(block(.30,.065,.40,['#c9cadd','#d0decb','#e6d4bc'][i],.86,.76+i*.067));
  const notice=at(new THREE.Group(),1.1,.05);notice.name='photo-science-sign';notice.add(block(1.5,.85,.09,'#c7dce5',0,.93));
  for(const x of [-.55,.55])notice.add(block(.06,.65,.06,'#a3bdc9',x,.36));
  const equation=textSign('E = hν', '#6d91a3',1.25,.38);equation.position.set(0,1.08,.06);notice.add(equation);
  const note=textSign('光子实验室', '#7398a8',1.3,.25);note.position.set(0,.76,.06);notice.add(note);
  // An atom sculpture outside the left island, not another optical component.
  const atom=at(new THREE.Group(),-.1,18.0);atom.name='photo-atom-sculpture';atom.add(block(.85,.20,.85,'#d0e0e8',0,.08));atom.add(ball(.18,'#d4bdad',0,.76,0));
  for(let n=0;n<3;n++){const orbit=new THREE.Mesh(new THREE.TorusGeometry(.55,.018,6,48),paint('#9fbdcc'));orbit.position.y=.76;orbit.rotation.set(.4+n*.7,n*.9,.35);atom.add(orbit);atom.add(ball(.06,'#b6cfc1',Math.cos(n*2)*.48,.76+Math.sin(n*2)*.35,.12));}
  // Quiet courtyard at the front: a little pond, stepping stones and a garden seat.
  const pond=at(new THREE.Group(),12,18.15);pond.name='photo-garden-pond';pond.add(block(2.0,.13,.78,'#c6d9d8',0,.04));pond.add(block(1.75,.035,.56,'#b6d7df',0,.12));
  for(const x of [-.5,.3]){const pad=ball(.13,'#b8cbb5',x,.16,.1);pad.scale.y=.18;pond.add(pad);pond.add(ball(.06,'#e6cabb',x,.2,.1));}
  const seat=at(new THREE.Group(),16,18.05);seat.add(block(1.45,.12,.45,'#d8c6aa',0,.39));seat.add(block(1.45,.30,.09,'#dfd0b9',0,.65,.19));for(const x of [-.55,.55])seat.add(block(.09,.38,.32,'#a4bcaf',x,.18));
  for(const [x,z]of [[3,18],[5,18],[7,18],[10,18],[14,18]])garden.add(block(.45,.055,.36,'#e1ebe8',x-center,-.02,z-center));
  return garden;
}

export function photoelectricItem(item:Item):THREE.Group {
  const root=new THREE.Group();
  if(item.kind==='photocell') {
    root.add(block(.85,.16,.8,'#b5d0df',0,.36));
    const glass=new THREE.Mesh(new RoundedBoxGeometry(.85,.62,.65,3,.14),new THREE.MeshPhysicalMaterial({color:'#bbdfea',transparent:true,opacity:.16,roughness:.1,depthWrite:false}));glass.position.y=.79;root.add(glass);
    const cathode=block(.06,.48,.50,'#bd9e6b',-.13,.76);cathode.name='photo-cathode';root.add(cathode);
    const anode=block(.035,.42,.45,'#8eb5c6',.24,.76);root.add(anode);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.26,.025,10,40),paint('#7c9dae'));ring.rotation.y=Math.PI/2;ring.position.set(.24,.76,0);root.add(ring);
    root.add(block(.16,.11,.65,'#dce9e7',-.3,.32));
    const dots=new THREE.Group();dots.name='photo-electrons';
    for(let n=0;n<5;n++){const dot=new THREE.Mesh(new THREE.SphereGeometry(.035,12,8),new THREE.MeshBasicMaterial({color:'#7cdcca'}));dot.userData.phase=n/5;dots.add(dot);}dots.visible=false;root.add(dots);
    const label=textSign('Na', '#927c57',.38,.15);label.position.set(-.15,1.16,0);root.add(label);
  } else if(item.kind==='source') {
    root.add(block(.65,.15,.65,item.id==='source'?'#d0d6eb':'#d2e5df',0,.35));
    const shell=block(.48,.38,.48,'#b4cbd9',0,.61);root.add(shell);
    const face=new THREE.Mesh(new THREE.CircleGeometry(.15,24),new THREE.MeshStandardMaterial({color:'#f2faff',emissive:'#d8faff',emissiveIntensity:.03,roughness:.2}));face.rotation.y=Math.PI/2;face.position.set(.25,.61,0);face.name='photo-source-bulb';root.add(face);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.19,.035,10,40),paint('#e6f1f3'));rim.rotation.y=Math.PI/2;rim.position.set(.26,.61,0);root.add(rim);
    const glow=new THREE.PointLight('#c5f6e1',0,3);glow.name='photo-source-light';glow.position.set(.4,.7,0);root.add(glow);
    const arrow=new THREE.Mesh(new THREE.ConeGeometry(.09,.22,3),paint('#819dac'));arrow.rotation.z=-Math.PI/2;arrow.position.set(.46,.4,0);root.add(arrow);
    root.rotation.y=-item.angle*Math.PI/180;
  } else {
    // A broad receiving face, normal pointing toward the incoming upward beam.
    root.add(block(1.65,.15,.60,'#c0d7db',0,.36));
    const panel=block(1.4,.64,.07,'#e8eee2',0,.76,0);panel.name='photo-lantern-panel';root.add(panel);
    for(const x of [-.75,.75])root.add(block(.07,.86,.11,'#8caeaa',x,.78));root.add(block(1.6,.08,.16,'#a4c7bc',0,1.24));
    for(let n=0;n<5;n++){const flower=new THREE.Mesh(new THREE.SphereGeometry(.09,16,10),new THREE.MeshStandardMaterial({color:n%2?'#d5b994':'#a3c7b1',emissive:'#e6d1a6',emissiveIntensity:.02}));flower.scale.set(1.3,1,.32);flower.position.set((n-2)*.25,.72+(n%2)*.17,.055);root.add(flower);}
    const glow=new THREE.PointLight('#f6e0b4',0,5);glow.name='photo-lantern-light';glow.position.set(0,1.1,.3);root.add(glow);
  }
  return root;
}

export class PhotoelectricLab {
  readonly root=new THREE.Group();
  private committed:PhotoelectricState|null=null;
  private readonly relay:THREE.Mesh;
  private readonly cable:THREE.Mesh;
  private readonly lanterns:THREE.Mesh[]=[];
  private readonly clouds:THREE.Group[]=[];
  private victory=false;
  constructor(level:Level) {
    const center=(level.size+1)/2;
    this.root.add(laboratoryGarden(center));
    for(const [x,title,color]of [[4.5,'Ⅰ · 单色光与感光板','#7295ab'],[13.5,'Ⅱ · 独立电源与花灯','#7e9f98']] as const) {
      const label=textSign(title,color,5.8,.64);label.rotation.x=-Math.PI/2;label.position.set(x-center,.19,1.1-center);this.root.add(label);
    }
    const battery=new THREE.Group();battery.position.set(10-center,.3,2-center);
    battery.add(block(.62,.7,.65,'#b9cfc5',0,.35));battery.add(block(.30,.09,.3,'#ecf0e3',0,.75));
    const plus=textSign('+','#5d8a7b',.30,.30);plus.position.set(0,.39,.335);battery.add(plus);this.root.add(battery);
    const batteryLabel=textSign('独立电源', '#7b9b92',1.4,.24);batteryLabel.rotation.x=-Math.PI/2;batteryLabel.position.set(10-center,.18,.65-center);this.root.add(batteryLabel);
    const circuit=new THREE.Group();circuit.position.set(10-center,.3,4-center);
    circuit.add(block(.7,.25,.62,'#c7d9e2',0,.14));
    this.relay=block(.32,.08,.32,'#9faeb2',0,.30);circuit.add(this.relay);this.root.add(circuit);
    const relayLabel=textSign('光控继电器', '#7895a8',1.7,.24);relayLabel.rotation.x=-Math.PI/2;relayLabel.position.set(10-center,.18,4.7-center);this.root.add(relayLabel);
    const v=(x:number,y:number,z:number)=>new THREE.Vector3(x-center,y,z-center);
    // Wires sit below the gap: no optical beam, board tile or playable bridge crosses it.
    this.cable=tube([v(7,.27,3),v(8.1,.12,3),v(8.8,-.25,3),v(9.3,-.25,4),v(10,.25,4)],'#9bafbd',.035);this.root.add(this.cable);
    this.root.add(tube([v(10,.35,2),v(10.2,.32,2.3),v(11,.32,2.3),v(11,.35,3)],'#d7ad94'));
    this.root.add(tube([v(10,.34,4),v(10.5,.28,4.2),v(11.4,.28,4.1),v(11.4,.34,3)],'#94b7c4'));
    for(const [x,y]of [[17.65,2],[17.65,6],[17.65,10],[17.65,14],[13.5,17.8],[10.7,17.8]]) {
      const lamp=new THREE.Group();lamp.position.set(x-center,0,y-center);lamp.add(block(.12,1.0,.12,'#91afa9',0,.5));
      const light=new THREE.Mesh(new RoundedBoxGeometry(.34,.40,.34,3,.08),new THREE.MeshStandardMaterial({color:'#e5e9dc',emissive:'#f5d6a0',emissiveIntensity:.03}));light.position.y=1.12;lamp.add(light);this.lanterns.push(light);lamp.add(block(.43,.07,.43,'#b4cdbb',0,1.35));this.root.add(lamp);
    }
    for(const [i,[x,z]]of [[-10,-5],[10,-5],[-10,5],[10,5],[-4,-11],[4,-11]].entries()){
      const cloud=new THREE.Group();cloud.position.set(x,-.1,z);cloud.userData.phase=i;
      for(let n=0;n<4;n++){const puff=new THREE.Mesh(new THREE.SphereGeometry(.55+n%2*.12,16,10),paint('#fafefe'));puff.scale.set(1,.48,.7);puff.position.set(Math.sin(n*2)*.55,.05*Math.cos(n),Math.cos(n*2)*.25);cloud.add(puff);}this.clouds.push(cloud);this.root.add(cloud);
    }
  }
  setTrace(state:PhotoelectricState|undefined,preview:boolean):void {if(!preview)this.committed=state?{...state}:null;}
  update(time:number,won:boolean,items:Map<string,THREE.Group>):void {
    const state=this.committed;this.victory=won;
    (this.relay.material as THREE.MeshStandardMaterial).color.set(state?.relayOn?'#9ccbb8':'#a2b5bf');
    (this.cable.material as THREE.MeshStandardMaterial).color.set(state?.relayOn?'#83b8a7':'#9bafbd');
    const electrons=items.get('photocathode')?.getObjectByName('photo-electrons');
    if(electrons){electrons.visible=!!state?.emitting;electrons.children.forEach((electron,i)=>{const phase=(time*.7+i/5)%1;electron.position.set(-.09+phase*.30,.66+(i%3)*.07,((i%2)*2-1)*.14);});}
    for(const id of ['source','powered-source']) {
      const bulb=items.get(id)?.getObjectByName('photo-source-bulb') as THREE.Mesh|undefined,light=items.get(id)?.getObjectByName('photo-source-light') as THREE.PointLight|undefined;
      if(!bulb||!light)continue;
      const active=id==='source'||!!state?.relayOn;
      const color=id==='source'?SPECTRUM.find(b=>b.id===PHOTO_WAVELENGTHS.find(w=>w.nm===state?.wavelengthNm)?.color)?.color??'#ee746b':'#d8fae5';
      const material=bulb.material as THREE.MeshStandardMaterial;material.color.set(active?color:'#9eafba');material.emissive.set(color);material.emissiveIntensity=active ? .55 : .01;light.color.set(color);light.intensity=active ? .45 : 0;
    }
    const panel=items.get('beacon')?.getObjectByName('photo-lantern-panel') as THREE.Mesh|undefined,glow=items.get('beacon')?.getObjectByName('photo-lantern-light') as THREE.PointLight|undefined;
    if(panel){const material=panel.material as THREE.MeshStandardMaterial;material.emissive.set('#ffe6b6');material.emissiveIntensity=won ? .7 : .01;}
    if(glow)glow.intensity=won?2.8:0;
    this.lanterns.forEach(lamp=>(lamp.material as THREE.MeshStandardMaterial).emissiveIntensity=won ? .7 : .03);
    this.clouds.forEach(cloud=>cloud.position.y=-.1+Math.sin(time*.3+cloud.userData.phase)*.035);
  }
  state(){return {islands:2,gapColumn:9,rightPowered:!!this.committed?.relayOn,electronsVisible:!!this.committed?.emitting,lanternsLit:this.victory?this.lanterns.length:0,garden:{planters:9,trees:6,glasshouse:true,laboratoryBench:true,atomSculpture:true,pond:true},rainbowVisible:false};}
}
