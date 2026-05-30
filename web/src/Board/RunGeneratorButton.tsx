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
      className="min-w-[50px] rounded-2xl bg-[var(--color-primary)] p-4 text-[var(--color-text)]"
    >
      <div className="grid gap-3">
        <label htmlFor={selectId} className="text-sm font-semibold">
          Target grade ({targetLabel})
        </label>
        <select
          id={selectId}
          value={grade}
          onChange={(event) => onGradeChange(event.target.value as Grade)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-[10px] py-2 text-slate-200"
        >
          {GRADE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {formatBaseGradeLabel(option)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-4">
          <label
            htmlFor={`${modifierId}-minus`}
            className="flex items-center gap-1.5"
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
            className="flex items-center gap-1.5"
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
        <label htmlFor={angleId} className="text-sm font-semibold">
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
          className="accent-blue-400"
        />
        <datalist id={angleTicksId}>
          {ANGLE_TICKS.map((tick) => (
            <option key={tick} value={tick} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={onGenerate}
          className="cursor-pointer rounded-lg border-0 bg-[var(--color-accent)] px-3 py-2.5 font-semibold text-slate-50"
        >
          Generate climb
        </button>
        {errorMessage ? (
          <div role="alert" className="text-[13px] text-red-300">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </section>
  );
}
