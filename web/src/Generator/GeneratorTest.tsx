import { generateCandidate } from "./GenerateCandidate.tsx";
import { predictCandidateDifficulty } from "./Generator.tsx";
import {
  getGradeProfile,
  getTargetDifficulty,
  type GeneratedCandidate,
  type Grade,
  type GradeModifier,
  type RoleId,
} from "./GeneratorUtils.tsx";

const VALID_ROLE_IDS = new Set([12, 13, 14, 15]);

const HARDCODED_PLACEMENTS: Record<string, RoleId> = {
  "1137": 15,
  "1154": 15,
  "1157": 15,
  "1190": 15,
  "1205": 12,
  "1206": 12,
  "1219": 15,
  "1221": 15,
  "1223": 13,
  "1257": 13,
  "1259": 13,
  "1275": 13,
  "1305": 14,
  "1306": 13,
  "1308": 13,
};
const HARDCODED_ANGLE = 35.0;
const HARDCODED_GRADE: Grade = "v4";
const HARDCODED_MODIFIER: GradeModifier = "base";

type SanityCheckResult = {
  candidate: GeneratedCandidate;
};

export function runGeneratorSanityCheck(
  grade: Grade = "v4",
): SanityCheckResult {
  const candidate = generateCandidate({ grade });

  if (candidate.climb.length === 0) {
    throw new Error("Sanity check failed: climb is empty.");
  }

  const seenPlacements = new Set<number>();
  const countedRoles = {
    start: 0,
    regular: 0,
    foot: 0,
    finish: 0,
  };

  for (const hold of candidate.climb) {
    if (!VALID_ROLE_IDS.has(hold.roleId)) {
      throw new Error("Sanity check failed: invalid roleId found.");
    }

    if (seenPlacements.has(hold.placementId)) {
      throw new Error("Sanity check failed: duplicate placementId found.");
    }

    seenPlacements.add(hold.placementId);

    switch (hold.roleId) {
      case 12:
        countedRoles.start += 1;
        break;
      case 13:
        countedRoles.regular += 1;
        break;
      case 14:
        countedRoles.finish += 1;
        break;
      case 15:
        countedRoles.foot += 1;
        break;
    }
  }

  if (Number.isNaN(candidate.sampledAngle)) {
    throw new Error("Sanity check failed: sampledAngle is not numeric.");
  }

  const profile = getGradeProfile(candidate.grade);
  const expectedDifficulty = getTargetDifficulty(profile, candidate.modifier);
  if (candidate.targetDifficulty !== expectedDifficulty) {
    throw new Error("Sanity check failed: targetDifficulty mismatch.");
  }

  const sampled = candidate.sampledRoleCounts;
  if (
    sampled.start !== countedRoles.start ||
    sampled.regular !== countedRoles.regular ||
    sampled.foot !== countedRoles.foot ||
    sampled.finish !== countedRoles.finish
  ) {
    throw new Error("Sanity check failed: role counts mismatch.");
  }

  return { candidate };
}

const buildHardcodedCandidate = (): GeneratedCandidate => {
  const climb = Object.entries(HARDCODED_PLACEMENTS).map(
    ([placementId, roleId]) => ({
      placementId: Number(placementId),
      roleId,
    }),
  );

  const sampledRoleCounts = {
    start: 0,
    regular: 0,
    foot: 0,
    finish: 0,
  };

  for (const hold of climb) {
    switch (hold.roleId) {
      case 12:
        sampledRoleCounts.start += 1;
        break;
      case 13:
        sampledRoleCounts.regular += 1;
        break;
      case 14:
        sampledRoleCounts.finish += 1;
        break;
      case 15:
        sampledRoleCounts.foot += 1;
        break;
    }
  }

  const profile = getGradeProfile(HARDCODED_GRADE);
  const targetDifficulty = getTargetDifficulty(profile, HARDCODED_MODIFIER);

  return {
    climb,
    grade: HARDCODED_GRADE,
    modifier: HARDCODED_MODIFIER,
    targetDifficulty,
    sampledAngle: HARDCODED_ANGLE,
    sampledRoleCounts,
  };
};

export async function runHardcodedDifficultyTest() {
  const candidate = buildHardcodedCandidate();
  const predictedDifficulty = await predictCandidateDifficulty(candidate);

  if (!Number.isFinite(predictedDifficulty)) {
    throw new Error("Hardcoded difficulty test failed: model output invalid.");
  }

  return { candidate, predictedDifficulty };
}
