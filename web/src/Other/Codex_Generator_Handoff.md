# Kilter Generator Implementation Handoff for Codex

## Current State

This is a static browser app for generating Kilter Board 12x12 boulder problems.

The frontend already understands climbs as arrays of:

```ts
{ placementId: number; roleId: number }
```

Role IDs are fixed:

```ts
12 = start
13 = regular
14 = finish
15 = foot
```

A trained regression model exists or is being integrated separately. It predicts `difficulty_numeric` from a feature vector built from climb holds plus metadata. The generator should not be neural. It should be statistical and use precomputed V-grade profiles from:

```text
web/src/Data/GeneratorStats.json
```

`GeneratorStats.json` contains per-grade profiles for `v0` through `v12`, generated from the training split.

Top-level shape:

```ts
{
  metadata: {
    joint_role_count_format: "start-regular-foot-finish";
    placement_id_type: "kilter_placement_id";
    generated_from_split: "train";
  };
  v0: GradeProfile;
  v1: GradeProfile;
  ...
  v12: GradeProfile;
}
```

Each grade profile contains:

```ts
type GradeProfile = {
  sample_size: number;
  difficulty_numeric: SummaryStats;
  range_x: SummaryStats;
  range_y: SummaryStats;
  horizontal_start_to_finish: SummaryStats;
  vertical_start_to_finish: SummaryStats;
  euclidean_start_to_finish: SummaryStats;
  discrete_distributions: {
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
};

type SummaryStats = {
  mean: number;
  std: number;
  p05: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
};
```

Important notes:

- `joint_role_count` keys are formatted as `start-regular-foot-finish`, for example `2-5-4-1`.
- Placement IDs greater than or equal to 4000 are valid for this project.
- Some very easy climbs can have many holds; do not add assumptions rejecting high hold counts.
- An external filter will run after candidate generation, so the first generator should stay simple.
- Avoid duplicate placement IDs inside a generated climb.
- Do not add a backend.
- Do not ship or depend on the original SQLite dataset in the browser.

## Goal

Implement the first TypeScript statistical generator that can create candidate climbs from `GeneratorStats.json`.

The generator should accept:

```ts
type Grade = "v0" | "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | "v8" | "v9" | "v10" | "v11" | "v12";
type GradeModifier = "minus" | "base" | "plus";
```

It should return a generated candidate like:

```ts
type GeneratedCandidate = {
  climb: Array<{ placementId: number; roleId: number }>;
  grade: Grade;
  modifier: GradeModifier;
  targetDifficulty: number;
  sampledAngle: number;
  sampledRoleCounts: {
    start: number;
    regular: number;
    foot: number;
    finish: number;
  };
};
```

## Target Difficulty Mapping

For a requested grade and modifier:

```ts
minus -> profile.difficulty_numeric.p25
base  -> profile.difficulty_numeric.p50
plus  -> profile.difficulty_numeric.p75
```

## Sampling Flow

1. Load/import `GeneratorStats.json` from `web/src/Data/GeneratorStats.json`.
2. Select the requested grade profile.
3. Determine target difficulty using p25/p50/p75.
4. Sample angle from `profile.discrete_distributions.angles`.
5. Sample joint role count from `profile.discrete_distributions.joint_role_count`.
6. Parse role count key as `start-regular-foot-finish`.
7. For each role, sample that many placement IDs from `profile.discrete_distributions.placement_ids[role]`.
8. Prevent duplicate placement IDs across all roles.
9. Convert roles to role IDs:
   - start -> 12
   - regular -> 13
   - finish -> 14
   - foot -> 15
10. Return the generated candidate.

## Suggested Files

Use existing project structure if it differs, but a clean first implementation could be:

```text
web/src/ml/generator/types.ts
web/src/ml/generator/weightedSample.ts
web/src/ml/generator/generatorStats.ts
web/src/ml/generator/generateCandidate.ts
web/src/ml/generator/index.ts
```

### `types.ts`

Define shared types for grades, modifiers, summary stats, grade profiles, generated holds, and generated candidates.

### `weightedSample.ts`

Implement reusable weighted sampling from `Record<string, number>`.

Useful functions:

```ts
export function weightedSampleKey(distribution: Record<string, number>, rng?: () => number): string;
export function weightedSampleNumber(distribution: Record<string, number>, rng?: () => number): number;
```

The sampler should tolerate tiny floating point sum errors. It should not require the distribution to sum exactly to 1.

### `generatorStats.ts`

Import the JSON and expose typed accessors:

```ts
export function getGradeProfile(grade: Grade): GradeProfile;
export function getTargetDifficulty(profile: GradeProfile, modifier: GradeModifier): number;
```

### `generateCandidate.ts`

Implement:

```ts
export function generateCandidate(options: {
  grade: Grade;
  modifier?: GradeModifier;
  rng?: () => number;
  maxPlacementRetries?: number;
}): GeneratedCandidate;
```

Default modifier: `base`.

Default RNG: `Math.random`.

Default maxPlacementRetries: something reasonable like `50` per hold.

Duplicate handling:

- Maintain a `Set<number>` of used placement IDs.
- If a sampled placement ID is already used, resample for that role.
- If retries fail, restart the whole candidate a limited number of times or throw a clear error.

Role order for parsing joint count:

```ts
const [start, regular, foot, finish] = key.split("-").map(Number);
```

Output role order in `climb` does not matter for rendering/model encoding, but for readability use:

1. starts
2. regulars
3. feet
4. finishes

## Later Integration Points

Do not implement these unless obvious existing functions already exist:

- Encode generated candidate using existing feature encoder.
- Score with ONNX regression model.
- Run external filter.
- Generate many candidates and rank by `abs(predictedDifficulty - targetDifficulty)`.
- Move generation/scoring to a Web Worker.

For now, focus on generating valid candidate objects from the stats file.

## Acceptance Checks

After implementation, add or run a quick sanity check that:

1. `generateCandidate({ grade: "v4" })` returns a non-empty climb.
2. Every hold has a numeric `placementId` and valid `roleId`.
3. No duplicate `placementId` exists in the climb.
4. `sampledRoleCounts` matches the actual role counts in `climb`.
5. `sampledAngle` is numeric.
6. `targetDifficulty` equals the grade profile p25/p50/p75 depending on modifier.
7. Placement IDs >= 4000 are not rejected just because of their value.

## Avoid

- Do not build a neural generator.
- Do not add hard-coded grade-specific rules.
- Do not reject 30+ hold climbs just because they are large.
- Do not add a backend.
- Do not modify the regression feature encoder unless required by existing imports.
- Do not change role IDs.
