import generatorStatsJson from "../Data/GeneratorStats.json";
import type {
  Grade,
  GradeModifier,
  GradeProfile,
  GeneratorStats,
} from "./Types.tsx";

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

