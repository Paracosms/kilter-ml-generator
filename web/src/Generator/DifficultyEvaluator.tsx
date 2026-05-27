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
const modelFileName = "kilter_grade_regressor.fp32.onnx";

const ensureTrailingSlash = (value: string) =>
    value.endsWith("/") ? value : `${value}/`;

const buildPublicUrl = (baseUrl: string, relativePath: string) =>
    new URL(
        relativePath,
        `${window.location.origin}${ensureTrailingSlash(baseUrl)}`,
    ).toString();

const assertModelAssetsAvailable = async (modelUrl: string) => {
    const dataUrl = `${modelUrl}.data`;
    const check = async (url: string) => {
        const response = await fetch(url, { method: "HEAD", cache: "no-store" });
        if (!response.ok) {
            throw new Error(
                `Missing ONNX asset: ${url} (HTTP ${response.status}).`,
            );
        }
    };

    await Promise.all([check(modelUrl), check(dataUrl)]);
};

async function getSession() {
    if (session) return session;

    const baseUrl = isNodeRuntime
        ? "/"
        : (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
    const modelPublicPath = isNodeRuntime
        ? ""
        : buildPublicUrl(baseUrl, `onnx/${modelFileName}`);
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

    try {
        await assertModelAssetsAvailable(modelPublicPath);
        session = await ortWeb.InferenceSession.create(modelPublicPath, {
            executionProviders: ["wasm"],
        });
        return session;
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unknown ONNX load error.";
        throw new Error(`${message} Model URL: ${modelPublicPath}`);
    }
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
