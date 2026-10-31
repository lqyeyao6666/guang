import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Item, Level } from './level.ts';

const matte=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.58,metalness:.04});
function box(w:number,h:number,d:number,color:string,x=0,y=0,z=0,r=.04) {
  const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,r),matte(color));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
function fish(color:string):THREE.Group {
  const root=new THREE.Group(),body=new THREE.Mesh(new THREE.SphereGeometry(.15,20,12),matte(color));body.scale.set(1.6,.9,.65);root.add(body);
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.14,.20,3),matte(color));tail.rotation.z=Math.PI/2;tail.position.x=-.26;root.add(tail);
  for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.025,10,8),matte('#304e64'));eye.position.set(.15,.045,side*.085);root.add(eye);}
  return root;
}

export function aquariumItem(item:Item):THREE.Group {
  const root=new THREE.Group();
  if(item.kind==='sensor') {
    root.add(box(.6,.20,.6,'#c9e3e9',0,.4));
    const core=new THREE.Mesh(new THREE.SphereGeometry(.16,24,16),new THREE.MeshStandardMaterial({color:'#96d5ca',emissive:'#71b9aa',emissiveIntensity:.03,roughness:.3}));core.position.y=.62;core.name='sensor-core';root.add(core);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.25,.025,10,40),matte('#7ea3b5'));ring.rotation.x=Math.PI/2;ring.position.y=.62;root.add(ring);
  } else if(item.kind==='gate') {
    for(const x of [-.56,.56])root.add(box(.12,1.7,.16,'#7096a9',x,.97));root.add(box(1.25,.15,.22,'#b5d9e5',0,1.8));
    const shutter=new THREE.Group();shutter.name='gate-shutter';shutter.add(box(.92,.75,.92,'#91b7c6',0,.6,0,.06));
    for(const x of [-.28,0,.28])shutter.add(box(.055,.4,.016,'#e7faff',x,.62,.462,.007));root.add(shutter);
  } else {
    const orb=new THREE.Mesh(new THREE.SphereGeometry(.24,24,16),new THREE.MeshStandardMaterial({color:'#f6fff6',emissive:'#b3eddb',emissiveIntensity:.13,roughness:.25}));orb.name='aquarium-lamp';orb.position.y=.73;root.add(orb);root.add(box(.63,.24,.63,'#d0e6e7',0,.42));
    const light=new THREE.PointLight('#c5f8e6',0,3);light.name='aquarium-lamp-light';light.position.y=.9;root.add(light);
    for(const radius of [.3,.38]){const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.025,10,40),matte('#8cbbb5'));ring.rotation.x=Math.PI/2;ring.position.y=.59;root.add(ring);}
  }
  return root;
}

export class AquariumLab {
  readonly root=new THREE.Group();
  gateLift=0;
  private previous:number|null=null;
  private swimTime=0;
  private readonly swimmers:THREE.Group[]=[];
  private readonly bubbles:THREE.Mesh[]=[];
  private readonly clouds:THREE.Group[]=[];
  private readonly celebration=new THREE.Group();
  private readonly glow=new THREE.PointLight('#b3efd6',0,7);
  private celebrating=false;
  constructor(level:Level) {
    const tank=level.aquarium!,center=(level.size+1)/2,aquarium=new THREE.Group();aquarium.position.set(tank.minX+1.5-center,0,tank.minY+1.5-center);
    aquarium.add(box(3.1,.19,3.1,'#c1dce5',0,.18,0,.08));aquarium.add(box(2.98,.06,2.98,'#e8e3cd',0,.30,0,.03));
    const water=new THREE.Mesh(new THREE.BoxGeometry(3,.78,3),new THREE.MeshPhysicalMaterial({color:'#86cfdf',transparent:true,opacity:.12,roughness:.16,depthWrite:false,side:THREE.DoubleSide}));water.position.y=.74;water.renderOrder=2;aquarium.add(water);
    const glass=new THREE.MeshPhysicalMaterial({color:'#c6edf7',transparent:true,opacity:.14,roughness:.08,depthWrite:false,side:THREE.DoubleSide});
    for(const side of [-1,1]){const pane=new THREE.Mesh(new THREE.PlaneGeometry(3,1.2),glass);pane.position.set(side*1.5,.92,0);pane.rotation.y=Math.PI/2;aquarium.add(pane);const other=pane.clone();other.position.set(0,.92,side*1.5);other.rotation.y=0;aquarium.add(other);}
    for(const x of [-1.5,1.5])for(const z of [-1.5,1.5])aquarium.add(box(.035,1.2,.035,'#a7ced9',x,.92,z,.012));
    for(const y of [.34,1.52])for(const side of [-1,1]){aquarium.add(box(3.04,.045,.045,'#d6edf2',0,y,side*1.5,.016));aquarium.add(box(.045,.045,3.04,'#d6edf2',side*1.5,y,0,.016));}
    for(let i=0;i<5;i++){const swimmer=fish(['#f3b37a','#f6cf80','#a9d6c1','#eeb7aa','#94bfdb'][i]);swimmer.scale.setScalar(.85+i%2*.15);swimmer.userData.phase=i*1.3;this.swimmers.push(swimmer);aquarium.add(swimmer);}
    for(const [x,z] of [[-1.18,-1.15],[1.16,.98],[-1.05,.82]])for(let blade=0;blade<3;blade++){const leaf=new THREE.Mesh(new THREE.SphereGeometry(.1,12,8),matte('#9cc7ae'));leaf.scale.set(.45,2.6+blade*.5,.6);leaf.position.set(x+(blade-1)*.1,.48,z);leaf.rotation.z=(blade-1)*.3;aquarium.add(leaf);}
    for(let i=0;i<10;i++){const bubble=new THREE.Mesh(new THREE.SphereGeometry(.035+i%3*.012,12,8),new THREE.MeshBasicMaterial({color:'#e9fdff',transparent:true,opacity:.45,depthWrite:false}));bubble.userData.phase=i*.137;this.bubbles.push(bubble);aquarium.add(bubble);}
    this.glow.position.set(0,.9,0);aquarium.add(this.glow);this.root.add(aquarium);
    for(const item of level.items.filter(i=>i.rail)) {
      const rail=item.rail!,length=rail.max-rail.min,track=new THREE.Group();track.position.set((rail.axis==='x'?(rail.min+rail.max)/2:rail.fixed)-center,.22,(rail.axis==='y'?(rail.min+rail.max)/2:rail.fixed)-center);if(rail.axis==='y')track.rotation.y=-Math.PI/2;
      for(const side of [-1,1])track.add(box(length+.42,.07,.06,'#779aab',0,.02,side*.23,.02));
      for(let n=0;n<=Math.round(length/rail.step);n++)track.add(box(.025,.035,.35,n%2?'#d8e7ed':'#a7c1cf',-length/2+n*rail.step,.045,0,.009));
      for(const side of [-1,1])track.add(box(.13,.14,.6,'#b7ccd7',side*(length/2+.14),.04,0));this.root.add(track);
      const canvas=document.createElement('canvas');canvas.width=128;canvas.height=96;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#5f889c';ctx.font='bold 64px "Microsoft YaHei"';ctx.textAlign='center';ctx.fillText(item.id.slice(-1).toUpperCase(),64,72);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(.45,.34),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));sign.rotation.x=-Math.PI/2;sign.position.set((rail.axis==='y'?rail.fixed+.65:rail.min-.55)-center,.23,(rail.axis==='y'?rail.min:rail.fixed)-center);this.root.add(sign);
    }
    for(const [index,[x,z]] of [[-9,-5],[9,-6],[-9,5],[9,5],[-3,-10],[4,-10]].entries()) {
      const cloud=new THREE.Group();cloud.position.set(x,-.05,z);cloud.userData.phase=index;
      for(let puff=0;puff<5;puff++){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.55+puff%2*.12,16,12),matte('#f9fdff'));mesh.scale.set(1,.47,.72);mesh.position.set(Math.sin(puff*2)*.65,Math.cos(puff)*.08,Math.cos(puff*2)*.3);cloud.add(mesh);}this.clouds.push(cloud);this.root.add(cloud);
    }
    const beacon=level.items.find(i=>i.kind==='beacon')!;this.celebration.position.set(beacon.x-center,0,beacon.y-center);
    for(let i=0;i<8;i++){const bubble=new THREE.Mesh(new THREE.SphereGeometry(.08+i%3*.025,16,12),new THREE.MeshBasicMaterial({color:i%2?'#ddf7e9':'#fff2cf',transparent:true,opacity:.6,depthWrite:false}));this.celebration.add(bubble);}this.celebration.visible=false;this.root.add(this.celebration);
  }
  update(time:number,won:boolean,open:boolean):void {
    const delta=this.previous===null?0:Math.min(.1,Math.max(0,time-this.previous));this.previous=time;this.gateLift=!open?0:time===0?1.15:Math.min(1.15,this.gateLift+delta*1.9);
    this.celebrating=won;this.glow.intensity=won?1.6:0;this.celebration.visible=won;
    this.swimTime+=delta*(won ? .35 : .17);
    this.swimmers.forEach((swimmer,i)=>{const phase=swimmer.userData.phase+this.swimTime;swimmer.position.set(Math.cos(phase)*(.72+i%2*.25),.66+i%3*.13,Math.sin(phase)*(.75-i%3*.1));swimmer.rotation.y=Math.atan2(-Math.cos(phase)*(.75-i%3*.1),-Math.sin(phase)*(.72+i%2*.25));});
    this.bubbles.forEach(bubble=>{const phase=(time*.12+bubble.userData.phase)%1;bubble.position.set(Math.sin(bubble.userData.phase*33)*1.13,.4+phase*.85,Math.cos(bubble.userData.phase*29)*1.12);});
    this.clouds.forEach(cloud=>cloud.position.y=-.05+Math.sin(time*.4+cloud.userData.phase)*.035);
    this.celebration.children.forEach((bubble,i)=>{const phase=(time*.16+i/8)%1;bubble.position.set(Math.cos(i*2.4)*(.2+phase*.45),.8+phase*2.7,Math.sin(i*2.4)*(.2+phase*.45));});
  }
  state(){return {gateLift:this.gateLift,celebrating:this.celebrating,fish:this.swimmers.length,tankSize:3,clouds:this.clouds.length,rainbowVisible:false};}
}
