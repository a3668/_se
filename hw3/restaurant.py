"""Restaurant geometry and mutable simulation data (no GUI dependencies)."""

from __future__ import annotations

from dataclasses import dataclass, field

Cell = tuple[int, int]
FREE, RESERVED, OCCUPIED = "空閒", "保留", "占用"
ROW_SPECS = (("A", 0, 4, 4), ("B", 7, 6, 6), ("C", 14, 4, 13))


@dataclass
class Table:
    name: str
    capacity: int
    x: int
    y: int
    goal: Cell
    width: int = 4
    height: int = 3
    window_side: bool = False
    status: str = FREE

    @property
    def occupied_cells(self) -> frozenset[Cell]:
        return frozenset(
            (x, y)
            for x in range(self.x, self.x + self.width)
            for y in range(self.y, self.y + self.height)
        )


@dataclass
class Requirements:
    party_size: int | None = None
    window_preference: bool | None = None
    window_required: bool = False
    table_name: str | None = None
    table_required: bool = False
    allow_split: bool | None = None
    other_requirements: list[str] = field(default_factory=list)
    question: str = ""

    @property
    def ready(self) -> bool:
        return self.party_size is not None and not self.other_requirements and not self.question

    def summary(self) -> str:
        parts = [f"{self.party_size} 人" if self.party_size else "人數待確認"]
        if self.window_preference is not None:
            window = "靠窗" if self.window_preference else "非靠窗"
            parts.append(("必須" if self.window_required else "偏好") + window)
        if self.table_name:
            parts.append(("須包含" if self.table_required else "偏好包含") + self.table_name)
        if self.allow_split is False:
            parts.append("不接受分桌")
        elif self.allow_split is True:
            parts.append("可分桌")
        parts.extend(self.other_requirements)
        return "、".join(parts)


@dataclass(frozen=True)
class TableAllocation:
    table_name: str
    people: int
    capacity: int

    @property
    def summary(self) -> str:
        return f"{self.table_name}｜{self.people} 人／{self.capacity} 人桌"


@dataclass
class CustomerGroup:
    number: int
    requirements: Requirements = field(default_factory=Requirements)
    position: Cell | None = (8, 1)
    status: str = "接待中"
    waiting_reason: str = ""
    allocations: tuple[TableAllocation, ...] = ()
    next_stop: int = 0
    remaining_people: int = 0
    declined_plans: set[str] = field(default_factory=set)


@dataclass
class Robot:
    position: Cell = (8, 2)
    goal: Cell | None = None
    route: list[Cell] = field(default_factory=list)
    task: str = ""


@dataclass
class RestaurantMap:
    width: int = 18
    height: int = 34
    cell_metres: int = 1
    robot_start: Cell = (8, 2)
    customer_start: Cell = (8, 1)
    entrance_x: tuple[int, int] = (7, 11)
    aisle_ranges: tuple[tuple[int, int], ...] = ((4, 6), (11, 13))
    lower_open_rows: tuple[int, int] = (0, 3)
    upper_passage_rows: tuple[int, int] = (31, 33)
    tables: list[Table] = field(default_factory=list)
    obstacles: set[Cell] = field(default_factory=set)

    @property
    def table_cells(self) -> frozenset[Cell]:
        return frozenset(cell for table in self.tables for cell in table.occupied_cells)

    @property
    def blocked_cells(self) -> frozenset[Cell]:
        return self.table_cells | self.obstacles

    def contains(self, cell: Cell) -> bool:
        return 0 <= cell[0] < self.width and 0 <= cell[1] < self.height

    def table(self, name: str) -> Table:
        return next(table for table in self.tables if table.name == name)


def create_restaurant() -> RestaurantMap:
    return RestaurantMap(tables=[
        Table(
            name=f"{row}{k + 1}", capacity=capacity, x=x, y=4 + 4 * k,
            goal=(goal_x, 5 + 4 * k), window_side=row == "A",
        )
        for row, x, capacity, goal_x in ROW_SPECS
        for k in range(7)
    ])
