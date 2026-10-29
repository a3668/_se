"""Single-robot, single-reception state machine. All mutations happen here."""

from __future__ import annotations

from datetime import datetime
from urllib.parse import urlparse

from PySide6.QtCore import QObject, QTimer, Signal, Slot

from ai import OllamaClient, ReceptionResult
from navigation import astar
from restaurant import (
    FREE, OCCUPIED, RESERVED, Cell, CustomerGroup, Robot, create_restaurant,
)
from seating import Candidate, no_seat_reason, rank_tables

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
        self.ai = OllamaClient(self)
        self.ai.completed.connect(self._received)
        self.ai.failed.connect(self._failed)
        self.timer = QTimer(self)
        self.timer.setInterval(300)
        self.timer.timeout.connect(self._tick)
        self.timer.start()
        self.new_customer()

    @property
    def traveling(self) -> bool:
        return self.phase in (ESCORTING, RETURNING, BLOCKED)

    @property
    def can_chat(self) -> bool:
        return self.group is not None and self.phase in (RECEPTION, CONFIRMING) and not self.alternatives

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
        self.group = CustomerGroup(self.sequence, position=start)
        self.phase = RECEPTION
        self._clear_offer()
        self._reset_conversation()
        self.say("歡迎光臨！請問幾位用餐？有靠窗或指定餐桌的需求嗎？")
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
        self.phase = RECEPTION
        self.last_error = ""
        self.say(result.reply)
        self.request_finished.emit(True)
        if result.requirements.ready:
            self._offer_seat()
        else:
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
        candidates = rank_tables(self.restaurant, self.group.requirements)
        exact = [candidate for candidate in candidates if not candidate.misses]
        if exact:
            self.proposed = exact[0]
            self.phase = CONFIRMING
            self.say("建議安排 " + self.proposed.reason + "請按「確認座位並帶位」，或輸入要修改的需求。")
            self.log(f"向第 {self.group.number} 組提出 {self.proposed.table_name}，尚未保留。")
        elif candidates:
            self.phase = CONFIRMING
            self.alternatives = candidates
            self.say("目前沒有符合所有偏好的空桌，請選擇是否接受其他位置，或繼續等待。")
            self.changed.emit()
            self.alternatives_offered.emit(list(candidates))
            return
        else:
            self.phase = RECEPTION
            self.say(no_seat_reason(self.restaurant, self.group.requirements) + "您可以修改需求，或按「繼續等待」。")
        self.changed.emit()

    def choose_alternative(self, table_name: str) -> None:
        if self.group is None or not any(item.table_name == table_name for item in self.alternatives):
            return
        fresh = next((item for item in rank_tables(self.restaurant, self.group.requirements)
                      if item.table_name == table_name), None)
        self._clear_offer()
        if fresh is None:
            self.say("剛才的替代餐桌已無法安排，重新尋找可用座位。")
            self._offer_seat()
            return
        self.proposed = fresh
        self.alternative_accepted = True
        self.phase = CONFIRMING
        self.say("您已接受本次替代位置：" + fresh.reason + "請再按「確認座位並帶位」開始。")
        self.changed.emit()

    def confirm(self) -> None:
        if self.phase != CONFIRMING or self.group is None or self.proposed is None:
            return
        previous = self.proposed
        fresh = next((item for item in rank_tables(self.restaurant, self.group.requirements)
                      if item.table_name == previous.table_name), None)
        if fresh is None or (fresh.misses and not self.alternative_accepted):
            self.say("餐桌或路線條件已變更，需要重新確認安排。")
            self._offer_seat()
            return
        table = self.restaurant.table(fresh.table_name)
        table.status = RESERVED
        self.group.table_name = table.name
        self.group.status = ESCORTING
        self.robot.goal = table.goal
        self.robot.task = ESCORTING
        self.phase = ESCORTING
        self._clear_offer()
        self.say(f"已確認 {table.name}，請跟隨機器人前往座位。")
        self.log(f"第 {self.group.number} 組確認 {table.name}，餐桌保留，開始帶位。")
        self._plan_route()
        self.changed.emit()

    def wait_current(self) -> None:
        if self.group is None or self.phase not in (RECEPTION, CONFIRMING):
            return
        if self.group.requirements.party_size is None:
            self.say("請先確認用餐人數，再加入等待隊伍。")
            self.changed.emit()
            return
        group = self.group
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

    def resume_waiting(self, number: int) -> None:
        if self.phase != IDLE or self.group is not None:
            return
        group = next((item for item in self.waiting if item.number == number), None)
        if group is None or self.restaurant.customer_start in self.restaurant.blocked_cells:
            return
        self._activate_waiting(group)
        self.say("已重新接待這組等待顧客。原需求：" + group.requirements.summary() + "。可輸入要補充或修改的需求。")
        if group.requirements.ready:
            self._offer_seat()
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
            # Automatic offers only resume groups whose original preferences match.
            # Rejected alternatives are not repeatedly shown on unchanged conditions.
            if any(not candidate.misses for candidate in rank_tables(self.restaurant, group.requirements)):
                self._activate_waiting(group)
                self.say(f"第 {group.number} 組等候的座位現在可安排，請確認。")
                self._offer_seat()
                return True
        return False

    def toggle_obstacle(self, cell: Cell) -> None:
        restaurant = self.restaurant
        if not restaurant.contains(cell) or cell in restaurant.table_cells:
            return
        if cell == self.robot.position or (self.group is not None and cell == self.group.position):
            self.log("不可在機器人或顧客當前位置放置障礙物。")
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
        if self.traveling:
            self._plan_route()
        elif self.phase == IDLE:
            self._evaluate_waiting()
        elif self.phase == CONFIRMING and self.proposed is not None and self.group is not None:
            fresh = next((item for item in rank_tables(self.restaurant, self.group.requirements)
                          if item.table_name == self.proposed.table_name), None)
            if fresh is not None:
                self.proposed = fresh
            else:
                self.say("原建議餐桌的路線已無法通行，重新尋找座位，仍需您確認。")
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
        self.changed.emit()

    def set_speed(self, steps_per_second: int) -> None:
        self.timer.setInterval(round(1000 / max(1, steps_per_second)))

    def _plan_route(self) -> None:
        if self.robot.goal is None:
            return
        route = astar(self.restaurant, self.robot.position, self.robot.goal)
        if route is None:
            self.robot.route = []
            if self.phase != BLOCKED:
                self.log("路線完全受阻，停下並保留任務，等待障礙物變更。")
            self.phase = BLOCKED
        else:
            self.robot.route = route[1:]
            self.phase = self.robot.task
            self.log(f"{self.robot.task}路線已規劃，剩餘 {len(self.robot.route)} 格。")

    def _tick(self) -> None:
        if self.paused or self.phase not in (ESCORTING, RETURNING):
            return
        if self.robot.route:
            next_cell = self.robot.route[0]
            if next_cell in self.restaurant.blocked_cells:
                self._plan_route()
                self.changed.emit()
                return
            previous = self.robot.position
            self.robot.position = self.robot.route.pop(0)
            if self.robot.task == ESCORTING and self.group is not None:
                self.group.position = previous
        if self.robot.position == self.robot.goal:
            self._arrived()
        self.changed.emit()

    def _arrived(self) -> None:
        if self.robot.task == ESCORTING and self.group is not None:
            table = self.restaurant.table(self.group.table_name)
            table.status = OCCUPIED
            self.group.position = None
            self.group.status = "已入座"
            self.say(f"已抵達 {table.name}，祝用餐愉快！機器人正在返回入口。")
            self.log(f"第 {self.group.number} 組已入座 {table.name}；機器人返回入口。")
            self.robot.task = RETURNING
            self.robot.goal = self.restaurant.robot_start
            self.phase = RETURNING
            self._plan_route()
        elif self.robot.task == RETURNING:
            self.robot.task = ""
            self.robot.goal = None
            self.robot.route = []
            self.group = None
            self.phase = IDLE
            self._clear_offer()
            self._reset_conversation()
            self.log("機器人已回到入口，可接待下一組。")
            self._evaluate_waiting()
