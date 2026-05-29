type ToggleGeneratorStatsProps = {
  isRunning: boolean;
  currentIteration: number;
  totalIterations: number;
  currentScore: number | null;
  bestScore: number | null;
};

const formatScore = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }
  return value.toFixed(3);
};

export function ToggleGeneratorStats({
  isRunning,
  currentIteration,
  totalIterations,
  currentScore,
  bestScore,
}: ToggleGeneratorStatsProps) {
  return (
    <section
      aria-label="Generator stats"
      style={{
        background: "#111827",
        borderRadius: 16,
        fontFamily: "helvetica",
        color: "#e5e7eb",
        padding: 16,
        minWidth: 50,
      }}
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Generator stats</div>
        <div style={{ fontSize: 13, color: "#cbd5f5" }}>
          {isRunning ? "Running" : "Idle"}
        </div>
        <div style={{ fontSize: 14 }}>
          Iteration: {currentIteration} / {totalIterations}
        </div>
        <div style={{ fontSize: 14 }}>
          Current score: {formatScore(currentScore)}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          Best score: {formatScore(bestScore)}
        </div>
      </div>
    </section>
  );
}
