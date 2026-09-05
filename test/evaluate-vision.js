/**
 * PrivacyShield - Vision Model Benchmark Evaluator
 * Runs the integrated Local Vision Transformer (Screen ViT) benchmark.
 */
const { ScreenViTModel } = require('../lib/vision/screen-vit');

async function runVisionEvaluation() {
  console.log('========================================================================');
  console.log('👁️  LOCAL VISION TRANSFORMER (SCREEN ViT) BENCHMARK:');
  console.log('========================================================================');

  const memBefore = process.memoryUsage().heapUsed;
  const vitModel = new ScreenViTModel();

  const loadStartTime = performance.now();
  await vitModel.initModel();
  const loadDurationMs = performance.now() - loadStartTime;
  const memAfter = process.memoryUsage().heapUsed;

  const sampleSyntheticCanvas = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const iterations = 50;
  const infStartTime = performance.now();
  let sampleResult = null;
  for (let i = 0; i < iterations; i++) {
    sampleResult = await vitModel.classifyScreen(sampleSyntheticCanvas);
  }
  const totalInfMs = performance.now() - infStartTime;
  const avgInfMs = totalInfMs / iterations;

  const memDeltaMB = (memAfter - memBefore) / (1024 * 1024);

  console.log(`• Model Status:         ${vitModel.getStatus().isLoaded ? '✔ LOADED' : '✕ FAILED'}`);
  console.log(`• Execution Provider:   ${sampleResult ? sampleResult.executionProvider : vitModel.getStatus().executionProvider}`);
  console.log(`• Model Load Time:      ${loadDurationMs.toFixed(2)} ms`);
  console.log(`• Heap Memory Impact:   +${memDeltaMB.toFixed(2)} MB`);
  console.log(`• Average Latency:      ${avgInfMs.toFixed(3)} ms / frame (${iterations} benchmark runs)`);
  console.log(`• Visual Classification: [${sampleResult?.visualPageType}] ${sampleResult?.visualLabel} (Confidence: ${(sampleResult?.visualConfidence * 100).toFixed(0)}%)`);
  console.log('========================================================================\n');
}

if (require.main === module) {
  runVisionEvaluation();
}

module.exports = { runVisionEvaluation };
