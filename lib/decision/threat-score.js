/**
 * PrivacyShield - On-Device Heuristic Threat & Exposure Score Engine
 * 
 * Computes a 0-100 heuristic exposure score using ONLY signals already produced
 * during a normal scan. No remote lookups, reputation APIs, or external network calls.
 * This is an on-device heuristic exposure indicator, not a verified threat or reputation rating.
 */
(function() {
  'use strict';

  // Tunable Named Weight Constants (simple weighted addition, capped at 100)
  const WEIGHT_INSECURE_CONNECTION = 30;     // Page is not served over HTTPS
  const WEIGHT_PASSWORD_ON_HTTP = 40;        // Password field detected over unencrypted HTTP
  const WEIGHT_SENSITIVE_PER_FIELD = 10;     // Exposure weight per detected sensitive field (Aadhaar, PAN, Card, etc.)
  const MAX_SENSITIVE_SCORE = 30;            // Upper cap on sensitive fields weight
  const WEIGHT_CROSS_ORIGIN_FORM = 15;       // Form posting to an external or cross-origin destination
  const WEIGHT_THIRD_PARTY_IFRAME = 10;      // Third-party iframe presence

  /**
   * Computes an on-device heuristic site exposure/threat score.
   * 
   * @param {Object} params
   * @param {boolean} [params.isHttps] - Whether current connection protocol is https
   * @param {boolean} [params.hasPasswordField] - Whether a password input field is present
   * @param {Array|number} [params.detectedPII] - Detected PII spans or count of sensitive entities
   * @param {number} [params.crossOriginFormsCount] - Forms targeting different origins
   * @param {number} [params.thirdPartyIframesCount] - Count of cross-origin iframes
   * @returns {{ score: number, factors: Array<string>, level: 'low' | 'medium' | 'high' }}
   */
  function computeThreatScore(params = {}) {
    // Default connection protocol check if in browser environment
    let isHttps = params.isHttps;
    if (typeof isHttps === 'undefined' && typeof window !== 'undefined' && window.location) {
      isHttps = window.location.protocol === 'https:' || window.location.protocol === 'chrome-extension:';
    }

    const hasPassword = Boolean(params.hasPasswordField);
    
    // Count detected sensitive fields
    let sensitiveCount = 0;
    if (Array.isArray(params.detectedPII)) {
      sensitiveCount = params.detectedPII.length;
    } else if (typeof params.detectedPII === 'number') {
      sensitiveCount = params.detectedPII;
    }

    const crossOriginForms = Number(params.crossOriginFormsCount) || 0;
    const thirdPartyIframes = Number(params.thirdPartyIframesCount) || 0;

    let score = 0;
    const factors = [];

    // 1. Connection insecurity: page is not HTTPS
    if (!isHttps) {
      score += WEIGHT_INSECURE_CONNECTION;
      factors.push(`Unencrypted connection (HTTP): +${WEIGHT_INSECURE_CONNECTION}`);

      // 2. Presence of password field(s) on a non-HTTPS page
      if (hasPassword) {
        score += WEIGHT_PASSWORD_ON_HTTP;
        factors.push(`Password input on insecure HTTP transport: +${WEIGHT_PASSWORD_ON_HTTP}`);
      }
    }

    // 3. Number/type of sensitive fields detected this scan
    if (sensitiveCount > 0) {
      const sensitiveScore = Math.min(sensitiveCount * WEIGHT_SENSITIVE_PER_FIELD, MAX_SENSITIVE_SCORE);
      score += sensitiveScore;
      factors.push(`${sensitiveCount} sensitive PII field(s) visible on screen: +${sensitiveScore}`);
    } else {
      factors.push('Zero redactable sensitive PII fields exposed on page');
    }

    // 4. Presence of forms posting cross-domain
    if (crossOriginForms > 0) {
      score += WEIGHT_CROSS_ORIGIN_FORM;
      factors.push(`Form submitting to third-party domain: +${WEIGHT_CROSS_ORIGIN_FORM}`);
    }

    // 5. Presence of third-party iframes
    if (thirdPartyIframes > 0) {
      score += WEIGHT_THIRD_PARTY_IFRAME;
      factors.push(`Third-party iframe embedded: +${WEIGHT_THIRD_PARTY_IFRAME}`);
    }

    // Cap score at 100, floor at 0
    score = Math.max(0, Math.min(100, Math.round(score)));

    // Categorize risk level (green < 33, amber 33-66, red > 66)
    let level = 'low';
    if (score > 66) {
      level = 'high';
    } else if (score >= 33) {
      level = 'medium';
    }

    return {
      score,
      factors,
      level
    };
  }

  // Universal Module Export (Browser Window + CommonJS / Node test support)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      computeThreatScore,
      WEIGHT_INSECURE_CONNECTION,
      WEIGHT_PASSWORD_ON_HTTP,
      WEIGHT_SENSITIVE_PER_FIELD,
      MAX_SENSITIVE_SCORE,
      WEIGHT_CROSS_ORIGIN_FORM,
      WEIGHT_THIRD_PARTY_IFRAME
    };
  } else if (typeof window !== 'undefined') {
    window.computeThreatScore = computeThreatScore;
  }
})();
