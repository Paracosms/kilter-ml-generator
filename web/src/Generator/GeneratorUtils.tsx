import generatorStatsJson from "../Data/GeneratorStats.json";

export type Grade =
  | "v0"
  | "v1"
  | "v2"
  | "v3"
  | "v4"
  | "v5"
  | "v6"
  | "v7"
  | "v8"
  | "v9"
  | "v10"
  | "v11"
  | "v12";

export type GradeModifier = "minus" | "base" | "plus";

export type RoleName = "start" | "regular" | "foot" | "finish";

export type RoleId = 12 | 13 | 14 | 15;

export const ROLE_ID_BY_NAME: Record<RoleName, RoleId> = {
  start: 12,
  regular: 13,
  finish: 14,
  foot: 15,
};

export const ROLE_NAMES_IN_ORDER: RoleName[] = [
  "start",
  "regular",
  "foot",
  "finish",
];

export type SummaryStats = {
  mean: number;
  std: number;
  p05: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
};

export type DiscreteDistributions = {
  num_holds: Record<string, number>;
  angles: Record<string, number>;
  role_counts: {
    start: Record<string, number>;
    regular: Record<string, number>;
    foot: Record<string, number>;
    finish: Record<string, number>;
  };
  placement_ids: {
    start: Record<string, number>;
    regular: Record<string, number>;
    foot: Record<string, number>;
    finish: Record<string, number>;
  };
  joint_role_count: Record<string, number>;
};

export type GradeProfile = {
  sample_size: number;
  difficulty_numeric: SummaryStats;
  range_x: SummaryStats;
  range_y: SummaryStats;
  horizontal_start_to_finish: SummaryStats;
  vertical_start_to_finish: SummaryStats;
  euclidean_start_to_finish: SummaryStats;
  discrete_distributions: DiscreteDistributions;
};

export type GeneratorStats = {
  metadata: {
    joint_role_count_format: string;
    placement_id_type: string;
    generated_from_split: string;
  };
} & Record<Grade, GradeProfile>;

const generatorStats = generatorStatsJson as GeneratorStats;

export function getGradeProfile(grade: Grade): GradeProfile {
  return generatorStats[grade];
}

export function getTargetDifficulty(
  profile: GradeProfile,
  modifier: GradeModifier,
): number {
  switch (modifier) {
    case "minus":
      return profile.difficulty_numeric.p25;
    case "plus":
      return profile.difficulty_numeric.p75;
    case "base":
    default:
      return profile.difficulty_numeric.p50;
  }
}

export type GeneratedHold = {
  placementId: number;
  roleId: RoleId;
};

export type SampledRoleCounts = {
  start: number;
  regular: number;
  foot: number;
  finish: number;
};

export type GeneratedCandidate = {
  climb: GeneratedHold[];
  grade: Grade;
  modifier: GradeModifier;
  targetDifficulty: number;
  sampledAngle: number;
  sampledRoleCounts: SampledRoleCounts;
};
