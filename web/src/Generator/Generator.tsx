import boardPlacements from "../Data/BoardPlacements.json";
import { runDifficultyModel } from "./DifficultyEvaluator.tsx";
import { generateCandidate } from "./GenerateCandidate.tsx";
import {
  buildPlacementIndex,
  evaluateRealism,
  type Placement,
} from "./RealismEvaluator.tsx";
import {
  ROLE_ID_BY_NAME,
  type GeneratedCandidate,
  type Grade,
  type GradeModifier,
  type RoleId,
} from "./Types";

type PlacementEntry = {
  placementId: number;
  index: number;
  x: number;
  y: number;
};

type PlacementLookup = {
  placementToIdx: Map<number, number>;
  placementToXY: Map<number, { x: number; y: number }>;
  boardXMin: number;
  boardXMax: number;
  boardYMin: number;
  boardYMax: number;
  boardXSpan: number;
  boardYSpan: number;
  numPlacements: number;
};

type HoldRecord = { x: number; y: number; roleId: RoleId };

type CoordSummary = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  xSpread: number;
  ySpread: number;
  meanX: number;
  meanY: number;
};

type CoordStd = {
  stdX: number;
  stdY: number;
};

const ROLE_TO_CHANNEL: Record<RoleId, number> = {
  12: 0,
  13: 1,
  14: 2,
  15: 3,
};

const HAND_ROLE_IDS = new Set<RoleId>([
  ROLE_ID_BY_NAME.start,
  ROLE_ID_BY_NAME.regular,
  ROLE_ID_BY_NAME.finish,
]);

const NEARBY_FOOT_DISTANCE = 16;
const FEATURE_CHANNELS = 5;
const DEFAULT_BEST_OF_CANDIDATES = 500;

const placementLookup: PlacementLookup = (() => {
  const placementToIdx = new Map<number, number>();
  const placementToXY = new Map<number, { x: number; y: number }>();

  let boardXMin = Number.POSITIVE_INFINITY;
  let boardXMax = Number.NEGATIVE_INFINITY;
  let boardYMin = Number.POSITIVE_INFINITY;
  let boardYMax = Number.NEGATIVE_INFINITY;

  for (const placement of boardPlacements as PlacementEntry[]) {
    placementToIdx.set(placement.placementId, placement.index);
    placementToXY.set(placement.placementId, { x: placement.x, y: placement.y });

    boardXMin = Math.min(boardXMin, placement.x);
    boardXMax = Math.max(boardXMax, placement.x);
    boardYMin = Math.min(boardYMin, placement.y);
    boardYMax = Math.max(boardYMax, placement.y);
  }

  if (!Number.isFinite(boardXMin)) {
    boardXMin = 0;
    boardXMax = 0;
    boardYMin = 0;
    boardYMax = 0;
  }

  const boardXSpan = Math.max(boardXMax - boardXMin, 1);
  const boardYSpan = Math.max(boardYMax - boardYMin, 1);

  return {
    placementToIdx,
    placementToXY,
    boardXMin,
    boardXMax,
    boardYMin,
    boardYMax,
    boardXSpan,
    boardYSpan,
    numPlacements: placementToIdx.size,
  };
})();

const placementIndex = buildPlacementIndex(
  boardPlacements as unknown as Placement[],
);

const safeDiv = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : numerator / denominator;

const average = (values: number[]) =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const median = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
};

const coordSummary = (xs: number[], ys: number[]): CoordSummary => {
  if (xs.length === 0) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      xSpread: 0,
      ySpread: 0,
      meanX: 0,
      meanY: 0,
    };
  }

  let minX = xs[0];
  let maxX = xs[0];
  let minY = ys[0];
  let maxY = ys[0];
  let sumX = 0;
  let sumY = 0;

  for (let i = 0; i < xs.length; i += 1) {
    const x = xs[i];
    const y = ys[i];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    sumX += x;
    sumY += y;
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    xSpread: maxX - minX,
    ySpread: maxY - minY,
    meanX: sumX / xs.length,
    meanY: sumY / ys.length,
  };
};

const coordStd = (xs: number[], ys: number[]): CoordStd => {
  if (xs.length === 0) {
    return { stdX: 0, stdY: 0 };
  }

  const meanX = average(xs);
  const meanY = average(ys);
  let sumSqX = 0;
  let sumSqY = 0;

  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }

  return {
    stdX: Math.sqrt(sumSqX / xs.length),
    stdY: Math.sqrt(sumSqY / ys.length),
  };
};

const coordsForRoles = (records: HoldRecord[], roles: Set<RoleId>) => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const record of records) {
    if (!roles.has(record.roleId)) {
      continue;
    }
    xs.push(record.x);
    ys.push(record.y);
  }
  return { xs, ys };
};

const pairwiseDistances = (xs: number[], ys: number[]) => {
  const distances: number[] = [];
  if (xs.length < 2) {
    return distances;
  }
  for (let i = 0; i < xs.length; i += 1) {
    for (let j = i + 1; j < xs.length; j += 1) {
      const dx = xs[i] - xs[j];
      const dy = ys[i] - ys[j];
      distances.push(Math.hypot(dx, dy));
    }
  }
  return distances;
};

const nearestNeighborDistances = (xs: number[], ys: number[]) => {
  const distances: number[] = [];
  if (xs.length === 0) {
    return distances;
  }
  if (xs.length === 1) {
    return [0];
  }
  for (let i = 0; i < xs.length; i += 1) {
    let minDistance = Number.POSITIVE_INFINITY;
    for (let j = 0; j < xs.length; j += 1) {
      if (i === j) {
        continue;
      }
      const dx = xs[i] - xs[j];
      const dy = ys[i] - ys[j];
      const dist = Math.hypot(dx, dy);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }
    distances.push(minDistance === Number.POSITIVE_INFINITY ? 0 : minDistance);
  }
  return distances;
};

const crossMinDistance = (
  xsA: number[],
  ysA: number[],
  xsB: number[],
  ysB: number[],
) => {
  if (xsA.length === 0 || xsB.length === 0) {
    return 0;
  }
  let minDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < xsA.length; i += 1) {
    for (let j = 0; j < xsB.length; j += 1) {
      const dx = xsA[i] - xsB[j];
      const dy = ysA[i] - ysB[j];
      minDistance = Math.min(minDistance, Math.hypot(dx, dy));
    }
  }
  return minDistance === Number.POSITIVE_INFINITY ? 0 : minDistance;
};

const crossNearestDistances = (
  xsA: number[],
  ysA: number[],
  xsB: number[],
  ysB: number[],
) => {
  if (xsA.length === 0 || xsB.length === 0) {
    return [] as number[];
  }
  const distances: number[] = [];
  for (let i = 0; i < xsA.length; i += 1) {
    let minDistance = Number.POSITIVE_INFINITY;
    for (let j = 0; j < xsB.length; j += 1) {
      const dx = xsA[i] - xsB[j];
      const dy = ysA[i] - ysB[j];
      minDistance = Math.min(minDistance, Math.hypot(dx, dy));
    }
    distances.push(minDistance === Number.POSITIVE_INFINITY ? 0 : minDistance);
  }
  return distances;
};

const toThirdBin = (value: number, left: number, right: number) => {
  if (value < left) {
    return 0;
  }
  if (value < right) {
    return 1;
  }
  return 2;
};

export const buildCandidateFeatureVector = (
  candidate: GeneratedCandidate,
): Float32Array => {
  const numPlacements = placementLookup.numPlacements;
  const tensor = new Float32Array(FEATURE_CHANNELS * numPlacements);
  const records: HoldRecord[] = [];

  for (const hold of candidate.climb) {
    const channel = ROLE_TO_CHANNEL[hold.roleId];
    const placementIdx = placementLookup.placementToIdx.get(hold.placementId);
    if (channel !== undefined && placementIdx !== undefined) {
      tensor[channel * numPlacements + placementIdx] = 1;
    }

    const coords = placementLookup.placementToXY.get(hold.placementId);
    if (coords) {
      records.push({ x: coords.x, y: coords.y, roleId: hold.roleId });
    }
  }

  const totalHoldCount = records.length;
  const { xs: startXs, ys: startYs } = coordsForRoles(
    records,
    new Set([ROLE_ID_BY_NAME.start]),
  );
  const { xs: regularXs, ys: regularYs } = coordsForRoles(
    records,
    new Set([ROLE_ID_BY_NAME.regular]),
  );
  const { xs: finishXs, ys: finishYs } = coordsForRoles(
    records,
    new Set([ROLE_ID_BY_NAME.finish]),
  );
  const { xs: footXs, ys: footYs } = coordsForRoles(
    records,
    new Set([ROLE_ID_BY_NAME.foot]),
  );
  const { xs: handXs, ys: handYs } = coordsForRoles(records, HAND_ROLE_IDS);

  const startCount = startXs.length;
  const regularCount = regularXs.length;
  const finishCount = finishXs.length;
  const footCount = footXs.length;
  const handHoldCount = startCount + regularCount + finishCount;

  const allXs = records.map((record) => record.x);
  const allYs = records.map((record) => record.y);

  const allSummary = coordSummary(allXs, allYs);
  const allStd = coordStd(allXs, allYs);

  const handSummary = coordSummary(handXs, handYs);
  const handStd = coordStd(handXs, handYs);

  const startMeanX = startXs.length ? average(startXs) : 0;
  const startMeanY = startYs.length ? average(startYs) : 0;
  const finishMeanX = finishXs.length ? average(finishXs) : 0;
  const finishMeanY = finishYs.length ? average(finishYs) : 0;

  const startToFinishDx = finishMeanX - startMeanX;
  const startToFinishDy = finishMeanY - startMeanY;
  const startToFinishAbsDx = Math.abs(startToFinishDx);
  const startToFinishAbsDy = Math.abs(startToFinishDy);
  const startToFinishDistance = Math.hypot(startToFinishDx, startToFinishDy);

  const pairwise = pairwiseDistances(allXs, allYs);
  const meanPairwise = pairwise.length ? average(pairwise) : 0;
  const medianPairwise = pairwise.length ? median(pairwise) : 0;
  const minPairwise = pairwise.length ? Math.min(...pairwise) : 0;
  const maxPairwise = pairwise.length ? Math.max(...pairwise) : 0;
  const stdPairwise = pairwise.length ? coordStd(pairwise, pairwise).stdX : 0;

  const nearest = nearestNeighborDistances(allXs, allYs);
  const meanNearest = nearest.length ? average(nearest) : 0;
  const maxNearest = nearest.length ? Math.max(...nearest) : 0;

  const handNearest = nearestNeighborDistances(handXs, handYs);
  const meanHandNearest = handNearest.length ? average(handNearest) : 0;
  const maxHandNearest = handNearest.length ? Math.max(...handNearest) : 0;

  const startToNearestRegular = crossMinDistance(
    startXs,
    startYs,
    regularXs,
    regularYs,
  );
  const finishToNearestRegular = crossMinDistance(
    finishXs,
    finishYs,
    regularXs,
    regularYs,
  );
  const startToNearestFoot = crossMinDistance(startXs, startYs, footXs, footYs);
  const finishToNearestFoot = crossMinDistance(
    finishXs,
    finishYs,
    footXs,
    footYs,
  );

  const footSummary = coordSummary(footXs, footYs);
  const footMeanX = footXs.length ? average(footXs) : 0;
  const footMeanY = footYs.length ? average(footYs) : 0;

  let meanFootToNearestHandDistance = 0;
  let handsWithNearbyFootRatio = 0;
  if (footXs.length && handXs.length) {
    const handToFootDistances = crossNearestDistances(
      handXs,
      handYs,
      footXs,
      footYs,
    );
    const footToHandDistances = crossNearestDistances(
      footXs,
      footYs,
      handXs,
      handYs,
    );
    meanFootToNearestHandDistance = footToHandDistances.length
      ? average(footToHandDistances)
      : 0;
    const nearbyHands = handToFootDistances.filter(
      (distance) => distance <= NEARBY_FOOT_DISTANCE,
    ).length;
    handsWithNearbyFootRatio = safeDiv(nearbyHands, handHoldCount);
  }

  const xLeft = placementLookup.boardXMin + placementLookup.boardXSpan / 3;
  const xRight = placementLookup.boardXMin + (2 * placementLookup.boardXSpan) / 3;
  const yBottom = placementLookup.boardYMin + placementLookup.boardYSpan / 3;
  const yTop = placementLookup.boardYMin + (2 * placementLookup.boardYSpan) / 3;

  let leftHoldRatio = 0;
  let centerHoldRatio = 0;
  let rightHoldRatio = 0;
  let bottomThirdHoldRatio = 0;
  let middleThirdHoldRatio = 0;
  let topThirdHoldRatio = 0;
  let occupiedZoneCount = 0;
  let maxZoneHoldCount = 0;

  if (totalHoldCount) {
    let leftCount = 0;
    let centerCount = 0;
    let rightCount = 0;
    let bottomCount = 0;
    let middleCount = 0;
    let topCount = 0;
    const zoneCounts = new Map<string, number>();

    for (const record of records) {
      if (record.x < xLeft) {
        leftCount += 1;
      } else if (record.x < xRight) {
        centerCount += 1;
      } else {
        rightCount += 1;
      }

      if (record.y < yBottom) {
        bottomCount += 1;
      } else if (record.y < yTop) {
        middleCount += 1;
      } else {
        topCount += 1;
      }

      const xBin = toThirdBin(record.x, xLeft, xRight);
      const yBin = toThirdBin(record.y, yBottom, yTop);
      const zoneKey = `${xBin}-${yBin}`;
      zoneCounts.set(zoneKey, (zoneCounts.get(zoneKey) ?? 0) + 1);
    }

    leftHoldRatio = safeDiv(leftCount, totalHoldCount);
    centerHoldRatio = safeDiv(centerCount, totalHoldCount);
    rightHoldRatio = safeDiv(rightCount, totalHoldCount);

    bottomThirdHoldRatio = safeDiv(bottomCount, totalHoldCount);
    middleThirdHoldRatio = safeDiv(middleCount, totalHoldCount);
    topThirdHoldRatio = safeDiv(topCount, totalHoldCount);

    occupiedZoneCount = zoneCounts.size;
    maxZoneHoldCount = 0;
    for (const count of zoneCounts.values()) {
      maxZoneHoldCount = Math.max(maxZoneHoldCount, count);
    }
  }

  const metadataValues = [
    totalHoldCount,
    handHoldCount,
    startCount,
    regularCount,
    footCount,
    finishCount,
    safeDiv(footCount, totalHoldCount),
    safeDiv(regularCount, handHoldCount),
    safeDiv(candidate.sampledAngle, 70),
    allSummary.minX,
    allSummary.maxX,
    allSummary.minY,
    allSummary.maxY,
    allSummary.xSpread,
    allSummary.ySpread,
    allSummary.xSpread * allSummary.ySpread,
    safeDiv(allSummary.xSpread, allSummary.ySpread),
    allSummary.meanX,
    allSummary.meanY,
    allStd.stdX,
    allStd.stdY,
    handSummary.minX,
    handSummary.maxX,
    handSummary.minY,
    handSummary.maxY,
    handSummary.xSpread,
    handSummary.ySpread,
    handSummary.meanX,
    handSummary.meanY,
    handStd.stdX,
    handStd.stdY,
    startMeanX,
    startMeanY,
    finishMeanX,
    finishMeanY,
    startToFinishDx,
    startToFinishDy,
    startToFinishAbsDx,
    startToFinishAbsDy,
    startToFinishDistance,
    meanPairwise,
    medianPairwise,
    minPairwise,
    maxPairwise,
    stdPairwise,
    meanNearest,
    maxNearest,
    meanHandNearest,
    maxHandNearest,
    startToNearestRegular,
    finishToNearestRegular,
    startToNearestFoot,
    finishToNearestFoot,
    footMeanX,
    footMeanY,
    footSummary.xSpread,
    footSummary.ySpread,
    meanFootToNearestHandDistance,
    handsWithNearbyFootRatio,
    leftHoldRatio,
    centerHoldRatio,
    rightHoldRatio,
    bottomThirdHoldRatio,
    middleThirdHoldRatio,
    topThirdHoldRatio,
    occupiedZoneCount,
    maxZoneHoldCount,
  ];

  const metadataOffset = 4 * numPlacements;
  const metadataLen = Math.min(metadataValues.length, numPlacements);
  for (let i = 0; i < metadataLen; i += 1) {
    const clipped = Math.min(1, Math.max(0, metadataValues[i]));
    tensor[metadataOffset + i] = clipped;
  }

  return tensor;
};

export const predictCandidateDifficulty = async (
  candidate: GeneratedCandidate,
): Promise<number> => {
  const featureVector = buildCandidateFeatureVector(candidate);
  return runDifficultyModel(featureVector);
};

type BestCandidateOptions = {
  grade: Grade;
  modifier?: GradeModifier;
  rng?: () => number;
  maxPlacementRetries?: number;
  iterations?: number;
  onProgress?: (progress: {
    iteration: number;
    totalIterations: number;
    currentScore: number;
    bestScore: number;
    bestCandidate: GeneratedCandidate;
    bestUpdated: boolean;
  }) => void | Promise<void>;
};

const scoreCandidate = async (candidate: GeneratedCandidate) => {
  const realismScore = evaluateRealism(candidate, placementIndex);
  const modelDifficulty = await predictCandidateDifficulty(candidate);
  const difficultyError = candidate.targetDifficulty - modelDifficulty;
  const denominator = 1 + difficultyError * difficultyError;
  const score =
    denominator === 0 ? Number.POSITIVE_INFINITY : realismScore / denominator;
  return {
    candidate,
    score,
    realismScore,
    difficultyError,
    modelDifficulty,
  };
};

export const generateBestCandidate = async (
  options: BestCandidateOptions,
): Promise<GeneratedCandidate> => {
  const {
    iterations = DEFAULT_BEST_OF_CANDIDATES,
    onProgress,
    ...generateOptions
  } = options;
  let bestCandidate: GeneratedCandidate | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < iterations; i += 1) {
    let candidate: GeneratedCandidate;
    try {
      candidate = generateCandidate(generateOptions);
    } catch {
      continue;
    }

    const scored = await scoreCandidate(candidate);
    const bestUpdated = scored.score > bestScore;
    if (bestUpdated) {
      bestScore = scored.score;
      bestCandidate = scored.candidate;
    }

    if (onProgress) {
      const bestCandidateForProgress = bestCandidate ?? scored.candidate;
      await onProgress({
        iteration: i + 1,
        totalIterations: iterations,
        currentScore: scored.score,
        bestScore,
        bestCandidate: bestCandidateForProgress,
        bestUpdated,
      });
    }
  }

  if (!bestCandidate) {
    throw new Error("Failed to generate a candidate climb.");
  }

  return bestCandidate;
};
