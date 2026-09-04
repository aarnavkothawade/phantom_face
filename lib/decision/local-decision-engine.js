/**
 * PrivacyShield - Local Decision-Making Engine (Component 4)
 * Evaluates screen structure on-device, classifies page context, selects task execution templates,
 * determines round-trip necessity via structural fingerprint deltas, and emits audit logs.
 */
(function() {
  'use strict';

  class LocalDecisionEngine {
    constructor() {
      this.history = [];
      this.lastDecision = null;
      this.cachedResponses = new Map(); // fingerprint+task -> serverResponse
    }

    /**
     * Classifies page type based on screen elements, structure counts, and DOM heuristics.
     * @param {Object} screenAnalysis - Output from ScreenUnderstandingModel
     * @returns {Object} { pageType, confidence, rationale }
     */
    classifyPage(screenAnalysis) {
      const counts = screenAnalysis.summaryCounts || {};
      const elements = screenAnalysis.elements || [];

      // Check for Authentication / Login Page
      const hasPassword = elements.some(e => e.type === 'input_password');
      if (hasPassword) {
        return {
          pageType: 'AUTHENTICATION_LOGIN',
          confidence: 0.95,
          rationale: 'Detected password input field and credential submission structure.'
        };
      }

      // Check for Form / Registration / Application Page
      if (counts.inputs >= 3 || (counts.forms >= 1 && counts.inputs >= 1)) {
        return {
          pageType: 'FORM_SUBMISSION',
          confidence: 0.92,
          rationale: `Found ${counts.inputs} input fields across ${counts.forms} form containers.`
        };
      }

      // Check for Data Dashboard / Analytics
      if (counts.tables >= 1 || (counts.images >= 3 && counts.headings >= 4)) {
        return {
          pageType: 'DASHBOARD_ANALYTICS',
          confidence: 0.88,
          rationale: `Found ${counts.tables} tabular grids and structured data containers.`
        };
      }

      // Check for Content / Article / Documentation
      if (counts.headings >= 2 && counts.inputs === 0) {
        return {
          pageType: 'ARTICLE_DOCUMENTATION',
          confidence: 0.85,
          rationale: 'High typography density with zero interactive input forms.'
        };
      }

      return {
        pageType: 'GENERAL_INTERACTIVE',
        confidence: 0.70,
        rationale: 'Mixed interactive elements and visual content.'
      };
    }

    /**
     * Selects optimal agent execution strategy and system prompt directive.
     */
    selectStrategy(pageType, task) {
      const lowerTask = (task || '').toLowerCase();

      // Check if task is explicit form filling
      if (lowerTask.includes('fill') || lowerTask.includes('enter') || lowerTask.includes('complete')) {
        return {
          strategy: 'DIRECT_FORM_FILLER',
          directive: 'Identify form inputs and map appropriate mock profile fields (email, name, phone, aadhaar, address). Never send raw values.'
        };
      }

      // Check if task is action / click / submit
      if (lowerTask.includes('click') || lowerTask.includes('submit') || lowerTask.includes('press')) {
        return {
          strategy: 'UI_ACTION_TRIGGER',
          directive: 'Identify target interactive button or control selector and emit click action.'
        };
      }

      // Context-aware defaults based on page classification
      switch (pageType) {
        case 'AUTHENTICATION_LOGIN':
          return {
            strategy: 'SAFE_AUTH_ASSISTANT',
            directive: 'Guide credential filling securely using local profile substitutions.'
          };
        case 'FORM_SUBMISSION':
          return {
            strategy: 'FORM_AUTOMATION_STRATEGY',
            directive: 'Analyze field requirements and synthesize structured fill actions.'
          };
        case 'DASHBOARD_ANALYTICS':
          return {
            strategy: 'DATA_SYNTHESIS_STRATEGY',
            directive: 'Extract key aggregated data points and format concise analytical response.'
          };
        case 'ARTICLE_DOCUMENTATION':
        default:
          return {
            strategy: 'SUMMARY_AND_QA_STRATEGY',
            directive: 'Read sanitized text context and provide direct factual answers.'
          };
      }
    }

    /**
     * Evaluates whether a new server round-trip is strictly required or if local caching applies.
     * @param {Object} screenAnalysis
     * @param {string} task
     * @returns {Object} Decision package
     */
    evaluateDecision(screenAnalysis, task) {
      const startTime = performance.now();
      const classification = this.classifyPage(screenAnalysis);
      const strategyInfo = this.selectStrategy(classification.pageType, task);

      const cacheKey = `${screenAnalysis.fingerprint}::${(task || '').trim().toLowerCase()}`;
      const cached = this.cachedResponses.get(cacheKey);

      let serverRoundTripNeeded = true;
      let roundTripRationale = 'Fresh screen state or modified task prompt requiring VLM synthesis.';

      if (cached && !screenAnalysis.isStateChanged) {
        serverRoundTripNeeded = false;
        roundTripRationale = 'Identical screen structure and task already cached in memory. Skipping network call.';
      }

      const durationMs = performance.now() - startTime;

      const decisionRecord = {
        timestamp: Date.now(),
        screenFingerprint: screenAnalysis.fingerprint,
        isStateChanged: screenAnalysis.isStateChanged,
        pageClassification: classification,
        selectedStrategy: strategyInfo.strategy,
        strategyDirective: strategyInfo.directive,
        serverRoundTripNeeded: serverRoundTripNeeded,
        roundTripRationale: roundTripRationale,
        cachedResponse: cached || null,
        durationMs: Math.round(durationMs * 100) / 100
      };

      this.lastDecision = decisionRecord;
      this.history.unshift(decisionRecord);
      if (this.history.length > 50) this.history.pop();

      return decisionRecord;
    }

    /**
     * Caches a successful server response.
     */
    cacheResponse(screenFingerprint, task, response) {
      const cacheKey = `${screenFingerprint}::${(task || '').trim().toLowerCase()}`;
      this.cachedResponses.set(cacheKey, response);
    }
  }

  const localDecisionEngineInstance = new LocalDecisionEngine();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      LocalDecisionEngine,
      decisionEngine: localDecisionEngineInstance
    };
  } else if (typeof window !== 'undefined') {
    window.LocalDecisionEngine = LocalDecisionEngine;
    window.decisionEngine = localDecisionEngineInstance;
  }
})();
