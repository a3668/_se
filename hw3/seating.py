"""Deterministic seating decisions; the language model cannot change tables."""

from __future__ import annotations

from dataclasses import dataclass

from navigation import astar
from restaurant import FREE, Cell, Requirements, RestaurantMap


@dataclass(frozen=True)
class Candidate:
    table_name: str
    path: tuple[Cell, ...]
    misses: tuple[str, ...]
    reason: str


def rank_tables(restaurant: RestaurantMap, requirements: Requirements) -> list[Candidate]:
    if not requirements.ready:
        return []
    ranked: list[tuple[tuple[int, int, int, str], Candidate]] = []
    for table in restaurant.tables:
        if table.status != FREE or table.capacity < requirements.party_size:
            continue
        wrong_window = (
            requirements.window_preference is not None
            and table.window_side != requirements.window_preference
        )
        wrong_table = bool(requirements.table_name and table.name != requirements.table_name)
        if (wrong_window and requirements.window_required) or (wrong_table and requirements.table_required):
            continue
        path = astar(restaurant, restaurant.robot_start, table.goal)
        if path is None:
            continue
        misses = []
        if wrong_window:
            misses.append("靠窗偏好" if requirements.window_preference else "非靠窗偏好")
        if wrong_table:
            misses.append(f"指定 {requirements.table_name} 的偏好")
        location = "靠窗" if table.window_side else "非靠窗"
        reason = (
            f"{table.name}｜{table.capacity} 人桌、{location}，"
            f"剩餘 {table.capacity - requirements.party_size} 席，距入口 {len(path) - 1} 公尺。"
        )
        reason += "需同意放寬：" + "、".join(misses) + "。" if misses else "符合目前需求。"
        candidate = Candidate(table.name, tuple(path), tuple(misses), reason)
        score = (len(misses), table.capacity - requirements.party_size, len(path) - 1, table.name)
        ranked.append((score, candidate))
    return [candidate for _, candidate in sorted(ranked, key=lambda item: item[0])]


def no_seat_reason(restaurant: RestaurantMap, requirements: Requirements) -> str:
    if requirements.other_requirements:
        return "特殊需求尚未確認是否可放寬：" + "、".join(requirements.other_requirements)
    if requirements.party_size and requirements.party_size > max(table.capacity for table in restaurant.tables):
        return "本餐廳最多提供六人桌，尚未支援併桌。可修改人數需求或繼續等待。"
    return "目前沒有同時符合人數、必要限制及可通行條件的空桌。"
