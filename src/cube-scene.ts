import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Level, Point } from './level.ts';
import { CUBE_FACES, cubeWorld } from './cube-space.ts';

export function cubeQuaternion(layer: number): THREE.Quaternion {
  const face=CUBE_FACES[layer];
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(face.u.x,face.u.y,face.u.z),new THREE.Vector3(face.n.x,face.n.y,face.n.z),new THREE.Vector3(face.v.x,face.v.y,face.v.z)));
}
export function placeOnCube(object: THREE.Object3D, position: Point, size:number, height=0): void {
  const world=cubeWorld(position,size,height);
  object.position.set(world.x,world.y,world.z);
  object.quaternion.copy(position.layer===-1 ? new THREE.Quaternion() : cubeQuaternion(position.layer??0));
}
const box=(w:number,h:number,d:number,color:string,x=0,y=0,z=0) => {
  const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,.04),new THREE.MeshStandardMaterial({color,roughness:.65,emissive:color,emissiveIntensity:.10}));
  mesh.position.set(x,y,z);mesh.receiveShadow=true;return mesh;
};

export function buildCubeGarden(level: Level, environment:THREE.Group, decks:THREE.Group[]): void {
  const h=level.size/2,center=(level.size+1)/2;
  for(let layer=0;layer<6;layer++) {
    const deck=new THREE.Group();
    placeOnCube(deck,{x:center,y:center,layer},level.size);
    deck.userData.layer=layer;
    for(let y=1;y<=level.size;y++) for(let x=1;x<=level.size;x++) {
      deck.add(box(.977,.14,.977,(x+y)%2 ? '#efc58d' : '#fff7e7',x-center,-.035,y-center));
    }
    for(const side of [-1,1]) {
      deck.add(box(level.size+.15,.12,.10,'#d3b083',0,-.10,side*h));
      deck.add(box(.10,.12,level.size-.1,'#d3b083',side*h,-.10,0));
    }
    // The center socket remains readable before a movable inward mirror is placed.
    const socket=new THREE.Mesh(new THREE.RingGeometry(.30,.43,48),new THREE.MeshBasicMaterial({color:'#b5ac8b',side:THREE.DoubleSide}));
    socket.rotation.x=-Math.PI/2;socket.position.y=.047;deck.add(socket);
    for(let i=1;i<=level.size;i++) {
      const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
      const context=canvas.getContext('2d')!;context.fillStyle='#a18563';context.font='500 38px system-ui';context.textAlign='center';context.textBaseline='middle';context.fillText(String(i),32,32);
      const texture=new THREE.CanvasTexture(canvas);
      for(const [x,z] of [[i-center,-h-.17],[-h-.17,i-center]]) {
        const label=new THREE.Mesh(new THREE.PlaneGeometry(.22,.22),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
        label.rotation.x=-Math.PI/2;label.position.set(x,.07,z);deck.add(label);
      }
    }
    decks.push(deck);environment.add(deck);
  }
  // Twelve continuous silver corner mirrors visibly explain the surface turns.
  for(const axis of [0,1,2]) for(const a of [-h,h]) for(const b of [-h,h]) {
    const start=new THREE.Vector3(),end=new THREE.Vector3();
    start.setComponent(axis,-h);end.setComponent(axis,h);
    start.setComponent((axis+1)%3,a);end.setComponent((axis+1)%3,a);
    start.setComponent((axis+2)%3,b);end.setComponent((axis+2)%3,b);
    const edge=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,level.size,10),new THREE.MeshStandardMaterial({color:'#b4c8c2',metalness:.3,roughness:.3,emissive:'#a9bcb5',emissiveIntensity:.12}));
    edge.userData.cubeFrame=true;edge.position.copy(start.clone().add(end).multiplyScalar(.5));edge.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());environment.add(edge);
  }
  for(const x of [-h,h]) for(const y of [-h,h]) for(const z of [-h,h]) {
    const joint=new THREE.Mesh(new THREE.SphereGeometry(.095,16,12),new THREE.MeshStandardMaterial({color:'#d1b18a',roughness:.55}));joint.userData.cubeFrame=true;joint.position.set(x,y,z);environment.add(joint);
  }
  const fill=new THREE.PointLight('#fff5df',8,15,1.3);environment.add(fill);
}
