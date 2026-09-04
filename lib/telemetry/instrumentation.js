/**
 * PrivacyShield - Performance & Telemetry Instrumentation Engine
 * Precision latency tracking (performance.now()), memory delta snapshots (performance.memory),
 * and centralized diagnostic health reporting across all local AI/vision modules.
 */
(function() {
  'use strict';

  class InstrumentationTracker {
    constructor() {
      this.sessions = [];
      this.currentSession = null;
    }

    /**
     * Starts a new pipeline telemetry session.
     */
    startSession(sessionName = 'scan_and_execute') {
      const memBefore = this.getMemorySnapshot();
      this.currentSession = {
        name: sessionName,
        startTimestamp: Date.now(),
        startPerf: performance.now(),
        endPerf: 0,
        totalDurationMs: 0,
        stages: {},
        memory: {
          startBytes: memBefore,
          endBytes: 0,
          deltaBytes: 0
        },
        metadata: {}
      };
      return this.currentSession;
    }

    /**
     * Records the start of a specific stage.
     */
    startStage(stageKey) {
      if (!this.currentSession) return;
      this.currentSession.stages[stageKey] = {
        key: stageKey,
        start: performance.now(),
        end: 0,
        durationMs: 0,
        memBefore: this.getMemorySnapshot()
      };
    }

    /**
     * Records the completion of a specific stage.
     */
    endStage(stageKey, extraData = {}) {
      if (!this.currentSession || !this.currentSession.stages[stageKey]) return;
      const stage = this.currentSession.stages[stageKey];
      stage.end = performance.now();
      stage.durationMs = Math.max(0.1, Math.round((stage.end - stage.start) * 100) / 100);
      stage.memAfter = this.getMemorySnapshot();
      stage.memDeltaBytes = stage.memAfter - stage.memBefore;
      stage.data = extraData;
      return stage;
    }

    /**
     * Finalizes the current telemetry session and computes latency waterfall.
     */
    endSession(metadata = {}) {
      if (!this.currentSession) return null;
      this.currentSession.endPerf = performance.now();
      this.currentSession.totalDurationMs = Math.round((this.currentSession.endPerf - this.currentSession.startPerf) * 100) / 100;

      const memAfter = this.getMemorySnapshot();
      this.currentSession.memory.endBytes = memAfter;
      this.currentSession.memory.deltaBytes = memAfter - this.currentSession.memory.startBytes;
      this.currentSession.metadata = metadata;

      // Compute percentage shares
      for (const key in this.currentSession.stages) {
        const stage = this.currentSession.stages[key];
        stage.percentShare = Math.round((stage.durationMs / (this.currentSession.totalDurationMs || 1)) * 1000) / 10;
      }

      const completed = { ...this.currentSession };
      this.sessions.unshift(completed);
      if (this.sessions.length > 20) this.sessions.pop();
      this.currentSession = null;

      return completed;
    }

    /**
     * Captures current JS heap usage in bytes (supported on Chromium).
     */
    getMemorySnapshot() {
      if (typeof performance !== 'undefined' && performance.memory && performance.memory.usedJSHeapSize) {
        return performance.memory.usedJSHeapSize;
      }
      return 0;
    }

    /**
     * Formats bytes into human readable KB/MB string.
     */
    formatBytes(bytes) {
      if (!bytes || bytes === 0) return 'N/A';
      if (Math.abs(bytes) < 1024) return `${bytes} B`;
      if (Math.abs(bytes) < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    /**
     * Compiles complete diagnostic report of all active models and hardware acceleration.
     */
    getSystemDiagnostics() {
      const faceStatus = (typeof window !== 'undefined' && window.faceDetector) ? window.faceDetector.getStatus() : { status: 'offline', activeBackend: 'None' };
      const vitStatus = (typeof window !== 'undefined' && window.screenViT) ? window.screenViT.getStatus() : { isLoaded: false, executionProvider: 'None', lastInferenceMs: 0 };

      let hwBackend = vitStatus.executionProvider !== 'None' ? vitStatus.executionProvider : 'CPU / JavaScript Runtime';
      if (hwBackend === 'None' || hwBackend === 'Detecting...') {
        if (typeof navigator !== 'undefined' && navigator.gpu) {
          hwBackend = 'WebGPU (Hardware Accelerated)';
        } else if (typeof WebAssembly !== 'undefined') {
          hwBackend = 'WASM (WebAssembly SIMD)';
        }
      }

      return {
        timestamp: Date.now(),
        hardwareProvider: hwBackend,
        faceDetectorStatus: faceStatus.status,
        faceDetectorBackend: faceStatus.activeBackend,
        faceTotalDetections: faceStatus.totalDetections || 0,
        vitLoaded: vitStatus.isLoaded,
        vitProvider: vitStatus.executionProvider,
        vitLastInferenceMs: vitStatus.lastInferenceMs,
        memoryUsed: this.formatBytes(this.getMemorySnapshot()),
        lastSession: this.sessions[0] || null
      };
    }
  }

  const instrumentationInstance = new InstrumentationTracker();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      InstrumentationTracker,
      instrumentation: instrumentationInstance
    };
  } else if (typeof window !== 'undefined') {
    window.InstrumentationTracker = InstrumentationTracker;
    window.instrumentation = instrumentationInstance;
  }
})();
