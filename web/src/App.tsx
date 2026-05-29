import { useState } from "react";
import { KilterBoard } from "./Board/KilterBoard";
import { BoardLegend } from "./Board/BoardLegend";
import { RunGeneratorButton } from "./Board/RunGeneratorButton";
import { ToggleGeneratorStats } from "./Board/ToggleGeneratorStats";
import {
  generateBestCandidate,
  generateCandidate,
  type GeneratedHold,
  type Grade,
  type GradeModifier,
} from "./Generator";
import boardPlacements from "./Data/BoardPlacements.json";

const DEFAULT_GRADE: Grade = "v4";
const DEFAULT_ANGLE = 40;
const STATS_ITERATIONS = 500;

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

  async function handleGenerate() {
    try {
      setStatsRunning(true);
      setStatsIteration(0);
      setStatsCurrentScore(null);
      setStatsBestScore(null);

      const candidate = await generateBestCandidate({
        grade: selectedGrade,
        modifier: gradeModifier,
        angle: selectedAngle,
        iterations: STATS_ITERATIONS,
        onProgress: async (progress) => {
          setStatsIteration(progress.iteration);
          setStatsCurrentScore(progress.currentScore);
          setStatsBestScore(progress.bestScore);

          if (progress.bestUpdated) {
            setSelectedPlacements(progress.bestCandidate.climb);
          }

          // Visualize each iteration
          const delayMs = 0.1;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        },
      });

      setSelectedPlacements(candidate.climb);
      setErrorMessage(null);
      setStatsRunning(false);
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
    <div
      style={{
        padding: 16,
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      <KilterBoard
        placements={boardPlacements}
        selectedPlacements={selectedPlacements}
        flipY={true}
      />

      <div style={{ display: "grid", gap: 16, alignSelf: "flex-start" }}>
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
        <ToggleGeneratorStats
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