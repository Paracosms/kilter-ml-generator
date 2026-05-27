// evaluates difficultyError using a pretrained python model loaded using ONNX
// inputs: GeneratedCandidate
// outputs: predictedDifficulty

// this module needs to take GeneratedCandidate and convert it into the input form the model expects
// model expects:
    // placementId + typeId
    // angle of climb
// preprocessing turns GeneratedCandidate form into an input for the model
// input is ran through model and produces output

import * as ortWeb from "onnxruntime-web";

let session: ortWeb.InferenceSession | null = null;

const isNodeRuntime = typeof window === "undefined";
const modelFileName = "KilterDifficultyRegressor.fp32.onnx";

async function getSession() {
    if (session) return session;

    const baseUrl = isNodeRuntime
        ? "/"
        : (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
    const modelPublicPath = `${baseUrl}onnx/${modelFileName}`;
    const modelFileUrl = new URL(`../../public/onnx/${modelFileName}`, import.meta.url);

    if (isNodeRuntime) {
        const ortNode = await import("onnxruntime-node");
        const { fileURLToPath } = await import("node:url");
        const modelPath = fileURLToPath(modelFileUrl);
        session = await ortNode.InferenceSession.create(modelPath, {
            executionProviders: ["cpu"],
        });
        return session;
    }

    session = await ortWeb.InferenceSession.create(modelPublicPath, {
        executionProviders: ["wasm"],
    });

    return session;
}

export async function runDifficultyModel(featureVector: Float32Array) {
    const modelSession = await getSession();

    const featureDim = featureVector.length;

    const inputTensor = new ortWeb.Tensor("float32", featureVector, [
        1,
        featureDim,
    ]);

    const results = await modelSession.run({
        features: inputTensor,
    });

    const outputTensor = results.difficulty;
    const outputData = outputTensor.data as Float32Array;

    return outputData[0];
}
