import { useEffect, useRef, useState } from "react";

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

const formatDuration = (valueMs: number | null) => {
  if (valueMs === null) {
    return "--";
  }
  return `${Math.round(valueMs)} ms`;
};

export function GeneratorStats({
  currentIteration,
  totalIterations,
  currentScore,
  bestScore,
}: ToggleGeneratorStatsProps) {
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const stopTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (currentIteration === 0) {
      startTimeRef.current = null;
      stopTimeRef.current = null;
      //setElapsedMs(0);
    }
  }, [currentIteration]);

  useEffect(() => {
    if (currentIteration > 0 && startTimeRef.current === null) {
      startTimeRef.current = performance.now();
    }
  }, [currentIteration]);

  useEffect(() => {
    if (startTimeRef.current === null) {
      return;
    }

    const isFinished =
      totalIterations > 0 &&
      currentIteration >= totalIterations &&
      currentScore !== null;

    if (isFinished) {
      if (stopTimeRef.current === null) {
        stopTimeRef.current = performance.now();
      }
      setElapsedMs(stopTimeRef.current - startTimeRef.current);
      return;
    }

    stopTimeRef.current = null;

    const tick = () => {
      if (startTimeRef.current !== null) {
        setElapsedMs(performance.now() - startTimeRef.current);
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [currentIteration, totalIterations, currentScore]);

  const elapsedLabel = formatDuration(elapsedMs);

  return (
    <section
      className="min-w-[50px] rounded-2xl bg-[var(--color-primary)] p-4 text-[var(--color-text)]"
    >
      <div className="grid gap-3">
        <div className="text-sm font-semibold">Generator Stats</div>
        <div className="text-[13px] text-[var(--color-text)]">
          Time: {elapsedLabel}
        </div>
        <div className="text-sm">
          Iteration: {currentIteration} / {totalIterations}
        </div>
        <div className="text-sm">
          Current score: {formatScore(currentScore)}
        </div>
        <div className="text-sm font-semibold">
          Best score: {formatScore(bestScore)}
        </div>
      </div>
    </section>
  );
}
