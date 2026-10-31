import type { Level, Point } from './level.ts';
import type { TraceResult } from './optics.ts';

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const same = (a: Point, b: Point) => distance(a, b) < 0.00001;

/** One surrounding cell, including diagonals. No remembered or cumulative exploration. */
export function forestVisible(level: Level, trace: TraceResult, point: Point): boolean {
  if (level.setting !== 'forest') return true;
  if (point.x < 1 || point.y < 1 || point.x > level.size || point.y > level.size) return false;
  const home = level.items.find(item => item.kind === 'beacon')!;
  if (Math.max(Math.abs(point.x - home.x), Math.abs(point.y - home.y)) <= 1) return true;
  return trace.segments.some(({ start, end }) => {
    const dx = Math.max(Math.min(start.x, end.x) - point.x, 0, point.x - Math.max(start.x, end.x));
    const dy = Math.max(Math.min(start.y, end.y) - point.y, 0, point.y - Math.max(start.y, end.y));
    return Math.max(dx, dy) <= 1 + 1e-6;
  });
}

/** Cell centers along the actual ray, stopping short of obstacles, edges, or the cabin wall. */
export function forestRoute(trace: TraceResult): Point[] {
  const route: Point[] = [];
  for (const [index, segment] of trace.segments.entries()) {
    const length = distance(segment.start, segment.end);
    if (length < 1e-6) continue;
    const dx = (segment.end.x - segment.start.x) / length, dy = (segment.end.y - segment.start.y) / length;
    const travel = index === trace.segments.length - 1 ? Math.max(0, length - 0.68) : length;
    if (!route.length) route.push({ x: segment.start.x, y: segment.start.y });
    for (let d = 1; d < travel - 1e-6; d++) route.push({ x: segment.start.x + dx * d, y: segment.start.y + dy * d });
    const end = { x: segment.start.x + dx * travel, y: segment.start.y + dy * travel };
    if (!same(route[route.length - 1], end)) route.push(end);
  }
  return route;
}

/** A route change retraces the travelled corridor to the shared fork, without teleporting. */
export class ForestWalker {
  position: Point;
  moving = false;
  heading = 0;
  private trail: Point[];
  private queue: { point: Point; trailLength?: number }[] = [];
  private routeKey = '';
  constructor(start: Point) { this.position = { ...start }; this.trail = [{ ...start }]; }
  follow(route: Point[]): void {
    if (!route.length) return;
    const key = JSON.stringify(route);
    if (key === this.routeKey) return;
    this.routeKey = key;
    let common = 0;
    while (common + 1 < Math.min(this.trail.length, route.length) && same(this.trail[common + 1], route[common + 1])) common++;
    this.queue = [
      ...this.trail.map((point, index) => ({ point, trailLength: index + 1 })).slice(common).reverse(),
      ...route.slice(common + 1).map(point => ({ point })),
    ];
  }
  update(delta: number): void {
    let travel = Math.max(0, delta) * 1.25;
    this.moving = this.queue.length > 0;
    while (this.queue.length && travel >= 0) {
      const next = this.queue[0], d = distance(this.position, next.point);
      if (d > 1e-6) this.heading = Math.atan2(next.point.x - this.position.x, next.point.y - this.position.y);
      if (d > travel) {
        this.position = { x: this.position.x + (next.point.x - this.position.x) * travel / d, y: this.position.y + (next.point.y - this.position.y) * travel / d };
        break;
      }
      this.position = { ...next.point }; travel -= d; this.queue.shift();
      if (next.trailLength !== undefined) this.trail.length = next.trailLength;
      else if (!same(this.trail[this.trail.length - 1], next.point)) this.trail.push({ ...next.point });
    }
    this.moving = this.queue.length > 0;
  }
  finish(): void { this.update(1000); }
}
