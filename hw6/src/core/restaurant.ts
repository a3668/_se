// Coordinates describe cell centres; one cell is one metre. Origin: bottom left.
export type Position = readonly [number, number];
export type Cell = Position;
export const FREE = '空閒', RESERVED = '保留', OCCUPIED = '占用';
export type TableStatus = typeof FREE | typeof RESERVED | typeof OCCUPIED;
export const key = (cell: Position): string => `${cell[0]},${cell[1]}`;
export const fromKey = (value: string): Cell => {
  const [x, y] = value.split(',').map(Number);
  return [x, y];
};
export const same = (a: Position | null, b: Position | null): boolean =>
  a !== null && b !== null && a[0] === b[0] && a[1] === b[1];

export interface Table {
  name: string;
  capacity: number;
  x: number;
  y: number;
  width: number;
  height: number;
  goal: Cell;
  windowSide: boolean;
  status: TableStatus;
}

// Keep the Ollama wire format identical to hw3.
export interface Requirements {
  party_size: number | null;
  window_preference: boolean | null;
  window_required: boolean;
  table_name: string | null;
  table_required: boolean;
  allow_split: boolean | null;
  other_requirements: string[];
  question: string;
}
export const emptyRequirements = (): Requirements => ({
  party_size: null, window_preference: null, window_required: false,
  table_name: null, table_required: false, allow_split: null, other_requirements: [], question: '',
});
export const ready = (r: Requirements): boolean => r.party_size !== null && !r.other_requirements.length && !r.question;
export function requirementsSummary(r: Requirements): string {
  const parts = [r.party_size ? `${r.party_size} 人` : '人數待確認'];
  if (r.window_preference !== null) parts.push(`${r.window_required ? '必須' : '偏好'}${r.window_preference ? '靠窗' : '非靠窗'}`);
  if (r.table_name) parts.push(`${r.table_required ? '須包含' : '偏好包含'} ${r.table_name}`);
  if (r.allow_split !== null) parts.push(r.allow_split ? '可分桌' : '不接受分桌');
  return [...parts, ...r.other_requirements].join('、');
}
export interface Allocation { tableName: string; people: number; capacity: number }
export interface CustomerGroup {
  number: number;
  requirements: Requirements;
  position: Position | null;
  status: string;
  waitingReason: string;
  allocations: Allocation[];
  nextStop: number;
  remainingPeople: number;
  declinedPlans: Set<string>;
  speed: number;
  stopped: boolean;
  trail: Position[];
}
export function createGroup(number: number, speed: number): CustomerGroup {
  return { number, speed, requirements: emptyRequirements(), position: [8, 1], status: '接待中',
    waitingReason: '', allocations: [], nextStop: 0, remainingPeople: 0,
    declinedPlans: new Set(), stopped: false, trail: [] };
}
export interface Pedestrian { number: number; position: Position; route: Position[]; speed: number }
export class Robot {
  position: Cell = [8, 2];
  goal: Cell | null = null;
  route: Cell[] = [];
  task: '' | '帶位中' | '返回中' = '';
  progress = 0;
  get visualPosition(): Position {
    if (!this.route.length) return this.position;
    const [x, y] = this.position, [nx, ny] = this.route[0];
    return [x + (nx - x) * this.progress, y + (ny - y) * this.progress];
  }
}
export class Restaurant {
  readonly width = 18;
  readonly height = 34;
  readonly robotStart: Cell = [8, 2];
  readonly customerStart: Cell = [8, 1];
  readonly tables: Table[] = [];
  readonly tableCells = new Set<string>();
  readonly obstacles = new Set<string>();
  readonly knownObstacles = new Set<string>();
  constructor() {
    for (const [row, x, capacity, goalX] of [['A', 0, 4, 4], ['B', 7, 6, 6], ['C', 14, 4, 13]] as const) {
      for (let i = 0; i < 7; i++) {
        const table: Table = { name: `${row}${i + 1}`, capacity, x, y: 4 + 4 * i,
          goal: [goalX, 5 + 4 * i], width: 4, height: 3, windowSide: row === 'A', status: FREE };
        this.tables.push(table);
        for (let dx = 0; dx < table.width; dx++) for (let dy = 0; dy < table.height; dy++) {
          this.tableCells.add(key([table.x + dx, table.y + dy]));
        }
      }
    }
  }
  get blockedCells(): Set<string> { return new Set([...this.tableCells, ...this.obstacles]); }
  get knownBlockedCells(): Set<string> { return new Set([...this.tableCells, ...this.knownObstacles]); }
  contains([x, y]: Cell): boolean { return x >= 0 && x < this.width && y >= 0 && y < this.height; }
  table(name: string): Table {
    const table = this.tables.find(t => t.name === name);
    if (!table) throw new Error(`不存在的桌號：${name}`);
    return table;
  }
}
