import type { Point } from './level.ts';

// Shared by the visible movable block and its optical footprint.
export const MOVABLE_BLOCK_HALF_SIZE = 0.32;
export const MOVABLE_BLOCK_CORNER_RADIUS = 0.06;

/** First entry into the rounded square at beam height, excluding its empty corners. */
export function movableBlockHitDistance(center: Point, origin: Point, direction: Point): number | null {
  const half = MOVABLE_BLOCK_HALF_SIZE;
  const radius = MOVABLE_BLOCK_CORNER_RADIUS;
  const epsilon = 1e-6;
  const local = { x: origin.x - center.x, y: origin.y - center.y };
  let near = -Infinity;
  let far = Infinity;
  for (const axis of ['x', 'y'] as const) {
    if (Math.abs(direction[axis]) < epsilon) {
      if (Math.abs(local[axis]) > half) return null;
    } else {
      const first = (-half - local[axis]) / direction[axis];
      const second = (half - local[axis]) / direction[axis];
      near = Math.max(near, Math.min(first, second));
      far = Math.min(far, Math.max(first, second));
    }
  }
  if (far < near || near <= epsilon || !Number.isFinite(near)) return null;
  const entry = { x: local.x + direction.x * near, y: local.y + direction.y * near };
  const flat = half - radius;
  if (Math.abs(entry.x) <= flat || Math.abs(entry.y) <= flat) return near;

  // An AABB corner is empty. Intersect its actual circular rounding instead.
  const offset = { x: local.x - Math.sign(entry.x) * flat, y: local.y - Math.sign(entry.y) * flat };
  const a = direction.x ** 2 + direction.y ** 2;
  const b = offset.x * direction.x + offset.y * direction.y;
  const c = offset.x ** 2 + offset.y ** 2 - radius ** 2;
  const discriminant = b * b - a * c;
  if (discriminant < -epsilon * epsilon) return null;
  const hit = (-b - Math.sqrt(Math.max(0, discriminant))) / a;
  return hit >= near - epsilon && hit <= far + epsilon ? hit : null;
}
