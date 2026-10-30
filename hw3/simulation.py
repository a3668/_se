"""Single-robot, single-reception state machine. All mutations happen here."""

from __future__ import annotations

from datetime import datetime
from time import monotonic
from urllib.parse import urlparse

from PySide6.QtCore import QObject, QTimer, Qt, Signal, Slot

from ai import OllamaClient, ReceptionResult
from navigation import astar
from motion import (EPS, RADIUS, SENSOR_RANGE, body_clear, cell_for, distance,
                    point_segment_distance, segment_clear, towards, trail_length)
from restaurant import (
    FREE, OCCUPIED, RESERVED, Cell, CustomerGroup, Pedestrian, Position, Robot, create_restaurant,
)
from seating import Candidate, capacity_problem, no_seat_reason, rank_tables, revalidate_plan

IDLE, RECEPTION, THINKING, CONFIRMING = "入口待命", "接待中", "AI 分析中", "等待座位確認"
ESCORTING, RETURNING, BLOCKED = "帶位中", "返回中", "受阻"


class Simulation(QObject):
    changed = Signal()
    message = Signal(str, str)
    conversation_reset = Signal()
    alternatives_offered = Signal(object)
    request_finished = Signal(bool)

    def __init__(self, parent: QObject | None = None) -> None:
        super().__init__(parent)
        self.restaurant = create_restaurant()
        self.robot = Robot(position=self.restaurant.robot_start)
        self.group: CustomerGroup | None = None
        self.waiting: list[CustomerGroup] = []
        self.phase = IDLE
        self.paused = False
        self.proposed: Candidate | None = None
        self.alternatives: list[Candidate] = []
        self.alternative_accepted = False
        self.history: list[dict[str, str]] = []
        self.events: list[str] = []
        self.last_error = ""
        self.pending_text = ""
        self.sequence = 0
        self.speed = 1.0
        self.customer_speed = 1.0
        self.time_scale = 1
        self.simulated_time = 0.0
        self.pedestrians: list[Pedestrian] = []
        self.detected_pedestrians: set[int] = set()
        self._pedestrian_sequence = 0
        self.wait_reason = ""
        self._waiting_customer = False
        self._blocked_seconds = 0.0
        self._last_detour = 0.0
        self._assistance_logged = False
        self._last_tick = monotonic()
        self._replan_pending = False
        self._avoid_people_pending = False
        self.ai = OllamaClient(self)
        self.ai.completed.connect(self._received)
        self.ai.failed.connect(self._failed)
        self.timer = QTimer(self)
        self.timer.setTimerType(Qt.TimerType.PreciseTimer)
        self.timer.setInterval(16)
        self.timer.timeout.connect(self._tick)
        self.timer.start()
        self.new_customer()

    @property
    def traveling(self) -> bool:
        return self.phase in (ESCORTING, RETURNING, BLOCKED)

    @property
    def customer_visual_position(self) -> Position | None:
        return self.group.position if self.group is not None else None

    @property
    def can_chat(self) -> bool:
        return self.group is not None and self.phase in (RECEPTION, CONFIRMING) and not self.alternatives

    @property
    def can_wait(self) -> bool:
        group = self.group
        return (self.can_chat and group is not None and group.requirements.party_size is not None
                and capacity_problem(self.restaurant, group.requirements) is None)

    @property
    def can_end(self) -> bool:
        return self.group is not None and self.phase in (RECEPTION, CONFIRMING) and not self.ai.busy

    def log(self, text: str) -> None:
        self.events.append(f"{datetime.now():%H:%M:%S}  {text}")
        self.events = self.events[-150:]

    def say(self, text: str) -> None:
        self.history.append({"role": "assistant", "content": text})
        self.message.emit("接待", text)

    def _clear_offer(self) -> None:
        self.proposed = None
        self.alternatives = []
        self.alternative_accepted = False

    def _reset_conversation(self) -> None:
        self.history = []
        self.last_error = ""
        self.pending_text = ""
        self.conversation_reset.emit()

    def new_customer(self) -> None:
        if self.phase != IDLE or self.group is not None or self.ai.busy:
            return
        if self._evaluate_waiting():
            return
        start = self.restaurant.customer_start
        if start in self.restaurant.blocked_cells:
            self.log("入口顧客位置被障礙物阻擋，請先移除障礙物。")
            self.changed.emit()
            return
        self.sequence += 1
        self.group = CustomerGroup(self.sequence, position=start, speed=self.customer_speed)
        self.phase = RECEPTION
        self._clear_offer()
        self._reset_conversation()
        self.say("歡迎光臨，請問幾位？")
        self.log(f"第 {self.sequence} 組顧客到店。")
        self.changed.emit()

    def submit(self, text: str, url: str, model: str) -> None:
        text, url, model = text.strip(), url.strip().rstrip("/"), model.strip()
        if not self.can_chat or not text or self.ai.busy:
            return
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc or not model:
            self.log("請填寫有效的 Ollama http(s) 位址與模型名稱。")
            self.changed.emit()
            return
        # A retry of the same text reuses its existing history entry.
        retrying = bool(self.last_error and text == self.pending_text)
        if not retrying:
            self.history.append({"role": "user", "content": text})
            self.message.emit("顧客", text)
        self.pending_text = text
        self.last_error = ""
        self._clear_offer()
        self.phase = THINKING
        self.changed.emit()
        self.ai.request(url, model, self.history, self.group.requirements)

    @Slot(object)
    def _received(self, result: ReceptionResult) -> None:
        if self.group is None:
            return
        self.group.requirements = result.requirements
        self.group.remaining_people = result.requirements.party_size or 0
        self.group.declined_plans.clear()
        self.phase = RECEPTION
        self.last_error = ""
        self.request_finished.emit(True)
        if result.requirements.ready:
            self._offer_seat()
        else:
            self.say(result.reply)
            self.changed.emit()

    @Slot(str)
    def _failed(self, error: str) -> None:
        self.phase = RECEPTION
        self.last_error = error
        self.message.emit("系統", error)
        self.log(error)
        self.request_finished.emit(False)
        self.changed.emit()

    def _offer_seat(self) -> None:
        if self.group is None:
            return
        self._clear_offer()
        candidates = rank_tables(self.restaurant, self.group.requirements, self.group.declined_plans)
        exact = [candidate for candidate in candidates if not candidate.requires_consent]
        if exact:
            self.proposed = exact[0]
            self.phase = CONFIRMING
            self.say(self.proposed.offer)
            self.log(f"向第 {self.group.number} 組提出 {self.proposed.key}，尚未保留。")
        elif candidates:
            self.phase = CONFIRMING
            self.alternatives = candidates
            best = candidates[0]
            differences = "；".join(best.differences)
            self.say(f"{differences}。{best.offer}")
            self.changed.emit()
            self.alternatives_offered.emit(list(candidates))
            return
        else:
            self.phase = RECEPTION
            self.say(no_seat_reason(self.restaurant, self.group.requirements))
        self.changed.emit()

    def choose_alternative(self, plan_key: str) -> None:
        previous = next((item for item in self.alternatives if item.key == plan_key), None)
        if self.group is None or previous is None:
            return
        fresh = revalidate_plan(self.restaurant, self.group.requirements, previous)
        self._clear_offer()
        if fresh is None:
            self.log("剛才的替代餐桌已無法安排，重新尋找可用座位。")
            self._offer_seat()
            return
        self.proposed = fresh
        self.alternative_accepted = True
        self.phase = CONFIRMING
        self.say(fresh.offer)
        self.changed.emit()

    def confirm(self) -> None:
        if self.phase != CONFIRMING or self.group is None or self.proposed is None:
            return
        previous = self.proposed
        fresh = revalidate_plan(self.restaurant, self.group.requirements, previous)
        if fresh is None or (fresh.requires_consent and not self.alternative_accepted):
            self.log("餐桌或路線條件已變更，需要重新確認安排。")
            self._offer_seat()
            return
        # Revalidation above checks every table and every leg before any mutation.
        for allocation in fresh.allocations:
            self.restaurant.table(allocation.table_name).status = RESERVED
        self.group.allocations = fresh.allocations
        self.group.next_stop = 0
        self.group.remaining_people = sum(item.people for item in fresh.allocations)
        self.group.status = ESCORTING
        self.group.trail = [self.robot.visual_position]
        self._waiting_customer = False
        self._set_wait_reason("")
        first_table = self.restaurant.table(fresh.allocations[0].table_name)
        self.robot.goal = first_table.goal
        self.robot.task = ESCORTING
        self.phase = ESCORTING
        self._clear_offer()
        self.say("已確認，請跟隨機器人前往座位。")
        self.log(f"第 {self.group.number} 組確認 {fresh.key}，全部餐桌保留，開始逐桌帶位。")
        self._plan_route()
        self.changed.emit()

    def wait_current(self) -> None:
        if self.group is None or self.phase not in (RECEPTION, CONFIRMING):
            return
        if self.group.requirements.party_size is None:
            self.say("請先確認用餐人數，再加入等待隊伍。")
            self.changed.emit()
            return
        permanent = capacity_problem(self.restaurant, self.group.requirements)
        if permanent:
            self.say(permanent)
            self.changed.emit()
            return
        group = self.group
        group.declined_plans.update(item.key for item in self.alternatives)
        if self.proposed is not None:
            group.declined_plans.add(self.proposed.key)
        group.status = "等待中"
        group.position = None
        group.waiting_reason = (
            "等候符合原需求的座位" if group.requirements.ready
            else "需求仍待確認；可選取等待顧客補充需求"
        )
        self.waiting.append(group)
        self.waiting.sort(key=lambda item: item.number)
        self.log(f"第 {group.number} 組加入等待隊伍：{group.requirements.summary()}。")
        self.group = None
        self.phase = IDLE
        self._clear_offer()
        self._reset_conversation()
        self._evaluate_waiting(exclude=group.number)
        self.changed.emit()

    def end_current(self) -> None:
        if not self.can_end:
            return
        self.group.status = "已離開"
        self.group.position = None
        self.log(f"第 {self.group.number} 組結束接待並離開，未保留任何桌位。")
        self.group = None
        self.phase = IDLE
        self._clear_offer()
        self._reset_conversation()
        self._evaluate_waiting()
        self.changed.emit()

    def resume_waiting(self, number: int) -> None:
        if self.phase != IDLE or self.group is not None:
            return
        group = next((item for item in self.waiting if item.number == number), None)
        if group is None or self.restaurant.customer_start in self.restaurant.blocked_cells:
            return
        # Explicitly reopening reception allows reconsidering previously declined plans.
        group.declined_plans.clear()
        self._activate_waiting(group)
        if group.requirements.ready:
            self._offer_seat()
        else:
            self.say(group.requirements.question or "請補充您的用餐需求。")
        self.changed.emit()

    def _activate_waiting(self, group: CustomerGroup) -> None:
        self.waiting.remove(group)
        self.group = group
        group.position = self.restaurant.customer_start
        group.status = RECEPTION
        self.phase = RECEPTION
        self._clear_offer()
        self._reset_conversation()

    def _evaluate_waiting(self, exclude: int | None = None) -> bool:
        if self.phase != IDLE or self.group is not None:
            return False
        if self.restaurant.customer_start in self.restaurant.blocked_cells:
            return False
        for group in self.waiting:
            if group.number == exclude:
                continue
            # A newly possible scattered plan still requires consent; it must not
            # cause large groups to wait forever merely because no adjacent set fits.
            if rank_tables(self.restaurant, group.requirements, group.declined_plans):
                self._activate_waiting(group)
                self._offer_seat()
                return True
        return False

    def toggle_obstacle(self, cell: Cell) -> None:
        restaurant = self.restaurant
        if not restaurant.contains(cell) or cell in restaurant.table_cells:
            return
        positions = [self.robot.visual_position] + [p.position for p in self.pedestrians]
        if self.customer_visual_position is not None:
            positions.append(self.customer_visual_position)
        protected = {self.robot.position}
        if self.robot.progress > 0 and self.robot.route:
            protected.add(self.robot.route[0])
        # Keep new square obstacles clear of entire actor bodies, including at cell boundaries.
        intersects = any(not body_clear(pos, restaurant, {cell}) for pos in positions)
        if cell in protected or intersects:
            self.log("不可在角色目前占用的位置或移動區段放置障礙物。")
        elif cell in restaurant.obstacles:
            restaurant.obstacles.remove(cell)
            self.log(f"移除障礙物 {cell}。")
            self._map_changed()
        else:
            restaurant.obstacles.add(cell)
            self.log(f"新增障礙物 {cell}。")
            self._map_changed()
        self.changed.emit()

    def _map_changed(self) -> None:
        sensed_change = self._sense()
        if self.traveling and sensed_change:
            self._plan_route()
        elif self.phase == IDLE:
            self._evaluate_waiting()
        elif self.phase == CONFIRMING and self.proposed is not None and self.group is not None:
            fresh = revalidate_plan(self.restaurant, self.group.requirements, self.proposed)
            if fresh is not None:
                self.proposed = fresh
            else:
                self.log("原建議餐桌的路線已無法通行，重新尋找座位，仍需顧客確認。")
                self._offer_seat()
        elif self.phase == RECEPTION and self.group is not None and self.group.requirements.ready and not self.last_error:
            self._offer_seat()

    def release_table(self, table_name: str) -> None:
        table = self.restaurant.table(table_name)
        if table.status == RESERVED:
            self.log(f"{table.name} 正在帶位保留中，無法釋放。")
        elif table.status == OCCUPIED:
            table.status = FREE
            self.log(f"{table.name} 已釋放為空閒。")
            self._map_changed()
        self.changed.emit()

    def set_paused(self, paused: bool) -> None:
        self.paused = paused
        self._last_tick = monotonic()
        self.changed.emit()

    def set_speed(self, metres_per_second: float) -> None:
        self._last_tick = monotonic()
        self.speed = max(0.5, min(1.5, metres_per_second))

    def set_customer_speed(self, speed: float) -> None:
        self.customer_speed = max(0.5, min(1.5, speed))
        if self.group is not None:
            self.group.speed = self.customer_speed

    def set_time_scale(self, scale: int) -> None:
        if scale not in (1, 2, 4):
            raise ValueError("模擬倍速只支援 1、2、4 倍")
        self._last_tick = monotonic()
        self.time_scale = scale

    def set_customer_stopped(self, stopped: bool) -> None:
        if self.group is None or self.robot.task != ESCORTING:
            return
        self.group.stopped = stopped
        self.changed.emit()

    def _plan_route(self, avoid_people: bool = False) -> None:
        if self.robot.goal is None:
            return
        # Finish the current safe segment before replanning from its endpoint.
        if self.robot.progress > 0:
            if avoid_people:
                # A stopped mid-segment robot may retreat to the previous waypoint.
                # Requiring it to finish a blocked segment would deadlock replanning.
                start = self.robot.position
                next_cell = self.robot.route[0]
                position = self.robot.visual_position
                others = [p.position for p in self.pedestrians
                          if p.number in self.detected_pedestrians]
                if self.customer_visual_position is not None:
                    others.append(self.customer_visual_position)
                if segment_clear(position, start, self.restaurant, others):
                    blocked = set(self.restaurant.known_blocked_cells)
                    for x in range(self.restaurant.width):
                        for y in range(self.restaurant.height):
                            if any(distance((x,y), p) < 1.1 for p in others):
                                blocked.add((x,y))
                    blocked.discard(start)
                    route = astar(self.restaurant, start, self.robot.goal, blocked)
                    if route is not None:
                        self.robot.position = next_cell
                        self.robot.progress = 1.0 - self.robot.progress
                        self.robot.route = [start] + route[1:]
                        self._replan_pending = False
                        self._avoid_people_pending = False
                        self.log("前方持續受阻，安全退回路點後繞行。")
                        return
            self._replan_pending = True
            self._avoid_people_pending |= avoid_people
            return
        avoid_people |= self._avoid_people_pending
        self._avoid_people_pending = False
        self._replan_pending = False
        blocked = set(self.restaurant.known_blocked_cells)
        if avoid_people:
            for person in self.pedestrians:
                if person.number in self.detected_pedestrians:
                    for x in range(self.restaurant.width):
                        for y in range(self.restaurant.height):
                            if distance((x, y), person.position) < 1.1:
                                blocked.add((x, y))
            if self.customer_visual_position is not None:
                blocked.add(cell_for(self.customer_visual_position))
        blocked.discard(self.robot.position)
        route = astar(self.restaurant, self.robot.position, self.robot.goal, blocked)
        if route is None:
            self.robot.route = []
            if self.phase != BLOCKED:
                self.log("路線完全受阻，停下並保留任務，等待障礙物變更。")
            self.phase = BLOCKED
        else:
            self.robot.route = route[1:]
            self.phase = self.robot.task
            self.log(f"{self.robot.task}路線已規劃，剩餘 {len(self.robot.route)} 格。")
        self._last_tick = monotonic()

    def _set_wait_reason(self, reason: str) -> None:
        if reason != self.wait_reason:
            self.wait_reason = reason
            if reason:
                self.log(reason)

    def _sense(self) -> bool:
        restaurant = self.restaurant
        position = self.robot.visual_position
        observed = {cell for cell in restaurant.obstacles | restaurant.known_obstacles
                    if distance(position, cell) <= SENSOR_RANGE}
        previous = set(restaurant.known_obstacles)
        restaurant.known_obstacles.difference_update(observed)
        restaurant.known_obstacles.update(observed & restaurant.obstacles)
        self.detected_pedestrians = {p.number for p in self.pedestrians
                                    if distance(position, p.position) <= SENSOR_RANGE}
        return previous != restaurant.known_obstacles

    def add_pedestrian(self, start: Cell, goal: Cell) -> bool:
        if start == goal or not body_clear(start, self.restaurant) or not body_clear(goal, self.restaurant):
            self.log("行人起終點須為不同的可通行位置。")
            self.changed.emit()
            return False
        positions = [self.robot.visual_position] + [p.position for p in self.pedestrians]
        if self.customer_visual_position is not None:
            positions.append(self.customer_visual_position)
        if any(distance(start, p) < 2 * RADIUS + 0.1 for p in positions):
            self.log("行人起點距離現有角色太近。")
            self.changed.emit()
            return False
        route = astar(self.restaurant, start, goal)
        if route is None:
            self.log("行人起終點之間沒有可通行路線。")
            self.changed.emit()
            return False
        self._pedestrian_sequence += 1
        self.pedestrians.append(Pedestrian(self._pedestrian_sequence, start, list(route[1:])))
        self._sense()
        self.log(f"新增行人 P{self._pedestrian_sequence}：{start} → {goal}。")
        self.changed.emit()
        return True

    def clear_pedestrians(self) -> None:
        self.pedestrians.clear()
        self._sense()
        if self.traveling:
            self._plan_route()
        self.changed.emit()

    def _move_pedestrians(self, dt: float) -> None:
        for person in list(self.pedestrians):
            if not person.route:
                self.pedestrians.remove(person)
                continue
            end = towards(person.position, person.route[0], person.speed * dt)
            others = [self.robot.visual_position] + [p.position for p in self.pedestrians if p is not person]
            if self.customer_visual_position is not None:
                others.append(self.customer_visual_position)
            if segment_clear(person.position, end, self.restaurant, others):
                person.position = end
                if distance(end, person.route[0]) < EPS:
                    person.route.pop(0)
                    if not person.route:
                        self.pedestrians.remove(person)

    def _move_customer(self, dt: float) -> None:
        group = self.group
        if group is None or group.position is None or group.stopped or self.robot.task != ESCORTING:
            return
        at_table = not self.robot.route and self.robot.position == self.robot.goal
        remaining = trail_length(group.position, group.trail)
        # Reach the table alongside the robot without overlapping its body.
        desired_gap = 2 * RADIUS if at_table else 1.0
        amount = min(group.speed * dt, max(0.0, remaining - desired_gap))
        while group.trail and amount > EPS:
            target = group.trail[0]
            step = min(amount, distance(group.position, target))
            end = towards(group.position, target, step)
            others = [self.robot.visual_position] + [p.position for p in self.pedestrians]
            if not segment_clear(group.position, end, self.restaurant, others):
                break
            group.position = end
            amount -= step
            if distance(end, target) < EPS:
                group.trail.pop(0)

    def _front_person_gap(self) -> float | None:
        if not self.robot.route:
            return None
        start = self.robot.visual_position
        points = [start]
        length = 0.0
        for cell in self.robot.route:
            length += distance(points[-1], cell)
            points.append(cell)
            if length >= 2.5:
                break
        gaps = []
        for person in self.pedestrians:
            if person.number not in self.detected_pedestrians:
                continue
            dx, dy = points[1][0]-start[0], points[1][1]-start[1]
            if (person.position[0]-start[0])*dx + (person.position[1]-start[1])*dy < -EPS:
                continue
            if any(point_segment_distance(person.position, a, b) < 2 * RADIUS + 0.25
                   for a, b in zip(points, points[1:])):
                gaps.append(distance(start, person.position) - 2 * RADIUS)
        return min(gaps) if gaps else None

    def _blocked_for(self, dt: float, reason: str) -> None:
        self._blocked_seconds += dt
        self._set_wait_reason("持續受阻，需要人工協助；保留原任務與桌位。"
                              if self._assistance_logged else reason)
        if self._blocked_seconds >= 3 and self._blocked_seconds - self._last_detour >= 3:
            self._last_detour = self._blocked_seconds
            self._plan_route(avoid_people=True)
        if self._blocked_seconds >= 10 and not self._assistance_logged:
            self._assistance_logged = True
            self._set_wait_reason("持續受阻，需要人工協助；保留原任務與桌位。")

    def _advance(self, dt: float) -> None:
        self.simulated_time += dt
        self._move_pedestrians(dt)
        if self._sense() and self.traveling:
            self._plan_route()
        if not self.traveling:
            return
        self._move_customer(dt)
        group = self.group
        reason = ""
        if self.robot.task == ESCORTING and group is not None and group.position is not None:
            gap = trail_length(group.position, group.trail)
            if group.stopped:
                reason = "顧客停留，等待顧客。"
            elif gap > 2.5:
                self._waiting_customer = True
            elif gap <= 1.5:
                self._waiting_customer = False
            if self._waiting_customer:
                reason = "顧客落後，等待跟上。"
        if reason:
            self._set_wait_reason(reason)
            return
        if self.phase == BLOCKED:
            self._blocked_for(dt, "路線受阻，等待通行。")
            return
        if not self.robot.route:
            if self.robot.position == self.robot.goal:
                if (self.robot.task == ESCORTING and group is not None and group.position is not None
                        and trail_length(group.position, group.trail) > 2 * RADIUS + EPS):
                    self._set_wait_reason("已抵達桌旁，等待顧客到達。")
                else:
                    self._set_wait_reason("")
                    self._arrived()
            return
        gap = self._front_person_gap()
        if gap is not None and gap < 0.5:
            self._blocked_for(dt, "前方行人接近，停止等待通行。")
            return
        speed = self.speed * (0.4 if gap is not None and gap < 1.5 else 1)
        target = self.robot.route[0]
        end = towards(self.robot.visual_position, target, speed * dt)
        others = [p.position for p in self.pedestrians]
        if self.customer_visual_position is not None:
            others.append(self.customer_visual_position)
        if not segment_clear(self.robot.visual_position, end, self.restaurant, others):
            self._blocked_for(dt, "前方無安全間距，等待通行。")
            return
        self._blocked_seconds = self._last_detour = 0.0
        self._assistance_logged = False
        self._set_wait_reason("前方行人接近，減速通行。" if speed < self.speed else "")
        before = self.robot.visual_position
        self.robot.progress += distance(before, end)
        if self.robot.task == ESCORTING and group is not None:
            group.trail.append(end)
        if distance(end, target) < EPS:
            self.robot.position = self.robot.route.pop(0)
            self.robot.progress = 0.0
            if self._replan_pending:
                self._plan_route()

    def step(self, real_seconds: float) -> None:
        """Advance deterministic elapsed time; used by both the timer and tests."""
        if real_seconds < 0:
            raise ValueError("經過時間不得為負數")
        if self.paused:
            return
        remaining = real_seconds * self.time_scale
        while remaining > EPS:
            dt = min(remaining, 0.02)
            self._advance(dt)
            remaining -= dt
        self.changed.emit()

    def _tick(self) -> None:
        now = monotonic()
        elapsed = min(now - self._last_tick, 0.1)
        self._last_tick = now
        if self.traveling or self.pedestrians:
            self.step(elapsed)

    def _arrived(self) -> None:
        if self.robot.task == ESCORTING and self.group is not None:
            allocation = self.group.allocations[self.group.next_stop]
            table = self.restaurant.table(allocation.table_name)
            table.status = OCCUPIED
            self.group.remaining_people -= allocation.people
            self.group.next_stop += 1
            self.log(f"第 {self.group.number} 組在 {table.name} 入座 {allocation.people} 位，"
                     f"尚有 {self.group.remaining_people} 位未入座。")
            if self.group.next_stop < len(self.group.allocations):
                following = self.group.allocations[self.group.next_stop]
                self.robot.goal = self.restaurant.table(following.table_name).goal
                self.say(f"接著前往 {following.table_name} 桌。")
                self._plan_route()
            else:
                self.group.position = None
                self.group.status = "已入座"
                self.say("已全部入座，祝用餐愉快！")
                self.log(f"第 {self.group.number} 組全部入座；機器人返回入口。")
                self.robot.task = RETURNING
                self.robot.goal = self.restaurant.robot_start
                self.phase = RETURNING
                self._plan_route()
        elif self.robot.task == RETURNING:
            self._blocked_seconds = self._last_detour = 0.0
            self._assistance_logged = False
            self._set_wait_reason("")
            self.robot.task = ""
            self.robot.goal = None
            self.robot.route = []
            self.group = None
            self.phase = IDLE
            self._clear_offer()
            self._reset_conversation()
            self.log("機器人已回到入口，可接待下一組。")
            self._evaluate_waiting()
