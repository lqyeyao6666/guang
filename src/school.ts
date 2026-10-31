import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Item, Level } from './level.ts';
import { MOVABLE_BLOCK_HALF_SIZE, MOVABLE_BLOCK_CORNER_RADIUS } from './block-shape.ts';

const material=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:0.85});
function box(parent:THREE.Group,w:number,h:number,d:number,color:string,x=0,y=0,z=0) {
  const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(0.055,w/4,h/4,d/4)),material(color));
  mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function ball(parent:THREE.Group,r:number,color:string,x:number,y:number,z:number) {
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,12,10),material(color));mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;
}
function text(parent:THREE.Group,label:string,w:number,h:number,x:number,y:number,z:number,color='#d4e0cf') {
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=160;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle=color;ctx.font='46px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,320,80);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));mesh.position.set(x,y,z);parent.add(mesh);
}
interface Student {root:THREE.Group;head:THREE.Group;body:THREE.Group;arm:THREE.Group;index:number;mode:'reading'|'writing';}

/** Cutaway classroom. Furniture stays readable and all people are decorative, never pick targets. */
export class SchoolStory {
  readonly root=new THREE.Group();
  private students:Student[]=[];
  private lamps:THREE.MeshStandardMaterial[]=[];
  private illumination=new THREE.AmbientLight('#ffe5b9',0);
  private clock=0;
  private previous:number|null=null;
  private light=0;
  private won=false;
  constructor(level:Level) {
    const edge=level.size/2+0.42;
    box(this.root,level.size+1.2,0.12,level.size+1.2,'#384759',0,-0.42,0);
    // Two rear walls only: camera rotation and high-angle dragging remain unobstructed.
    box(this.root,level.size+1.2,2.5,0.15,'#405569',0,0.75,-edge);
    box(this.root,0.15,2.5,level.size+1.2,'#435b70',-edge,0.75,0);
    box(this.root,5.1,1.14,0.09,'#234c48',0,1.07,-edge+0.1);
    for(const side of [-1,1])box(this.root,0.06,1.27,0.09,'#aa9d7f',side*2.58,1.07,-edge+0.15);
    box(this.root,5.22,0.06,0.12,'#aa9d7f',0,0.46,-edge+0.15);
    text(this.root,'晚自习 · 慢慢来，认真想',4.4,0.6,0,1.12,-edge+0.17);
    text(this.root,'把今晚的光，留给每一个认真学习的人',5.4,0.38,0,2,-edge+0.12,'#e4c7a0');
    for(const z of [-3.8,-0.3,3.2]) {
      box(this.root,0.08,1.25,2.3,'#8ca9bc',-edge+0.11,1.05,z);
      box(this.root,0.04,1.04,2.08,'#1d3551',-edge+0.17,1.05,z);
      box(this.root,0.06,1.1,0.05,'#9aafbc',-edge+0.21,1.05,z);
      box(this.root,0.06,0.05,2.1,'#9aafbc',-edge+0.21,1.05,z);
      ball(this.root,0.12,'#cddce3',-edge+0.21,1.4,z-0.55);
    }
    // Overhead fittings stay on rear wall to avoid covering the playable grid.
    for(const x of [-3.8,3.8]) {
      const m=box(this.root,1.5,0.1,0.2,'#b5c5cd',x,2.1,-edge+0.25).material;
      m.emissive.set('#ffe6b9');this.lamps.push(m);
    }
    const clock=ball(this.root,0.25,'#d2c5a4',3.4,1.35,-edge+0.17);clock.scale.z=0.16;
    box(this.root,0.018,0.14,0.02,'#48586a',3.4,1.4,-edge+0.22);box(this.root,0.13,0.018,0.02,'#48586a',3.46,1.35,-edge+0.22);
    this.root.add(this.illumination);
    const desks=level.items.filter(i=>i.kind==='block'&&!i.movable&&i.id.includes('desk'));
    // Keep pupils distributed through the room, with a clear table top beneath each notebook.
    desks.slice(0,12).forEach((desk,i)=>this.student(desk,i,level.size));
  }
  private student(desk:Item,index:number,size:number) {
    const root=new THREE.Group(),body=new THREE.Group(),head=new THREE.Group(),arm=new THREE.Group();
    root.position.set(desk.x-(size+1)/2,0.3,desk.y-(size+1)/2+0.27);
    root.scale.setScalar(0.82);root.add(body);body.position.set(0,0.9,0.13);body.add(head);head.position.set(0,0.35,0);
    box(body,0.29,0.32,0.23,index%3===0?'#c4d3de':index%3===1?'#809eb6':'#b6bfd0',0,0,0);
    ball(head,0.145,'#ddbea3',0,0,0);
    const hair=ball(head,0.15,index%2?'#3b393f':'#303d48',0,0.07,0.015);hair.scale.y=0.55;
    if(index%3===1)for(const s of [-1,1])ball(head,0.075,'#3b393f',s*0.14,0.04,0.045);
    for(const s of [-1,1])ball(head,0.012,'#3a414b',s*0.047,0,-0.14);
    body.add(arm);arm.position.set(0.19,0.03,-0.02);box(arm,0.1,0.12,0.32,'#94b2c8',0,0,-0.13);ball(arm,0.052,'#ddbea3',0,-0.02,-0.29);
    box(body,0.1,0.1,0.3,'#94b2c8',-0.18,-0.02,-0.12);
    for(const s of [-1,1]) {box(root,0.11,0.31,0.12,'#414f65',s*0.085,0.28,0.02);box(root,0.13,0.07,0.21,'#c0c6c9',s*0.085,0.11,-0.02);}
    // An open book is on the table, in front of the pupil rather than floating in their hands.
    box(root,0.34,0.025,0.24,'#e9dfc0',0,0.78,-0.39);box(root,0.008,0.029,0.24,'#aaa080',0,0.79,-0.39);
    for(const s of [-1,1])for(let n=0;n<3;n++)box(root,0.11,0.004,0.006,'#9aa1a0',s*0.09,0.798,-0.45+n*0.045);
    box(arm,0.012,0.012,0.18,'#c6a06c',0,-0.04,-0.29);
    this.root.add(root);this.students.push({root,head,body,arm,index,mode:index%3?'writing':'reading'});
  }
  item(item:Item):THREE.Group {
    const root=new THREE.Group();
    if(item.kind==='source') {
      box(root,0.42,0.22,0.38,'#899b9b',0,0.34);box(root,0.34,0.14,0.27,'#e8d8a3',0.06,0.59);
      const bulb=ball(root,0.09,'#fff3cc',0.21,0.59,0);(bulb.material as THREE.MeshStandardMaterial).emissive.set('#fff7d8');
      box(root,0.23,0.045,0.055,'#596e79',-0.03,0.74);return root;
    }
    if(item.kind==='beacon') {
      box(root,0.6,0.22,0.5,'#839aaa',0,0.3);box(root,0.5,0.32,0.2,'#d9d5bb',0,0.58);
      const lamp=box(root,0.42,0.18,0.22,'#d2d8cf',0,0.61,0.02);lamp.material.emissive.set('#ffebba');this.lamps.push(lamp.material);
      return root;
    }
    if(item.kind==='waypoint') {
      const lectern=item.id==='school-pass-2';
      // Optical centre y=.59 is open under these desks; a lit arch identifies the real passage.
      box(root,0.86,0.12,0.86,lectern?'#9b8b74':'#8f9ca7',0,1.05);
      for(const x of [-0.34,0.34]) for(const z of [-0.34,0.34])box(root,0.1,0.86,0.1,'#74848f',x,0.58,z);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.23,0.025,8,28),new THREE.MeshStandardMaterial({color:'#bbc7bd',emissive:'#a8beaa',emissiveIntensity:0.12}));ring.rotation.y=Math.PI/2;ring.position.y=0.59;root.add(ring);
      box(root,0.28,0.04,0.29,'#c4b998',0,1.14);return root;
    }
    const movable=item.movable;
    if(movable||item.id.includes('books')) {
      if(movable){
        const width=MOVABLE_BLOCK_HALF_SIZE*2;
        const body=new THREE.Mesh(new RoundedBoxGeometry(width,0.6,width,2,MOVABLE_BLOCK_CORNER_RADIUS),material('#718a98'));
        body.position.y=0.45;body.castShadow=body.receiveShadow=true;root.add(body);
      } else box(root,0.78,0.6,0.78,'#677888',0,0.45);
      for(let n=0;n<4;n++)box(root,0.56,0.055,0.47,['#9faeb5','#af9b83','#8faaa3','#c6baa1'][n],0,0.79+n*0.055,0);
      if(movable){box(root,0.36,0.06,0.04,'#d3c7a0',0,0.8,-0.3);for(const x of [-0.16,0.16])box(root,0.05,0.16,0.04,'#d3c7a0',x,0.73,-0.3);}
    } else if(item.id.includes('chair')) {
      box(root,0.78,0.12,0.77,'#8c9a9f',0,0.63);box(root,0.78,0.48,0.12,'#88949d',0,0.86,0.3);
      // Stored workbooks fill the seat and make the blocking footprint unambiguous.
      box(root,0.7,0.38,0.68,'#7d8d9e',0,0.38);box(root,0.58,0.07,0.5,'#b6af9a',0,0.73);
    } else if(item.id.includes('cabinet')) {
      box(root,0.83,0.9,0.83,'#6c8090',0,0.6);for(const x of [-0.2,0.2]){box(root,0.35,0.73,0.04,'#81929b',x,0.62,0.43);box(root,0.035,0.13,0.055,'#c5bda2',x*0.4,0.61,0.46);}
    } else {
      box(root,0.84,0.09,0.84,'#ae9d86',0,0.95);
      box(root,0.76,0.31,0.76,'#6c7e8d',0,0.69); // Closed under-desk book cubby blocks the beam at y=.59.
      for(const x of [-0.33,0.33])for(const z of [-0.33,0.33])box(root,0.075,0.75,0.075,'#8394a1',x,0.53,z);
      box(root,0.42,0.07,0.38,'#9c9380',0,0.51,0.49);box(root,0.42,0.3,0.07,'#9c9380',0,0.76,0.66);
      box(root,0.42,0.035,0.3,'#c7c0a7',-0.1,1.02,-0.1);
    }
    return root;
  }
  reset(){this.previous=null;this.clock=0;this.light=0;this.won=false;this.update(0,false);}
  update(time:number,won:boolean){
    const delta=this.previous===null?0:Math.max(0,Math.min(0.1,time-this.previous));this.previous=time;this.clock+=delta;this.won=won;
    this.light=time===0?(won?1:0):THREE.MathUtils.damp(this.light,won?1:0,2.5,delta);
    this.illumination.intensity=this.light*1.7;this.lamps.forEach(m=>m.emissiveIntensity=0.02+this.light*1.7);
    for(const p of this.students){
      const t=this.clock,settle=won?THREE.MathUtils.smoothstep(this.light,0.15+p.index%4*0.08,0.8):0;
      const worry=Math.sin(t*(0.75+p.index*0.031)+p.index*2.4)*0.63+Math.sin(t*0.29+p.index)*0.18;
      p.head.rotation.y=worry*(1-settle);p.head.rotation.x=-Math.sin(t*0.9+p.index)*0.055*(1-settle)+settle*0.34;
      p.body.rotation.z=Math.sin(t*0.7+p.index*1.9)*0.045*(1-settle);p.body.rotation.x=settle*0.12;
      p.arm.rotation.y=settle*(p.mode==='writing'?Math.sin(t*(2.5+p.index*0.07)+p.index)*0.12:0.02);
      p.arm.rotation.x=(1-settle)*Math.max(0,Math.sin(t*0.6+p.index*2))*-0.18;
    }
  }
  state(){return{powered:this.won,brightness:this.light,studentCount:this.students.length,phase:this.won?(this.light>0.97?'studying':'settling'):'anxious',students:this.students.map(p=>({position:p.root.position.toArray(),mode:p.mode,headYaw:p.head.rotation.y,headPitch:p.head.rotation.x,writingAngle:p.arm.rotation.y}))};}
}
