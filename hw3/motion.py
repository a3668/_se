"""Continuous geometry in cell-centre coordinates; one unit is one metre."""
from __future__ import annotations

from collections.abc import Collection, Iterable
from math import ceil, floor, hypot

from restaurant import Cell, Position, RestaurantMap

RADIUS = 0.25
SENSOR_RANGE = 4.0
EPS = 1e-8


def distance(a: Position, b: Position) -> float:
    return hypot(a[0] - b[0], a[1] - b[1])


def towards(a: Position, b: Position, amount: float) -> Position:
    length = distance(a, b)
    if length <= amount + EPS:
        return b
    ratio = amount / length
    return (a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio)


def cell_for(point: Position) -> Cell:
    return (floor(point[0] + 0.5), floor(point[1] + 0.5))


def body_clear(point: Position, restaurant: RestaurantMap,
               blocked: Collection[Cell] | None = None) -> bool:
    x, y = point
    if not (RADIUS - 0.5 <= x <= restaurant.width - 0.5 - RADIUS
            and RADIUS - 0.5 <= y <= restaurant.height - 0.5 - RADIUS):
        return False
    cells = restaurant.blocked_cells if blocked is None else blocked
    # A blocked cell occupies a whole unit square around its centre.
    for cx in range(floor(x - 0.75), ceil(x + 0.75) + 1):
        for cy in range(floor(y - 0.75), ceil(y + 0.75) + 1):
            if (cx, cy) in cells:
                dx, dy = max(abs(x - cx) - 0.5, 0), max(abs(y - cy) - 0.5, 0)
                if hypot(dx, dy) < RADIUS - EPS:
                    return False
    return True


def segment_clear(start: Position, end: Position, restaurant: RestaurantMap,
                  others: Iterable[Position] = ()) -> bool:
    # Subdivide the swept body, preventing tunnelling even at accelerated time.
    others = tuple(others)
    count = max(1, ceil(distance(start, end) / 0.025))
    for i in range(1, count + 1):
        point = towards(start, end, distance(start, end) * i / count)
        if not body_clear(point, restaurant):
            return False
        if any(distance(point, other) < 2 * RADIUS - EPS for other in others):
            return False
    return True


def trail_length(start: Position, trail: list[Position]) -> float:
    total = 0.0
    for point in trail:
        total += distance(start, point)
        start = point
    return total


def point_segment_distance(point: Position, a: Position, b: Position) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    squared = dx * dx + dy * dy
    if squared <= EPS:
        return distance(point, a)
    t = max(0.0, min(1.0, ((point[0]-a[0])*dx + (point[1]-a[1])*dy) / squared))
    return distance(point, (a[0]+t*dx, a[1]+t*dy))
