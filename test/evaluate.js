/**
 * PrivacyShield - Ground Truth Evaluation & Benchmark Suite
 * Evaluates detection precision, recall, F1-score, Verhoeff/Luhn checksum accuracy,
 * span deduplication, and execution latency.
 */

const fs = require('fs');
const path = require('path');

// Import Core Engines
const Verhoeff = require('../lib/pii/verhoeff');
const Luhn = require('../lib/pii/luhn');
const PIIRulesEngine = require('../lib/pii/regex-rules');
const { TextPIIDetector } = require('../lib/pii/text-detector');

console.log('========================================================================');
console.log('🛡️  PrivacyShield - Precision & Recall Evaluation Benchmark (ISRO SIH)');
console.log('========================================================================\n');

// 1. GROUND TRUTH TEST DATASET
const GroundTruthDataset = [
  // AADHAAR NUMBERS (Valid Verhoeff vs Invalid)
  { type: 'AADHAAR', value: '2345 6789 0124', shouldMatch: true },
  { type: 'AADHAAR', value: '9876 5432 1096', shouldMatch: true },
  { type: 'AADHAAR', value: '3675 9834 1257', shouldMatch: true },
  { type: 'AADHAAR', value: '0000 0000 0000', shouldMatch: false }, // Invalid repeating
  { type: 'AADHAAR', value: '2345 6789 0129', shouldMatch: false }, // Invalid Verhoeff checksum

  // PAN CARDS
  { type: 'PAN', value: 'ABCDE1234F', shouldMatch: true },
  { type: 'PAN', value: 'ZXCVB9876Y', shouldMatch: true },
  { type: 'PAN', value: 'ALKPJ4521M', shouldMatch: true },
  { type: 'PAN', value: '12345ABCDE', shouldMatch: false }, // Reversed invalid format

  // CREDIT / DEBIT CARDS (Valid Luhn vs Invalid)
  { type: 'CARD', value: '4532 0150 5190 7100', shouldMatch: true }, // Visa (Valid Luhn)
  { type: 'CARD', value: '5412 7512 5595 3373', shouldMatch: true }, // MasterCard (Valid Luhn)
  { type: 'CARD', value: '3782 822463 10005', shouldMatch: true },   // Amex (Valid Luhn)
  { type: 'CARD', value: '6080 1234 0044 3180', shouldMatch: true }, // RuPay (Valid Luhn)
  { type: 'CARD', value: '4532 0150 0000 0009', shouldMatch: false }, // Invalid Luhn checksum

  // EMAIL ADDRESSES
  { type: 'EMAIL', value: 'research.scientist@isro-partner.in', shouldMatch: true },
  { type: 'EMAIL', value: 'aarav.sharma.dev@gmail.com', shouldMatch: true },
  { type: 'EMAIL', value: 'support@cloud-provider.co.uk', shouldMatch: true },
  { type: 'EMAIL', value: 'invalid-email-no-at-sign.com', shouldMatch: false },

  // PHONE NUMBERS
  { type: 'PHONE', value: '+91 98765 43210', shouldMatch: true },
  { type: 'PHONE', value: '9876543210', shouldMatch: true },
  { type: 'PHONE', value: '+1-202-555-0199', shouldMatch: true },
  { type: 'PHONE', value: '12345', shouldMatch: false }, // Too short

  // API KEYS & SECRETS
  { type: 'AWS_KEY', value: 'AKIAIOSFODNN7EXAMPLE', shouldMatch: true },
  { type: 'GITHUB_TOKEN', value: 'ghp_111122223333444455556666777788889999', shouldMatch: true },
  { type: 'GOOGLE_KEY', value: 'AIzaSyA_1234567890abcdefghijklmnopqrst', shouldMatch: true }
];

async function runEvaluation() {
  const detector = new TextPIIDetector();

  let totalTP = 0;
  let totalFP = 0;
  let totalFN = 0;
  let totalTN = 0;

  const categoryMetrics = {};

  const startTime = performance.now();

  for (const item of GroundTruthDataset) {
    const cat = item.type;
    if (!categoryMetrics[cat]) {
      categoryMetrics[cat] = { TP: 0, FP: 0, FN: 0, TN: 0 };
    }

    const testText = `Here is the record data: ${item.value} for verification.`;
    const res = detector.detectAndSanitize(testText);
    const matched = res.detectedSpans.length > 0;

    if (item.shouldMatch) {
      if (matched) {
        totalTP++;
        categoryMetrics[cat].TP++;
      } else {
        totalFN++;
        categoryMetrics[cat].FN++;
      }
    } else {
      if (matched) {
        totalFP++;
        categoryMetrics[cat].FP++;
      } else {
        totalTN++;
        categoryMetrics[cat].TN++;
      }
    }
  }

  const durationMs = performance.now() - startTime;

  // Compute Metrics
  const precision = totalTP / (totalTP + totalFP);
  const recall = totalTP / (totalTP + totalFN);
  const f1 = (2 * precision * recall) / (precision + recall);

  console.log('------------------------------------------------------------------------');
  console.log('📊 CATEGORY BREAKDOWN:');
  console.log('------------------------------------------------------------------------');
  console.log(
    'Category'.padEnd(16) +
    'TP'.padStart(6) +
    'FP'.padStart(6) +
    'FN'.padStart(6) +
    'TN'.padStart(6) +
    'Precision'.padStart(12) +
    'Recall'.padStart(12) +
    'F1-Score'.padStart(12)
  );
  console.log('-'.repeat(76));

  for (const [cat, m] of Object.entries(categoryMetrics)) {
    const prec = m.TP + m.FP > 0 ? (m.TP / (m.TP + m.FP)) : 1.0;
    const rec = m.TP + m.FN > 0 ? (m.TP / (m.TP + m.FN)) : 1.0;
    const f1Score = prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 1.0;

    console.log(
      cat.padEnd(16) +
      String(m.TP).padStart(6) +
      String(m.FP).padStart(6) +
      String(m.FN).padStart(6) +
      String(m.TN).padStart(6) +
      (prec * 100).toFixed(1).padStart(11) + '%' +
      (rec * 100).toFixed(1).padStart(11) + '%' +
      (f1Score * 100).toFixed(1).padStart(11) + '%'
    );
  }

  console.log('-'.repeat(76));
  console.log('📈 OVERALL BENCHMARK PERFORMANCE:');
  console.log(`• True Positives (TP):  ${totalTP}`);
  console.log(`• False Positives (FP): ${totalFP}`);
  console.log(`• False Negatives (FN): ${totalFN}`);
  console.log(`• True Negatives (TN):  ${totalTN}`);
  console.log(`• Precision:            ${(precision * 100).toFixed(2)}%`);
  console.log(`• Recall:               ${(recall * 100).toFixed(2)}%`);
  console.log(`• F1-Score:             ${(f1 * 100).toFixed(2)}%`);
  console.log(`• Total Test Time:      ${durationMs.toFixed(2)} ms (${(durationMs / GroundTruthDataset.length).toFixed(3)} ms/item)`);
  console.log('========================================================================\n');

  // 2. TEST REVERSIBLE LOSS-LESS RESTORATION
  const originalDoc = 'User Aarav Sharma with Aadhaar 2345 6789 0124 and email aarav@gmail.com.';
  const sanitizedDoc = detector.detectAndSanitize(originalDoc);
  const restoredDoc = detector.restoreText(sanitizedDoc.sanitizedText);

  console.log('🔄 REVERSIBLE DOM INVERSION TEST:');
  console.log('• Original Text:  ', originalDoc);
  console.log('• Sanitized Mask: ', sanitizedDoc.sanitizedText);
  console.log('• Restored Text:  ', restoredDoc);
  console.log('• Lossless Match: ', originalDoc === restoredDoc ? '✔ 100% PASS' : '✕ FAIL');
  console.log('========================================================================\n');

  // 3. SCREEN VIT LOCAL VISION MODEL BENCHMARK
  console.log('👁️  LOCAL VISION TRANSFORMER (SCREEN ViT) BENCHMARK:');
  const { ScreenViTModel } = require('../lib/vision/screen-vit');

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

runEvaluation();
