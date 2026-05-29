// evaluates a generated candidate on realism
// input: GeneratedCandidate: form inferred by Types.tsx
// output: RealismScore: from 0.0 to 1.0, where 1.0 is the highest and most perfect climb

// hard fails (RealismScore set to 0.0 and returns immediately)
// distance between 2 start/finish holds is physically impossible?
    // check distance between holds for climbs with 2 start/finish holds
    // const MAX_DIST_X = 60;
    // const MAX_DIST_Y = 48;
    // const MAX_DIST_EUCLIDEAN = 64;
    // e.g. if |start1.x - start2.x| > 60, RealismScore = 0.0
    // ensures climbs are physically possible
// start hold is impossible to reach?
    // if the LOWEST start.y is > 72 (6ft), RealismScore = 0.0

// takes into account:
// Zone density
    // Split the board into maybe a 3 x 4 grid.
        // (3x3 for the main 12'x12' grid and the extra row is the entire kickboard zone at the top, aka placementId > 4000)
    // Count holds per zone.
    // Penalize if too many holds are packed into one small zone or if the climb skips a huge middle region.
// y position of start holds
    // penalize starts that are too high
    // should be an adjustable constant, perhaps start penalizing above y >= 48
// y position of finish holds
    // penalize starts that are too low
    // should be an adjustable constant, perhaps start penalizing below y <= 36

import { ROLE_ID_BY_NAME } from "./Types";
import type { GeneratedCandidate, RoleId } from "./Types";

export type RealismScore = number;

export type Placement = {
  placementId: number;
  x: number;
  y: number;
};

type Point = Pick<Placement, "x" | "y">;

export type PlacementIndex = {
  byId: Map<number, Placement>;
  mainMinX: number;
  mainMaxX: number;
  mainMinY: number;
  mainMaxY: number;
};

export type RealismEvaluatorOptions = {
  maxStartDistanceX: number;
  maxStartDistanceY: number;
  maxStartDistanceEuclidean: number;
  maxFinishDistanceX: number;
  maxFinishDistanceY: number;
  maxFinishDistanceEuclidean: number;
  startReachMaxY: number;
  // Y where start penalties begin; higher => more lenient, lower => harsher.
  startPenaltyStartY: number;
  // Y below which finish penalties apply; higher => harsher, lower => more lenient.
  finishPenaltyBelowY: number;
  // Optional min Y for finish penalty range; lower => softer penalty curve.
  finishPenaltyMinY?: number;
  // Hard reject if a foot is farther than this from any non-foot hold.
  footProximityRadius: number;
  // Distance from start->finish line before a hold is penalized.
  lineDistanceMax: number;
  zoneColumns: number;
  zoneRowsMain: number;
  kickboardPlacementIdMin: number;
  // 0..1; lower => penalize concentration sooner, higher => allow denser clusters.
  maxZoneRatio: number;
  // 0..1; higher => concentration contributes more to zone penalty.
  concentrationWeight: number;
  // 0..1; added penalty if middle row empty; higher => stronger gap penalty.
  middleRowPenalty: number;
  // 0..1; added penalty if middle column empty; higher => stronger gap penalty.
  middleColumnPenalty: number;
  // 0..1; added penalty if center zone empty (when total >= min); higher => stronger penalty.
  centerZonePenalty: number;
  // Minimum main-zone holds before center-zone penalty can apply; higher => less often.
  centerZoneMinTotal: number;
  // Exponent applied to the final realism score; >1 makes penalties harsher.
  overallScoreExponent: number;
  weights: {
    // 0..1-ish; higher => this component impacts overall realism more.
    zone: number;
    start: number;
    finish: number;
    line: number;
  };
};

const DEFAULT_OPTIONS: RealismEvaluatorOptions = {
  maxStartDistanceX: 60,
  maxStartDistanceY: 48,
  maxStartDistanceEuclidean: 64,
  maxFinishDistanceX: 60,
  maxFinishDistanceY: 48,
  maxFinishDistanceEuclidean: 64,
  startReachMaxY: 72,
  // Start penalty begins above this Y (higher => more lenient on high starts).
  startPenaltyStartY: 48,
  // Finish penalty begins below this Y (higher => more strict on low finishes).
  finishPenaltyBelowY: 36,
  // Distance a start/regular/finish hold is required to be near a foot hold
  footProximityRadius: 60,
  // Penalty for any holds beyond 7ft from the line from start-finish
  lineDistanceMax: 72,
  zoneColumns: 3,
  zoneRowsMain: 3,
  kickboardPlacementIdMin: 4000,
  // Max fraction of holds allowed in a single zone before penalty (0..1).
  maxZoneRatio: 0.45,
  // Weighting of concentration vs gap penalties (0..1).
  concentrationWeight: 0.6,
  // Added penalty if middle row empty (0..1).
  middleRowPenalty: 0.35,
  // Added penalty if middle column empty (0..1).
  middleColumnPenalty: 0.25,
  // Added penalty if center zone empty (0..1).
  centerZonePenalty: 0.15,
  // Minimum main holds to apply center-zone penalty.
  centerZoneMinTotal: 4,
  overallScoreExponent: 1.5,
  weights: {
    // Relative weights; normalized by total weight.
    zone: 0.5,
    start: 0.25,
    finish: 0.25,
    line: 0.2,
  },
};

export const buildPlacementIndex = (placements: Placement[]): PlacementIndex => {
  const byId = new Map<number, Placement>();
  let mainMinX = Number.POSITIVE_INFINITY;
  let mainMaxX = Number.NEGATIVE_INFINITY;
  let mainMinY = Number.POSITIVE_INFINITY;
  let mainMaxY = Number.NEGATIVE_INFINITY;

  for (const placement of placements) {
    byId.set(placement.placementId, placement);
    if (placement.placementId <= DEFAULT_OPTIONS.kickboardPlacementIdMin) {
      mainMinX = Math.min(mainMinX, placement.x);
      mainMaxX = Math.max(mainMaxX, placement.x);
      mainMinY = Math.min(mainMinY, placement.y);
      mainMaxY = Math.max(mainMaxY, placement.y);
    }
  }

  if (!Number.isFinite(mainMinX)) {
    mainMinX = 0;
    mainMaxX = 0;
    mainMinY = 0;
    mainMaxY = 0;
  }

  return { byId, mainMinX, mainMaxX, mainMinY, mainMaxY };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const averagePoint = (placements: Placement[]): Point => ({
  x: average(placements.map((placement) => placement.x)),
  y: average(placements.map((placement) => placement.y)),
});

const distanceToSegment = (
  point: Point,
  start: Point,
  end: Point,
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t =
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  const clampedT = clamp(t, 0, 1);
  const projX = start.x + clampedT * dx;
  const projY = start.y + clampedT * dy;
  return Math.hypot(point.x - projX, point.y - projY);
};

const collectRolePlacements = (
  candidate: GeneratedCandidate,
  roleId: RoleId,
  placementIndex: PlacementIndex,
) => {
  const placements: Placement[] = [];
  for (const hold of candidate.climb) {
    if (hold.roleId !== roleId) {
      continue;
    }
    const placement = placementIndex.byId.get(hold.placementId);
    if (placement) {
      placements.push(placement);
    }
  }
  return placements;
};

const computeZoneScore = (
  placements: Placement[],
  placementIndex: PlacementIndex,
  options: RealismEvaluatorOptions,
) => {
  if (placements.length === 0) {
    return 0;
  }

  const zoneRowsTotal = options.zoneRowsMain + 1;
  const counts = Array.from({ length: zoneRowsTotal }, () =>
    Array.from({ length: options.zoneColumns }, () => 0),
  );

  const mainWidth = placementIndex.mainMaxX - placementIndex.mainMinX;
  const mainHeight = placementIndex.mainMaxY - placementIndex.mainMinY;
  const colWidth = mainWidth === 0 ? 1 : mainWidth / options.zoneColumns;
  const rowHeight = mainHeight === 0 ? 1 : mainHeight / options.zoneRowsMain;

  for (const placement of placements) {
    const isKickboard =
      placement.placementId > options.kickboardPlacementIdMin;
    const row = isKickboard
      ? options.zoneRowsMain
      : clamp(
          Math.floor((placement.y - placementIndex.mainMinY) / rowHeight),
          0,
          options.zoneRowsMain - 1,
        );
    const col = clamp(
      Math.floor((placement.x - placementIndex.mainMinX) / colWidth),
      0,
      options.zoneColumns - 1,
    );
    counts[row][col] += 1;
  }

  let totalHolds = 0;
  let maxCount = 0;
  let totalMainHolds = 0;

  for (let row = 0; row < counts.length; row += 1) {
    for (let col = 0; col < counts[row].length; col += 1) {
      const value = counts[row][col];
      totalHolds += value;
      maxCount = Math.max(maxCount, value);
      if (row < options.zoneRowsMain) {
        totalMainHolds += value;
      }
    }
  }

  if (totalHolds === 0) {
    return 0;
  }

  const maxRatio = maxCount / totalHolds;
  const concentrationPenalty =
    maxRatio <= options.maxZoneRatio
      ? 0
      : (maxRatio - options.maxZoneRatio) / (1 - options.maxZoneRatio);

  let gapPenalty = 0;
  if (totalMainHolds > 0) {
    const middleRowIndex = Math.floor(options.zoneRowsMain / 2);
    const middleColIndex = Math.floor(options.zoneColumns / 2);

    const middleRowCount = counts[middleRowIndex].reduce(
      (sum, value) => sum + value,
      0,
    );
    let middleColCount = 0;
    for (let row = 0; row < options.zoneRowsMain; row += 1) {
      middleColCount += counts[row][middleColIndex];
    }

    if (middleRowCount === 0) {
      gapPenalty += options.middleRowPenalty;
    }
    if (middleColCount === 0) {
      gapPenalty += options.middleColumnPenalty;
    }
    if (
      totalMainHolds >= options.centerZoneMinTotal &&
      counts[middleRowIndex][middleColIndex] === 0
    ) {
      gapPenalty += options.centerZonePenalty;
    }
  }

  gapPenalty = clamp(gapPenalty, 0, 1);

  const combinedPenalty = clamp(
    concentrationPenalty * options.concentrationWeight + gapPenalty,
    0,
    1,
  );

  return clamp(1 - combinedPenalty, 0, 1);
};

export const evaluateRealism = (
  candidate: GeneratedCandidate,
  placementIndex: PlacementIndex,
  options?: Partial<RealismEvaluatorOptions>,
): RealismScore => {
  const resolvedOptions: RealismEvaluatorOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    weights: {
      ...DEFAULT_OPTIONS.weights,
      ...options?.weights,
    },
  };

  const starts = collectRolePlacements(
    candidate,
    ROLE_ID_BY_NAME.start,
    placementIndex,
  );
  const regulars = collectRolePlacements(
    candidate,
    ROLE_ID_BY_NAME.regular,
    placementIndex,
  );
  const finishes = collectRolePlacements(
    candidate,
    ROLE_ID_BY_NAME.finish,
    placementIndex,
  );
  const feet = collectRolePlacements(
    candidate,
    ROLE_ID_BY_NAME.foot,
    placementIndex,
  );

  if (feet.length > 0) {
    const handPlacements = [...starts, ...regulars, ...finishes];
    if (handPlacements.length === 0) {
      return 0;
    }
    for (const foot of feet) {
      let closest = Number.POSITIVE_INFINITY;
      for (const hand of handPlacements) {
        const distance = Math.hypot(foot.x - hand.x, foot.y - hand.y);
        if (distance < closest) {
          closest = distance;
        }
      }
      if (closest > resolvedOptions.footProximityRadius) {
        return 0;
      }
    }
  }

  if (starts.length === 2) {
    const [first, second] = starts;
    const dx = Math.abs(first.x - second.x);
    const dy = Math.abs(first.y - second.y);
    const distance = Math.hypot(dx, dy);
    if (
      dx > resolvedOptions.maxStartDistanceX ||
      dy > resolvedOptions.maxStartDistanceY ||
      distance > resolvedOptions.maxStartDistanceEuclidean
    ) {
      return 0;
    }
  }

  if (finishes.length === 2) {
    const [first, second] = finishes;
    const dx = Math.abs(first.x - second.x);
    const dy = Math.abs(first.y - second.y);
    const distance = Math.hypot(dx, dy);
    if (
      dx > resolvedOptions.maxFinishDistanceX ||
      dy > resolvedOptions.maxFinishDistanceY ||
      distance > resolvedOptions.maxFinishDistanceEuclidean
    ) {
      return 0;
    }
  }

  if (starts.length > 0) {
    const lowestStartY = Math.min(...starts.map((start) => start.y));
    if (lowestStartY > resolvedOptions.startReachMaxY) {
      return 0;
    }
  }

  const allPlacements: Placement[] = [];
  for (const hold of candidate.climb) {
    const placement = placementIndex.byId.get(hold.placementId);
    if (placement) {
      allPlacements.push(placement);
    }
  }

  const zoneScore = computeZoneScore(
    allPlacements,
    placementIndex,
    resolvedOptions,
  );

  let startScore = 0;
  if (starts.length > 0) {
    const startAvgY = average(starts.map((start) => start.y));
    if (startAvgY <= resolvedOptions.startPenaltyStartY) {
      startScore = 1;
    } else {
      startScore =
        1 -
        (startAvgY - resolvedOptions.startPenaltyStartY) /
          (resolvedOptions.startReachMaxY -
            resolvedOptions.startPenaltyStartY);
    }
    startScore = clamp(startScore, 0, 1);
  }

  let finishScore = 0;
  if (finishes.length > 0) {
    const finishAvgY = average(finishes.map((finish) => finish.y));
    const finishMinY =
      resolvedOptions.finishPenaltyMinY ?? placementIndex.mainMinY;
    if (finishAvgY >= resolvedOptions.finishPenaltyBelowY) {
      finishScore = 1;
    } else {
      const range = resolvedOptions.finishPenaltyBelowY - finishMinY;
      finishScore = range <= 0 ? 0 : (finishAvgY - finishMinY) / range;
    }
    finishScore = clamp(finishScore, 0, 1);
  }

  let lineScore = 1;
  if (starts.length > 0 && finishes.length > 0 && allPlacements.length > 0) {
    const startAvg = averagePoint(starts);
    const finishAvg = averagePoint(finishes);
    const penalties = allPlacements.map((placement) => {
      const distance = distanceToSegment(placement, startAvg, finishAvg);
      if (distance <= resolvedOptions.lineDistanceMax) {
        return 0;
      }
      return clamp(
        (distance - resolvedOptions.lineDistanceMax) /
          resolvedOptions.lineDistanceMax,
        0,
        1,
      );
    });
    const averagePenalty = average(penalties);
    lineScore = clamp(1 - averagePenalty, 0, 1);
  }

  const weightTotal =
    resolvedOptions.weights.zone +
    resolvedOptions.weights.start +
    resolvedOptions.weights.finish +
    resolvedOptions.weights.line;

  if (weightTotal <= 0) {
    return 0;
  }

  const weightedScore =
    zoneScore * resolvedOptions.weights.zone +
    startScore * resolvedOptions.weights.start +
    finishScore * resolvedOptions.weights.finish +
    lineScore * resolvedOptions.weights.line;

  return clamp(
    Math.pow(
      clamp(weightedScore / weightTotal, 0, 1),
      resolvedOptions.overallScoreExponent,
    ),
    0,
    1,
  );
};
