import { key, type Cell, type Position, type Restaurant } from './restaurant';
export const RADIUS = 0.25, SENSOR_RANGE = 4, EPS = 1e-8;
export const distance = (a: Position, b: Position): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function towards(a: Position, b: Position, amount: number): Position {
  const length = distance(a, b);
  if (length <= amount + EPS) return b;
  const ratio = amount / length;
  return [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio];
}
export const cellFor = (p: Position): Cell => [Math.floor(p[0] + 0.5), Math.floor(p[1] + 0.5)];
export function bodyClear([x, y]: Position, map: Restaurant, blocked = map.blockedCells): boolean {
  if (!(RADIUS - 0.5 <= x && x <= map.width - 0.5 - RADIUS && RADIUS - 0.5 <= y && y <= map.height - 0.5 - RADIUS)) return false;
  for (let cx = Math.floor(x - 0.75); cx <= Math.ceil(x + 0.75); cx++) {
    for (let cy = Math.floor(y - 0.75); cy <= Math.ceil(y + 0.75); cy++) {
      if (blocked.has(key([cx, cy])) && Math.hypot(Math.max(Math.abs(x - cx) - 0.5, 0), Math.max(Math.abs(y - cy) - 0.5, 0)) < RADIUS - EPS) return false;
    }
  }
  return true;
}
export function segmentClear(start: Position, end: Position, map: Restaurant, others: Position[] = []): boolean {
  const length = distance(start, end), count = Math.max(1, Math.ceil(length / 0.025));
  // Resolve the obstacle set once for the swept body rather than once per sample.
  const blocked = map.blockedCells;
  for (let i = 1; i <= count; i++) {
    const point = towards(start, end, length * i / count);
    if (!bodyClear(point, map, blocked) || others.some(p => distance(point, p) < 2 * RADIUS - EPS)) return false;
  }
  return true;
}
export function trailLength(start: Position, trail: Position[]): number {
  let total = 0;
  for (const point of trail) { total += distance(start, point); start = point; }
  return total;
}
export function pointSegmentDistance(point: Position, a: Position, b: Position): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], squared = dx * dx + dy * dy;
  if (squared <= EPS) return distance(point, a);
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / squared));
  return distance(point, [a[0] + t * dx, a[1] + t * dy]);
}
