"""Static restaurant preview. Run with: python hw3/preview.py."""

from __future__ import annotations

import sys
from dataclasses import dataclass

from PySide6.QtCore import QPointF, QRectF, Qt
from PySide6.QtGui import QColor, QFont, QPainter, QPaintEvent, QPen
from PySide6.QtWidgets import (
    QApplication,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QPushButton,
    QScrollArea,
    QSizePolicy,
    QVBoxLayout,
    QWidget,
)


Cell = tuple[int, int]


@dataclass(frozen=True)
class Table:
    name: str
    capacity: int
    x: int
    y: int
    width: int
    height: int
    goal: Cell
    window_side: bool = False
    status: str = "空閒"

    @property
    def occupied_cells(self) -> frozenset[Cell]:
        """The entire rectangle blocks navigation, including its visual padding."""
        return frozenset(
            (x, y)
            for x in range(self.x, self.x + self.width)
            for y in range(self.y, self.y + self.height)
        )


@dataclass(frozen=True)
class RestaurantMap:
    width: int
    height: int
    cell_metres: int
    tables: tuple[Table, ...]
    robot_start: Cell
    entrance_x: tuple[int, int]  # Cell boundaries; right boundary is exclusive.
    aisle_ranges: tuple[tuple[int, int], ...]  # Inclusive cell indices.
    lower_open_rows: tuple[int, int]
    upper_passage_rows: tuple[int, int]

    @property
    def blocked_cells(self) -> frozenset[Cell]:
        return frozenset(cell for table in self.tables for cell in table.occupied_cells)

    @property
    def walkable_cells(self) -> frozenset[Cell]:
        blocked = self.blocked_cells
        return frozenset(
            (x, y)
            for x in range(self.width)
            for y in range(self.height)
            if (x, y) not in blocked
        )


# All geometry is defined in grid coordinates with the origin at bottom left.
ROW_SPECS = (("A", 0, 4, 4), ("B", 7, 6, 6), ("C", 14, 4, 13))
MAP = RestaurantMap(
    width=18,
    height=34,
    cell_metres=1,
    tables=tuple(
        Table(
            name=f"{row}{k + 1}",
            capacity=capacity,
            x=x,
            y=4 + 4 * k,
            width=4,
            height=3,
            goal=(goal_x, 5 + 4 * k),
            window_side=row == "A",
        )
        for row, x, capacity, goal_x in ROW_SPECS
        for k in range(7)
    ),
    robot_start=(8, 2),
    entrance_x=(7, 11),
    aisle_ranges=((4, 6), (11, 13)),
    lower_open_rows=(0, 3),
    upper_passage_rows=(31, 33),
)

COLORS = {
    "floor": "#faf9f5",
    "aisle": "#eef3f5",
    "open": "#edf5f1",
    "grid": "#e1e5e3",
    "wall": "#596b69",
    "text": "#223b36",
    "muted": "#6b7d78",
    "four": "#d7eae0",
    "six": "#c5ddd9",
    "table_edge": "#7baba0",
    "goal": "#c28a29",
    "robot": "#23736a",
    "window": "#62aaca",
}


class MapCanvas(QWidget):
    def __init__(self, restaurant: RestaurantMap) -> None:
        super().__init__()
        self.restaurant = restaurant
        self.setMinimumSize(300, 480)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)

    def paintEvent(self, event: QPaintEvent) -> None:
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        restaurant = self.restaurant
        area = QRectF(self.rect()).adjusted(44, 30, -18, -44)
        scale = min(area.width() / restaurant.width, area.height() / restaurant.height)
        floor = QRectF(
            area.center().x() - restaurant.width * scale / 2,
            area.center().y() - restaurant.height * scale / 2,
            restaurant.width * scale,
            restaurant.height * scale,
        )

        def rect(x: float, y: float, width: float = 1, height: float = 1) -> QRectF:
            return QRectF(
                floor.left() + x * scale,
                floor.bottom() - (y + height) * scale,
                width * scale,
                height * scale,
            )

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
            inset = scale * 0.10
            painter.setPen(QPen(QColor(COLORS["table_edge"]), 1))
            painter.setBrush(QColor(COLORS["four"] if table.capacity == 4 else COLORS["six"]))
            painter.drawRoundedRect(box.adjusted(inset, inset, -inset, -inset), 5, 5)
            text(box.adjusted(0, scale * 0.32, 0, -scale * 1.2), table.name, table_font, COLORS["text"], True)
            text(box.adjusted(0, scale * 1.5, 0, -scale * 0.35), f"{table.capacity} 人 · {table.status}", table_font * 0.73, COLORS["muted"])

            center = rect(*table.goal).center()
            painter.setPen(QPen(QColor(COLORS["goal"]), 1.4))
            painter.setBrush(QColor("#fff5d9"))
            painter.drawEllipse(center, scale * 0.22, scale * 0.22)
            painter.setBrush(QColor(COLORS["goal"]))
            painter.drawEllipse(center, scale * 0.07, scale * 0.07)

        # Boundary walls leave a real opening at the entrance.
        painter.setPen(QPen(QColor(COLORS["wall"]), 2))
        painter.drawLine(floor.topLeft(), floor.topRight())
        painter.drawLine(floor.topRight(), floor.bottomRight())
        painter.drawLine(floor.bottomLeft(), floor.topLeft())
        entrance_left, entrance_right = restaurant.entrance_x
        painter.drawLine(point(0, 0), point(entrance_left, 0))
        painter.drawLine(point(entrance_right, 0), point(restaurant.width, 0))
        painter.setPen(QPen(QColor(COLORS["robot"]), 3))
        painter.drawLine(point(entrance_left, 0), point(entrance_right, 0))

        # The blue strip lies outside the grid so it cannot cover table A.
        painter.setPen(QPen(QColor(COLORS["window"]), 4))
        painter.drawLine(floor.topLeft() + QPointF(-7, 0), floor.bottomLeft() + QPointF(-7, 0))

        axis_font = min(8.0, scale * 0.45)
        for x in range(restaurant.width):
            text(QRectF(floor.left() + x * scale, floor.bottom() + 3, scale, 16), str(x), axis_font, COLORS["muted"])
        for y in range(restaurant.height):
            cell = rect(0, y)
            text(QRectF(floor.left() - 31, cell.top(), 19, scale), str(y), axis_font, COLORS["muted"])

        for row, x, _, _ in ROW_SPECS:
            text(QRectF(floor.left() + x * scale, floor.top() - 25, 4 * scale, 20), f"{row} 列", 10, COLORS["text"], True)
        text(rect(0, 31, 18, 3), "上方連通通道", table_font * 0.8, COLORS["muted"])
        text(rect(5, 0, 8, 1.2), "入口 / 接待區", table_font * 0.8, COLORS["robot"], True)

        robot = rect(*restaurant.robot_start)
        painter.setPen(QPen(QColor("#ffffff"), 1.5))
        painter.setBrush(QColor(COLORS["robot"]))
        painter.drawEllipse(robot.center(), scale * 0.48, scale * 0.48)
        text(robot, "R", table_font * 0.8, "#ffffff", True)
        text(QRectF(floor.left(), floor.bottom() + 22, floor.width(), 18), "左下角 (0,0)  ·  x 向右 / y 向上  ·  每格 1 m", 9, COLORS["muted"])
        painter.end()


def label(value: str, role: str = "", wrap: bool = False) -> QLabel:
    widget = QLabel(value)
    widget.setWordWrap(wrap)
    if role:
        widget.setProperty("role", role)
    return widget


def card(title: str) -> tuple[QFrame, QVBoxLayout]:
    frame = QFrame()
    frame.setObjectName("card")
    layout = QVBoxLayout(frame)
    layout.setContentsMargins(18, 16, 18, 16)
    layout.setSpacing(12)
    layout.addWidget(label(title, "section"))
    return frame, layout


class PreviewWindow(QMainWindow):
    def __init__(self, restaurant: RestaurantMap) -> None:
        super().__init__()
        self.setWindowTitle("餐廳帶位機器人｜靜態 GUI 預覽")
        self.resize(1040, 920)
        self.setMinimumSize(760, 640)
        root = QWidget()
        self.setCentralWidget(root)
        layout = QVBoxLayout(root)
        layout.setContentsMargins(24, 20, 24, 12)
        layout.setSpacing(16)

        header = QHBoxLayout()
        titles = QVBoxLayout()
        titles.addWidget(label("餐廳帶位機器人", "title"))
        titles.addWidget(label("18 × 34 公尺  /  單一機器人  /  固定餐廳配置", "muted"))
        header.addLayout(titles)
        header.addStretch()
        header.addWidget(label("靜態預覽", "badge"))
        layout.addLayout(header)

        content = QHBoxLayout()
        content.setSpacing(18)
        map_frame, map_layout = card("餐廳平面圖")
        map_layout.setContentsMargins(14, 14, 14, 8)
        map_layout.addWidget(MapCanvas(restaurant), 1)
        content.addWidget(map_frame, 1)

        sidebar = QWidget()
        sidebar_layout = QVBoxLayout(sidebar)
        sidebar_layout.setContentsMargins(0, 0, 0, 0)
        sidebar_layout.setSpacing(14)

        summary, summary_layout = card("桌位總覽")
        metrics = QGridLayout()
        for column, (value, caption) in enumerate((
            (str(len(restaurant.tables)), "餐桌"),
            (str(sum(table.capacity for table in restaurant.tables)), "座位"),
            ("1", "機器人"),
        )):
            metrics.addWidget(label(value, "metric"), 0, column)
            metrics.addWidget(label(caption, "muted"), 1, column)
        summary_layout.addLayout(metrics)
        summary_layout.addWidget(label("A / C 列：四人桌，各 7 張\nB 列：六人桌，共 7 張\n所有餐桌目前空閒；A 列靠窗。", wrap=True))
        sidebar_layout.addWidget(summary)

        legend, legend_layout = card("地圖圖例")
        for symbol, caption, color in (
            ("■", "四人桌 · 空閒", COLORS["table_edge"]),
            ("■", "六人桌 · 空閒", "#4e837b"),
            ("◎", "桌旁導航目標點", COLORS["goal"]),
            ("●", "機器人 R · (8,2)", COLORS["robot"]),
            ("┃", "左側整排窗戶", COLORS["window"]),
        ):
            row = QHBoxLayout()
            swatch = label(symbol)
            swatch.setFixedWidth(22)
            swatch.setStyleSheet(f"color: {color}; font-size: 18px;")
            row.addWidget(swatch)
            row.addWidget(label(caption), 1)
            legend_layout.addLayout(row)
        sidebar_layout.addWidget(legend)

        reception, reception_layout = card("顧客接待 · 尚未啟用")
        reception_layout.addWidget(label("後續加入 Ollama 需求分析；本次僅呈現介面配置。", "muted", True))
        customer_input = QLineEdit()
        customer_input.setPlaceholderText("例如：我們四位，希望靠窗")
        customer_input.setEnabled(False)
        reception_layout.addWidget(customer_input)
        confirm = QPushButton("確認座位並帶位（尚未啟用）")
        confirm.setEnabled(False)
        reception_layout.addWidget(confirm)
        sidebar_layout.addWidget(reception)

        seating, seating_layout = card("座位資訊 · 尚未啟用")
        seating_layout.addWidget(label("顧客人數：—\n座位需求：—\n建議餐桌：—\n等待隊伍：尚未啟用", wrap=True))
        sidebar_layout.addWidget(seating)
        sidebar_layout.addStretch()

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setMinimumWidth(300)
        scroll.setMaximumWidth(340)
        scroll.setWidget(sidebar)
        content.addWidget(scroll)
        layout.addLayout(content, 1)
        self.statusBar().setSizeGripEnabled(False)
        self.statusBar().showMessage("靜態預覽・機器人在入口待命")


STYLESHEET = """
QMainWindow, QScrollArea, QScrollArea > QWidget > QWidget { background: #f2f5f3; }
QWidget { color: #223b36; font-size: 13px; }
QFrame#card { background: #ffffff; border: 1px solid #dce5df; border-radius: 12px; }
QLabel { background: transparent; border: none; }
QLabel[role="title"] { font-size: 25px; font-weight: 700; }
QLabel[role="section"] { font-size: 14px; font-weight: 600; }
QLabel[role="muted"] { color: #6b7d78; font-size: 12px; }
QLabel[role="metric"] { color: #23736a; font-size: 30px; font-weight: 700; }
QLabel[role="badge"] { color: #23736a; background: #e0eee7; padding: 7px 12px; border-radius: 10px; }
QLineEdit, QPushButton { padding: 10px 8px; border: 1px solid #dde4df; border-radius: 7px; }
QLineEdit:disabled, QPushButton:disabled { color: #84918b; background: #f1f4f2; }
QStatusBar { background: #e5ede7; color: #45665a; padding: 4px 16px; }
"""


def main() -> int:
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    app.setStyleSheet(STYLESHEET)
    window = PreviewWindow(MAP)
    screen = app.primaryScreen()
    if screen is not None:
        available = screen.availableGeometry()
        window.resize(min(1040, available.width()), min(920, available.height()))
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
