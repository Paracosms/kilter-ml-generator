import { useState } from "react";
import { KilterBoard } from "./Board/KilterBoard";
import { BoardLegend } from "./Board/BoardLegend";
import { RunGeneratorButton } from "./Board/RunGeneratorButton";
import {
  generateBestCandidate,
  generateCandidate,
  type GeneratedHold,
  type Grade,
} from "./Generator";
import boardPlacements from "./Data/BoardPlacements.json";

const DEFAULT_GRADE: Grade = "v4";

export default function App() {
  const [selectedGrade, setSelectedGrade] = useState<Grade>(DEFAULT_GRADE);
  const [selectedPlacements, setSelectedPlacements] = useState<GeneratedHold[]>(
    () => generateCandidate({ grade: DEFAULT_GRADE }).climb,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleGenerate() {
    try {
      const candidate = await generateBestCandidate({ grade: selectedGrade });
      setSelectedPlacements(candidate.climb);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to generate a candidate climb.",
      );
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
          onGradeChange={setSelectedGrade}
          onGenerate={handleGenerate}
          errorMessage={errorMessage}
        />
        <BoardLegend />
      </div>
    </div>
  );
}