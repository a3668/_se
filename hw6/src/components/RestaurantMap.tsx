import { useState, type MouseEvent, type KeyboardEvent } from 'react';
import { Crosshair, Navigation, ScanLine } from 'lucide-react';
import { SENSOR_RANGE } from '../core/motion';
import { fromKey, key, type Cell, type Position } from '../core/restaurant';
import type { Simulation } from '../core/simulation';

const point = ([x, y]: Position): Position => [x + 0.5, 34 - y - 0.5];
const coordinates = (p: Position) => point(p).join(',');

function Actor({ position, kind, label, discovered = true }: { position: Position; kind: 'robot' | 'customer' | 'pedestrian'; label: string; discovered?: boolean }) {
  const [cx, cy] = point(position);
  return <g className={`actor actor-${kind} ${discovered ? '' : 'undiscovered'}`} transform={`translate(${cx} ${cy})`}>
    <title>{label}｜座標 {position.map(n => n.toFixed(2)).join(', ')}</title>
    <circle className="actor-halo" r="0.57" />
    <circle className="actor-body" r="0.25" />
    <text className="actor-letter" x="0" y="-0.53">{kind === 'robot' ? 'R' : kind === 'customer' ? 'G' : 'P'}</text>
    {kind === 'customer' && <text className="actor-count" x="0.65" y="0.22">{label}</text>}
  </g>;
}

export function RestaurantMap({ simulation: s, editing, setEditing }: { simulation: Simulation; editing: boolean; setEditing: (value: boolean) => void }) {
  const [hover, setHover] = useState<Cell | null>(null);
  const [cursor, setCursor] = useState<Cell>([4, 8]);
  const map = s.restaurant, robot = s.robot.visualPosition;
  const route = s.robot.route.length ? [robot, ...s.robot.route] : s.proposed?.path ?? [];
  const selected = new Set(s.proposed?.tableNames ?? s.group?.allocations.slice(s.group.nextStop).map(a => a.tableName) ?? []);
  const obstacleKeys = [...new Set([...map.obstacles, ...map.knownObstacles])];
  function cellAt(event: MouseEvent<SVGSVGElement>): Cell | null {
    const svg = event.currentTarget, matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
    const local = p.matrixTransform(matrix.inverse());
    const cell: Cell = [Math.floor(local.x), Math.floor(34 - local.y)];
    return map.contains(cell) ? cell : null;
  }
  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (!editing) return;
    const directions: Record<string, Cell> = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (directions[event.key]) {
      event.preventDefault(); const delta = directions[event.key];
      setCursor([Math.max(0, Math.min(17, cursor[0] + delta[0])), Math.max(0, Math.min(33, cursor[1] + delta[1]))]);
    } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); s.toggleObstacle(cursor); }
    else if (event.key === 'Escape') setEditing(false);
  }
  return <section className="panel map-panel" aria-labelledby="map-title">
    <div className="panel-heading map-heading">
      <div><div className="eyebrow"><span className="live-dot" /> LIVE FLOOR PLAN</div><h2 id="map-title">餐廳即時地圖</h2></div>
      <button className={`button small ${editing ? 'primary' : 'subtle'}`} onClick={() => setEditing(!editing)} aria-pressed={editing}>
        <Crosshair size={15} />{editing ? '完成編輯' : '編輯障礙物'}
      </button>
    </div>
    <div className="map-legend" aria-label="地圖圖例">
      <span><i className="legend-dot free" />空閒</span><span><i className="legend-dot reserved" />保留</span><span><i className="legend-dot occupied" />占用</span>
      <span><i className="legend-line" />導航路線</span><span className="legend-sensor"><ScanLine size={13} />感測 4 m</span>
    </div>
    <div className={`map-stage ${editing ? 'editing' : ''}`}>
      <svg className="restaurant-svg" viewBox="-1.8 -1.7 21.6 38" role={editing ? 'application' : 'img'}
        aria-label={editing ? '障礙物地圖：點選空白格編輯，或方向鍵移動游標、Enter 切換障礙物、Escape 結束編輯' : '餐廳俯視地圖：21 桌、98 席，顯示機器人、顧客、行人與路線'}
        tabIndex={editing ? 0 : undefined} onKeyDown={keyboard}
        onMouseMove={e => setHover(cellAt(e))} onMouseLeave={() => setHover(null)}
        onClick={e => { const cell = cellAt(e); if (cell && editing) { setCursor(cell); s.toggleObstacle(cell); } }}>
        <defs>
          <pattern id="floor-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M 1 0 L 0 0 0 1" fill="none" stroke="#dce5df" strokeWidth="0.025" /></pattern>
          <marker id="route-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#438978" /></marker>
        </defs>
        <rect width="18" height="34" className="floor" />
        <rect x="4" width="3" height="34" className="aisle" /><rect x="11" width="3" height="34" className="aisle" />
        <rect width="18" height="3" className="open-floor" /><rect y="30" width="18" height="4" className="open-floor" />
        <rect width="18" height="34" fill="url(#floor-grid)" />
        <path d="M 7 34 H 0 V 0 H 18 V 34 H 12" className="floor-wall" />
        <path d="M -0.2 3 V 30" className="window-line" />
        <text x="-0.8" y="17" className="window-label" transform="rotate(-90 -0.8 17)">WINDOW SIDE · 靠窗區</text>
        <text x="2" y="-0.65" className="zone-label">A 區 · 4 人桌</text><text x="9" y="-0.65" className="zone-label">B 區 · 6 人桌</text><text x="16" y="-0.65" className="zone-label">C 區 · 4 人桌</text>
        {Array.from({ length: 9 }, (_, i) => i * 4).map(y => <text key={y} x="18.65" y={34 - y} className="axis-label">{y}</text>)}
        {[0, 4, 8, 12, 16].map(x => <text key={x} x={x + 0.5} y="35.3" className="axis-label">{x}</text>)}
        <text x="9.5" y="34.7" className="entrance-label">入口 ENTRANCE</text>
        <circle cx={point(robot)[0]} cy={point(robot)[1]} r={SENSOR_RANGE} className="sensor-circle" />
        {map.tables.map(table => <g key={table.name} className={`map-table ${table.status === '空閒' ? 'table-free' : table.status === '保留' ? 'table-reserved' : 'table-occupied'} ${selected.has(table.name) ? 'table-selected' : ''}`}>
          <title>{table.name}｜{table.capacity} 人桌｜{table.status}{table.windowSide ? '｜靠窗' : ''}</title>
          <rect x={table.x + 0.12} y={34 - table.y - table.height + 0.12} width={table.width - 0.24} height={table.height - 0.24} rx="0.28" />
          <text x={table.x + 2} y={34 - table.y - 1.65} className="table-name">{table.name}</text>
          <text x={table.x + 2} y={34 - table.y - 0.75} className="table-caption">{table.capacity} 人 · {table.status}</text>
          <circle cx={point(table.goal)[0]} cy={point(table.goal)[1]} r="0.14" className="table-goal" />
        </g>)}
        {route.length > 1 && <polyline points={route.map(coordinates).join(' ')} className={`navigation-route ${s.proposed ? 'proposed-route' : ''}`} markerEnd="url(#route-arrow)" />}
        {obstacleKeys.map(id => {
          const [x, y] = fromKey(id), present = map.obstacles.has(id), known = map.knownObstacles.has(id);
          return <g key={id} className={`map-obstacle ${!known ? 'undiscovered' : ''} ${!present ? 'remembered' : ''}`}>
            <title>{!present ? '現場已移除，機器人仍記得' : known ? '已發現障礙物' : '尚未發現障礙物'} ({id})</title>
            <rect x={x + 0.08} y={33 - y + 0.08} width="0.84" height="0.84" rx="0.12" />
            <path d={`M ${x + 0.3} ${33 - y + 0.3} l 0.4 0.4 m 0 -0.4 l -0.4 0.4`} />
          </g>;
        })}
        {s.pedestrians.map(p => <Actor key={p.number} position={p.position} kind="pedestrian" label={`行人 P${p.number}`} discovered={s.detectedPedestrians.has(p.number)} />)}
        {s.customerPosition && <Actor position={s.customerPosition} kind="customer" label={s.group?.remainingPeople ? `${s.group.remainingPeople}人` : '顧客'} />}
        <Actor position={robot} kind="robot" label="帶位機器人 R" />
        {editing && <rect x={cursor[0] + 0.03} y={33 - cursor[1] + 0.03} width="0.94" height="0.94" className="edit-cursor" />}
      </svg>
      <div className="map-scale"><span />1 格 = 1 公尺</div>
      {editing && <div className="edit-hint"><Crosshair size={14} />點選空白格新增／移除障礙物</div>}
    </div>
    <div className="map-footer"><span><Navigation size={14} />R ({robot.map(n => n.toFixed(2)).join(', ')})</span><span>{hover ? `座標 (${key(hover)})` : '深色：已發現 · 淺色：未發現 · 金框：記憶'}</span></div>
  </section>;
}
