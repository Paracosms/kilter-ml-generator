import {
  runGeneratorSanityCheck,
  runHardcodedDifficultyTest,
} from "../src/Generator/GeneratorTest";

const main = async () => {
  const { candidate } = runGeneratorSanityCheck("v4");

  console.log("Generator sanity check passed.");
  console.log(`Generated climb holds: ${candidate.climb.length}`);
  console.log(`Target difficulty: ${candidate.targetDifficulty}`);

  const { predictedDifficulty } = await runHardcodedDifficultyTest();
  console.log(`Hardcoded predicted difficulty [ONNX]: ${predictedDifficulty}`);
  console.log(`Hardcoded predicted difficulty [PYTHON]: 11.20529`);
};

main().catch((error) => {
  console.error(error);
});
