import type { GeneratedCandidate, Grade, GradeModifier } from "../GeneratorUtils.tsx";

type GenerateRequest = {
  type: "generate";
  requestId: number;
  grade: Grade;
  modifier: GradeModifier;
  angle: number;
  iterations: number;
};

type PreloadRequest = {
  type: "preload";
};

export type HostToWorkerMessage = GenerateRequest | PreloadRequest;

export type ProgressMessage = {
  type: "progress";
  requestId: number;
  iteration: number;
  totalIterations: number;
  currentScore: number;
  bestScore: number;
  bestCandidate: GeneratedCandidate;
  bestUpdated: boolean;
};

export type DoneMessage = {
  type: "done";
  requestId: number;
  candidate: GeneratedCandidate;
};

export type ErrorMessage = {
  type: "error";
  requestId: number;
  error: string;
};

type PreloadDoneMessage = {
  type: "preload-done";
};

type PreloadErrorMessage = {
  type: "preload-error";
  error: string;
};

export type WorkerToHostMessage =
  | ProgressMessage
  | DoneMessage
  | ErrorMessage
  | PreloadDoneMessage
  | PreloadErrorMessage;
