import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, CircuitBoard, Code2, Cpu, Database, GitBranch, History, LoaderCircle, Maximize2, Pause, Play, Plus, RotateCcw, Save, Trash2, Waves, ZoomIn, ZoomOut } from 'lucide-react'
import Datapath from './Datapath'
import { examples } from './examples'
import { hex, names, slots, stageNames } from './types'
import type { Cycle, Input, Pipeline, Program, Run, RunSummary, Simulation, Slot } from './types'

async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch('/api/v1' + path, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { throw new Error(res.ok ? '後端回傳格式不正確' : text || `HTTP ${res.status}`) }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
  return data as T
}
function integer(raw: string): number {
  if (!/^-?(?:0x[0-9a-f]+|\d+)$/i.test(raw.trim())) throw new Error(`無效整數：${raw}`)
  const value = raw.startsWith('-0x') ? -Number(raw.slice(1)) : Number(raw)
  if (!Number.isSafeInteger(value) || value < -2147483648 || value > 4294967295) throw new Error(`數值超出 32-bit 範圍：${raw}`)
  return value >>> 0
}
function settings(raw: string, type: 'registers' | 'memory'): Record<string, number> {
  const result: Record<string, number> = {}
  for (const line of raw.split('\n')) {
    const text = line.split('#')[0].trim()
    if (!text) continue
    const parts = text.split('=').map(s => s.trim())
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('初始設定請使用「名稱 = 數值」，每行一筆')
    const key = parts[0].replace(/^\$/, '').toLowerCase()
    const index = type === 'registers' ? key === 's8' ? 30 : names.includes(key) ? names.indexOf(key) : /^\d+$/.test(key) ? Number(key) : -1 : integer(key)
    if (type === 'registers' && (index < 0 || index >= 32)) throw new Error(`未知暫存器：${parts[0]}`)
    if (type === 'memory' && (index > 1020 || index % 4 !== 0)) throw new Error('記憶體位址須為 0–1020，並按 4 bytes 對齊')
    if (Object.hasOwn(result, index)) throw new Error(`初始設定重複：${parts[0]}`)
    result[index] = integer(parts[1])
    if (type === 'registers' && index === 0 && result[index] !== 0) throw new Error('$zero 必須為零')
  }
  return result
}
function rawSettings(values: Record<string, number>, registers: boolean): string { return Object.entries(values).map(([key, value]) => `${registers ? '$' + names[Number(key)] : hex(Number(key), 4)} = ${hex(value)}`).join('\n') }
const tabs = [{ id: 'datapath', label: 'Datapath', icon: CircuitBoard }, { id: 'control', label: 'Control Unit', icon: GitBranch }, { id: 'pipeline', label: 'Pipeline', icon: Waves }, { id: 'history', label: 'History', icon: History }] as const
const date = (n: number) => new Date(n * 1000).toLocaleString('zh-TW', { hour12: false })
const statusName = (s: string) => ({ completed: '執行完成', limit: '到達上限', error: '執行停止' }[s] ?? s)
const empty: Pipeline = { if_id: null, id_ex: null, ex_mem: null, mem_wb: null }

export default function App() {
  const [title, setTitle] = useState(examples[0].title)
  const [source, setSource] = useState(examples[0].source)
  const [registerText, setRegisterText] = useState('')
  const [memoryText, setMemoryText] = useState(examples[0].memory)
  const [maxCycles, setMaxCycles] = useState(10000)
  const [programId, setProgramId] = useState<number | null>(null)
  const [run, setRun] = useState<Run | null>(null)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [tab, setTab] = useState<string>('datapath')
  const [zoom, setZoom] = useState(100)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [programs, setPrograms] = useState<Program[]>([])
  const [history, setHistory] = useState<RunSummary[]>([])
  const [online, setOnline] = useState(false)
  const [afterEdge, setAfterEdge] = useState(true)
  const [memoryPage, setMemoryPage] = useState(0)
  const simulation = run?.simulation
  const cycle = simulation?.trace[index]
  const last = Math.max(0, (simulation?.trace.length ?? 1) - 1)
  async function refresh() {
    const [p, h] = await Promise.all([api<Program[]>('/programs'), api<RunSummary[]>('/simulations')])
    setPrograms(p); setHistory(h); setOnline(true)
  }
  useEffect(() => { refresh().catch(() => { setOnline(false); setError('尚未連上 Rust API。請依 README 啟動後端，再按重新連線。') }) }, [])
  useEffect(() => {
    if (!playing || !simulation) return
    const timer = window.setInterval(() => setIndex(i => Math.min(i + 1, last)), 800 / speed)
    return () => window.clearInterval(timer)
  }, [playing, speed, last, simulation])
  useEffect(() => { if (index >= last) setPlaying(false) }, [index, last])
  function edit() { setDirty(true); setPlaying(false); setNotice('') }
  function input(): Input { return { source, registers: settings(registerText, 'registers'), memory: settings(memoryText, 'memory'), max_cycles: maxCycles } }
  async function action(fn: () => Promise<void>) {
    setBusy(true); setPlaying(false); setError(''); setNotice('')
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : '操作失敗') } finally { setBusy(false) }
  }
  function loadInput(name: string, data: Input, id: number | null) {
    setTitle(name); setSource(data.source); setRegisterText(rawSettings(data.registers, true)); setMemoryText(rawSettings(data.memory, false)); setMaxCycles(data.max_cycles); setProgramId(id); setPlaying(false)
  }
  function replaceDraft(): boolean { return !dirty || window.confirm('取代目前編輯中的程式與初始設定？') }
  const registers = cycle ? afterEdge ? cycle.registers_after : cycle.registers_before : Array.from({ length: 32 }, (_, i) => simulation?.input.registers[String(i)] ?? 0)
  const memory = cycle ? afterEdge ? cycle.memory_after : index > 0 ? simulation!.trace[index-1].memory_after : Array.from({ length: 256 }, (_, i) => simulation?.input.memory[String(i*4)] ?? 0) : Array.from({ length: 256 }, () => 0)
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#" onClick={e=>{e.preventDefault();setTab('datapath')}}><span className="brand-icon"><Cpu size={24}/></span><strong>MIPS<span className="brand-slash"> / </span><span className="brand-light">Pipeline Lab</span></strong><span className="version">01</span></a><div className="top-meta"><span className="desktop-only">PATTERSON & HENNESSY</span><span className="tag">SINGLE ISSUE</span><span className={`connection ${online ? 'connected' : ''}`}><i/>{online ? 'LOCAL WORKSPACE' : 'API OFFLINE'}</span></div></header>
    <div className="workspace-heading"><div><p className="eyebrow">COMPUTER ARCHITECTURE / INTERACTIVE WORKBENCH</p><h1>看見每一個 cycle。</h1><p className="subtitle">五級 MIPS 管線，從資料流到每一次停頓的原因。</p></div><div className="model-note"><span className="model-icon"><Activity size={20}/></span><div><strong>Classic 5-stage MIPS</strong><span>EX branch · Full hazard handling · 1 KiB memory</span></div></div></div>
    <main className="workspace">
      <aside className="editor-panel panel"><div className="panel-title"><span><Code2 size={16}/> PROGRAM EDITOR</span><button className="icon-button" title="新程式" aria-label="新程式" disabled={busy} onClick={()=>{if(!replaceDraft())return;loadInput('未命名程式',{source:'nop\n',registers:{},memory:{},max_cycles:10000},null);setDirty(true)}}><Plus size={17}/></button></div>
        <div className="editor-content"><label className="field-label" htmlFor="program-title">程式名稱 <span>{programId ? `SAVED #${programId}` : 'DRAFT'}</span></label><input id="program-title" className="title-input" value={title} maxLength={100} disabled={busy} onChange={e=>{setTitle(e.target.value);edit()}}/>
          <label className="field-label" htmlFor="example">載入教學範例</label><div className="select-wrap"><BookOpen size={15}/><select id="example" value="" disabled={busy} onChange={e=>{const ex=examples[Number(e.target.value)];if(!ex||!replaceDraft())return;loadInput(ex.title,{source:ex.source,registers:{},memory:settings(ex.memory,'memory'),max_cycles:10000},null);setDirty(true);setNotice(ex.description)}}><option value="" disabled>選擇一個範例…</option>{examples.map((ex,i)=><option key={ex.title} value={i}>{String(i+1).padStart(2,'0')} / {ex.title}</option>)}</select><ChevronDown size={14}/></div>
        </div>
        <div className="code-heading"><span>PROGRAM.asm</span><span>MIPS32 · MAX 20</span></div><div className="code-editor"><div className="line-numbers" aria-hidden="true">{source.split('\n').map((_,i)=><div key={i}>{i+1}</div>)}</div><textarea aria-label="MIPS 組合語言" value={source} disabled={busy} spellCheck={false} wrap="off" onChange={e=>{setSource(e.target.value);edit()}} onScroll={e=>{const gutter=e.currentTarget.previousElementSibling;if(gutter)gutter.scrollTop=e.currentTarget.scrollTop}}/></div>
        <div className="editor-content settings"><details><summary><Database size={14}/> 初始狀態 <span>REGISTERS / MEMORY</span></summary><label className="field-label" htmlFor="init-registers">暫存器（每行：$t0 = 12）</label><textarea id="init-registers" value={registerText} disabled={busy} placeholder="$t0 = 12" onChange={e=>{setRegisterText(e.target.value);edit()}}/><label className="field-label" htmlFor="init-memory">記憶體 word（每行：0x0000 = 7）</label><textarea id="init-memory" value={memoryText} disabled={busy} placeholder="0x0000 = 7" onChange={e=>{setMemoryText(e.target.value);edit()}}/><label className="field-label" htmlFor="cycle-limit">Cycle 上限</label><input id="cycle-limit" type="number" min={1} max={10000} value={maxCycles} disabled={busy} onChange={e=>{setMaxCycles(Number(e.target.value));edit()}}/><p className="help">未設定的值為 0。支援帶符號十進位或 32-bit 十六進位；記憶體位址 0–1020，4-byte 對齊。</p></details>
          <details className="syntax"><summary><BookOpen size={14}/> 支援語法 <ChevronDown size={12}/></summary><p>add · addu · sub · subu · addi · addiu<br/>and · or · xor · nor · andi · ori · xori<br/>slt · sltu · slti · sltiu · sll · srl · sra · lui<br/>lw · sw · beq · bne · j · jal · jr · nop</p><p>標籤、$t0 / $8、# 或 ; 註解、.text。分支數字為相對 word offset；j 的數字為絕對 byte 位址。只接受 nop 偽指令。資料由初始狀態設定。</p></details>
          <button className="primary run-button" disabled={busy} onClick={()=>action(async()=>{const result=await api<Run>('/simulations','POST',{title,program_id:programId,input:input()});setRun(result);setIndex(0);setDirty(false);setTab('datapath');await refresh();setNotice('模擬已儲存，可逐 cycle 播放。')})}>{busy ? <LoaderCircle className="spin" size={16}/> : <Play size={16}/>} 執行模擬 <span>RUN</span></button>
          <button className="secondary save-button" disabled={busy} onClick={()=>action(async()=>{const saved=await api<Program>(programId ? `/programs/${programId}` : '/programs',programId ? 'PUT' : 'POST',{title,input:input()});setProgramId(saved.id);await refresh();setNotice(`程式已儲存 #${saved.id}`)})}><Save size={15}/> 儲存程式</button>
        </div><div className="editor-footer"><span className="status-dot"/> SINGLE ISSUE / IN-ORDER / 32-BIT</div>
      </aside>
      <section className="main-area">
        {error && <div className="alert error" role="alert">{error}{!online && <button disabled={busy} onClick={()=>action(async()=>{await refresh();setNotice('已連上工作區')})}>重新連線</button>}</div>}
        {notice && <div className="alert notice" role="status"><Check size={15}/>{notice}<button onClick={()=>setNotice('')} aria-label="關閉通知">×</button></div>}
        {dirty && simulation && <div className="alert warning">編輯尚未套用；下方顯示「{run?.title}」的已儲存執行快照。</div>}
        <div className="metric-grid">{[{label:'CLOCK CYCLE',value:cycle ? String(cycle.number).padStart(3,'0') : '—',sub:simulation ? `/ ${simulation.statistics.cycles} cycles` : '等待模擬',icon:Activity},{label:'RETIRED',value:simulation?.statistics.retired ?? '—',sub:'本次模擬完成指令',icon:Cpu},{label:'STALL / FLUSH',value:simulation ? `${simulation.statistics.stalls} / ${simulation.statistics.flushed}` : '—',sub:'停頓 cycles / 清除指令',icon:GitBranch},{label:'CPI',value:simulation ? simulation.statistics.cpi.toFixed(2) : '—',sub:'含管線填充與排空',icon:Waves}].map(m=><div className="metric panel" key={m.label}><div><span>{m.label}</span><m.icon size={15}/></div><strong>{m.value}</strong><small>{m.sub}</small></div>)}</div>
        <section className="panel simulation-panel"><div className="view-tabs" role="tablist" aria-label="模擬檢視">{tabs.map(t=><button key={t.id} id={`tab-${t.id}`} role="tab" aria-selected={tab===t.id} aria-controls="simulation-view" className={tab===t.id?'active':''} onClick={()=>setTab(t.id)}><t.icon size={16}/>{t.label}{t.id==='history'&&history.length>0&&<span className="count">{history.length}</span>}</button>)}</div>
          <div id="simulation-view" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab==='datapath'&&<><div className="view-heading"><div><h2>Pipeline datapath</h2><p>時鐘邊緣前的資料流與有效訊號</p></div><div className="view-tools"><span className="legend"><i/>ACTIVE <i className="amber"/>FORWARD</span><button className="icon-button" aria-label="縮小資料路徑" onClick={()=>setZoom(z=>Math.max(80,z-10))}><ZoomOut size={16}/></button><span className="zoom-label">{zoom}%</span><button className="icon-button" aria-label="放大資料路徑" onClick={()=>setZoom(z=>Math.min(200,z+10))}><ZoomIn size={16}/></button><button className="icon-button" aria-label="重設縮放" onClick={()=>setZoom(100)}><Maximize2 size={15}/></button></div></div><Datapath cycle={cycle} zoom={zoom}/><div className="stage-strip">{stageNames.map((name,i)=>{const slot=cycle?slots(cycle)[i]:null;return <div key={name} className={slot?'occupied':''}><span className={`stage-dot stage-${i}`}/><strong>{name}</strong><code>{slot?`#${slot.id} ${slot.instruction.op}`:'—'}</code></div>})}</div></>}
            {tab==='control'&&<ControlView cycle={cycle}/>}
            {tab==='pipeline'&&<Timeline simulation={simulation} index={index} onSelect={i=>{setIndex(i);setPlaying(false)}}/>}
            {tab==='history'&&<div className="history-view"><div className="view-heading"><div><h2>Simulation history</h2><p>程式與執行快照 · SQLite 共用工作區 · 最近 100 筆</p></div><button className="secondary small" disabled={busy} onClick={()=>action(refresh)}><RotateCcw size={14}/> 重新整理</button></div><h3>已儲存程式 <span>{programs.length}</span></h3>{!programs.length&&<p className="empty-note">尚無已儲存程式。可從左側儲存目前內容。</p>}<div className="saved-grid">{programs.map(p=><article className="saved-card" key={p.id}><div><Code2 size={16}/><strong>{p.title}</strong></div><small>{date(p.updated_at)}</small><div className="saved-actions"><button disabled={busy} onClick={()=>{if(!replaceDraft())return;loadInput(p.title,p.input,p.id);setDirty(true);setNotice(`已載入程式 #${p.id}`)}}>載入程式 <ArrowRight size={13}/></button><button className="icon-button danger" disabled={busy} aria-label={`刪除程式 ${p.title}`} onClick={()=>{if(window.confirm('刪除此程式？已儲存的模擬快照會保留。'))action(async()=>{await api(`/programs/${p.id}`,'DELETE');if(programId===p.id)setProgramId(null);await refresh()})}}><Trash2 size={14}/></button></div></article>)}</div><h3>執行紀錄 <span>{history.length}</span></h3>{!history.length&&<p className="empty-note">執行模擬後，紀錄會自動儲存在這裡。</p>}<div className="run-list">{history.map(h=><article key={h.id}><span className={`history-status ${h.status}`}/><div className="run-info"><strong>{h.title}</strong><small>#{h.id} · {date(h.created_at)} · {h.cycles} cycles · {h.retired} retired</small></div><span className="status-label">{statusName(h.status)}</span><button className="secondary small" disabled={busy} onClick={()=>{if(!replaceDraft())return;action(async()=>{const loaded=await api<Run>(`/simulations/${h.id}`);loadInput(loaded.title,loaded.simulation.input,loaded.program_id);setRun(loaded);setIndex(0);setDirty(false);setTab('datapath');setNotice(`正在回放紀錄 #${loaded.id}`)})}}><Play size={13}/> 回放</button><button className="icon-button danger" disabled={busy} aria-label={`刪除紀錄 ${h.id}`} onClick={()=>{if(window.confirm('刪除此模擬紀錄？'))action(async()=>{await api(`/simulations/${h.id}`,'DELETE');if(run?.id===h.id){setRun(null);setIndex(0)}await refresh()})}}><Trash2 size={14}/></button></article>)}</div></div>}
          </div>
          <div className="transport"><div className="transport-buttons"><button className="icon-button" title="回到第一個 cycle" aria-label="回到第一個 cycle" disabled={!cycle} onClick={()=>{setIndex(0);setPlaying(false)}}><RotateCcw size={16}/></button><button className="icon-button" aria-label="上一個 cycle" disabled={!cycle||index===0} onClick={()=>{setIndex(i=>Math.max(0,i-1));setPlaying(false)}}><ChevronLeft size={20}/></button><button className="play-button" aria-label={playing?'暫停播放':'播放模擬'} disabled={!cycle||index===last} onClick={()=>setPlaying(p=>!p)}>{playing?<Pause size={16}/>:<Play size={16}/>}</button><button className="icon-button" aria-label="下一個 cycle" disabled={!cycle||index===last} onClick={()=>{setIndex(i=>Math.min(last,i+1));setPlaying(false)}}><ChevronRight size={20}/></button></div><input type="range" aria-label="Cycle 時間軸" min={0} max={last||1} value={index} disabled={!cycle} onChange={e=>{setIndex(Number(e.target.value));setPlaying(false)}}/><code>{cycle?.number??0} <span>/ {simulation?.trace.length??0}</span></code><select aria-label="播放速度" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[0.5,1,2,4].map(s=><option key={s} value={s}>{s}×</option>)}</select></div>
        </section>
        {simulation&&<div className={`run-result ${simulation.status}`}><span className="status-dot"/><strong>{statusName(simulation.status)}</strong><span>{simulation.stop_reason}</span><code>SNAPSHOT #{run?.id}</code></div>}
        <div className="bottom-grid"><section className="panel event-panel"><div className="panel-title"><span><GitBranch size={15}/> CYCLE EVENTS</span><span className="muted">{cycle?`CC ${cycle.number}`:'LIVE SIGNALS'}</span></div><div className="event-list">{!cycle?<div className="empty-state"><CircuitBoard size={28}/><strong>從一段程式開始。</strong><p>選擇範例並執行，查看每個 cycle 的處理原因。</p></div>:!cycle.events.length?<div className="event normal"><span>FLOW</span><p>指令依序前進，目前沒有 hazard 或寫入事件。</p></div>:cycle.events.map((e,i)=><div className={`event ${e.kind}`} key={i}><span>{e.stage} / {e.kind.toUpperCase()}</span><p>{e.message}</p></div>)}</div></section>
        <section className="panel machine-panel"><div className="panel-title"><span><Database size={15}/> MACHINE STATE</span><button className="edge-toggle" onClick={()=>setAfterEdge(a=>!a)}>{afterEdge?'邊緣後':'邊緣前'} <ArrowLeft size={12}/><ArrowRight size={12}/></button></div><div className="machine-content"><div className="machine-subhead"><h3>Registers</h3><span>HEX / SIGNED</span></div><div className="register-grid">{registers.map((value,i)=><div key={i} className={cycle&&cycle.registers_before[i]!==cycle.registers_after[i]?'changed':''}><span>${names[i]}<small>{i}</small></span><code title={String(value|0)}>{hex(value)}</code></div>)}</div><div className="machine-subhead memory-heading"><h3>Data Memory <span>1 KiB</span></h3><div><button className="icon-button" aria-label="上一頁記憶體" disabled={memoryPage===0} onClick={()=>setMemoryPage(p=>p-1)}><ChevronLeft size={15}/></button><code>{memoryPage+1}/16</code><button className="icon-button" aria-label="下一頁記憶體" disabled={memoryPage===15} onClick={()=>setMemoryPage(p=>p+1)}><ChevronRight size={15}/></button></div></div><div className="memory-grid">{Array.from({length:16},(_,i)=>{const word=memoryPage*16+i;const value=memory[word]??0;return <div key={word} className={cycle?.memory_change?.address===word*4?'changed':''}><span>{hex(word*4,4)}</span><code title={`${value|0} · bytes (LE): ${[0,8,16,24].map(s=>((value>>>s)&255).toString(16).padStart(2,'0')).join(' ')}`}>{hex(value)}</code></div>})}</div><p className="help">值以十六進位顯示；指向數值可查看帶符號值與記憶體位元組。綠底表示本 cycle 的變更。</p></div></section></div>
      </section>
    </main><footer className="page-footer"><span>MIPS / PIPELINE LAB</span><span>IF → ID → EX → MEM → WB</span><span>BUILT TO MAKE ARCHITECTURE VISIBLE.</span></footer>
  </div>
}

function ControlView({cycle}:{cycle:Cycle|undefined}) {
  const [stage,setStage]=useState(2)
  const [after,setAfter]=useState(false)
  const current=cycle?slots(cycle)[stage]:null
  const i=current?.instruction
  const pipeline=cycle?(after?cycle.pipeline_after:cycle.pipeline_before):empty
  return <div className="control-view"><div className="view-heading"><div><h2>Control & decode</h2><p>各指令的控制訊號隨管線暫存器傳遞；EX 顯示 forwarding 選擇。</p></div></div><div className="stage-selector">{stageNames.map((s,n)=><button key={s} className={stage===n?'selected':''} onClick={()=>setStage(n)}>{s}<small>{cycle?slots(cycle)[n]?.instruction.op??'idle':'idle'}</small></button>)}</div>
    <div className="decode-card"><div><span className="eyebrow">{stageNames[stage]} / INSTRUCTION</span><h3>{current?`#${current.id} ${i!.text}`:'— bubble / idle'}</h3><code>{i?hex(i.machine_code):'0x00000000'}</code></div><div className="decode-fields">{[['opcode',i?(i.machine_code>>>26).toString(2).padStart(6,'0'):'—'],['rs',i?`$${names[i.rs]} (${i.rs})`:'—'],['rt',i?`$${names[i.rt]} (${i.rt})`:'—'],['rd',i?`$${names[i.rd]} (${i.rd})`:'—'],['immediate',i?String(i.immediate):'—'],['shamt',i?String(i.shamt):'—']].map(([key,val])=><div key={key}><span>{key}</span><code>{val}</code></div>)}</div></div>
    <div className="signals-grid">{Object.entries(i?.control??{reg_dst:false,alu_src:false,mem_to_reg:false,reg_write:false,mem_read:false,mem_write:false,branch:false,jump:false,alu_op:'—'}).map(([key,value])=><div key={key} className={value===true?'on':''}><span>{({reg_dst:'RegDst',alu_src:'ALUSrc',mem_to_reg:'MemToReg',reg_write:'RegWrite',mem_read:'MemRead',mem_write:'MemWrite',branch:'Branch',jump:'Jump',alu_op:'ALU operation'} as Record<string,string>)[key]}</span><code>{typeof value==='boolean'?Number(value):value}</code></div>)}</div>
    <h3 className="section-label">Hazard & forwarding unit</h3><div className="signals-grid hazard-signals">{[['PCWrite',cycle?.signals.pc_write],['IF/IDWrite',cycle?.signals.if_id_write],['ID/EX Bubble',cycle?.signals.id_ex_flush],['IF/ID Flush',cycle?.signals.if_id_flush],['Forward A',cycle?.signals.forward_a],['Forward B / store',cycle?.signals.forward_b],['WB → MEM store',cycle?.signals.forward_store],['Redirect PC',cycle?.signals.redirect==null?'—':hex(cycle.signals.redirect)]].map(([key,value])=><div key={String(key)}><span>{key}</span><code>{value==null?'—':typeof value==='boolean'?Number(value):value}</code></div>)}</div>
    <div className="machine-subhead"><h3>Pipeline registers</h3><button className="secondary small" onClick={()=>setAfter(a=>!a)}>{after?'時鐘邊緣後':'時鐘邊緣前'} <ArrowRight size={12}/></button></div><div className="latch-grid">{Object.entries(pipeline).map(([key,slot]:[string,Slot|null])=><div className="latch-card" key={key}><h4>{key.toUpperCase().replace('_','/')}<span>{slot?'VALID':'EMPTY'}</span></h4><code>{slot?`#${slot.id} ${slot.instruction.text}`:'bubble'}</code>{slot&&<dl>{[['PC',hex(slot.instruction.pc)],['Read A',hex(slot.read_a)],['Read B',hex(slot.read_b)],['ALU result',hex(slot.alu_result)],['Store data',hex(slot.store_value)],['WB data',hex(slot.write_value)],['Destination',slot.instruction.destination===null?'—':`$${names[slot.instruction.destination]}`],['RegWrite',String(Number(slot.instruction.control.reg_write))],['MemRead / Write',`${Number(slot.instruction.control.mem_read)} / ${Number(slot.instruction.control.mem_write)}`]].map(([key,val])=><div key={key}><dt>{key}</dt><dd>{val}</dd></div>)}</dl>}</div>)}</div><p className="help">控制訊號為所選指令的解碼值；nop / bubble 無寫入效果。EX operands：{cycle?.ex_operands?.map(v=>hex(v)).join(' / ')??'—'}；ALU result：{cycle?.ex_result==null?'—':hex(cycle.ex_result)}。</p></div>
}
function Timeline({simulation,index,onSelect}:{simulation:Simulation|undefined;index:number;onSelect:(i:number)=>void}) {
  const rows=useMemo(()=>{
    const map=new Map<number,{slot:Slot;visits:Map<number,{stage:string;state:string}>}>()
    simulation?.trace.forEach((c,col)=>slots(c).forEach((slot,s)=>{if(!slot)return;let row=map.get(slot.id);if(!row){row={slot,visits:new Map()};map.set(slot.id,row)};const state=c.events.some(e=>e.kind==='flush'&&e.stage===stageNames[s])?'flushed':s<2&&!c.signals.if_id_write?'stalled':'';row.visits.set(col,{stage:stageNames[s],state})}))
    return Array.from(map.values())
  },[simulation])
  const start=Math.max(0,Math.min(index-6,Math.max(0,(simulation?.trace.length??0)-18)))
  const columns=Array.from({length:Math.min(18,simulation?.trace.length??0)},(_,n)=>start+n)
  const visible=rows.filter(row=>columns.some(col=>row.visits.has(col)))
  return <div className="timeline-view"><div className="view-heading"><div><h2>Instruction timeline</h2><p>每行為一次指令實例；重複出現的程式行仍有不同 ID。</p></div><span className="tag">SINGLE ISSUE</span></div>{!simulation?<div className="empty-state"><Waves size={32}/><strong>還沒有執行紀錄</strong><p>執行左側程式後，這裡會顯示逐 cycle 時序。</p></div>:<><div className="timeline-scroll"><table className="timeline-table"><thead><tr><th>INSTRUCTION / INSTANCE</th>{columns.map(col=><th key={col} className={col===index?'current':''}><button onClick={()=>onSelect(col)}>{col+1}</button></th>)}</tr></thead><tbody>{visible.map(row=><tr key={row.slot.id}><th><small>#{row.slot.id} · L{row.slot.instruction.line}</small><code>{row.slot.instruction.text}</code></th>{columns.map(col=>{const visit=row.visits.get(col);return <td key={col} className={col===index?'current':''}>{visit&&<button title={visit.state==='flushed'?'此指令被清除':visit.state==='stalled'?'保持此階段，等待資料':`Cycle ${col+1}`} onClick={()=>onSelect(col)} className={`pipeline-cell ${visit.stage.toLowerCase()} ${visit.state}`}>{visit.stage}{visit.state==='stalled'?' ·':''}{visit.state==='flushed'?' ×':''}</button>}</td>})}</tr>)}</tbody></table></div><div className="timeline-legend"><span><i className="status-dot"/> 一般推進</span><span className="amber-text">· stall，保持階段</span><span className="red-text">× flush，取消指令</span><span>顯示目前 cycle 附近的 18 欄，可用下方時間軸定位。</span></div></>}</div>
}
