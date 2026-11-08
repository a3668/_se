"""Four-direction A*; returned paths include both start and goal."""

from __future__ import annotations

import heapq
from collections.abc import Collection
from itertools import count

from restaurant import Cell, RestaurantMap


def astar(restaurant: RestaurantMap, start: Cell, goal: Cell,
          blocked: Collection[Cell] | None = None) -> list[Cell] | None:
    blocked = restaurant.blocked_cells if blocked is None else blocked
    if not restaurant.contains(start) or not restaurant.contains(goal):
        return None
    if start in blocked or goal in blocked:
        return None
    serial = count()
    distance = lambda cell: abs(cell[0] - goal[0]) + abs(cell[1] - goal[1])
    frontier = [(distance(start), next(serial), 0, start)]
    costs = {start: 0}
    parents: dict[Cell, Cell] = {}
    while frontier:
        _, _, cost, cell = heapq.heappop(frontier)
        if cost != costs[cell]:
            continue
        if cell == goal:
            path = [goal]
            while path[-1] != start:
                path.append(parents[path[-1]])
            return list(reversed(path))
        x, y = cell
        for neighbor in ((x, y + 1), (x + 1, y), (x, y - 1), (x - 1, y)):
            if not restaurant.contains(neighbor) or neighbor in blocked:
                continue
            new_cost = cost + 1
            if new_cost < costs.get(neighbor, float("inf")):
                costs[neighbor] = new_cost
                parents[neighbor] = cell
                heapq.heappush(frontier, (new_cost + distance(neighbor), next(serial), new_cost, neighbor))
    return None
