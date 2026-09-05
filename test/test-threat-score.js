const assert = require('assert');
const { computeThreatScore } = require('../lib/decision/threat-score');

console.log('Testing computeThreatScore()...');

// 1. Insecure HTTP page with a password field -> High threat, red level
const t1 = computeThreatScore({
  isHttps: false,
  hasPasswordField: true,
  detectedPII: 0
});
console.log('T1 (HTTP + Password):', t1);
assert.strictEqual(t1.score >= 70, true, 'Score should be >= 70');
assert.strictEqual(t1.level, 'high', 'Level should be high');

// 2. HTTPS page with zero sensitive fields -> Low threat, green level
const t2 = computeThreatScore({
  isHttps: true,
  hasPasswordField: false,
  detectedPII: 0
});
console.log('T2 (HTTPS + Zero PII):', t2);
assert.strictEqual(t2.score, 0, 'Score should be 0');
assert.strictEqual(t2.level, 'low', 'Level should be low');

// 3. HTTPS page with 2 sensitive PII fields -> 20 score, low level
const t3 = computeThreatScore({
  isHttps: true,
  hasPasswordField: false,
  detectedPII: 2
});
console.log('T3 (HTTPS + 2 PII):', t3);
assert.strictEqual(t3.score, 20);
assert.strictEqual(t3.level, 'low');

// 4. Insecure HTTP page without password -> 30 score, low level (< 33)
const t4 = computeThreatScore({
  isHttps: false,
  hasPasswordField: false,
  detectedPII: 0
});
console.log('T4 (HTTP + No Password):', t4);
assert.strictEqual(t4.score, 30);
assert.strictEqual(t4.level, 'low');

// 5. Cross-domain form + third-party iframe on HTTPS with 3 PII fields
const t5 = computeThreatScore({
  isHttps: true,
  hasPasswordField: false,
  detectedPII: 3,
  crossOriginFormsCount: 1,
  thirdPartyIframesCount: 1
});
console.log('T5 (Cross-domain form + iframe + 3 PII):', t5);
// 30 (PII cap) + 15 (form) + 10 (iframe) = 55
assert.strictEqual(t5.score, 55);
assert.strictEqual(t5.level, 'medium');

console.log('All threat-score unit tests passed successfully! ✔');
