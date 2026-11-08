import type { Cycle } from './types'
import { hex, slots, stageNames } from './types'

export default function Datapath({ cycle, zoom }: { cycle: Cycle | undefined; zoom: number }) {
  const active = new Set(cycle?.active_paths ?? [])
  const instructions = cycle ? slots(cycle) : []
  const color = (on: boolean, accent = false) => on ? (accent ? '#f0b56a' : '#a8e4a0') : '#465048'
  const wire = (d: string, key: string, label?: string, x?: number, y?: number) => <g key={key}><path d={d} fill="none" stroke={color(active.has(key), key.startsWith('forward'))} strokeWidth={active.has(key) ? 3 : 1.5} markerEnd={`url(#${active.has(key) ? key.startsWith('forward') ? 'arrowAmber' : 'arrowGreen' : 'arrowMuted'})`} className={active.has(key) ? 'live-wire' : ''}/>{label && <text x={x} y={y} className="wire-label" fill={color(active.has(key), key.startsWith('forward'))}>{label}</text>}</g>
  const box = (x: number, y: number, width: number, height: number, label: string, sub: string, on: boolean, shape = false) => <g><rect x={x} y={y} width={width} height={height} rx={shape ? 19 : 6} fill={on ? '#23372a' : '#1b221d'} stroke={on ? '#a8e4a0' : '#505c50'} strokeWidth={on ? 1.8 : 1}/><text x={x+width/2} y={y+height/2-3} textAnchor="middle" className="component-label">{label}</text><text x={x+width/2} y={y+height/2+17} textAnchor="middle" className="component-sub">{sub}</text></g>
  return <div className="schematic-scroll"><svg viewBox="0 0 1250 510" style={{ width: `${zoom}%`, minWidth: 900 }} role="img" aria-label="MIPS 五級管線資料路徑，綠色為有效資料路徑，琥珀色為 forwarding">
    <defs>{[['arrowMuted','#465048'],['arrowGreen','#a8e4a0'],['arrowAmber','#f0b56a']].map(([id, fill])=><marker id={id} key={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={fill}/></marker>)}<pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill="#647263" opacity=".2"/></pattern></defs>
    <rect width="1250" height="510" fill="url(#grid)"/>
    {[0,1,2,3,4].map((s)=><g key={s}><rect x={s*250+8} y="12" width="234" height="45" rx="5" fill={instructions[s] ? '#243629' : '#1c241e'}/><text x={s*250+22} y="31" className="stage-title">{stageNames[s]} <tspan className="component-sub"> / {['FETCH','DECODE','EXECUTE','MEMORY','WRITE BACK'][s]}</tspan></text><text x={s*250+22} y="47" className="stage-instruction">{instructions[s] ? `#${instructions[s]!.id} ${instructions[s]!.instruction.text}` : '— bubble / idle'}</text>{s > 0 && <line x1={s*250} x2={s*250} y1="70" y2="490" stroke="#354137" strokeDasharray="3 6"/>}</g>)}
    {wire('M 73 210 L 110 210','fetch')}
    {wire('M 38 160 L 38 120 L 130 120','fetch')}
    {wire('M 190 120 L 235 120 L 235 90 L 38 90 L 38 160','fetch','PC + 4',196,112)}
    {wire('M 300 210 L 300 355 L 335 355','immediate')}
    {wire('M 430 355 L 480 355 L 480 313 L 510 313','immediate')}
    {wire('M 222 210 L 260 210','fetch')}
    {wire('M 278 210 L 315 210','decode')}
    {wire('M 425 193 L 470 193 L 470 195 L 510 195','decode','Read A',430,178)}
    {wire('M 425 235 L 455 235 L 455 284 L 510 284','decode','Read B',430,250)}
    {wire('M 528 195 L 557 195 L 557 214 L 590 214','execute')}
    {wire('M 528 284 L 565 284 L 565 265 L 590 265','execute')}
    {wire('M 614 214 L 645 214','execute','A',623,201)}
    {wire('M 614 265 L 645 265','execute','B',623,285)}
    {wire('M 723 239 L 760 239','execute')}
    {wire('M 778 239 L 815 239','memory-address','Address',788,225)}
    {wire('M 778 239 L 805 239 L 805 320 L 1010 320','memory-alu','ALU result',835,339)}
    {wire('M 925 239 L 1010 239','memory-read','Read data',935,224)}
    {wire('M 1028 239 L 1080 239','writeback-memory')}
    {wire('M 1028 320 L 1060 320 L 1060 273 L 1080 273','writeback-alu')}
    {wire('M 1105 255 L 1185 255 L 1185 430 L 365 430 L 365 300','writeback','Write-back bus',650,449)}
    {wire('M 785 239 L 785 105 L 600 105 L 600 190','forward-ex-a','EX/MEM → EX',650,96)}
    {wire('M 785 105 L 550 105 L 550 340 L 600 340 L 600 290','forward-ex-b')}
    {wire('M 1130 255 L 1130 375 L 540 375 L 540 160 L 600 160 L 600 190','forward-wb-a','MEM/WB → EX',910,393)}
    {wire('M 1130 375 L 600 375 L 600 290','forward-wb-b')}
    {wire('M 1130 375 L 870 375 L 870 300','forward-store','MEM/WB → store',860,367)}
    {wire('M 614 265 L 630 265 L 630 347 L 740 347 L 740 285 L 760 285','store-ex','Store data',649,366)}
    {wire('M 778 285 L 815 285','memory-write')}
    {wire('M 685 196 L 685 78 L 38 78 L 38 160','redirect','Branch / jump target → PC',275,94)}
    {box(12,160,61,100,'PC',cycle ? hex(cycle.pc_before,4) : '0000',active.has('fetch'))}
    {box(110,160,112,100,'Instruction','Memory',active.has('fetch'))}
    {box(130,100,60,39,'+ 4','',active.has('fetch'))}
    {box(315,155,110,145,'Register','File',active.has('decode') || active.has('writeback'))}
    {box(335,330,95,50,'Immediate','extend',active.has('immediate'))}
    {box(590,190,24,45,'','',signalsForward(cycle,'a'),true)}
    {box(590,242,24,48,'','',signalsForward(cycle,'b'),true)}
    <path d="M645 185 L645 225 L660 239 L645 253 L645 293 L723 261 L723 217 Z" fill={active.has('execute') ? '#294430' : '#202b23'} stroke={active.has('execute') ? '#a8e4a0' : '#526354'} strokeWidth="1.8"/><text x="681" y="242" textAnchor="middle" className="component-label">ALU</text>
    {box(645,125,86,44,'Branch','compare',!!cycle?.pipeline_before.id_ex?.instruction.control.branch)}
    {box(815,185,110,115,'Data','Memory · 1 KiB',active.has('memory-read') || active.has('memory-write'))}
    {box(1080,225,25,62,'','',active.has('writeback'),true)}
    {box(1125,170,98,48,'WB result',cycle?.pipeline_before.mem_wb ? hex(cycle.pipeline_before.mem_wb.write_value,4) : '—',active.has('writeback'))}
    {[[260,'IF/ID'],[510,'ID/EX'],[760,'EX/MEM'],[1010,'MEM/WB']].map(([x,label],s)=><g key={label}><rect x={Number(x)} y="145" width="18" height="190" rx="3" fill="#324237" stroke="#758e76"/><text transform={`translate(${Number(x)+12},240) rotate(-90)`} textAnchor="middle" className="latch-label">{label}</text><text x={Number(x)+9} y="472" textAnchor="middle" className="latch-value">{instructions[s+1] ? `#${instructions[s+1]!.id}` : 'EMPTY'}</text></g>)}
    <text x="20" y="495" className="component-sub">Cycle {cycle?.number ?? '—'} · 組合邏輯與訊號：時鐘邊緣前</text><text x="1220" y="495" textAnchor="end" className="component-sub">EX branch · predict not taken · no delay slot</text>
  </svg></div>
}
function signalsForward(c: Cycle | undefined, which: 'a' | 'b') { return (which === 'a' ? c?.signals.forward_a : c?.signals.forward_b) !== 'Register' && !!c }
