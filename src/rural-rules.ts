import type { Item, Level, Point } from './level.ts';

export function cowAtHome(cow: Item): boolean {
  return cow.kind === 'cow' && !!cow.home && !cow.herdPath && Math.hypot(cow.x - cow.home.x, cow.y - cow.home.y) < 1e-6;
}
export function herdCow(level: Level, id: string): { ok: boolean; message: string } {
  const cow = level.items.find(item => item.id === id && item.kind === 'cow');
  if (!cow?.home) return { ok: false, message: '请选择需要回圈的牛。' };
  if (cowAtHome(cow)) return { ok: false, message: '它已经在圈里安心等电影了。' };
  if (level.items.some(item => item.herdPath)) return { ok: false, message: '另一头牛正在回圈，等它走完这段路再出发。' };
  const queue: Point[][] = [[{ x: cow.x, y: cow.y }]], visited = new Set([`${cow.x},${cow.y}`]);
  while (queue.length) {
    const path = queue.shift()!, end = path[path.length - 1];
    if (end.x === cow.home.x && end.y === cow.home.y) {
      cow.herdPath = path; cow.herdTravel = 0;
      return { ok: true, message: `${cow.name}沿着清出的路回圈了。` };
    }
    for (const [dx, dy] of [[0, -1], [-1, 0], [0, 1], [1, 0]]) {
      const point = { x: end.x + dx, y: end.y + dy }, key = `${point.x},${point.y}`;
      if (point.x < 1 || point.y < 1 || point.x > level.size || point.y > level.size || visited.has(key)) continue;
      if (level.items.some(item => item.id !== id && !item.inInventory && Math.abs(item.x - point.x) < 0.8 && Math.abs(item.y - point.y) < 0.8)) continue;
      visited.add(key); queue.push([...path, point]);
    }
  }
  return { ok: false, message: '路还没通。先移开沿路的稻草、器件，或让另一头牛先回圈，再试试。' };
}

/** Only committed animals move. Their continuous positions remain physical light blockers. */
export function advanceHerds(level: Level, delta: number, reducedMotion = false): boolean {
  let changed = false;
  for (const cow of level.items.filter(item => item.kind === 'cow' && item.herdPath)) {
    const path = cow.herdPath!, length = path.length - 1;
    const travel = Math.min(length, (cow.herdTravel ?? 0) + (reducedMotion ? length : Math.max(0, Math.min(delta, 0.1)) * 2.2));
    const index = Math.min(Math.floor(travel), Math.max(0, length - 1)), start = path[index], end = path[Math.min(index + 1, length)];
    cow.x = start.x + (end.x - start.x) * (travel - index);
    cow.y = start.y + (end.y - start.y) * (travel - index);
    cow.angle = (Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI + 360) % 360;
    cow.herdTravel = travel; changed = true;
    if (travel >= length) { cow.x = cow.home!.x; cow.y = cow.home!.y; delete cow.herdPath; delete cow.herdTravel; }
  }
  return changed;
}
