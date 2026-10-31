import type { Point } from './level.ts';

export interface Vec3 { x: number; y: number; z: number }
const vector = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const CUBE_FACES = [
  { name: '底面', short: '底', u: vector(1,0,0), v: vector(0,0,1), n: vector(0,1,0) },
  { name: '右面', short: '右', u: vector(0,0,-1), v: vector(0,1,0), n: vector(-1,0,0) },
  { name: '后面', short: '后', u: vector(-1,0,0), v: vector(0,1,0), n: vector(0,0,1) },
  { name: '左面', short: '左', u: vector(0,0,1), v: vector(0,1,0), n: vector(1,0,0) },
  { name: '前面', short: '前', u: vector(1,0,0), v: vector(0,1,0), n: vector(0,0,-1) },
  { name: '顶面', short: '顶', u: vector(1,0,0), v: vector(0,0,-1), n: vector(0,-1,0) },
] as const;
export const dot3 = (a: Vec3, b: Vec3) => a.x*b.x + a.y*b.y + a.z*b.z;
export const add3 = (a: Vec3, b: Vec3): Vec3 => vector(a.x+b.x,a.y+b.y,a.z+b.z);
export const scale3 = (a: Vec3, scale: number): Vec3 => vector(a.x*scale,a.y*scale,a.z*scale);

export function cubeWorld(position: Point, size = 7, height = 0): Vec3 {
  if (position.layer === -1) return vector(0,0,0);
  const face = CUBE_FACES[position.layer ?? 0];
  const center = (size+1)/2;
  return add3(scale3(face.n, -size/2 + height), add3(scale3(face.u, position.x-center), scale3(face.v, position.y-center)));
}

export function cubeLocal(world: Vec3, layer: number, size = 7): Point {
  const face = CUBE_FACES[layer], center = (size+1)/2;
  return { x: dot3(world,face.u)+center, y: dot3(world,face.v)+center, layer };
}

/** Fold a surface ray over a real shared edge, retaining its tangential component. */
export function crossCubeEdge(point: Point, direction: Point, size = 7): { point: Point; direction: Point } | null {
  const face = CUBE_FACES[point.layer ?? 0];
  const edgeX = Math.abs(point.x-.5)<1e-5 || Math.abs(point.x-size-.5)<1e-5;
  const edgeY = Math.abs(point.y-.5)<1e-5 || Math.abs(point.y-size-.5)<1e-5;
  // A ray hitting a corner has no single adjacent face; stop instead of teleporting.
  if (edgeX === edgeY) return null;
  const outward = scale3(edgeX ? face.u : face.v, edgeX ? Math.sign(direction.x) : Math.sign(direction.y));
  const layer = CUBE_FACES.findIndex(candidate => dot3(candidate.n,outward) < -.999);
  if (layer < 0) return null;
  const next = CUBE_FACES[layer];
  const worldDirection = add3(scale3(face.u,direction.x),scale3(face.v,direction.y));
  const amount = dot3(worldDirection,outward);
  const folded = add3(add3(worldDirection,scale3(outward,-amount)),scale3(face.n,amount));
  const nextDirection = { x: dot3(folded,next.u), y: dot3(folded,next.v) };
  const entry = cubeLocal(cubeWorld(point,size),layer,size);
  entry.x += nextDirection.x*1e-5; entry.y += nextDirection.y*1e-5;
  return { point: entry, direction: nextDirection };
}
