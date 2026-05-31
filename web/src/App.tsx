import { useEffect, useRef, useState } from "react";
import { KilterBoard } from "./Board/KilterBoard";
import { BoardLegend } from "./Board/BoardLegend";
import { RunGeneratorButton } from "./Board/RunGeneratorButton";
import { GeneratorStats } from "./Board/GeneratorStats.tsx";
import {
  generateCandidate,
  type GeneratedHold,
  type Grade,
  type GradeModifier,
} from "./Generator";
import type {
  HostToWorkerMessage,
  WorkerToHostMessage,
} from "./Generator/Workers/WorkerMessages.tsx";
import boardPlacements from "./Data/BoardPlacements.json";

const DEFAULT_GRADE: Grade = "v4";
const DEFAULT_ANGLE = 40;
const STATS_ITERATIONS = 1000;

const createGeneratorWorker = () =>
  new Worker(new URL("./Generator/Workers/GeneratorWorker.tsx", import.meta.url), {
    type: "module",
  });

export default function App() {
  const [selectedGrade, setSelectedGrade] = useState<Grade>(DEFAULT_GRADE);
  const [gradeModifier, setGradeModifier] = useState<GradeModifier>("base");
  const [selectedAngle, setSelectedAngle] = useState<number>(DEFAULT_ANGLE);
  const [selectedPlacements, setSelectedPlacements] = useState<GeneratedHold[]>(
    () =>
      generateCandidate({
        grade: DEFAULT_GRADE,
        modifier: "base",
        angle: DEFAULT_ANGLE,
      }).climb,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statsRunning, setStatsRunning] = useState(false);
  const [statsIteration, setStatsIteration] = useState(0);
  const [statsCurrentScore, setStatsCurrentScore] = useState<number | null>(
    null,
  );
  const [statsBestScore, setStatsBestScore] = useState<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const activeRequestRef = useRef<number | null>(null);

  useEffect(() => {
    const worker = createGeneratorWorker();
    workerRef.current = worker;

    const preloadMessage: HostToWorkerMessage = {
      type: "preload",
    };
    worker.postMessage(preloadMessage);

    worker.onmessage = (event: MessageEvent<WorkerToHostMessage>) => {
      const message = event.data;
      if ("requestId" in message && activeRequestRef.current !== message.requestId) {
        return;
      }
      if (message.type === "preload-error") {
        console.warn(`Model preload failed: ${message.error}`);
        return;
      }
      if (message.type === "preload-done") {
        return;
      }
      if (message.type === "progress") {
        setStatsIteration(message.iteration);
        setStatsCurrentScore(message.currentScore);
        setStatsBestScore(message.bestScore);
        if (message.bestUpdated) {
          setSelectedPlacements(message.bestCandidate.climb);
        }
        return;
      }
      if (message.type === "done") {
        setSelectedPlacements(message.candidate.climb);
        setErrorMessage(null);
        setStatsRunning(false);
        return;
      }
      if (message.type === "error") {
        setErrorMessage(message.error);
        setStatsRunning(false);
      }
    };

    worker.onerror = () => {
      setErrorMessage("Worker failed while generating.");
      setStatsRunning(false);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  async function handleGenerate() {
    const worker = workerRef.current;
    if (!worker) {
      setErrorMessage("Worker is not available.");
      return;
    }

    try {
      setStatsRunning(true);
      setStatsIteration(0);
      setStatsCurrentScore(null);
      setStatsBestScore(null);
      setErrorMessage(null);

      const requestId = (activeRequestRef.current ?? 0) + 1;
      activeRequestRef.current = requestId;

      const message: HostToWorkerMessage = {
        type: "generate",
        requestId,
        grade: selectedGrade,
        modifier: gradeModifier,
        angle: selectedAngle,
        iterations: STATS_ITERATIONS,
      };
      worker.postMessage(message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to generate a candidate climb.",
      );
      setStatsRunning(false);
    }
  }

  return (
    <div className="flex flex-wrap justify-center gap-4 p-4">
      <KilterBoard
        placements={boardPlacements}
        selectedPlacements={selectedPlacements}
        flipY={true}
      />

      <div className="grid gap-4 self-start">
        <RunGeneratorButton
          grade={selectedGrade}
          modifier={gradeModifier}
          angle={selectedAngle}
          onGradeChange={setSelectedGrade}
          onModifierChange={setGradeModifier}
          onAngleChange={setSelectedAngle}
          onGenerate={handleGenerate}
          errorMessage={errorMessage}
        />
        <GeneratorStats
          isRunning={statsRunning}
          currentIteration={statsIteration}
          totalIterations={STATS_ITERATIONS}
          currentScore={statsCurrentScore}
          bestScore={statsBestScore}
        />
        <BoardLegend />
      </div>
    </div>
  );
}