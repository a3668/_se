import { astar } from './navigation';
import { FREE, key, ready, type Allocation, type Cell, type Requirements, type Restaurant, type Table } from './restaurant';

const MAX_ALTERNATIVES = 5;
const compareName = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export class Candidate {
  constructor(public allocations: Allocation[], public paths: Cell[][], public misses: string[], public scattered: boolean) {}
  get tableNames(): string[] { return this.allocations.map(a => a.tableName); }
  get key(): string { return this.tableNames.sort(compareName).join(','); }
  get path(): Cell[] { return this.paths.flatMap((path, i) => i === 0 ? path : path.slice(1)); }
  get requiresConsent(): boolean { return !!this.misses.length || this.scattered; }
  get differences(): string[] { return [...this.misses, ...(this.scattered ? ['桌位分散，未安排在同列連續桌位'] : [])]; }
  get offer(): string {
    const names = this.tableNames.join('、');
    return this.allocations.length === 1 ? `為您安排 ${names} 桌，可以嗎？` : `為您安排 ${names}，分 ${this.allocations.length} 桌可以嗎？`;
  }
}
function hardTables(map: Restaurant, r: Requirements): Table[] {
  return map.tables.filter(t => !r.window_required || t.windowSide === r.window_preference);
}
export function capacityProblem(map: Restaurant, r: Requirements): string | null {
  const size = r.party_size;
  if (size === null) return null;
  const total = map.tables.reduce((s, t) => s + t.capacity, 0);
  if (size > total) return `餐廳總共只有 ${total} 席，無法安排 ${size} 位。`;
  let tables = hardTables(map, r);
  if (r.table_required && !tables.some(t => t.name === r.table_name)) return '指定桌號與必要座位條件無法同時滿足，請修改需求。';
  if (r.allow_split === false) {
    if (r.table_required) tables = tables.filter(t => t.name === r.table_name);
    const maximum = Math.max(0, ...tables.map(t => t.capacity));
    if (size > maximum) return `符合必要條件的單桌最多容納 ${maximum} 位，需要接受分桌才能安排 ${size} 位。`;
  } else if (size > tables.reduce((s, t) => s + t.capacity, 0)) return '符合必要座位條件的總席位不足，請修改需求。';
  return null;
}
function adjacent(tables: Table[]): boolean {
  const ordered = [...tables].sort((a, b) => compareName(a.name, b.name));
  return ordered.every((t, i) => i === 0 || (ordered[i - 1].name[0] === t.name[0] && Number(t.name.slice(1)) === Number(ordered[i - 1].name.slice(1)) + 1));
}
function misses(tables: Table[], r: Requirements): string[] {
  const result: string[] = [];
  if (r.window_preference !== null) {
    const wrong = tables.filter(t => t.windowSide !== r.window_preference).map(t => t.name);
    if (wrong.length) result.push(`${r.window_preference ? '靠窗' : '非靠窗'}偏好無法全部滿足：${wrong.join('、')}`);
  }
  if (r.table_name && !tables.some(t => t.name === r.table_name)) result.push(`未包含指定的 ${r.table_name}`);
  return result;
}
class Planner {
  private cache = new Map<string, Cell[] | null>();
  constructor(private map: Restaurant, private r: Requirements) {}
  route(start: Cell, goal: Cell): Cell[] | null {
    const id = `${key(start)}>${key(goal)}`;
    if (!this.cache.has(id)) {
      const path = astar(this.map, start, goal, this.map.knownBlockedCells);
      this.cache.set(id, path);
      this.cache.set(`${key(goal)}>${key(start)}`, path ? [...path].reverse() : null);
    }
    return this.cache.get(id)!;
  }
  build(tables: Table[]): Candidate | null {
    const size = this.r.party_size;
    if (size === null || !tables.length || tables.length > size || tables.reduce((s, t) => s + t.capacity, 0) < size) return null;
    const counts = new Map(tables.map(t => [t.name, 1]));
    for (let i = 0; i < size - tables.length; i++) {
      const target = tables.filter(t => counts.get(t.name)! < t.capacity)
        .sort((a, b) => counts.get(a.name)! - counts.get(b.name)! || compareName(a.name, b.name))[0];
      counts.set(target.name, counts.get(target.name)! + 1);
    }
    let remaining = [...tables], current = this.map.robotStart;
    const allocations: Allocation[] = [], paths: Cell[][] = [];
    while (remaining.length) {
      const options = remaining.flatMap(table => {
        const path = this.route(current, table.goal);
        return path ? [{ table, path }] : [];
      }).sort((a, b) => a.path.length - b.path.length || compareName(a.table.name, b.table.name));
      if (!options.length) return null;
      const { table, path } = options[0];
      allocations.push({ tableName: table.name, people: counts.get(table.name)!, capacity: table.capacity });
      paths.push(path); current = table.goal;
      remaining = remaining.filter(t => t !== table);
    }
    return new Candidate(allocations, paths, misses(tables, this.r), !adjacent(tables));
  }
}

function* combinations(tables: Table[], count: number, size: number, required: string | null): Generator<Table[]> {
  const prefix = [0];
  for (const table of tables) prefix.push(prefix[prefix.length - 1] + table.capacity);
  const requiredIndex = tables.findIndex(t => t.name === required);
  function* search(start: number, chosen: Table[], capacity: number, hasRequired: boolean): Generator<Table[]> {
    const slots = count - chosen.length;
    if (!slots) { if (capacity >= size && hasRequired) yield chosen; return; }
    if (tables.length - start < slots || capacity + prefix[start + slots] - prefix[start] < size) return;
    if (!hasRequired && (requiredIndex < 0 || requiredIndex < start)) return;
    for (let i = start; i <= tables.length - slots; i++) {
      yield* search(i + 1, [...chosen, tables[i]], capacity + tables[i].capacity, hasRequired || tables[i].name === required);
    }
  }
  yield* search(0, [], 0, required === null);
}
function modes(tables: Table[], r: Requirements, missCount: number): { pool: Table[]; required: string | null }[] {
  const result: { pool: Table[]; required: string | null }[] = [];
  const softWindow = r.window_preference !== null && !r.window_required;
  const softTable = r.table_name !== null && !r.table_required;
  for (const relaxWindow of softWindow ? [false, true] : [false]) {
    for (const relaxTable of softTable ? [false, true] : [false]) {
      if (Number(relaxWindow) + Number(relaxTable) !== missCount) continue;
      const pool = tables.filter(t => r.window_preference === null || relaxWindow || t.windowSide === r.window_preference);
      const required = relaxTable ? null : r.table_name;
      if (required === null || pool.some(t => t.name === required)) {
        result.push({ pool: pool.sort((a, b) => b.capacity - a.capacity || compareName(a.name, b.name)), required });
      }
    }
  }
  return result;
}
export function rankTables(map: Restaurant, r: Requirements, excluded = new Set<string>()): Candidate[] {
  if (!ready(r) || capacityProblem(map, r) || r.party_size === null) return [];
  const size = r.party_size, planner = new Planner(map, r);
  const available = hardTables(map, r).filter(t => t.status === FREE && planner.route(map.robotStart, t.goal) !== null);
  if (available.reduce((s, t) => s + t.capacity, 0) < size) return [];
  const maxCount = r.allow_split === false ? 1 : Math.min(available.length, size);
  for (let missCount = 0; missCount < 3; missCount++) {
    const choices = modes(available, r, missCount);
    for (const scattered of [false, true]) {
      for (let count = 1; count <= maxCount; count++) {
        const best: { candidate: Candidate; waste: number; length: number }[] = [], seen = new Set<string>();
        for (const { pool, required } of choices) {
          if (pool.length < count || pool.slice(0, count).reduce((s, t) => s + t.capacity, 0) < size) continue;
          const ordered = [...pool].sort((a, b) => compareName(a.name, b.name));
          const options = scattered ? combinations(pool, count, size, required) :
            Array.from({ length: ordered.length - count + 1 }, (_, i) => ordered.slice(i, i + count));
          for (const tables of options) {
            const capacity = tables.reduce((s, t) => s + t.capacity, 0);
            if (!adjacent(tables) !== scattered || capacity < size || (required && !tables.some(t => t.name === required)) || misses(tables, r).length !== missCount) continue;
            const names = tables.map(t => t.name).sort(compareName).join(',');
            if (excluded.has(names) || seen.has(names)) continue;
            seen.add(names);
            const waste = capacity - size;
            if (best.length === MAX_ALTERNATIVES && waste > best[best.length - 1].waste) continue;
            const candidate = planner.build(tables);
            if (!candidate) continue;
            best.push({ candidate, waste, length: candidate.paths.reduce((s, path) => s + path.length - 1, 0) });
            best.sort((a, b) => a.waste - b.waste || a.length - b.length || compareName(a.candidate.key, b.candidate.key));
            best.splice(MAX_ALTERNATIVES);
          }
        }
        if (best.length) return best.map(item => item.candidate);
      }
    }
  }
  return [];
}
export function revalidatePlan(map: Restaurant, r: Requirements, candidate: Candidate): Candidate | null {
  if (!ready(r) || capacityProblem(map, r)) return null;
  const names = new Set(candidate.tableNames), tables = hardTables(map, r).filter(t => names.has(t.name));
  if (tables.length !== names.size || tables.some(t => t.status !== FREE) || (r.allow_split === false && tables.length > 1) ||
      (r.table_required && !names.has(r.table_name!))) return null;
  return new Planner(map, r).build(tables);
}
export function noSeatReason(map: Restaurant, r: Requirements): string {
  return capacityProblem(map, r) || (r.other_requirements.length ? `尚有需求待確認：${r.other_requirements.join('、')}` : '目前沒有能安排整組顧客的空桌，請稍候。');
}
