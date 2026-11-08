"""Interactive restaurant window; state changes are delegated to Simulation."""

from __future__ import annotations

from html import escape

from PySide6.QtCore import QPointF, QRectF, Qt, QTimer, Signal, Slot
from PySide6.QtGui import (
    QColor, QCloseEvent, QFont, QMouseEvent, QPainter, QPainterPath, QPaintEvent, QPen,
)
from PySide6.QtWidgets import (
    QCheckBox, QComboBox, QDialog, QDoubleSpinBox, QFrame, QHBoxLayout, QLabel, QLineEdit,
    QListWidget, QListWidgetItem, QMainWindow, QPlainTextEdit, QPushButton,
    QScrollArea, QSizePolicy, QSpinBox, QTextBrowser, QVBoxLayout, QWidget,
)

from ai import DEFAULT_MODEL, DEFAULT_URL, ModelListThread
from restaurant import FREE, OCCUPIED, RESERVED, ROW_SPECS, Cell, Position
from seating import Candidate
from motion import SENSOR_RANGE, RADIUS
from simulation import CONFIRMING, IDLE, Simulation

COLORS = {
    "floor": "#faf9f5", "aisle": "#eef3f5", "open": "#edf5f1",
    "grid": "#e1e5e3", "wall": "#596b69", "text": "#223b36",
    "muted": "#6b7d78", "four": "#d7eae0", "six": "#c5ddd9",
    "reserved": "#f9e2b6", "occupied": "#e5d9d5", "table_edge": "#7baba0",
    "goal": "#c28a29", "robot": "#23736a", "window": "#62aaca",
    "customer": "#c47139", "obstacle": "#687582", "route": "#3b9387",
}

STYLESHEET = """
QMainWindow, QScrollArea, QScrollArea > QWidget > QWidget { background: #f2f5f3; }
QWidget { color: #223b36; font-size: 13px; }
QFrame#card { background: #ffffff; border: 1px solid #dce5df; border-radius: 12px; }
QLabel { background: transparent; border: none; }
QLabel[role="title"] { font-size: 24px; font-weight: 700; }
QLabel[role="section"] { font-size: 14px; font-weight: 600; }
QLabel[role="muted"] { color: #6b7d78; font-size: 12px; }
QLabel[role="badge"] { color: #23736a; background: #e0eee7; padding: 7px 12px; border-radius: 10px; }
QLineEdit, QComboBox, QSpinBox, QDoubleSpinBox, QListWidget, QTextBrowser, QPlainTextEdit {
    background: #ffffff; border: 1px solid #dce5df; border-radius: 6px; padding: 5px;
}
QPushButton { background: #edf4ef; border: 1px solid #c8dbcf; border-radius: 6px; padding: 8px; }
QPushButton:hover { background: #dcece3; }
QPushButton#confirm { color: white; background: #23736a; border-color: #23736a; }
QPushButton:disabled, QPushButton#confirm:disabled, QLineEdit:disabled { color: #8b9991; background: #f1f4f2; border-color: #e1e6e2; }
QStatusBar { background: #e5ede7; color: #45665a; padding: 3px 12px; }
"""


def label(text: str, role: str = "", wrap: bool = False) -> QLabel:
    widget = QLabel(text)
    widget.setWordWrap(wrap)
    if role:
        widget.setProperty("role", role)
    return widget


def card(title: str) -> tuple[QFrame, QVBoxLayout]:
    frame = QFrame()
    frame.setObjectName("card")
    layout = QVBoxLayout(frame)
    layout.setContentsMargins(14, 12, 14, 12)
    layout.setSpacing(9)
    layout.addWidget(label(title, "section"))
    return frame, layout


class ModelComboBox(QComboBox):
    opened = Signal()
    closed = Signal()

    def __init__(self) -> None:
        super().__init__()
        self.popup_open = False

    def showPopup(self) -> None:
        self.opened.emit()
        self.popup_open = self.count() > 0
        super().showPopup()

    def hidePopup(self) -> None:
        super().hidePopup()
        self.popup_open = False
        self.closed.emit()


class MapCanvas(QWidget):
    def __init__(self, simulation: Simulation) -> None:
        super().__init__()
        self.simulation = simulation
        self.editing_obstacles = False
        self.setMinimumSize(320, 440)
        self.setMouseTracking(True)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)

    def geometry_for_map(self) -> tuple[QRectF, float]:
        restaurant = self.simulation.restaurant
        area = QRectF(self.rect()).adjusted(44, 30, -18, -44)
        scale = min(area.width() / restaurant.width, area.height() / restaurant.height)
        floor = QRectF(
            area.center().x() - restaurant.width * scale / 2,
            area.center().y() - restaurant.height * scale / 2,
            restaurant.width * scale, restaurant.height * scale,
        )
        return floor, scale

    def cell_at(self, position: QPointF) -> Cell | None:
        floor, scale = self.geometry_for_map()
        cell = (int((position.x() - floor.left()) // scale),
                int((floor.bottom() - position.y()) // scale))
        return cell if self.simulation.restaurant.contains(cell) else None

    def mousePressEvent(self, event: QMouseEvent) -> None:
        if self.editing_obstacles and event.button() == Qt.MouseButton.LeftButton:
            cell = self.cell_at(event.position())
            if cell is not None:
                self.simulation.toggle_obstacle(cell)
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event: QMouseEvent) -> None:
        cell = self.cell_at(event.position())
        text = ""
        if cell is not None:
            text = f"座標 {cell}"
            for table in self.simulation.restaurant.tables:
                if cell in table.occupied_cells:
                    text += f"｜{table.name}・{table.capacity} 人・{table.status}｜目標 {table.goal}"
                    break
                if cell == table.goal:
                    text += f"｜{table.name} 導航目標"
            if self.editing_obstacles:
                text += "｜點擊新增／移除障礙物"
        self.setToolTip(text)
        super().mouseMoveEvent(event)

    def paintEvent(self, event: QPaintEvent) -> None:
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        simulation, restaurant = self.simulation, self.simulation.restaurant
        floor, scale = self.geometry_for_map()

        def rect(x: float, y: float, width: float = 1, height: float = 1) -> QRectF:
            return QRectF(floor.left() + x * scale, floor.bottom() - (y + height) * scale,
                          width * scale, height * scale)

        def point(x: float, y: float) -> QPointF:
            return QPointF(floor.left() + x * scale, floor.bottom() - y * scale)

        def text(box: QRectF, value: str, size: float, color: str, bold: bool = False) -> None:
            font = QFont(self.font())
            font.setPointSizeF(size)
            font.setBold(bold)
            painter.setFont(font)
            painter.setPen(QColor(color))
            painter.drawText(box, Qt.AlignmentFlag.AlignCenter, value)

        painter.fillRect(floor, QColor(COLORS["floor"]))
        for left, right in restaurant.aisle_ranges:
            painter.fillRect(rect(left, 0, right - left + 1, restaurant.height), QColor(COLORS["aisle"]))
        for bottom, top in (restaurant.lower_open_rows, restaurant.upper_passage_rows):
            painter.fillRect(rect(0, bottom, restaurant.width, top - bottom + 1), QColor(COLORS["open"]))
        painter.setPen(QPen(QColor(COLORS["grid"]), 0.7))
        for x in range(restaurant.width + 1):
            painter.drawLine(point(x, 0), point(x, restaurant.height))
        for y in range(restaurant.height + 1):
            painter.drawLine(point(0, y), point(restaurant.width, y))

        table_font = min(12.0, scale * 0.53)
        for table in restaurant.tables:
            box = rect(table.x, table.y, table.width, table.height)
            fill = COLORS["four"] if table.capacity == 4 else COLORS["six"]
            if table.status == RESERVED:
                fill = COLORS["reserved"]
            elif table.status == OCCUPIED:
                fill = COLORS["occupied"]
            selected = simulation.proposed is not None and table.name in simulation.proposed.table_names
            painter.setPen(QPen(QColor(COLORS["robot"] if selected else COLORS["table_edge"]), 2.5 if selected else 1))
            painter.setBrush(QColor(fill))
            padding = scale * 0.1
            painter.drawRoundedRect(box.adjusted(padding, padding, -padding, -padding), 5, 5)
            text(box.adjusted(0, scale * 0.32, 0, -scale * 1.2), table.name, table_font, COLORS["text"], True)
            text(box.adjusted(0, scale * 1.5, 0, -scale * 0.35),
                 f"{table.capacity} 人 · {table.status}", table_font * 0.73, COLORS["muted"])
            painter.setPen(QPen(QColor(COLORS["goal"]), 1.3))
            painter.setBrush(QColor("#fff5d9"))
            painter.drawEllipse(rect(*table.goal).center(), scale * 0.2, scale * 0.2)

        route = simulation.robot.route
        if not route and simulation.proposed is not None:
            route = list(simulation.proposed.path[1:])
        if route:
            path = QPainterPath(rect(*simulation.robot.visual_position).center())
            for cell in route:
                path.lineTo(rect(*cell).center())
            pen = QPen(QColor(COLORS["route"]), max(1.5, scale * 0.1))
            pen.setStyle(Qt.PenStyle.DashLine)
            painter.setPen(pen)
            painter.setBrush(Qt.BrushStyle.NoBrush)
            painter.drawPath(path)

        robot_center = rect(*simulation.robot.visual_position).center()
        painter.setPen(QPen(QColor("#76a9a1"), 1, Qt.PenStyle.DashLine))
        painter.setBrush(QColor(60, 140, 125, 12))
        painter.drawEllipse(robot_center, SENSOR_RANGE * scale, SENSOR_RANGE * scale)

        for cell in restaurant.obstacles | restaurant.known_obstacles:
            box = rect(*cell).adjusted(scale * 0.12, scale * 0.12, -scale * 0.12, -scale * 0.12)
            known = cell in restaurant.known_obstacles
            actual = cell in restaurant.obstacles
            painter.fillRect(box, QColor(COLORS["obstacle"] if known and actual else "#c5ccd0"))
            if known and not actual:
                painter.setPen(QPen(QColor("#c28a29"), 2))
                painter.drawRect(box)
            painter.setPen(QPen(QColor("#ffffff"), 1))
            painter.drawLine(box.topLeft(), box.bottomRight())
            painter.drawLine(box.topRight(), box.bottomLeft())

        painter.setPen(QPen(QColor(COLORS["wall"]), 2))
        painter.drawLine(floor.topLeft(), floor.topRight())
        painter.drawLine(floor.topRight(), floor.bottomRight())
        painter.drawLine(floor.bottomLeft(), floor.topLeft())
        entrance_left, entrance_right = restaurant.entrance_x
        painter.drawLine(point(0, 0), point(entrance_left, 0))
        painter.drawLine(point(entrance_right, 0), point(restaurant.width, 0))
        painter.setPen(QPen(QColor(COLORS["robot"]), 3))
        painter.drawLine(point(entrance_left, 0), point(entrance_right, 0))
        painter.setPen(QPen(QColor(COLORS["window"]), 4))
        painter.drawLine(floor.topLeft() + QPointF(-7, 0), floor.bottomLeft() + QPointF(-7, 0))

        axis_font = min(8.0, scale * 0.45)
        for x in range(restaurant.width):
            text(QRectF(floor.left() + x * scale, floor.bottom() + 3, scale, 16), str(x), axis_font, COLORS["muted"])
        for y in range(restaurant.height):
            text(QRectF(floor.left() - 31, rect(0, y).top(), 19, scale), str(y), axis_font, COLORS["muted"])
        for row, x, _, _ in ROW_SPECS:
            text(QRectF(floor.left() + x * scale, floor.top() - 25, 4 * scale, 20), f"{row} 列", 10, COLORS["text"], True)
        text(rect(0, 31, 18, 3), "上方連通通道", table_font * 0.8, COLORS["muted"])
        text(rect(5, 0, 8, 1), "入口 / 接待區", table_font * 0.75, COLORS["robot"], True)

        def marker(cell: Position, symbol: str, color: str) -> None:
            box = rect(*cell)
            painter.setPen(QPen(QColor("#ffffff"), 1.3))
            painter.setBrush(QColor(color))
            painter.drawEllipse(box.center(), scale * RADIUS, scale * RADIUS)
            text(box, symbol, table_font * 0.75, "#ffffff", True)

        for person in simulation.pedestrians:
            color = "#8e63b5" if person.number in simulation.detected_pedestrians else "#c9bbd5"
            marker(person.position, "P", color)
        marker(simulation.robot.visual_position, "R", COLORS["robot"])
        group = simulation.group
        customer_position = simulation.customer_visual_position
        if group is not None and customer_position is not None:
            marker(customer_position, "G", COLORS["customer"])
            size = (str(group.remaining_people) if group.allocations
                    else str(group.requirements.party_size) if group.requirements.party_size else "?")
            x, y = customer_position
            # Keep the count label inside the map, including along its right edge.
            label_x = x + 1 if x < restaurant.width - 4 else x - 3
            text(rect(label_x, y, 3, 1), f"{size} 人", table_font * 0.7, COLORS["customer"], True)
        text(QRectF(floor.left(), floor.bottom() + 22, floor.width(), 18),
             "左下角 (0,0)  ·  x 向右 / y 向上  ·  每格 1 m", 9, COLORS["muted"])
        painter.end()


class RestaurantWindow(QMainWindow):
    def __init__(self, simulation: Simulation) -> None:
        super().__init__()
        self.simulation = simulation
        self.close_pending = False
        self.model_worker: ModelListThread | None = None
        self.pending_models: list[str] | None = None
        self.preferred_model = DEFAULT_MODEL
        self.alternative_dialog: QDialog | None = None
        self.waiting_snapshot: tuple = ()
        self.events_snapshot: tuple = ()
        self.setWindowTitle("AI 智慧餐廳帶位機器人")
        self.setMinimumSize(850, 720)
        self.resize(1200, 980)
        root = QWidget()
        self.setCentralWidget(root)
        layout = QVBoxLayout(root)
        layout.setContentsMargins(20, 16, 20, 8)
        layout.setSpacing(10)
        header = QHBoxLayout()
        titles = QVBoxLayout()
        titles.addWidget(label("AI 智慧餐廳帶位機器人", "title"))
        titles.addWidget(label("18 × 34 公尺 / 21 桌・98 席 / 單一機器人・逐回合接待", "muted"))
        header.addLayout(titles)
        header.addStretch()
        self.badge = label("", "badge")
        header.addWidget(self.badge)
        layout.addLayout(header)

        content = QHBoxLayout()
        content.setSpacing(14)
        map_frame, map_layout = card("餐廳平面圖")
        self.canvas = MapCanvas(simulation)
        map_layout.addWidget(self.canvas, 1)
        map_layout.addWidget(label("R 機器人  ·  G 顧客群  ·  P 行人  ·  金圈：目標點  ·  虛線：路線", "muted", True))
        map_layout.addWidget(label("綠：空閒  ·  黃：保留  ·  灰褐：占用  ·  深灰：障礙物", "muted", True))
        content.addWidget(map_frame, 1)

        sidebar = QWidget()
        side = QVBoxLayout(sidebar)
        side.setContentsMargins(0, 0, 0, 0)
        side.setSpacing(10)
        reception, reception_layout = card("顧客接待")
        self.current_group = label("", wrap=True)
        reception_layout.addWidget(self.current_group)
        self.conversation = QTextBrowser()
        self.conversation.setOpenExternalLinks(False)
        self.conversation.setMinimumHeight(120)
        self.conversation.setMaximumHeight(190)
        reception_layout.addWidget(self.conversation)
        self.customer_input = QLineEdit()
        self.customer_input.setPlaceholderText("例如：我們四位，希望靠窗")
        self.customer_input.returnPressed.connect(self._send)
        reception_layout.addWidget(self.customer_input)
        actions = QHBoxLayout()
        self.send_button = QPushButton("送出需求")
        self.send_button.clicked.connect(self._send)
        self.retry_button = QPushButton("重試")
        self.retry_button.clicked.connect(self._retry)
        self.new_button = QPushButton("下一組顧客")
        self.new_button.clicked.connect(simulation.new_customer)
        for button in (self.send_button, self.retry_button, self.new_button):
            actions.addWidget(button)
        reception_layout.addLayout(actions)
        side.addWidget(reception)

        seating, seating_layout = card("座位安排")
        self.seat_info = label("", wrap=True)
        seating_layout.addWidget(self.seat_info)
        self.confirm_button = QPushButton("確認座位並帶位")
        self.confirm_button.setObjectName("confirm")
        self.confirm_button.clicked.connect(simulation.confirm)
        seating_layout.addWidget(self.confirm_button)
        self.wait_button = QPushButton("繼續等待，接待其他顧客")
        self.wait_button.clicked.connect(simulation.wait_current)
        seating_layout.addWidget(self.wait_button)
        self.end_button = QPushButton("結束本組")
        self.end_button.clicked.connect(simulation.end_current)
        seating_layout.addWidget(self.end_button)
        side.addWidget(seating)

        controls, controls_layout = card("模擬控制")
        motion = QHBoxLayout()
        self.pause_button = QPushButton("暫停移動")
        self.pause_button.setCheckable(True)
        self.pause_button.toggled.connect(simulation.set_paused)
        motion.addWidget(self.pause_button)
        motion.addWidget(label("公尺／秒"))
        self.speed = QDoubleSpinBox()
        self.speed.setRange(0.5, 1.5)
        self.speed.setSingleStep(0.1)
        self.speed.setDecimals(1)
        self.speed.setValue(1.0)
        self.speed.setAccessibleName("機器人速度")
        self.speed.valueChanged.connect(simulation.set_speed)
        simulation.set_speed(self.speed.value())
        motion.addWidget(self.speed)
        controls_layout.addLayout(motion)
        following = QHBoxLayout()
        following.addWidget(label("顧客 公尺／秒"))
        self.customer_speed = QDoubleSpinBox()
        self.customer_speed.setRange(0.5, 1.5)
        self.customer_speed.setSingleStep(0.1)
        self.customer_speed.setDecimals(1)
        self.customer_speed.setValue(1.0)
        self.customer_speed.setAccessibleName("顧客速度")
        self.customer_speed.valueChanged.connect(simulation.set_customer_speed)
        following.addWidget(self.customer_speed)
        self.time_scale = QComboBox()
        self.time_scale.setAccessibleName("模擬倍速")
        for value in (1, 2, 4):
            self.time_scale.addItem(f"{value} 倍", value)
        self.time_scale.currentIndexChanged.connect(
            lambda _: simulation.set_time_scale(self.time_scale.currentData()))
        following.addWidget(self.time_scale)
        controls_layout.addLayout(following)
        self.customer_stop = QPushButton("顧客停留")
        self.customer_stop.setCheckable(True)
        self.customer_stop.toggled.connect(simulation.set_customer_stopped)
        controls_layout.addWidget(self.customer_stop)
        self.motion_reason = label("", "muted", True)
        controls_layout.addWidget(self.motion_reason)
        controls_layout.addWidget(label("感測半徑 4 m｜深色：已發現｜淺色：未發現｜金框：記憶位置", "muted", True))
        person_controls = QHBoxLayout()
        self.person_start = QLineEdit("4, 8")
        self.person_goal = QLineEdit("6, 8")
        self.person_start.setAccessibleName("行人起點")
        self.person_goal.setAccessibleName("行人終點")
        self.person_start.setPlaceholderText("起點 x,y")
        self.person_goal.setPlaceholderText("終點 x,y")
        person_controls.addWidget(self.person_start)
        person_controls.addWidget(label("→"))
        person_controls.addWidget(self.person_goal)
        controls_layout.addLayout(person_controls)
        person_actions = QHBoxLayout()
        self.add_person = QPushButton("新增行人")
        self.add_person.clicked.connect(self._add_pedestrian)
        self.clear_people = QPushButton("清除行人")
        self.clear_people.clicked.connect(simulation.clear_pedestrians)
        person_actions.addWidget(self.add_person)
        person_actions.addWidget(self.clear_people)
        controls_layout.addLayout(person_actions)
        self.edit_obstacles = QCheckBox("障礙物編輯：點擊空白格新增／移除")
        self.edit_obstacles.toggled.connect(self._set_edit_mode)
        controls_layout.addWidget(self.edit_obstacles)
        release = QHBoxLayout()
        self.occupied_tables = QComboBox()
        self.occupied_tables.setPlaceholderText("尚無占用餐桌")
        release.addWidget(self.occupied_tables, 1)
        self.release_button = QPushButton("釋放餐桌")
        self.release_button.clicked.connect(self._release)
        release.addWidget(self.release_button)
        controls_layout.addLayout(release)
        self.table_summary = label("", "muted", True)
        controls_layout.addWidget(self.table_summary)
        side.addWidget(controls)

        queue, queue_layout = card("等待隊伍")
        self.waiting_list = QListWidget()
        self.waiting_list.setMinimumHeight(70)
        self.waiting_list.setMaximumHeight(130)
        self.waiting_list.setWordWrap(True)
        self.waiting_list.itemSelectionChanged.connect(self._update_resume_button)
        queue_layout.addWidget(self.waiting_list)
        self.resume_button = QPushButton("接待選取的等待顧客／修改需求")
        self.resume_button.clicked.connect(self._resume)
        queue_layout.addWidget(self.resume_button)
        side.addWidget(queue)

        settings, settings_layout = card("模型")
        self.ollama_model = ModelComboBox()
        self.ollama_model.setPlaceholderText("正在載入模型…")
        self.ollama_model.setToolTip("模型名稱")
        self.ollama_model.opened.connect(self._load_models)
        self.ollama_model.closed.connect(self.refresh)
        self.ollama_model.currentTextChanged.connect(self._model_selected)
        settings_layout.addWidget(self.ollama_model)
        self.model_status = label("", "muted", True)
        settings_layout.addWidget(self.model_status)
        side.addWidget(settings)
        side.addStretch()
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setMinimumWidth(360)
        scroll.setMaximumWidth(440)
        scroll.setWidget(sidebar)
        content.addWidget(scroll)
        layout.addLayout(content, 1)
        self.events = QPlainTextEdit()
        self.events.setReadOnly(True)
        self.events.setFixedHeight(88)
        self.events.setPlaceholderText("事件紀錄")
        layout.addWidget(self.events)
        self.statusBar().setSizeGripEnabled(False)

        simulation.changed.connect(self.refresh)
        simulation.message.connect(self._message)
        simulation.conversation_reset.connect(self._clear_conversation)
        simulation.alternatives_offered.connect(self._show_alternatives)
        simulation.request_finished.connect(self._request_finished)
        simulation.ai.idle.connect(self._close_if_pending)
        for message in simulation.history:
            self._message("顧客" if message["role"] == "user" else "接待", message["content"])
        self.refresh()
        QTimer.singleShot(0, self._load_models)

    @Slot()
    def _load_models(self) -> None:
        if self.close_pending or self.model_worker is not None or self.simulation.ai.busy:
            return
        self.model_status.setText("正在更新模型清單…")
        self.model_worker = ModelListThread(self)
        self.model_worker.finished.connect(self._models_loaded)
        self.model_worker.start()

    @Slot()
    def _models_loaded(self) -> None:
        worker = self.model_worker
        self.model_worker = None
        if worker is not None:
            if worker.models is not None:
                self.pending_models = worker.models
                self.model_status.setText("" if worker.models else "Ollama 沒有可用模型。")
            else:
                self.model_status.setText(worker.error)
                self.ollama_model.setPlaceholderText("無法取得模型")
            worker.deleteLater()
        self.refresh()
        self._close_if_pending()

    def _model_selected(self, model: str) -> None:
        if model:
            self.preferred_model = model
        self.refresh()

    def _apply_models(self) -> None:
        if self.pending_models is None or self.ollama_model.popup_open or self.simulation.ai.busy:
            return
        models, self.pending_models = self.pending_models, None
        previous = self.ollama_model.currentText() or self.preferred_model
        existing = [self.ollama_model.itemText(i) for i in range(self.ollama_model.count())]
        if models != existing:
            self.ollama_model.blockSignals(True)
            self.ollama_model.clear()
            self.ollama_model.addItems(models)
            self.ollama_model.setCurrentIndex(models.index(previous) if previous in models else -1)
            self.ollama_model.blockSignals(False)
        self.ollama_model.setPlaceholderText("請選擇模型" if models else "無可用模型")

    def _send(self) -> None:
        if self.ollama_model.currentIndex() >= 0:
            self.simulation.submit(self.customer_input.text(), DEFAULT_URL, self.ollama_model.currentText())

    def _retry(self) -> None:
        if self.ollama_model.currentIndex() >= 0:
            self.simulation.submit(self.simulation.pending_text, DEFAULT_URL, self.ollama_model.currentText())

    def _request_finished(self, succeeded: bool) -> None:
        if succeeded:
            self.customer_input.clear()

    def _clear_conversation(self) -> None:
        self.conversation.clear()
        self.customer_input.clear()

    def _message(self, speaker: str, text: str) -> None:
        self.conversation.append(f"<b>{escape(speaker)}</b>：{escape(text).replace(chr(10), '<br>')}")
        bar = self.conversation.verticalScrollBar()
        bar.setValue(bar.maximum())

    def _set_edit_mode(self, enabled: bool) -> None:
        self.canvas.editing_obstacles = enabled
        self.canvas.setCursor(Qt.CursorShape.CrossCursor if enabled else Qt.CursorShape.ArrowCursor)

    def _add_pedestrian(self) -> None:
        try:
            start = tuple(int(value.strip()) for value in self.person_start.text().split(","))
            goal = tuple(int(value.strip()) for value in self.person_goal.text().split(","))
            if len(start) != 2 or len(goal) != 2:
                raise ValueError
        except ValueError:
            self.simulation.log("行人座標請使用 x,y 格式，例如 4,8。")
            self.simulation.changed.emit()
            return
        self.simulation.add_pedestrian(start, goal)

    def _release(self) -> None:
        if self.occupied_tables.currentText():
            self.simulation.release_table(self.occupied_tables.currentText())

    def _resume(self) -> None:
        item = self.waiting_list.currentItem()
        if item is not None:
            self.simulation.resume_waiting(item.data(Qt.ItemDataRole.UserRole))

    def _update_resume_button(self) -> None:
        self.resume_button.setEnabled(self.simulation.phase == IDLE and self.waiting_list.currentItem() is not None)

    def refresh(self) -> None:
        self._apply_models()
        simulation, group = self.simulation, self.simulation.group
        self.canvas.update()
        state = simulation.phase + (" · 已暫停移動" if simulation.paused else "")
        self.motion_reason.setText(simulation.wait_reason or "依目前感測資訊行動。")
        following = group is not None and simulation.robot.task == "帶位中"
        self.customer_stop.setEnabled(following)
        self.customer_stop.blockSignals(True)
        self.customer_stop.setChecked(bool(group and group.stopped))
        self.customer_stop.setText("恢復跟隨" if group and group.stopped else "顧客停留")
        self.customer_stop.blockSignals(False)
        self.badge.setText(state)
        target = f"，目標 {simulation.robot.goal}" if simulation.robot.goal is not None else ""
        x, y = simulation.robot.visual_position
        self.statusBar().showMessage(f"{state}｜機器人 ({x:.2f}, {y:.2f}){target}")
        self.current_group.setText(f"第 {group.number} 組｜{group.requirements.summary()}" if group else "入口待命，請新增顧客。")
        if group is not None and group.allocations:
            self.current_group.setText(self.current_group.text() + f"\n尚未入座：{group.remaining_people} 位")
        self.customer_input.setEnabled(simulation.can_chat)
        has_model = self.ollama_model.currentIndex() >= 0
        self.send_button.setEnabled(simulation.can_chat and has_model)
        self.retry_button.setEnabled(simulation.can_chat and has_model and bool(simulation.last_error))
        self.new_button.setEnabled(simulation.phase == IDLE and group is None)
        self.confirm_button.setEnabled(simulation.phase == CONFIRMING and simulation.proposed is not None)
        self.wait_button.setEnabled(simulation.can_wait)
        self.end_button.setEnabled(simulation.can_end)
        self.ollama_model.setEnabled(not simulation.ai.busy and not simulation.traveling)
        self.pause_button.setText("繼續移動" if simulation.paused else "暫停移動")
        if simulation.proposed:
            self.seat_info.setText(simulation.proposed.reason)
        elif group and group.allocations:
            self.seat_info.setText("\n".join(
                item.summary + (" · 已入座" if index < group.next_stop else " · 保留")
                for index, item in enumerate(group.allocations)
            ))
        elif simulation.alternatives:
            self.seat_info.setText("等待選擇替代餐桌或繼續等候。")
        else:
            self.seat_info.setText("尚未確認餐桌。\n請先輸入完整用餐需求。")

        restaurant = simulation.restaurant
        self.table_summary.setText(" / ".join(f"{status} {sum(table.status == status for table in restaurant.tables)} 桌"
                                             for status in (FREE, RESERVED, OCCUPIED)))
        occupied = [table.name for table in restaurant.tables if table.status == OCCUPIED]
        previous_names = [self.occupied_tables.itemText(i) for i in range(self.occupied_tables.count())]
        if occupied != previous_names:
            selected = self.occupied_tables.currentText()
            self.occupied_tables.clear()
            self.occupied_tables.addItems(occupied)
            if selected in occupied:
                self.occupied_tables.setCurrentText(selected)
        self.release_button.setEnabled(bool(occupied))
        waiting = tuple((item.number, item.requirements.summary(), item.waiting_reason) for item in simulation.waiting)
        if waiting != self.waiting_snapshot:
            selected = self.waiting_list.currentItem()
            selected_number = selected.data(Qt.ItemDataRole.UserRole) if selected is not None else None
            self.waiting_list.clear()
            for number, summary, reason in waiting:
                item = QListWidgetItem(f"● 第 {number} 組｜{summary}\n{reason}")
                item.setData(Qt.ItemDataRole.UserRole, number)
                self.waiting_list.addItem(item)
                if number == selected_number:
                    self.waiting_list.setCurrentItem(item)
            self.waiting_snapshot = waiting
        self._update_resume_button()
        events = tuple(simulation.events)
        if events != self.events_snapshot:
            self.events.setPlainText("\n".join(events))
            self.events.verticalScrollBar().setValue(self.events.verticalScrollBar().maximum())
            self.events_snapshot = events

    def _show_alternatives(self, candidates: list[Candidate]) -> None:
        if self.close_pending:
            return
        dialog = QDialog(self)
        self.alternative_dialog = dialog
        dialog.setWindowTitle("替代座位")
        dialog.resize(580, 420)
        layout = QVBoxLayout(dialog)
        layout.addWidget(label("是否接受下列替代位置？", wrap=True))
        choices = QListWidget()
        choices.setWordWrap(True)
        for candidate in candidates:
            placement = "分散桌位" if candidate.scattered else "同列相鄰" if len(candidate.allocations) > 1 else "單桌"
            details = "\n".join((candidate.reason, placement, *candidate.misses))
            item = QListWidgetItem(details)
            item.setData(Qt.ItemDataRole.UserRole, candidate.key)
            choices.addItem(item)
        choices.setCurrentRow(0)
        layout.addWidget(choices)
        actions = QHBoxLayout()
        accept = QPushButton("接受選取位置")
        wait = QPushButton("繼續等待")
        actions.addWidget(accept)
        actions.addWidget(wait)
        layout.addLayout(actions)

        def choose() -> None:
            item = choices.currentItem()
            if item is not None:
                dialog.accept()
                self.simulation.choose_alternative(item.data(Qt.ItemDataRole.UserRole))

        def finished(result: int) -> None:
            self.alternative_dialog = None
            if result == QDialog.DialogCode.Rejected:
                self.simulation.wait_current()
            dialog.deleteLater()

        accept.clicked.connect(choose)
        wait.clicked.connect(dialog.reject)
        dialog.finished.connect(finished)
        # open() is asynchronous: Qt keeps processing repaint/timer events.
        dialog.open()

    def closeEvent(self, event: QCloseEvent) -> None:
        if self.simulation.ai.busy or self.model_worker is not None:
            self.close_pending = True
            self.simulation.timer.stop()
            self.setEnabled(False)
            self.statusBar().showMessage("等待目前 Ollama 請求結束後關閉視窗…")
            event.ignore()
        else:
            self.simulation.timer.stop()
            event.accept()

    def _close_if_pending(self) -> None:
        if self.close_pending:
            self.close()
