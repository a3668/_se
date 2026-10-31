import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Activity, ArrowRight, ArrowUpRight, Bot, Check, ChevronRight, CircleHelp, Clock3, DoorOpen, Footprints, ListOrdered,
  MessageSquare, Pause, Play, Plus, RotateCcw, Send, Settings2, SlidersHorizontal, Sparkles, Users, Utensils, X } from 'lucide-react';
import { RestaurantMap } from './components/RestaurantMap';
import { OCCUPIED, RESERVED, requirementsSummary, type Allocation, type Cell } from './core/restaurant';
import { CONFIRMING, ESCORTING, IDLE, THINKING, type Simulation } from './core/simulation';
import { useSimulation } from './useSimulation';
import { useOllamaModels, type OllamaModelCatalog } from './useOllamaModels';

function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <div className="empty-state">{icon}<p>{children}</p></div>;
}
function Allocations({ items }: { items: Allocation[] }) {
  return <div className="allocations">{items.map(item => <div className="allocation" key={item.tableName}>
    <span className="table-tag">{item.tableName}</span><span><strong>{item.people}</strong> 人 <small>／ {item.capacity} 人桌</small></span>
  </div>)}</div>;
}

function Reception({ s, catalog }: { s: Simulation; catalog: OllamaModelCatalog }) {
  const { settings } = catalog;
  const [text, setText] = useState('');
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [s.messages.length, s.busy]);
  async function submit(value: string) {
    if (!catalog.canSubmit || !s.canChat) return;
    const succeeded = await s.submit(value, settings);
    if (succeeded) setText(current => current.trim() === value.trim() ? '' : current);
    else if (s.lastErrorCode === 'MODEL_NOT_AVAILABLE') catalog.invalidateSelection(settings.model);
  }
  function send(event: FormEvent) { event.preventDefault(); void submit(text); }
  const activeAllocations = s.proposed?.allocations ?? s.group?.allocations ?? [];
  return <section className="panel reception-panel" aria-labelledby="reception-title">
    <div className="panel-heading"><div className="heading-with-icon"><span className="section-icon"><MessageSquare size={17} /></span>
      <div><h2 id="reception-title">接待工作台</h2><p>理解需求，安排每一席</p></div></div>
      <span className="soft-badge">{s.group ? `第 ${String(s.group.number).padStart(2, '0')} 組` : '入口待命'}</span>
    </div>
    <div className="group-summary"><Users size={16} /><span>{s.group ? requirementsSummary(s.group.requirements) : '準備好接待下一組顧客'}
      {s.group?.allocations.length ? <small>尚未入座 {s.group.remainingPeople} 位</small> : null}</span></div>
    <div ref={log} className="conversation" role="log" aria-label="接待對話" aria-relevant="additions" aria-busy={s.busy}>
      {!s.messages.length && <EmptyState icon={<Bot size={26} />}>機器人在入口待命<br />可接待下一組或候位顧客</EmptyState>}
      {s.messages.map((message, i) => <div key={`${s.conversationVersion}-${i}`} className={`message ${message.speaker === '顧客' ? 'from-customer' : message.speaker === '系統' ? 'from-system' : 'from-robot'}`}>
        <span className="message-avatar">{message.speaker === '顧客' ? <Users size={14} /> : message.speaker === '系統' ? <CircleHelp size={14} /> : <Bot size={14} />}</span>
        <div><span className="message-speaker">{message.speaker}</span><p>{message.text}</p></div>
      </div>)}
      {s.busy && <div className="thinking" role="status"><Sparkles size={14} /><span>正在理解顧客需求</span><i /><i /><i /></div>}
    </div>
    <form className="reception-form" onSubmit={send}>
      <label className="sr-only" htmlFor="customer-request">顧客需求</label>
      <div className="input-with-button"><input id="customer-request" value={text} onChange={e => setText(e.target.value)} disabled={!s.canChat}
        placeholder={s.traveling ? '帶位完成後可接待下一組' : s.phase === IDLE ? '請先接待下一組顧客' : '例如：我們五位，希望靠窗'} autoComplete="off" />
        <button className="send-button" disabled={!s.canChat || !catalog.canSubmit || !text.trim()} type="submit" aria-label="送出需求" title="送出需求"><Send size={17} /></button></div>
      {!catalog.canSubmit && <p className={`model-required ${catalog.status === 'error' ? 'error' : ''}`} role="status">
        {catalog.status === 'loading' ? '正在載入模型…' : '請至「模型」選擇模型後送出。'}
      </p>}
      <div className="form-actions"><span>Enter 送出需求</span><div>
        {s.lastError && <button type="button" className="text-button" disabled={!s.canChat || !catalog.canSubmit} onClick={() => { setText(s.pendingText); void submit(s.pendingText); }}><RotateCcw size={13} />重試</button>}
        <button type="button" className="text-button" disabled={s.phase !== IDLE || s.busy} onClick={() => s.newCustomer()}><Plus size={14} />下一組顧客</button>
      </div></div>
    </form>
    <div className="seating-area">
      <div className="subsection-heading"><h3><Utensils size={15} />座位安排</h3><span>{s.proposed ? '待顧客確認' : s.group?.allocations.length ? '帶位進度' : '尚無方案'}</span></div>
      {activeAllocations.length ? <>
        <Allocations items={activeAllocations} />
        {s.proposed?.differences.length ? <p className="inline-warning">{s.proposed.differences.join('；')}</p> : null}
        {s.group?.allocations.length ? <div className="stop-progress">{s.group.allocations.map((a, i) => <span className={i < s.group!.nextStop ? 'completed' : ''} key={a.tableName}>
          {i < s.group!.nextStop ? <Check size={12} /> : <span className="stop-dot" />}{a.tableName}{i < s.group!.allocations.length - 1 && <ChevronRight size={12} />}
        </span>)}</div> : null}
      </> : <p className="seat-placeholder">{s.phase === THINKING ? '需求分析完成後，將在此提出座位方案。' : '確認用餐需求後，為顧客安排合適座位。'}</p>}
      <button className="button primary confirm-button" disabled={s.phase !== CONFIRMING || !s.proposed || s.busy} onClick={() => s.confirm()}><Footprints size={16} />確認座位並帶位<ArrowRight size={16} /></button>
      <div className="secondary-actions"><button className="button subtle" disabled={!s.canWait} onClick={() => s.waitCurrent()}><Clock3 size={14} />繼續等待</button>
        <button className="button quiet" disabled={!s.canEnd} onClick={() => s.endCurrent()}><DoorOpen size={14} />結束本組</button></div>
    </div>
  </section>;
}

type Tab = 'controls' | 'queue' | 'events' | 'settings';
const tabs = [{ id: 'controls', label: '模擬控制', icon: SlidersHorizontal }, { id: 'queue', label: '候位名單', icon: ListOrdered },
  { id: 'events', label: '事件紀錄', icon: Activity }, { id: 'settings', label: '模型', icon: Settings2 }] as const;

function ControlPanels({ s, catalog }: { s: Simulation; catalog: OllamaModelCatalog }) {
  const { settings } = catalog;
  const [tab, setTab] = useState<Tab>('controls');
  const [start, setStart] = useState('4, 8'), [goal, setGoal] = useState('6, 8');
  const [release, setRelease] = useState('');
  const occupied = s.restaurant.tables.filter(t => t.status === OCCUPIED);
  const effectiveRelease = occupied.some(t => t.name === release) ? release : occupied[0]?.name ?? '';
  function addPerson(event: FormEvent) {
    event.preventDefault();
    const parse = (value: string): Cell | null => {
      const match = /^\s*(-?\d+)\s*[,，]\s*(-?\d+)\s*$/.exec(value);
      if (!match) return null;
      const cell: Cell = [Number(match[1]), Number(match[2])];
      return cell.every(Number.isSafeInteger) ? cell : null;
    };
    const a = parse(start), b = parse(goal);
    if (!a || !b) s.report('行人座標請使用整數 x,y 格式，例如 4,8。'); else s.addPedestrian(a, b);
  }
  return <section className="panel utility-panel" aria-label="管理與模擬設定">
    <div className="utility-tabs" role="tablist" aria-label="管理面板">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`content-${id}`}
      tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={event => {
        const index = tabs.findIndex(t => t.id === id);
        const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
        if (next !== null) { event.preventDefault(); setTab(tabs[next].id); document.getElementById(`tab-${tabs[next].id}`)?.focus(); }
      }}><Icon size={15} />{label}{id === 'queue' && s.waiting.length > 0 && <b>{s.waiting.length}</b>}</button>)}</div>
    <div className="utility-content" role="tabpanel" id={`content-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>
      {tab === 'controls' && <>
        <div className="playback-row"><button className={`button ${s.paused ? 'primary' : 'subtle'}`} onClick={() => s.setPaused(!s.paused)}>{s.paused ? <Play size={15} /> : <Pause size={15} />}{s.paused ? '繼續模擬' : '暫停模擬'}</button>
          <div className="segmented" aria-label="模擬倍速">{[1, 2, 4].map(scale => <button key={scale} aria-pressed={s.timeScale === scale} onClick={() => s.setTimeScale(scale)}>{scale}×</button>)}</div>
          <span className="simulation-clock"><Clock3 size={13} />{Math.floor(s.simulatedTime / 60).toString().padStart(2, '0')}:{Math.floor(s.simulatedTime % 60).toString().padStart(2, '0')}</span>
        </div>
        <div className="speed-controls"><label><span><Bot size={14} />機器人 <b>{s.speed.toFixed(1)} <small>m/s</small></b></span><input aria-label="機器人速度" type="range" min="0.5" max="1.5" step="0.1" value={s.speed} onChange={e => s.setSpeed(Number(e.target.value))} /></label>
          <label><span><Users size={14} />顧客 <b>{s.customerSpeed.toFixed(1)} <small>m/s</small></b></span><input aria-label="顧客速度" type="range" min="0.5" max="1.5" step="0.1" value={s.customerSpeed} onChange={e => s.setCustomerSpeed(Number(e.target.value))} /></label></div>
        <div className="following-row"><span className="muted">{s.waitReason || '依目前感測資訊行動'}</span><button className="text-button" disabled={s.robot.task !== ESCORTING || !s.customerPosition} onClick={() => s.setCustomerStopped(!s.group?.stopped)}>{s.group?.stopped ? <Play size={13} /> : <Pause size={13} />}{s.group?.stopped ? '恢復跟隨' : '顧客停留'}</button></div>
        <form className="pedestrian-form" onSubmit={addPerson}><h3><Footprints size={14} />行人情境</h3><div className="pedestrian-fields"><input aria-label="行人起點 x,y" value={start} onChange={e => setStart(e.target.value)} placeholder="起點 x,y" /><ArrowRight size={14} /><input aria-label="行人終點 x,y" value={goal} onChange={e => setGoal(e.target.value)} placeholder="終點 x,y" />
          <button className="button subtle small" type="submit"><Plus size={13} />新增</button><button className="text-button" type="button" disabled={!s.pedestrians.length} onClick={() => s.clearPedestrians()}>清除</button></div></form>
        <div className="release-row"><label htmlFor="release-table">釋放餐桌</label><select id="release-table" value={effectiveRelease} onChange={e => setRelease(e.target.value)} disabled={!occupied.length}>
          {!occupied.length && <option value="">尚無占用餐桌</option>}{occupied.map(t => <option key={t.name} value={t.name}>{t.name} · {t.capacity} 人桌</option>)}</select><button className="button subtle small" disabled={!effectiveRelease} onClick={() => s.releaseTable(effectiveRelease)}>釋放</button></div>
      </>}
      {tab === 'queue' && <div className="queue-list">{!s.waiting.length ? <EmptyState icon={<Users size={27} />}>目前沒有候位顧客<br />選擇繼續等待的顧客會保留在這裡</EmptyState> : <><p className="panel-note">依到店順序，優先接待能安排整組的顧客。</p>{s.waiting.map(group => <div className="queue-item" key={group.number}><div className="queue-number">{String(group.number).padStart(2, '0')}</div><div><strong>第 {group.number} 組 · {group.requirements.party_size ?? '?'} 位</strong><p>{requirementsSummary(group.requirements)}</p><small>{group.waitingReason}</small></div><button className="button subtle small" disabled={s.phase !== IDLE} onClick={() => s.resumeWaiting(group.number)}>接待／修改<ArrowUpRight size={13} /></button></div>)}</>}</div>}
      {tab === 'events' && <div className="event-list" aria-label="事件紀錄">{!s.events.length ? <EmptyState icon={<Activity size={25} />}>尚無事件紀錄</EmptyState> : [...s.events].reverse().map(event => <div className="event-row" key={event.id}><time>{event.time}</time><span>{event.text}</span></div>)}</div>}
      {tab === 'settings' && <div className="settings-form">
        <label htmlFor="ollama-model">模型</label><div className="model-select-row">
          <select id="ollama-model" value={settings.model} disabled={s.busy} onPointerDown={() => { void catalog.reload(); }} onKeyDown={event => {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) void catalog.reload();
          }} onChange={e => catalog.selectModel(e.target.value)} aria-describedby="ollama-model-status">
            <option value="" disabled>{catalog.status === 'loading' ? '載入中…' : catalog.status === 'error' ? '清單載入失敗' : !catalog.models.length ? '無可用模型' : '請選擇模型'}</option>
            {catalog.models.map(model => <option key={model} value={model}>{model}</option>)}
          </select>
        </div><p id="ollama-model-status" className={`model-status ${catalog.status === 'error' || (catalog.status === 'ready' && !catalog.models.length) ? 'error' : ''}`} role="status">{catalog.statusMessage}</p>
      </div>}
    </div>
  </section>;
}

function Alternatives({ s }: { s: Simulation }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    container.current?.querySelector<HTMLButtonElement>('button')?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); s.waitCurrent(); }
      if (event.key === 'Tab') {
        const buttons = container.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); if (previous instanceof HTMLElement) previous.focus(); };
  }, [s]);
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) s.waitCurrent(); }}><div className="alternatives-dialog" ref={container} role="dialog" aria-modal="true" aria-labelledby="alternatives-title" aria-describedby="alternatives-description">
    <div className="panel-heading"><div><div className="eyebrow">SEATING OPTIONS</div><h2 id="alternatives-title">一起看看其他安排</h2></div><button className="icon-button" aria-label="關閉並繼續等待" onClick={() => s.waitCurrent()}><X size={19} /></button></div>
    <p id="alternatives-description" className="alternatives-description">目前需要調整座位偏好或安排分散桌位。選擇方案後，仍會回到工作台讓您確認帶位。</p>
    <div className="alternative-list">{s.alternatives.map((candidate, i) => <div className="alternative-option" key={candidate.key}>
      <div className="alternative-heading"><strong>方案 {String(i + 1).padStart(2, '0')}</strong><span>{candidate.scattered ? '分散桌位' : '同列連續桌位'}</span></div><Allocations items={candidate.allocations} />
      <p>{candidate.differences.join('；')}</p><button className="button primary" onClick={() => s.chooseAlternative(candidate.key)}>選擇此方案<ArrowRight size={14} /></button>
    </div>)}</div><button className="button subtle wait-alternative" onClick={() => s.waitCurrent()}><Clock3 size={15} />繼續等待，接待其他顧客</button>
  </div></div>;
}

export default function App() {
  const s = useSimulation();
  const [editing, setEditing] = useState(false);
  const catalog = useOllamaModels(s.busy);
  const free = s.restaurant.tables.filter(t => t.status === '空閒');
  const reserved = s.restaurant.tables.filter(t => t.status === RESERVED).length;
  const occupied = s.restaurant.tables.filter(t => t.status === OCCUPIED).length;
  return <div className="app-shell">
    <header className="app-header"><div className="brand"><span className="brand-mark"><Bot size={26} strokeWidth={1.7} /></span><div><div className="brand-title">AI 智慧餐廳帶位機器人</div><p>RESTAURANT ROBOT · SIMULATION LAB</p></div></div>
      <div className="header-right"><span className="project-label">HW / 06</span><span className={`status-badge ${s.phase === THINKING ? 'is-thinking' : s.phase === '受阻' ? 'is-blocked' : ''}`} role="status"><span className="live-dot" />{s.phase}{s.paused && ' · 已暫停'}</span></div></header>
    <main><section className="overview-bar" aria-label="餐廳概況"><div className="overview-intro"><span className="eyebrow">FLOOR OVERVIEW</span><h1>讓每一位顧客，都有好位置。</h1></div>
      <div className="overview-stats"><div><span className="stat-label"><Utensils size={14} />空閒餐桌</span><strong>{free.length}<small> / 21</small></strong></div><div><span className="stat-label">保留／占用</span><strong>{reserved}<small> / </small>{occupied}</strong></div><div><span className="stat-label"><Users size={14} />候位組數</span><strong>{s.waiting.length}<small> 組</small></strong></div><div><span className="stat-label">可用席位</span><strong>{free.reduce((sum, t) => sum + t.capacity, 0)}<small> / 98</small></strong></div></div></section>
      <div className="workspace"><RestaurantMap simulation={s} editing={editing} setEditing={setEditing} /><div className="right-column"><Reception key={s.conversationVersion} s={s} catalog={catalog} /><ControlPanels s={s} catalog={catalog} /></div></div>
    </main><footer className="app-footer"><span><span className="live-dot" />AI 接待 × 自主導航 × 智慧分桌</span><span>18 × 34 m · 21 桌 · 98 席<span className="footer-divider">/</span>本機模擬</span></footer>
    {s.waitReason && <div className={`motion-notice ${s.waitReason.includes('人工協助') ? 'needs-help' : ''}`} role="status"><CircleHelp size={16} />{s.waitReason}</div>}
    {s.alternatives.length > 0 && <Alternatives s={s} />}
  </div>;
}
