import { key, same, type Cell, type Restaurant } from './restaurant';

interface Node { cell: Cell; cost: number; priority: number; serial: number }
class Heap {
  private items: Node[] = [];
  get length() { return this.items.length; }
  private before(a: Node, b: Node) { return a.priority < b.priority || (a.priority === b.priority && a.serial < b.serial); }
  push(node: Node) {
    this.items.push(node);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (!this.before(this.items[i], this.items[parent])) break;
      [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
      i = parent;
    }
  }
  pop(): Node {
    const first = this.items[0], last = this.items.pop()!;
    if (this.items.length) {
      this.items[0] = last;
      let i = 0;
      while (true) {
        const left = i * 2 + 1, right = left + 1;
        let smallest = i;
        if (left < this.items.length && this.before(this.items[left], this.items[smallest])) smallest = left;
        if (right < this.items.length && this.before(this.items[right], this.items[smallest])) smallest = right;
        if (smallest === i) break;
        [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
        i = smallest;
      }
    }
    return first;
  }
}

// Stable north/east/south/west ordering matches hw3, including equal-cost ties.
export function astar(map: Restaurant, start: Cell, goal: Cell, blocked = map.blockedCells): Cell[] | null {
  if (!map.contains(start) || !map.contains(goal) || blocked.has(key(start)) || blocked.has(key(goal))) return null;
  let serial = 0;
  const heuristic = ([x, y]: Cell) => Math.abs(x - goal[0]) + Math.abs(y - goal[1]);
  const frontier = new Heap();
  frontier.push({ cell: start, cost: 0, priority: heuristic(start), serial: serial++ });
  const costs = new Map([[key(start), 0]]), parents = new Map<string, Cell>();
  while (frontier.length) {
    const { cell, cost } = frontier.pop();
    if (cost !== costs.get(key(cell))) continue;
    if (same(cell, goal)) {
      const path = [goal];
      while (!same(path[path.length - 1], start)) path.push(parents.get(key(path[path.length - 1]))!);
      return path.reverse();
    }
    const [x, y] = cell;
    for (const neighbor of [[x, y + 1], [x + 1, y], [x, y - 1], [x - 1, y]] as Cell[]) {
      if (!map.contains(neighbor) || blocked.has(key(neighbor))) continue;
      const newCost = cost + 1, id = key(neighbor);
      if (newCost < (costs.get(id) ?? Infinity)) {
        costs.set(id, newCost); parents.set(id, cell);
        frontier.push({ cell: neighbor, cost: newCost, priority: newCost + heuristic(neighbor), serial: serial++ });
      }
    }
  }
  return null;
}
