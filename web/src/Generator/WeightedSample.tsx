const EPSILON = 1e-12;

type Distribution = Record<string, number>;

export function weightedSampleKey(
  distribution: Distribution,
  rng: () => number = Math.random,
): string {
  const entries = Object.entries(distribution).filter(
    ([, weight]) => weight > 0,
  );

  if (entries.length === 0) {
    throw new Error("Weighted sample distribution is empty.");
  }

  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (totalWeight <= EPSILON) {
    throw new Error("Weighted sample distribution has no positive weight.");
  }

  const target = rng() * totalWeight;
  let cumulative = 0;

  for (const [key, weight] of entries) {
    cumulative += weight;
    if (target <= cumulative + EPSILON) {
      return key;
    }
  }

  return entries[entries.length - 1][0];
}

export function weightedSampleNumber(
  distribution: Distribution,
  rng: () => number = Math.random,
): number {
  return Number(weightedSampleKey(distribution, rng));
}

