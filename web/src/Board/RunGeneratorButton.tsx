import { useId } from "react";
import type { Grade } from "../Generator";

const GRADE_OPTIONS: Grade[] = [
  "v0",
  "v1",
  "v2",
  "v3",
  "v4",
  "v5",
  "v6",
  "v7",
  "v8",
  "v9",
  "v10",
  "v11",
  "v12",
];

type RunGeneratorButtonProps = {
  grade: Grade;
  onGradeChange: (grade: Grade) => void;
  onGenerate: () => void;
  errorMessage?: string | null;
};

function formatGradeLabel(grade: Grade) {
  return `V${grade.slice(1)}`;
}

export function RunGeneratorButton({
  grade,
  onGradeChange,
  onGenerate,
  errorMessage,
}: RunGeneratorButtonProps) {
  const selectId = useId();

  return (
    <section
      aria-label="Generate a candidate climb"
      style={{
        background: "#111827",
        borderRadius: 16,
        fontFamily: "helvetica",
        color: "#e5e7eb",
        padding: 16,
        minWidth: 220,
      }}
    >
      <div style={{ display: "grid", gap: 12 }}>
        <label htmlFor={selectId} style={{ fontSize: 14, fontWeight: 600 }}>
          Target grade
        </label>
        <select
          id={selectId}
          value={grade}
          onChange={(event) => onGradeChange(event.target.value as Grade)}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid #374151",
            background: "#0f172a",
            color: "#e5e7eb",
          }}
        >
          {GRADE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatGradeLabel(option)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onGenerate}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "none",
            background: "#2563eb",
            color: "#f9fafb",
            fontWeight: 600,
            fontFamily: "Helvetica",
            cursor: "pointer",
          }}
        >
          Generate climb
        </button>
        {errorMessage ? (
          <div role="alert" style={{ color: "#fca5a5", fontSize: 13 }}>
            {errorMessage}
          </div>
        ) : null}
      </div>
    </section>
  );
}

