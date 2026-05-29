import { useId } from "react";
import type { Grade, GradeModifier } from "../Generator";

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

const ANGLE_TICKS = Array.from({ length: 15 }, (_, index) => index * 5);

type RunGeneratorButtonProps = {
  grade: Grade;
  modifier: GradeModifier;
  angle: number;
  onGradeChange: (grade: Grade) => void;
  onModifierChange: (modifier: GradeModifier) => void;
  onAngleChange: (angle: number) => void;
  onGenerate: () => void;
  errorMessage?: string | null;
};

function formatBaseGradeLabel(grade: Grade) {
  return `V${grade.slice(1)}`;
}

function formatTargetGradeLabel(grade: Grade, modifier: GradeModifier) {
  const baseLabel = formatBaseGradeLabel(grade);
  if (modifier === "minus") {
    return `${baseLabel}-`;
  }
  if (modifier === "plus") {
    return `${baseLabel}+`;
  }
  return baseLabel;
}

export function RunGeneratorButton({
  grade,
  modifier,
  angle,
  onGradeChange,
  onModifierChange,
  onAngleChange,
  onGenerate,
  errorMessage,
}: RunGeneratorButtonProps) {
  const selectId = useId();
  const modifierId = useId();
  const angleId = useId();
  const angleTicksId = useId();
  const targetLabel = formatTargetGradeLabel(grade, modifier);

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
          Target grade ({targetLabel})
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
              {formatBaseGradeLabel(option)}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <label
            htmlFor={`${modifierId}-minus`}
            style={{ display: "flex", gap: 6, alignItems: "center" }}
          >
            <input
              id={`${modifierId}-minus`}
              type="checkbox"
              checked={modifier === "minus"}
              onChange={(event) =>
                onModifierChange(event.target.checked ? "minus" : "base")
              }
            />
            V-
          </label>
          <label
            htmlFor={`${modifierId}-plus`}
            style={{ display: "flex", gap: 6, alignItems: "center" }}
          >
            <input
              id={`${modifierId}-plus`}
              type="checkbox"
              checked={modifier === "plus"}
              onChange={(event) =>
                onModifierChange(event.target.checked ? "plus" : "base")
              }
            />
            V+
          </label>
        </div>
        <label htmlFor={angleId} style={{ fontSize: 14, fontWeight: 600 }}>
          Angle ({angle}°)
        </label>
        <input
          id={angleId}
          type="range"
          min={0}
          max={70}
          step={5}
          value={angle}
          list={angleTicksId}
          onChange={(event) => onAngleChange(Number(event.target.value))}
          style={{ accentColor: "#60a5fa" }}
        />
        <datalist id={angleTicksId}>
          {ANGLE_TICKS.map((tick) => (
            <option key={tick} value={tick} />
          ))}
        </datalist>
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
