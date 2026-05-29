import { getGradeProfile, getTargetDifficulty } from "./GeneratorStats.tsx";
import {
  ROLE_ID_BY_NAME,
  ROLE_NAMES_IN_ORDER,
  type GeneratedCandidate,
  type Grade,
  type GradeModifier,
  type RoleName,
  type SampledRoleCounts,
} from "./Types.tsx";
import { weightedSampleKey, weightedSampleNumber } from "./WeightedSample.tsx";

const DEFAULT_MAX_PLACEMENT_RETRIES = 50;
const DEFAULT_MAX_CANDIDATE_RETRIES = 5;
const MIN_ANGLE = 0;
const MAX_ANGLE = 70;

type GenerateCandidateOptions = {
  grade: Grade;
  modifier?: GradeModifier;
  angle?: number;
  rng?: () => number;
  maxPlacementRetries?: number;
};

function parseRoleCounts(key: string): SampledRoleCounts {
  const [start, regular, foot, finish] = key.split("-").map(Number);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(regular) ||
    !Number.isFinite(foot) ||
    !Number.isFinite(finish)
  ) {
    throw new Error(`Invalid joint_role_count key: ${key}`);
  }

  return { start, regular, foot, finish };
}

function sampleUniquePlacement(
  distribution: Record<string, number>,
  usedPlacements: Set<number>,
  rng: () => number,
  maxPlacementRetries: number,
): number {
  for (let attempt = 0; attempt < maxPlacementRetries; attempt += 1) {
    const sampled = weightedSampleNumber(distribution, rng);
    if (!Number.isFinite(sampled)) {
      continue;
    }

    if (!usedPlacements.has(sampled)) {
      return sampled;
    }
  }

  throw new Error("Failed to sample a unique placement ID.");
}

function buildRoleHolds(
  role: RoleName,
  count: number,
  distribution: Record<string, number>,
  usedPlacements: Set<number>,
  rng: () => number,
  maxPlacementRetries: number,
): Array<{ placementId: number; roleId: number }> {
  const holds: Array<{ placementId: number; roleId: number }> = [];
  for (let index = 0; index < count; index += 1) {
    const placementId = sampleUniquePlacement(
      distribution,
      usedPlacements,
      rng,
      maxPlacementRetries,
    );
    usedPlacements.add(placementId);
    holds.push({ placementId, roleId: ROLE_ID_BY_NAME[role] });
  }

  return holds;
}

const clampAngle = (value: number) =>
  Math.min(MAX_ANGLE, Math.max(MIN_ANGLE, value));

export function generateCandidate(
  options: GenerateCandidateOptions,
): GeneratedCandidate {
  const modifier = options.modifier ?? "base";
  const rng = options.rng ?? Math.random;
  const maxPlacementRetries =
    options.maxPlacementRetries ?? DEFAULT_MAX_PLACEMENT_RETRIES;

  const profile = getGradeProfile(options.grade);
  const targetDifficulty = getTargetDifficulty(profile, modifier);

  for (
    let candidateAttempt = 0;
    candidateAttempt < DEFAULT_MAX_CANDIDATE_RETRIES;
    candidateAttempt += 1
  ) {
    const sampledAngle = Number.isFinite(options.angle)
      ? clampAngle(options.angle as number)
      : weightedSampleNumber(profile.discrete_distributions.angles, rng);
    const roleKey = weightedSampleKey(
      profile.discrete_distributions.joint_role_count,
      rng,
    );
    const sampledRoleCounts = parseRoleCounts(roleKey);
    const totalHolds =
      sampledRoleCounts.start +
      sampledRoleCounts.regular +
      sampledRoleCounts.foot +
      sampledRoleCounts.finish;

    if (totalHolds <= 0) {
      continue;
    }

    const usedPlacements = new Set<number>();
    const climb: Array<{ placementId: number; roleId: number }> = [];

    try {
      for (const role of ROLE_NAMES_IN_ORDER) {
        const count = sampledRoleCounts[role];
        if (count <= 0) {
          continue;
        }

        const placements = buildRoleHolds(
          role,
          count,
          profile.discrete_distributions.placement_ids[role],
          usedPlacements,
          rng,
          maxPlacementRetries,
        );
        climb.push(...placements);
      }
    } catch (error) {
      if (candidateAttempt + 1 >= DEFAULT_MAX_CANDIDATE_RETRIES) {
        throw error;
      }
      continue;
    }

    return {
    // @ts-ignore
      climb,
      grade: options.grade,
      modifier,
      targetDifficulty,
      sampledAngle,
      sampledRoleCounts,
    };
  }

  throw new Error("Failed to generate a candidate climb.");
}

