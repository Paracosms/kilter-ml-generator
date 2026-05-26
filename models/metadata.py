{
  "angle": 40.0,
  "diameter": 147.07821048680188,
  "num_holds": 14,
  "angle_adjustable": 40,
  "frames_xy": "(56,16)S|(56,24)S|(64,32)S|(72,40)S|(72,48)S|(72,64)I|(72,80)I|(88,80)I|(88,88)I|(88,96)I|(104,112)I|(104,128)I|(112,136)I|(112,152)I",
  "frames": "p1096r15p1113r15p1131r15p1149r12p1166r15p1200r13p1234r15p1236r13p1253r15p1270r13p1306r13p1340r13p1358r13p1392r14",
  "is_nomatch": 0,
  "difficulty_average": 15.9958,
  "layout_id": 1,
  "hsm": 1,
  "edge_left": 56,
  "edge_right": 112,
  "edge_bottom": 16,
  "edge_top": 152,
  "frames_count": 1,
  "frames_pace": 0,
  "is_listed": 1,
  "has_start": 1,
  "has_finish": 0
}

-----

import numpy as np
import json
import torch
import re
from collections import Counter
from tqdm import tqdm

# 1. Load the lookup table
board_data = json.load(BoardPlacements.json)

placement_to_idx = {int(p['placementId']): i for i, p in enumerate(board_data)}
num_placements = len(placement_to_idx)

# Role mapping
role_to_channel = {
    12: 0, # start
    13: 1, # regular
    14: 2, # finish
    15: 3  # foot
}

placement_to_xy = {
    int(p['placementId']): (float(p.get('x', 0.0)), float(p.get('y', 0.0)))
    for p in board_data
}

board_x_min = min(x for x, _ in placement_to_xy.values())
board_x_max = max(x for x, _ in placement_to_xy.values())
board_y_min = min(y for _, y in placement_to_xy.values())
board_y_max = max(y for _, y in placement_to_xy.values())
board_x_span = max(board_x_max - board_x_min, 1.0)
board_y_span = max(board_y_max - board_y_min, 1.0)

HAND_ROLES = {12, 13, 14}
FOOT_ROLE = 15
NEARBY_FOOT_DISTANCE = 16.0

METADATA_FEATURE_NAMES = [
    "total_hold_count",
    "hand_hold_count",
    "start_count",
    "regular_count",
    "foot_count",
    "finish_count",
    "foot_ratio",
    "regular_ratio",
    "angle",
    "min_x",
    "max_x",
    "min_y",
    "max_y",
    "x_spread",
    "y_spread",
    "bounding_box_area",
    "aspect_ratio",
    "mean_x",
    "mean_y",
    "std_x",
    "std_y",
    "hand_min_x",
    "hand_max_x",
    "hand_min_y",
    "hand_max_y",
    "hand_x_spread",
    "hand_y_spread",
    "hand_mean_x",
    "hand_mean_y",
    "hand_std_x",
    "hand_std_y",
    "start_mean_x",
    "start_mean_y",
    "finish_mean_x",
    "finish_mean_y",
    "start_to_finish_dx",
    "start_to_finish_dy",
    "start_to_finish_abs_dx",
    "start_to_finish_abs_dy",
    "start_to_finish_distance",
    "mean_pairwise_distance",
    "median_pairwise_distance",
    "min_pairwise_distance",
    "max_pairwise_distance",
    "std_pairwise_distance",
    "mean_nearest_neighbor_distance",
    "max_nearest_neighbor_distance",
    "hand_mean_nearest_neighbor_distance",
    "hand_max_nearest_neighbor_distance",
    "start_to_nearest_regular_distance",
    "finish_to_nearest_regular_distance",
    "start_to_nearest_foot_distance",
    "finish_to_nearest_foot_distance",
    "foot_mean_x",
    "foot_mean_y",
    "foot_x_spread",
    "foot_y_spread",
    "mean_foot_to_nearest_hand_distance",
    "hands_with_nearby_foot_ratio",
    "left_hold_ratio",
    "center_hold_ratio",
    "right_hold_ratio",
    "bottom_third_hold_ratio",
    "middle_third_hold_ratio",
    "top_third_hold_ratio",
    "occupied_zone_count",
    "max_zone_hold_count",
]


def _safe_div(numerator, denominator):
    return float(numerator) / float(denominator) if denominator else 0.0


def _coords_for_roles(records, roles):
    points = [(x, y) for x, y, role_id in records if role_id in roles]
    if not points:
        return np.empty(0, dtype=np.float32), np.empty(0, dtype=np.float32)
    arr = np.asarray(points, dtype=np.float32)
    return arr[:, 0], arr[:, 1]


def _coord_summary(xs, ys):
    if xs.size == 0:
        return 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0
    min_x = float(np.min(xs))
    max_x = float(np.max(xs))
    min_y = float(np.min(ys))
    max_y = float(np.max(ys))
    return (
        min_x,
        max_x,
        min_y,
        max_y,
        max_x - min_x,
        max_y - min_y,
        float(np.mean(xs)),
        float(np.mean(ys)),
    )


def _coord_spread_std(xs, ys):
    if xs.size == 0:
        return 0.0, 0.0
    return float(np.std(xs)), float(np.std(ys))


def _pairwise_distances(xs, ys):
    if xs.size < 2:
        return np.empty(0, dtype=np.float32)
    coords = np.column_stack((xs, ys)).astype(np.float32)
    diffs = coords[:, None, :] - coords[None, :, :]
    distances = np.sqrt(np.sum(diffs * diffs, axis=-1))
    return distances[np.triu_indices(coords.shape[0], k=1)]


def _nearest_neighbor_distances(xs, ys):
    if xs.size == 0:
        return np.empty(0, dtype=np.float32)
    if xs.size == 1:
        return np.zeros(1, dtype=np.float32)
    coords = np.column_stack((xs, ys)).astype(np.float32)
    diffs = coords[:, None, :] - coords[None, :, :]
    distances = np.sqrt(np.sum(diffs * diffs, axis=-1))
    np.fill_diagonal(distances, np.inf)
    return np.min(distances, axis=1).astype(np.float32)


def _cross_min_distance(xs_a, ys_a, xs_b, ys_b):
    if xs_a.size == 0 or xs_b.size == 0:
        return 0.0
    a = np.column_stack((xs_a, ys_a)).astype(np.float32)
    b = np.column_stack((xs_b, ys_b)).astype(np.float32)
    diffs = a[:, None, :] - b[None, :, :]
    distances = np.sqrt(np.sum(diffs * diffs, axis=-1))
    return float(np.min(distances))


def _cross_nearest_distances(xs_a, ys_a, xs_b, ys_b):
    if xs_a.size == 0 or xs_b.size == 0:
        return np.empty(0, dtype=np.float32)
    a = np.column_stack((xs_a, ys_a)).astype(np.float32)
    b = np.column_stack((xs_b, ys_b)).astype(np.float32)
    diffs = a[:, None, :] - b[None, :, :]
    distances = np.sqrt(np.sum(diffs * diffs, axis=-1))
    return np.min(distances, axis=1).astype(np.float32)


def _extract_hold_records(problem):
    frames_str = str(problem.get('frames', '') or '')
    frames_xy_str = str(problem.get('frames_xy', '') or '')
    frame_matches = re.findall(r'p(\d+)r(\d+)', frames_str)
    xy_matches = re.findall(r'\((-?\d+),(-?\d+)\)[A-Za-z]', frames_xy_str)

    records = []
    for idx, (p_id, r_id) in enumerate(frame_matches):
        p_id_int = int(p_id)
        r_id_int = int(r_id)
        coords = placement_to_xy.get(p_id_int)
        if coords is None:
            continue
        if idx < len(xy_matches):
            x, y = float(xy_matches[idx][0]), float(xy_matches[idx][1])
        else:
            x, y = coords
        records.append((x, y, r_id_int))
    return records

def flatten_climb_multihot(problem, mapping=placement_to_idx):
    """
    Converts a problem row (Series/Dict) into a (5, num_placements) tensor.
    Channels: 0=start, 1=regular, 2=finish, 3=foot, 4=metadata features.
    """
    tensor = np.zeros((5, num_placements), dtype=np.float32)

    frames_str = problem['frames']
    matches = re.findall(r'p(\d+)r(\d+)', frames_str)

    for p_id, r_id in matches:
        p_id_int = int(p_id)
        r_id_int = int(r_id)
        if p_id_int in mapping and r_id_int in role_to_channel:
            channel_idx = role_to_channel[r_id_int]
            placement_idx = mapping[p_id_int]
            tensor[channel_idx, placement_idx] = 1.0

    records = _extract_hold_records(problem)
    total_hold_count = len(records)

    start_xs, start_ys = _coords_for_roles(records, {12})
    regular_xs, regular_ys = _coords_for_roles(records, {13})
    finish_xs, finish_ys = _coords_for_roles(records, {14})
    foot_xs, foot_ys = _coords_for_roles(records, {15})
    hand_xs, hand_ys = _coords_for_roles(records, HAND_ROLES)

    start_count = int(start_xs.size)
    regular_count = int(regular_xs.size)
    finish_count = int(finish_xs.size)
    foot_count = int(foot_xs.size)
    hand_hold_count = int(start_count + regular_count + finish_count)

    min_x, max_x, min_y, max_y, x_spread, y_spread, mean_x, mean_y = _coord_summary(
        np.asarray([x for x, _, _ in records], dtype=np.float32),
        np.asarray([y for _, y, _ in records], dtype=np.float32),
    )
    std_x, std_y = _coord_spread_std(
        np.asarray([x for x, _, _ in records], dtype=np.float32),
        np.asarray([y for _, y, _ in records], dtype=np.float32),
    )

    hand_min_x, hand_max_x, hand_min_y, hand_max_y, hand_x_spread, hand_y_spread, hand_mean_x, hand_mean_y = _coord_summary(
        hand_xs, hand_ys
    )
    hand_std_x, hand_std_y = _coord_spread_std(hand_xs, hand_ys)

    start_mean_x, start_mean_y = (float(np.mean(start_xs)), float(np.mean(start_ys))) if start_xs.size else (0.0, 0.0)
    finish_mean_x, finish_mean_y = (float(np.mean(finish_xs)), float(np.mean(finish_ys))) if finish_xs.size else (0.0, 0.0)

    start_to_finish_dx = finish_mean_x - start_mean_x
    start_to_finish_dy = finish_mean_y - start_mean_y
    start_to_finish_abs_dx = abs(start_to_finish_dx)
    start_to_finish_abs_dy = abs(start_to_finish_dy)
    start_to_finish_distance = float(np.hypot(start_to_finish_dx, start_to_finish_dy))

    pairwise_distances = _pairwise_distances(
        np.asarray([x for x, _, _ in records], dtype=np.float32),
        np.asarray([y for _, y, _ in records], dtype=np.float32),
    )
    if pairwise_distances.size:
        mean_pairwise_distance = float(np.mean(pairwise_distances))
        median_pairwise_distance = float(np.median(pairwise_distances))
        min_pairwise_distance = float(np.min(pairwise_distances))
        max_pairwise_distance = float(np.max(pairwise_distances))
        std_pairwise_distance = float(np.std(pairwise_distances))
    else:
        mean_pairwise_distance = 0.0
        median_pairwise_distance = 0.0
        min_pairwise_distance = 0.0
        max_pairwise_distance = 0.0
        std_pairwise_distance = 0.0

    nearest_neighbor_distances = _nearest_neighbor_distances(
        np.asarray([x for x, _, _ in records], dtype=np.float32),
        np.asarray([y for _, y, _ in records], dtype=np.float32),
    )
    mean_nearest_neighbor_distance = float(np.mean(nearest_neighbor_distances)) if nearest_neighbor_distances.size else 0.0
    max_nearest_neighbor_distance = float(np.max(nearest_neighbor_distances)) if nearest_neighbor_distances.size else 0.0

    hand_nearest_neighbor_distances = _nearest_neighbor_distances(hand_xs, hand_ys)
    hand_mean_nearest_neighbor_distance = float(np.mean(hand_nearest_neighbor_distances)) if hand_nearest_neighbor_distances.size else 0.0
    hand_max_nearest_neighbor_distance = float(np.max(hand_nearest_neighbor_distances)) if hand_nearest_neighbor_distances.size else 0.0

    start_to_nearest_regular_distance = _cross_min_distance(start_xs, start_ys, regular_xs, regular_ys)
    finish_to_nearest_regular_distance = _cross_min_distance(finish_xs, finish_ys, regular_xs, regular_ys)
    start_to_nearest_foot_distance = _cross_min_distance(start_xs, start_ys, foot_xs, foot_ys)
    finish_to_nearest_foot_distance = _cross_min_distance(finish_xs, finish_ys, foot_xs, foot_ys)

    foot_mean_x = float(np.mean(foot_xs)) if foot_xs.size else 0.0
    foot_mean_y = float(np.mean(foot_ys)) if foot_ys.size else 0.0
    foot_min_x, foot_max_x, foot_min_y, foot_max_y, foot_x_spread, foot_y_spread, _, _ = _coord_summary(foot_xs, foot_ys)

    if foot_xs.size and hand_xs.size:
        hand_to_foot_distances = _cross_nearest_distances(hand_xs, hand_ys, foot_xs, foot_ys)
        mean_foot_to_nearest_hand_distance = float(np.mean(_cross_nearest_distances(foot_xs, foot_ys, hand_xs, hand_ys)))
        hands_with_nearby_foot_ratio = _safe_div(np.sum(hand_to_foot_distances <= NEARBY_FOOT_DISTANCE), hand_hold_count)
    else:
        mean_foot_to_nearest_hand_distance = 0.0
        hands_with_nearby_foot_ratio = 0.0

    x_left = board_x_min + (board_x_span / 3.0)
    x_right = board_x_min + (2.0 * board_x_span / 3.0)
    y_bottom = board_y_min + (board_y_span / 3.0)
    y_top = board_y_min + (2.0 * board_y_span / 3.0)

    if total_hold_count:
        left_hold_ratio = _safe_div(np.sum(np.asarray([x for x, _, _ in records], dtype=np.float32) < x_left), total_hold_count)
        center_hold_ratio = _safe_div(np.sum((np.asarray([x for x, _, _ in records], dtype=np.float32) >= x_left) & (np.asarray([x for x, _, _ in records], dtype=np.float32) < x_right)), total_hold_count)
        right_hold_ratio = _safe_div(np.sum(np.asarray([x for x, _, _ in records], dtype=np.float32) >= x_right), total_hold_count)

        bottom_third_hold_ratio = _safe_div(np.sum(np.asarray([y for _, y, _ in records], dtype=np.float32) < y_bottom), total_hold_count)
        middle_third_hold_ratio = _safe_div(np.sum((np.asarray([y for _, y, _ in records], dtype=np.float32) >= y_bottom) & (np.asarray([y for _, y, _ in records], dtype=np.float32) < y_top)), total_hold_count)
        top_third_hold_ratio = _safe_div(np.sum(np.asarray([y for _, y, _ in records], dtype=np.float32) >= y_top), total_hold_count)
    else:
        left_hold_ratio = center_hold_ratio = right_hold_ratio = 0.0
        bottom_third_hold_ratio = middle_third_hold_ratio = top_third_hold_ratio = 0.0

    if total_hold_count:
        x_bins = np.digitize(np.asarray([x for x, _, _ in records], dtype=np.float32), [x_left, x_right], right=False)
        y_bins = np.digitize(np.asarray([y for _, y, _ in records], dtype=np.float32), [y_bottom, y_top], right=False)
        zone_counts = Counter(zip(x_bins.tolist(), y_bins.tolist()))
        occupied_zone_count = len(zone_counts)
        max_zone_hold_count = max(zone_counts.values())
    else:
        occupied_zone_count = 0
        max_zone_hold_count = 0

    # include angle from the input row (important feature describing wall angle)
    angle = float(problem.get('angle', 0.0))

    metadata_values = np.asarray([
        float(total_hold_count),
        float(hand_hold_count),
        float(start_count),
        float(regular_count),
        float(foot_count),
        float(finish_count),
        _safe_div(foot_count, total_hold_count),
        _safe_div(regular_count, hand_hold_count),
        float(angle),
        min_x,
        max_x,
        min_y,
        max_y,
        x_spread,
        y_spread,
        x_spread * y_spread,
        _safe_div(x_spread, y_spread),
        mean_x,
        mean_y,
        std_x,
        std_y,
        hand_min_x,
        hand_max_x,
        hand_min_y,
        hand_max_y,
        hand_x_spread,
        hand_y_spread,
        hand_mean_x,
        hand_mean_y,
        hand_std_x,
        hand_std_y,
        start_mean_x,
        start_mean_y,
        finish_mean_x,
        finish_mean_y,
        start_to_finish_dx,
        start_to_finish_dy,
        start_to_finish_abs_dx,
        start_to_finish_abs_dy,
        start_to_finish_distance,
        mean_pairwise_distance,
        median_pairwise_distance,
        min_pairwise_distance,
        max_pairwise_distance,
        std_pairwise_distance,
        mean_nearest_neighbor_distance,
        max_nearest_neighbor_distance,
        hand_mean_nearest_neighbor_distance,
        hand_max_nearest_neighbor_distance,
        start_to_nearest_regular_distance,
        finish_to_nearest_regular_distance,
        start_to_nearest_foot_distance,
        finish_to_nearest_foot_distance,
        foot_mean_x,
        foot_mean_y,
        foot_x_spread,
        foot_y_spread,
        mean_foot_to_nearest_hand_distance,
        hands_with_nearby_foot_ratio,
        left_hold_ratio,
        center_hold_ratio,
        right_hold_ratio,
        bottom_third_hold_ratio,
        middle_third_hold_ratio,
        top_third_hold_ratio,
        float(occupied_zone_count),
        float(max_zone_hold_count),
    ], dtype=np.float32)

    metadata_len = min(metadata_values.size, tensor.shape[1])
    tensor[4, :metadata_len] = metadata_values[:metadata_len]

    return tensor