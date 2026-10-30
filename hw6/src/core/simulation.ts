import { requestReception, type ChatMessage, type OllamaSettings } from './ai';
import { astar } from './navigation';
import { EPS, RADIUS, SENSOR_RANGE, bodyClear, cellFor, distance, pointSegmentDistance, segmentClear, towards, trailLength } from './motion';
import { FREE, OCCUPIED, RESERVED, Restaurant, Robot, createGroup, fromKey, key, ready, requirementsSummary, same,
  type Cell, type CustomerGroup, type Pedestrian, type Position } from './restaurant';
import { Candidate, capacityProblem, noSeatReason, rankTables, revalidatePlan } from './seating';

export const IDLE = '入口待命', RECEPTION = '接待中', THINKING = 'AI 分析中', CONFIRMING = '等待座位確認';
export const ESCORTING = '帶位中', RETURNING = '返回中', BLOCKED = '受阻';
export type Phase = typeof IDLE | typeof RECEPTION | typeof THINKING | typeof CONFIRMING | typeof ESCORTING | typeof RETURNING | typeof BLOCKED;
export interface ConversationMessage { speaker: '接待' | '顧客' | '系統'; text: string }
export interface EventEntry { id: number; time: string; text: string }

// A single authoritative engine. React subscribes without owning simulation rules.
export class Simulation {
  readonly restaurant = new Restaurant();
  readonly robot = new Robot();
  group: CustomerGroup | null = null;
  waiting: CustomerGroup[] = [];
  phase: Phase = IDLE;
  paused = false;
  proposed: Candidate | null = null;
  alternatives: Candidate[] = [];
  alternativeAccepted = false;
  history: ChatMessage[] = [];
  messages: ConversationMessage[] = [];
  events: EventEntry[] = [];
  conversationVersion = 0;
  lastError = '';
  pendingText = '';
  speed = 1;
  customerSpeed = 1;
  timeScale = 1;
  simulatedTime = 0;
  pedestrians: Pedestrian[] = [];
  detectedPedestrians = new Set<number>();
  waitReason = '';
  private sequence = 0;
  private pedestrianSequence = 0;
  private eventSequence = 0;
  private waitingCustomer = false;
  private blockedSeconds = 0;
  private lastDetour = 0;
  private assistanceLogged = false;
  private replanPending = false;
  private avoidPeoplePending = false;
  private request: AbortController | null = null;
  private revision = 0;
  private listeners = new Set<() => void>();
  constructor() { this.newCustomer(); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.revision;
  private changed() { this.revision++; for (const listener of this.listeners) listener(); }
  get busy() { return this.request !== null; }
  get traveling() { return this.phase === ESCORTING || this.phase === RETURNING || this.phase === BLOCKED; }
  get canChat() { return this.group !== null && (this.phase === RECEPTION || this.phase === CONFIRMING) && !this.alternatives.length && !this.busy; }
  get canWait() { return this.canChat && this.group!.requirements.party_size !== null && !capacityProblem(this.restaurant, this.group!.requirements); }
  get canEnd() { return this.group !== null && (this.phase === RECEPTION || this.phase === CONFIRMING) && !this.busy; }
  get customerPosition(): Position | null { return this.group?.position ?? null; }
  log(text: string) {
    this.events.push({ id: ++this.eventSequence, time: new Date().toLocaleTimeString('zh-TW', { hour12: false }), text });
    this.events = this.events.slice(-150);
  }
  report(text: string) { this.log(text); this.changed(); }
  private say(text: string) {
    this.history.push({ role: 'assistant', content: text });
    this.messages.push({ speaker: '接待', text });
  }
  private clearOffer() { this.proposed = null; this.alternatives = []; this.alternativeAccepted = false; }
  private resetConversation() {
    this.history = []; this.messages = []; this.lastError = ''; this.pendingText = ''; this.conversationVersion++;
  }
  newCustomer() {
    if (this.phase !== IDLE || this.group || this.busy) return;
    if (this.evaluateWaiting()) { this.changed(); return; }
    if (this.restaurant.blockedCells.has(key(this.restaurant.customerStart))) {
      this.report('入口顧客位置被障礙物阻擋，請先移除障礙物。'); return;
    }
    this.group = createGroup(++this.sequence, this.customerSpeed);
    this.phase = RECEPTION; this.clearOffer(); this.resetConversation();
    this.say('歡迎光臨，請問幾位？');
    this.log(`第 ${this.sequence} 組顧客到店。`); this.changed();
  }
  async submit(text: string, settings: OllamaSettings): Promise<boolean> {
    text = text.trim();
    if (!this.canChat || !text || !this.group) return false;
    try {
      const url = new URL(settings.baseUrl.trim());
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !settings.model.trim()) throw new Error();
    } catch { this.report('請填寫有效的 Ollama http(s) 位址與模型名稱。'); return false; }
    if (!(this.lastError && text === this.pendingText)) {
      this.history.push({ role: 'user', content: text }); this.messages.push({ speaker: '顧客', text });
    }
    this.pendingText = text; this.lastError = ''; this.clearOffer(); this.phase = THINKING;
    const controller = new AbortController(); this.request = controller; this.changed();
    try {
      const result = await requestReception(settings, this.history, this.group.requirements, controller.signal);
      if (controller.signal.aborted || !this.group) return false;
      this.request = null;
      this.group.requirements = result.requirements;
      this.group.remainingPeople = result.requirements.party_size ?? 0;
      this.group.declinedPlans.clear(); this.phase = RECEPTION;
      if (ready(result.requirements)) this.offerSeat(); else this.say(result.reply);
      return true;
    } catch (error) {
      if (controller.signal.aborted) return false;
      this.phase = RECEPTION;
      this.lastError = error instanceof Error ? error.message : '接待失敗，請重試。';
      this.messages.push({ speaker: '系統', text: this.lastError }); this.log(this.lastError);
      return false;
    } finally {
      if (this.request === controller) this.request = null;
      this.changed();
    }
  }
  dispose() {
    if (!this.request) return;
    this.request.abort(); this.request = null;
    // A page restored from the browser's back/forward cache must remain usable.
    if (this.phase === THINKING) {
      this.phase = RECEPTION; this.lastError = '上一筆請求已取消，可重新送出需求。';
      this.changed();
    }
  }
  private offerSeat() {
    if (!this.group) return;
    this.clearOffer();
    const candidates = rankTables(this.restaurant, this.group.requirements, this.group.declinedPlans);
    const exact = candidates.find(c => !c.requiresConsent);
    if (exact) {
      this.proposed = exact; this.phase = CONFIRMING; this.say(exact.offer);
      this.log(`向第 ${this.group.number} 組提出 ${exact.key}，尚未保留。`);
    } else if (candidates.length) {
      this.phase = CONFIRMING; this.alternatives = candidates;
      this.say(`${candidates[0].differences.join('；')}。${candidates[0].offer}`);
    } else {
      this.phase = RECEPTION; this.say(noSeatReason(this.restaurant, this.group.requirements));
    }
  }
  chooseAlternative(planKey: string) {
    const previous = this.alternatives.find(c => c.key === planKey);
    if (!previous || !this.group) return;
    const fresh = revalidatePlan(this.restaurant, this.group.requirements, previous);
    this.clearOffer();
    if (!fresh) { this.log('剛才的替代餐桌已無法安排，重新尋找可用座位。'); this.offerSeat(); }
    else { this.proposed = fresh; this.alternativeAccepted = true; this.phase = CONFIRMING; this.say(fresh.offer); }
    this.changed();
  }
  confirm() {
    if (this.phase !== CONFIRMING || !this.group || !this.proposed || this.busy) return;
    const fresh = revalidatePlan(this.restaurant, this.group.requirements, this.proposed);
    if (!fresh || (fresh.requiresConsent && !this.alternativeAccepted)) {
      this.log('餐桌或路線條件已變更，需要重新確認安排。'); this.offerSeat(); this.changed(); return;
    }
    // Check the entire plan above before reserving any of its tables.
    for (const allocation of fresh.allocations) this.restaurant.table(allocation.tableName).status = RESERVED;
    this.group.allocations = fresh.allocations; this.group.nextStop = 0;
    this.group.remainingPeople = fresh.allocations.reduce((s, a) => s + a.people, 0);
    this.group.status = ESCORTING; this.group.trail = [this.robot.visualPosition];
    this.waitingCustomer = false; this.setWaitReason('');
    this.robot.goal = this.restaurant.table(fresh.allocations[0].tableName).goal;
    this.robot.task = ESCORTING; this.phase = ESCORTING; this.clearOffer();
    this.say('已確認，請跟隨機器人前往座位。');
    this.log(`第 ${this.group.number} 組確認 ${fresh.key}，全部餐桌保留，開始逐桌帶位。`);
    this.planRoute(); this.changed();
  }
  waitCurrent() {
    if (!this.group || (this.phase !== RECEPTION && this.phase !== CONFIRMING) || this.busy) return;
    if (this.group.requirements.party_size === null) { this.say('請先確認用餐人數，再加入等待隊伍。'); this.changed(); return; }
    const permanent = capacityProblem(this.restaurant, this.group.requirements);
    if (permanent) { this.say(permanent); this.changed(); return; }
    const group = this.group;
    for (const candidate of this.alternatives) group.declinedPlans.add(candidate.key);
    if (this.proposed) group.declinedPlans.add(this.proposed.key);
    group.status = '等待中'; group.position = null;
    group.waitingReason = ready(group.requirements) ? '等候符合原需求的座位' : '需求仍待確認；可選取等待顧客補充需求';
    this.waiting.push(group); this.waiting.sort((a, b) => a.number - b.number);
    this.log(`第 ${group.number} 組加入等待隊伍：${requirementsSummary(group.requirements)}。`);
    this.group = null; this.phase = IDLE; this.clearOffer(); this.resetConversation();
    this.evaluateWaiting(group.number); this.changed();
  }
  endCurrent() {
    if (!this.canEnd || !this.group) return;
    this.log(`第 ${this.group.number} 組結束接待並離開，未保留任何桌位。`);
    this.group = null; this.phase = IDLE; this.clearOffer(); this.resetConversation(); this.evaluateWaiting(); this.changed();
  }
  resumeWaiting(number: number) {
    if (this.phase !== IDLE || this.group) return;
    const group = this.waiting.find(g => g.number === number);
    if (!group || this.restaurant.blockedCells.has(key(this.restaurant.customerStart))) return;
    group.declinedPlans.clear(); this.activateWaiting(group);
    if (ready(group.requirements)) this.offerSeat(); else this.say(group.requirements.question || '請補充您的用餐需求。');
    this.changed();
  }
  private activateWaiting(group: CustomerGroup) {
    this.waiting = this.waiting.filter(g => g !== group); this.group = group;
    group.position = this.restaurant.customerStart; group.status = RECEPTION; group.speed = this.customerSpeed;
    this.phase = RECEPTION; this.clearOffer(); this.resetConversation();
  }
  private evaluateWaiting(exclude?: number): boolean {
    if (this.phase !== IDLE || this.group || this.restaurant.blockedCells.has(key(this.restaurant.customerStart))) return false;
    for (const group of this.waiting) {
      if (group.number !== exclude && rankTables(this.restaurant, group.requirements, group.declinedPlans).length) {
        this.activateWaiting(group); this.offerSeat(); return true;
      }
    }
    return false;
  }
  toggleObstacle(cell: Cell) {
    const map = this.restaurant, id = key(cell);
    if (!map.contains(cell) || map.tableCells.has(id)) return;
    const positions = this.actorPositions();
    const protectedCells = new Set([key(this.robot.position)]);
    if (this.robot.progress > 0 && this.robot.route.length) protectedCells.add(key(this.robot.route[0]));
    if (this.group?.position && this.group.trail.length && this.robot.task === ESCORTING) {
      protectedCells.add(key(cellFor(this.group.position)));
      protectedCells.add(key(cellFor(this.group.trail[0])));
    }
    if (protectedCells.has(id) || positions.some(p => !bodyClear(p, map, new Set([id])))) {
      this.log('不可在角色目前占用的位置或移動區段放置障礙物。');
    } else {
      const removing = map.obstacles.has(id);
      if (removing) map.obstacles.delete(id); else map.obstacles.add(id);
      this.log(`${removing ? '移除' : '新增'}障礙物 (${id})。`); this.mapChanged();
    }
    this.changed();
  }
  private mapChanged() {
    const sensedChange = this.sense();
    if (this.traveling && sensedChange) this.planRoute();
    else if (this.phase === IDLE) this.evaluateWaiting();
    else if (this.phase === CONFIRMING && this.proposed && this.group) {
      const fresh = revalidatePlan(this.restaurant, this.group.requirements, this.proposed);
      if (fresh) this.proposed = fresh;
      else { this.log('原建議餐桌的路線已無法通行，重新尋找座位，仍需顧客確認。'); this.offerSeat(); }
    } else if (this.phase === RECEPTION && this.group && ready(this.group.requirements) && !this.lastError) this.offerSeat();
  }
  releaseTable(name: string) {
    const table = this.restaurant.table(name);
    if (table.status === RESERVED) this.log(`${name} 正在帶位保留中，無法釋放。`);
    else if (table.status === OCCUPIED) { table.status = FREE; this.log(`${name} 已釋放為空閒。`); this.mapChanged(); }
    this.changed();
  }
  setPaused(paused: boolean) { this.paused = paused; this.changed(); }
  setSpeed(value: number) { this.speed = Math.max(0.5, Math.min(1.5, value)); this.changed(); }
  setCustomerSpeed(value: number) {
    this.customerSpeed = Math.max(0.5, Math.min(1.5, value));
    if (this.group) this.group.speed = this.customerSpeed;
    this.changed();
  }
  setTimeScale(scale: number) { if ([1, 2, 4].includes(scale)) { this.timeScale = scale; this.changed(); } }
  setCustomerStopped(stopped: boolean) {
    if (this.group && this.robot.task === ESCORTING) { this.group.stopped = stopped; this.changed(); }
  }
  private actorPositions(): Position[] {
    return [this.robot.visualPosition, ...this.pedestrians.map(p => p.position), ...(this.customerPosition ? [this.customerPosition] : [])];
  }
  private planRoute(avoidPeople = false) {
    if (!this.robot.goal) return;
    if (this.robot.progress > 0) {
      if (avoidPeople) {
        const start = this.robot.position, nextCell = this.robot.route[0], position = this.robot.visualPosition;
        const others = this.pedestrians.filter(p => this.detectedPedestrians.has(p.number)).map(p => p.position);
        if (this.customerPosition) others.push(this.customerPosition);
        if (segmentClear(position, start, this.restaurant, others)) {
          const blocked = this.restaurant.knownBlockedCells;
          this.blockNearPeople(blocked, others); blocked.delete(key(start));
          const route = astar(this.restaurant, start, this.robot.goal, blocked);
          if (route) {
            this.robot.position = nextCell; this.robot.progress = 1 - this.robot.progress;
            this.robot.route = [start, ...route.slice(1)]; this.replanPending = false; this.avoidPeoplePending = false;
            this.log('前方持續受阻，安全退回路點後繞行。'); return;
          }
        }
      }
      this.replanPending = true; this.avoidPeoplePending ||= avoidPeople; return;
    }
    avoidPeople ||= this.avoidPeoplePending; this.avoidPeoplePending = false; this.replanPending = false;
    const blocked = this.restaurant.knownBlockedCells;
    if (avoidPeople) {
      this.blockNearPeople(blocked, this.pedestrians.filter(p => this.detectedPedestrians.has(p.number)).map(p => p.position));
      if (this.customerPosition) blocked.add(key(cellFor(this.customerPosition)));
    }
    blocked.delete(key(this.robot.position));
    const route = astar(this.restaurant, this.robot.position, this.robot.goal, blocked);
    if (!route) {
      this.robot.route = [];
      if (this.phase !== BLOCKED) this.log('路線完全受阻，停下並保留任務，等待障礙物變更。');
      this.phase = BLOCKED;
    } else {
      this.robot.route = route.slice(1); this.phase = this.robot.task || IDLE;
      this.log(`${this.robot.task}路線已規劃，剩餘 ${this.robot.route.length} 格。`);
    }
  }
  private blockNearPeople(blocked: Set<string>, people: Position[]) {
    for (let x = 0; x < this.restaurant.width; x++) for (let y = 0; y < this.restaurant.height; y++) {
      if (people.some(p => distance([x, y], p) < 1.1)) blocked.add(key([x, y]));
    }
  }
  private setWaitReason(reason: string) {
    if (reason !== this.waitReason) { this.waitReason = reason; if (reason) this.log(reason); }
  }
  private sense(): boolean {
    const map = this.restaurant, position = this.robot.visualPosition;
    const previous = new Set(map.knownObstacles);
    for (const id of new Set([...map.obstacles, ...map.knownObstacles])) {
      if (distance(position, fromKey(id)) <= SENSOR_RANGE) {
        if (map.obstacles.has(id)) map.knownObstacles.add(id); else map.knownObstacles.delete(id);
      }
    }
    this.detectedPedestrians = new Set(this.pedestrians.filter(p => distance(position, p.position) <= SENSOR_RANGE).map(p => p.number));
    return previous.size !== map.knownObstacles.size || [...previous].some(id => !map.knownObstacles.has(id));
  }
  addPedestrian(start: Cell, goal: Cell): boolean {
    if (same(start, goal) || !bodyClear(start, this.restaurant) || !bodyClear(goal, this.restaurant)) {
      this.report('行人起終點須為不同的可通行位置。'); return false;
    }
    if (this.actorPositions().some(p => distance(start, p) < 2 * RADIUS + 0.1)) { this.report('行人起點距離現有角色太近。'); return false; }
    const route = astar(this.restaurant, start, goal);
    if (!route) { this.report('行人起終點之間沒有可通行路線。'); return false; }
    this.pedestrians.push({ number: ++this.pedestrianSequence, position: start, route: route.slice(1), speed: 1 });
    this.sense(); this.report(`新增行人 P${this.pedestrianSequence}：(${key(start)}) → (${key(goal)})。`); return true;
  }
  clearPedestrians() {
    this.pedestrians = []; this.sense(); if (this.traveling) this.planRoute(); this.changed();
  }
  private movePedestrians(dt: number) {
    for (const person of [...this.pedestrians]) {
      if (!person.route.length) { this.pedestrians = this.pedestrians.filter(p => p !== person); continue; }
      const end = towards(person.position, person.route[0], person.speed * dt);
      const others = [this.robot.visualPosition, ...this.pedestrians.filter(p => p !== person).map(p => p.position)];
      if (this.customerPosition) others.push(this.customerPosition);
      if (segmentClear(person.position, end, this.restaurant, others)) {
        person.position = end;
        if (distance(end, person.route[0]) < EPS) {
          person.route.shift(); if (!person.route.length) this.pedestrians = this.pedestrians.filter(p => p !== person);
        }
      }
    }
  }
  private moveCustomer(dt: number) {
    const group = this.group;
    if (!group?.position || group.stopped || this.robot.task !== ESCORTING) return;
    const atTable = !this.robot.route.length && same(this.robot.position, this.robot.goal);
    let amount = Math.min(group.speed * dt, Math.max(0, trailLength(group.position, group.trail) - (atTable ? 2 * RADIUS : 1)));
    while (group.trail.length && amount > EPS) {
      const target = group.trail[0], step = Math.min(amount, distance(group.position, target));
      const end = towards(group.position, target, step);
      if (!segmentClear(group.position, end, this.restaurant, [this.robot.visualPosition, ...this.pedestrians.map(p => p.position)])) break;
      group.position = end; amount -= step;
      if (distance(end, target) < EPS) group.trail.shift();
    }
  }
  private frontPersonGap(): number | null {
    if (!this.robot.route.length) return null;
    const start = this.robot.visualPosition, points: Position[] = [start]; let length = 0;
    for (const cell of this.robot.route) { length += distance(points[points.length - 1], cell); points.push(cell); if (length >= 2.5) break; }
    const gaps: number[] = [];
    for (const person of this.pedestrians) {
      if (!this.detectedPedestrians.has(person.number)) continue;
      const dx = points[1][0] - start[0], dy = points[1][1] - start[1];
      if ((person.position[0] - start[0]) * dx + (person.position[1] - start[1]) * dy < -EPS) continue;
      if (points.slice(1).some((b, i) => pointSegmentDistance(person.position, points[i], b) < 2 * RADIUS + 0.25)) gaps.push(distance(start, person.position) - 2 * RADIUS);
    }
    return gaps.length ? Math.min(...gaps) : null;
  }
  private blockedFor(dt: number, reason: string) {
    this.blockedSeconds += dt;
    this.setWaitReason(this.assistanceLogged ? '持續受阻，需要人工協助；保留原任務與桌位。' : reason);
    if (this.blockedSeconds >= 3 && this.blockedSeconds - this.lastDetour >= 3) { this.lastDetour = this.blockedSeconds; this.planRoute(true); }
    if (this.blockedSeconds >= 10 && !this.assistanceLogged) {
      this.assistanceLogged = true; this.setWaitReason('持續受阻，需要人工協助；保留原任務與桌位。');
    }
  }
  private advance(dt: number) {
    this.simulatedTime += dt; this.movePedestrians(dt);
    if (this.sense() && this.traveling) this.planRoute();
    if (!this.traveling) return;
    this.moveCustomer(dt);
    const group = this.group; let reason = '';
    if (this.robot.task === ESCORTING && group?.position) {
      const gap = trailLength(group.position, group.trail);
      if (group.stopped) reason = '顧客停留，等待顧客。';
      else if (gap > 2.5) this.waitingCustomer = true;
      else if (gap <= 1.5) this.waitingCustomer = false;
      if (this.waitingCustomer) reason = '顧客落後，等待跟上。';
    }
    if (reason) { this.setWaitReason(reason); return; }
    if (this.phase === BLOCKED) { this.blockedFor(dt, '路線受阻，等待通行。'); return; }
    if (!this.robot.route.length) {
      if (same(this.robot.position, this.robot.goal)) {
        if (this.robot.task === ESCORTING && group?.position && trailLength(group.position, group.trail) > 2 * RADIUS + EPS) this.setWaitReason('已抵達桌旁，等待顧客到達。');
        else { this.setWaitReason(''); this.arrived(); }
      }
      return;
    }
    const gap = this.frontPersonGap();
    if (gap !== null && gap < 0.5) { this.blockedFor(dt, '前方行人接近，停止等待通行。'); return; }
    const speed = this.speed * (gap !== null && gap < 1.5 ? 0.4 : 1);
    const target = this.robot.route[0], before = this.robot.visualPosition, end = towards(before, target, speed * dt);
    const others = this.pedestrians.map(p => p.position); if (this.customerPosition) others.push(this.customerPosition);
    if (!segmentClear(before, end, this.restaurant, others)) { this.blockedFor(dt, '前方無安全間距，等待通行。'); return; }
    this.blockedSeconds = this.lastDetour = 0; this.assistanceLogged = false;
    this.setWaitReason(speed < this.speed ? '前方行人接近，減速通行。' : '');
    this.robot.progress += distance(before, end);
    if (this.robot.task === ESCORTING && group) group.trail.push(end);
    if (distance(end, target) < EPS) {
      this.robot.position = this.robot.route.shift()!; this.robot.progress = 0;
      if (this.replanPending) this.planRoute();
    }
  }
  step(realSeconds: number) {
    if (!Number.isFinite(realSeconds) || realSeconds < 0) throw new Error('經過時間須為非負有限數值');
    if (this.paused) return;
    let remaining = realSeconds * this.timeScale;
    while (remaining > EPS) { const dt = Math.min(remaining, 0.02); this.advance(dt); remaining -= dt; }
    this.changed();
  }
  private arrived() {
    if (this.robot.task === ESCORTING && this.group) {
      const group = this.group, allocation = group.allocations[group.nextStop];
      this.restaurant.table(allocation.tableName).status = OCCUPIED;
      group.remainingPeople -= allocation.people; group.nextStop++;
      this.log(`第 ${group.number} 組在 ${allocation.tableName} 入座 ${allocation.people} 位，尚有 ${group.remainingPeople} 位未入座。`);
      if (group.nextStop < group.allocations.length) {
        const next = group.allocations[group.nextStop]; this.robot.goal = this.restaurant.table(next.tableName).goal;
        this.say(`接著前往 ${next.tableName} 桌。`); this.planRoute();
      } else {
        group.position = null; group.status = '已入座'; this.say('已全部入座，祝用餐愉快！');
        this.log(`第 ${group.number} 組全部入座；機器人返回入口。`);
        this.robot.task = RETURNING; this.robot.goal = this.restaurant.robotStart; this.phase = RETURNING; this.planRoute();
      }
    } else if (this.robot.task === RETURNING) {
      this.blockedSeconds = this.lastDetour = 0; this.assistanceLogged = false; this.setWaitReason('');
      this.robot.task = ''; this.robot.goal = null; this.robot.route = []; this.group = null; this.phase = IDLE;
      this.clearOffer(); this.resetConversation(); this.log('機器人已回到入口，可接待下一組。'); this.evaluateWaiting();
    }
  }
}
