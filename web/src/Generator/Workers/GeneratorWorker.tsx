import { generateBestCandidate } from "../Generator.tsx";
import { preloadDifficultyModel } from "../Evaluators/DifficultyEvaluator.tsx";
import type {
  HostToWorkerMessage,
  WorkerToHostMessage,
} from "./WorkerMessages.tsx";

// @ts-ignore
const ctx = self as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<HostToWorkerMessage>) => {
  const message = event.data;
  if (message.type === "preload") {
    try {
      await preloadDifficultyModel();
      const doneMessage: WorkerToHostMessage = {
        type: "preload-done",
      };
      ctx.postMessage(doneMessage);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to preload the model.";
      const errorPayload: WorkerToHostMessage = {
        type: "preload-error",
        error: errorMessage,
      };
      ctx.postMessage(errorPayload);
    }
    return;
  }
  if (message.type !== "generate") {
    return;
  }

  try {
    const candidate = await generateBestCandidate({
      grade: message.grade,
      modifier: message.modifier,
      angle: message.angle,
      iterations: message.iterations,
      onProgress: (progress) => {
        const progressMessage: WorkerToHostMessage = {
          type: "progress",
          requestId: message.requestId,
          ...progress,
        };
        ctx.postMessage(progressMessage);
      },
    });

    const doneMessage: WorkerToHostMessage = {
      type: "done",
      requestId: message.requestId,
      candidate,
    };
    ctx.postMessage(doneMessage);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to generate a candidate climb.";
    const errorPayload: WorkerToHostMessage = {
      type: "error",
      requestId: message.requestId,
      error: errorMessage,
    };
    ctx.postMessage(errorPayload);
  }
};
