"""Whole-party seating plans with bounded, capacity-pruned combination search."""

from __future__ import annotations

from dataclasses import dataclass
from itertools import product
from typing import Iterator

from navigation import astar
from restaurant import FREE, Cell, Requirements, RestaurantMap, Table, TableAllocation

MAX_ALTERNATIVES = 5


@dataclass(frozen=True)
class Candidate:
    allocations: tuple[TableAllocation, ...]  # In actual visiting order.
    paths: tuple[tuple[Cell, ...], ...]
    misses: tuple[str, ...]
    scattered: bool

    @property
    def table_names(self) -> tuple[str, ...]:
        return tuple(item.table_name for item in self.allocations)

    @property
    def key(self) -> str:
        return ",".join(sorted(self.table_names))

    @property
    def path(self) -> tuple[Cell, ...]:
        return self.paths[0] + tuple(cell for path in self.paths[1:] for cell in path[1:])

    @property
    def reason(self) -> str:
        return "\n".join(item.summary for item in self.allocations)

    @property
    def requires_consent(self) -> bool:
        return bool(self.misses or self.scattered)

    @property
    def differences(self) -> tuple[str, ...]:
        return self.misses + (("桌位分散，未安排在同列連續桌位",) if self.scattered else ())

    @property
    def offer(self) -> str:
        names = "、".join(self.table_names)
        if len(self.allocations) == 1:
            return f"為您安排 {names} 桌，可以嗎？"
        return f"為您安排 {names}，分 {len(self.allocations)} 桌可以嗎？"


def _hard_tables(restaurant: RestaurantMap, requirements: Requirements) -> list[Table]:
    return [table for table in restaurant.tables
            if not requirements.window_required or table.window_side == requirements.window_preference]


def capacity_problem(restaurant: RestaurantMap, requirements: Requirements) -> str | None:
    """Permanent capacity only: occupancy and removable obstacles do not count."""
    size = requirements.party_size
    if size is None:
        return None
    total = sum(table.capacity for table in restaurant.tables)
    if size > total:
        return f"餐廳總共只有 {total} 席，無法安排 {size} 位。"
    tables = _hard_tables(restaurant, requirements)
    if requirements.table_required and not any(table.name == requirements.table_name for table in tables):
        return "指定桌號與必要座位條件無法同時滿足，請修改需求。"
    if requirements.allow_split is False:
        if requirements.table_required:
            tables = [table for table in tables if table.name == requirements.table_name]
        maximum = max((table.capacity for table in tables), default=0)
        if size > maximum:
            return f"符合必要條件的單桌最多容納 {maximum} 位，需要接受分桌才能安排 {size} 位。"
    elif size > sum(table.capacity for table in tables):
        return "符合必要座位條件的總席位不足，請修改需求。"
    return None


def _adjacent(tables: tuple[Table, ...]) -> bool:
    ordered = sorted(tables, key=lambda table: table.name)
    return all(left.name[0] == right.name[0] and int(right.name[1:]) == int(left.name[1:]) + 1
               for left, right in zip(ordered, ordered[1:]))


def _misses(tables: tuple[Table, ...], requirements: Requirements) -> tuple[str, ...]:
    misses = []
    if requirements.window_preference is not None:
        wrong = [table.name for table in tables if table.window_side != requirements.window_preference]
        if wrong:
            location = "靠窗" if requirements.window_preference else "非靠窗"
            misses.append(f"{location}偏好無法全部滿足：{'、'.join(wrong)}")
    if requirements.table_name and not any(table.name == requirements.table_name for table in tables):
        misses.append(f"未包含指定的 {requirements.table_name}")
    return tuple(misses)


class _Planner:
    """Cache A* segments for one unchanged map while comparing combinations."""

    def __init__(self, restaurant: RestaurantMap, requirements: Requirements) -> None:
        self.restaurant = restaurant
        self.requirements = requirements
        self.cache: dict[tuple[Cell, Cell], tuple[Cell, ...] | None] = {}

    def route(self, start: Cell, goal: Cell) -> tuple[Cell, ...] | None:
        key = (start, goal)
        if key not in self.cache:
            path = astar(self.restaurant, start, goal, self.restaurant.known_blocked_cells)
            self.cache[key] = tuple(path) if path is not None else None
            self.cache[(goal, start)] = tuple(reversed(path)) if path is not None else None
        return self.cache[key]

    def build(self, tables: tuple[Table, ...]) -> Candidate | None:
        size = self.requirements.party_size
        if size is None or not tables or len(tables) > size or sum(table.capacity for table in tables) < size:
            return None
        counts = {table.name: 1 for table in tables}
        for _ in range(size - len(tables)):
            target = min((table for table in tables if counts[table.name] < table.capacity),
                         key=lambda table: (counts[table.name], table.name))
            counts[target.name] += 1
        remaining = list(tables)
        current = self.restaurant.robot_start
        allocations, paths = [], []
        while remaining:
            options = []
            for table in remaining:
                path = self.route(current, table.goal)
                if path is not None:
                    options.append((len(path), table.name, table, path))
            if not options:
                return None
            _, _, table, path = min(options, key=lambda option: (option[0], option[1]))
            allocations.append(TableAllocation(table.name, counts[table.name], table.capacity))
            paths.append(path)
            current = table.goal
            remaining.remove(table)
        return Candidate(tuple(allocations), tuple(paths), _misses(tables, self.requirements), not _adjacent(tables))


def _combinations(tables: list[Table], count: int, size: int, required: str | None) -> Iterator[tuple[Table, ...]]:
    """Fixed-size search; tables are sorted by descending capacity for pruning."""
    prefix = [0]
    for table in tables:
        prefix.append(prefix[-1] + table.capacity)
    required_index = next((i for i, table in enumerate(tables) if table.name == required), None)

    def search(start: int, chosen: tuple[Table, ...], capacity: int, has_required: bool) -> Iterator[tuple[Table, ...]]:
        slots = count - len(chosen)
        if slots == 0:
            if capacity >= size and has_required:
                yield chosen
            return
        if len(tables) - start < slots or capacity + prefix[start + slots] - prefix[start] < size:
            return
        if not has_required and (required_index is None or required_index < start):
            return
        for i in range(start, len(tables) - slots + 1):
            table = tables[i]
            yield from search(i + 1, (*chosen, table), capacity + table.capacity,
                              has_required or table.name == required)

    yield from search(0, (), 0, required is None)


def _modes(tables: list[Table], requirements: Requirements, miss_count: int) -> Iterator[tuple[list[Table], str | None]]:
    soft_window = requirements.window_preference is not None and not requirements.window_required
    soft_table = requirements.table_name is not None and not requirements.table_required
    for relax_window, relax_table in product((False, True) if soft_window else (False,),
                                            (False, True) if soft_table else (False,)):
        if int(relax_window) + int(relax_table) != miss_count:
            continue
        pool = [table for table in tables
                if requirements.window_preference is None or relax_window
                or table.window_side == requirements.window_preference]
        required = requirements.table_name if not relax_table else None
        if required is None or any(table.name == required for table in pool):
            yield sorted(pool, key=lambda table: (-table.capacity, table.name)), required


def rank_tables(restaurant: RestaurantMap, requirements: Requirements,
                excluded: set[str] | None = None) -> list[Candidate]:
    if not requirements.ready or capacity_problem(restaurant, requirements):
        return []
    size = requirements.party_size
    if size is None:
        return []
    planner = _Planner(restaurant, requirements)
    available = [table for table in _hard_tables(restaurant, requirements)
                 if table.status == FREE and planner.route(restaurant.robot_start, table.goal) is not None]
    if sum(table.capacity for table in available) < size:
        return []
    max_count = min(len(available), size) if requirements.allow_split is not False else 1
    # Preference matches outrank adjacency; within each class minimize table count.
    for miss_count in range(3):
        modes = list(_modes(available, requirements, miss_count))
        for scattered in (False, True):
            for count in range(1, max_count + 1):
                best: list[tuple[tuple, Candidate]] = []
                seen: set[str] = set()
                for pool, required in modes:
                    if len(pool) < count or sum(table.capacity for table in pool[:count]) < size:
                        continue
                    if scattered:
                        combinations = _combinations(pool, count, size, required)
                    else:
                        ordered = sorted(pool, key=lambda table: table.name)
                        combinations = (tuple(ordered[i:i + count]) for i in range(len(ordered) - count + 1))
                    for tables in combinations:
                        if (not _adjacent(tables)) != scattered or sum(table.capacity for table in tables) < size:
                            continue
                        if required and not any(table.name == required for table in tables):
                            continue
                        if len(_misses(tables, requirements)) != miss_count:
                            continue
                        names = ",".join(sorted(table.name for table in tables))
                        if excluded and names in excluded:
                            continue
                        if names in seen:
                            continue
                        seen.add(names)
                        waste = sum(table.capacity for table in tables) - size
                        if len(best) == MAX_ALTERNATIVES and waste > best[-1][0][0]:
                            continue
                        candidate = planner.build(tables)
                        if candidate is None:
                            continue
                        score = (waste, sum(len(path) - 1 for path in candidate.paths), names)
                        best.append((score, candidate))
                        best.sort(key=lambda item: item[0])
                        del best[MAX_ALTERNATIVES:]
                if best:
                    return [candidate for _, candidate in best]
    return []


def revalidate_plan(restaurant: RestaurantMap, requirements: Requirements, candidate: Candidate) -> Candidate | None:
    """Recheck the exact proposed combination, even if it is no longer top five."""
    if not requirements.ready or capacity_problem(restaurant, requirements):
        return None
    names = set(candidate.table_names)
    tables = tuple(table for table in _hard_tables(restaurant, requirements) if table.name in names)
    if len(tables) != len(names) or any(table.status != FREE for table in tables):
        return None
    if requirements.allow_split is False and len(tables) > 1:
        return None
    if requirements.table_required and requirements.table_name not in names:
        return None
    return _Planner(restaurant, requirements).build(tables)


def no_seat_reason(restaurant: RestaurantMap, requirements: Requirements) -> str:
    permanent = capacity_problem(restaurant, requirements)
    if permanent:
        return permanent
    if requirements.other_requirements:
        return "尚有需求待確認：" + "、".join(requirements.other_requirements)
    return "目前沒有能安排整組顧客的空桌，請稍候。"
