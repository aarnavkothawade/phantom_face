/**
 * PrivacyShield - Core Content Script & One-Button Pipeline Coordinator
 * 
 * Orchestrates:
 * 1. DOM Scan & Text PII / NER Detection (with Verhoeff, Luhn, Regex, Entropy)
 * 2. Local Face / Visual PII Detection (BlazeFace ML + Heuristic Fallback)
 * 3. Local Screen-Understanding & UI Structure Model (Structured JSON + Topology Fingerprint)
 * 4. In-Place DOM Redaction & Canvas Screenshot Redaction (Solid Masks + Gaussian Face Blurs)
 * 5. Local Decision Engine (Page Classification + State Delta Analysis)
 * 6. Proxy Server Communication & Live DOM Action Execution (Visual Highlight + Mock Profile Autofill)
 */
(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__PRIVACY_SHIELD_INITIALIZED__) return;
  window.__PRIVACY_SHIELD_INITIALIZED__ = true;

  console.log('[PrivacyShield] Initializing Privacy-Preserving Vision Agent...');

  // Module References (loaded in order via manifest or global scripts)
  const config = window.PrivacyShieldConfig || {};
  const textDetector = window.textPIIDetector;
  const domRedactor = window.domRedactor;
  const faceDetector = window.faceDetector;
  const screenAnalyzer = window.screenAnalyzer;
  const screenViT = window.screenViT;
  const ocrWorker = window.ocrWorker;
  const canvasRedactor = window.canvasRedactor;
  const decisionEngine = window.decisionEngine;
  const actionExecutor = window.actionExecutor;
  const instrumentation = window.instrumentation;

  // Pipeline State
  let pipelineState = {
    isScanning: false,
    isRedacted: false,
    currentScreenshot: null,
    sanitizedScreenshotBase64: null,
    sanitizedTextBundle: '',
    screenStructure: null,
    localDecision: null,
    lastTask: '',
    lastTelemetry: null
  };

  /**
   * Builds and injects the floating action button and inspection panel into the host page.
   */
  function injectUI() {
    if (document.getElementById('privacyshield-root')) return;

    const host = document.createElement('div');
    host.id = 'privacyshield-root';

    // SVG Shield Icon
    const shieldSvg = `
      <svg class="ps-shield-svg" viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="M9 12l2 2 4-4" stroke-width="2.2"/>
      </svg>
    `;

    // Floating Button
    const fab = document.createElement('button');
    fab.className = 'ps-fab-button';
    fab.setAttribute('title', 'PrivacyShield: Click to Scan, Redact & Launch Vision Agent');
    fab.innerHTML = `
      ${shieldSvg}
      <span class="ps-fab-badge" id="ps-fab-badge">LOCAL</span>
      <span class="ps-fab-tooltip">PrivacyShield Agent (1-Click)</span>
    `;

    // Panel
    const panel = document.createElement('div');
    panel.className = 'ps-panel';
    panel.id = 'ps-panel';
    panel.style.display = 'none';

    panel.innerHTML = `
      <!-- Header -->
      <div class="ps-header">
        <div class="ps-header-title">
          <svg style="width:18px;height:18px;stroke:#00f2fe;fill:none;" viewBox="0 0 24 24">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-width="2"/>
          </svg>
          <h3>PrivacyShield Agent</h3>
          <span class="ps-version-pill">Local ML</span>
        </div>
        <div class="ps-header-actions">
          <button class="ps-icon-btn" id="ps-close-btn" title="Close Panel">✕</button>
        </div>
      </div>

      <!-- Main Body -->
      <div class="ps-body">
        <!-- Progress Bar -->
        <div class="ps-progress-container" id="ps-progress-box">
          <div class="ps-progress-header">
            <span id="ps-progress-status">Ready to Scan</span>
            <span id="ps-progress-percent">0%</span>
          </div>
          <div class="ps-progress-track">
            <div class="ps-progress-fill" id="ps-progress-fill"></div>
          </div>
          <div class="ps-stage-badges">
            <div class="ps-stage-badge" id="badge-dom"><span>•</span> DOM Scan</div>
            <div class="ps-stage-badge" id="badge-pii"><span>•</span> PII Redaction</div>
            <div class="ps-stage-badge" id="badge-face"><span>•</span> Face ML</div>
            <div class="ps-stage-badge" id="badge-screen"><span>•</span> Screen Model</div>
            <div class="ps-stage-badge" id="badge-pixel"><span>•</span> Pixel Blur</div>
            <div class="ps-stage-badge" id="badge-ocr"><span>•</span> OCR Text</div>
            <div class="ps-stage-badge" id="badge-vit"><span>•</span> ViT Model</div>
          </div>
        </div>

        <!-- Sanitized Stats Grid -->
        <div class="ps-stats-grid" id="ps-stats-grid" style="display:none;">
          <div class="ps-stat-card">
            <div class="ps-stat-value" id="stat-pii-count">0</div>
            <div class="ps-stat-label">DOM PII</div>
          </div>
          <div class="ps-stat-card">
            <div class="ps-stat-value" id="stat-ocr-count">0</div>
            <div class="ps-stat-label">OCR PII</div>
          </div>
          <div class="ps-stat-card">
            <div class="ps-stat-value" id="stat-faces-count">0</div>
            <div class="ps-stat-label">Faces Blurred</div>
          </div>
        </div>

        <!-- Redacted Image Preview -->
        <div class="ps-preview-box" id="ps-preview-box" style="display:none;">
          <div class="ps-preview-header">
            <span>Sanitized Screen Preview (Zero PII Leaked)</span>
            <span style="color:#10b981;font-size:10px;font-weight:700;">● REDACTED</span>
          </div>
          <img class="ps-preview-img" id="ps-preview-img" alt="Redacted Screen"/>
        </div>

        <!-- Task Input Box -->
        <div class="ps-task-box" id="ps-task-box" style="display:none;">
          <label class="ps-task-label" for="ps-task-input">What do you want me to do?</label>
          <div class="ps-input-row">
            <input type="text" class="ps-task-input" id="ps-task-input" placeholder="e.g., fill this application form, click submit, summarize"/>
            <button class="ps-go-btn" id="ps-go-btn">
              <span>Go</span>
              <svg style="width:14px;height:14px;fill:currentColor;" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>

        <!-- Agent Response / Action Result Card -->
        <div class="ps-result-card" id="ps-result-card" style="display:none;">
          <div class="ps-result-header">
            <span id="ps-result-icon">⚡</span>
            <span id="ps-result-title">Agent Execution Result</span>
          </div>
          <div class="ps-result-content" id="ps-result-content"></div>
        </div>
      </div>

      <!-- Telemetry & Decision Drawer (Collapsible) -->
      <div class="ps-drawer" id="ps-drawer">
        <div class="ps-drawer-header" id="ps-drawer-toggle">
          <span>⚙ Telemetry & Decision Audit (<span id="ps-total-latency">0 ms</span>)</span>
          <span id="ps-drawer-arrow">▼</span>
        </div>
        <div class="ps-drawer-body" id="ps-drawer-body" style="display:none;">
          <div style="margin-bottom:6px;color:#94a3b8;font-size:10px;" id="ps-telemetry-meta">
            Hardware: <strong id="meta-hw">Detecting...</strong> | Face ML: <strong id="meta-face">BlazeFace</strong>
          </div>
          <div style="margin-bottom:6px;color:#94a3b8;font-size:10px;" id="ps-decision-meta">
            Decision: <strong id="meta-decision" style="color:#38bdf8;">Evaluating...</strong>
          </div>
          <div id="ps-waterfall-container"></div>
        </div>
      </div>

      <!-- Footer Controls -->
      <div class="ps-footer">
        <button class="ps-text-btn" id="ps-restore-btn">Restore Original DOM</button>
        <button class="ps-text-btn" id="ps-rescan-btn">Re-Scan & Redact</button>
      </div>
    `;

    host.appendChild(panel);
    host.appendChild(fab);
    document.body.appendChild(host);

    // Event Bindings
    fab.addEventListener('click', onOneButtonClick);
    panel.querySelector('#ps-close-btn').addEventListener('click', () => panel.style.display = 'none');
    panel.querySelector('#ps-restore-btn').addEventListener('click', onRestorePage);
    panel.querySelector('#ps-rescan-btn').addEventListener('click', onOneButtonClick);
    panel.querySelector('#ps-drawer-toggle').addEventListener('click', toggleTelemetryDrawer);

    const taskInput = panel.querySelector('#ps-task-input');
    const goBtn = panel.querySelector('#ps-go-btn');

    goBtn.addEventListener('click', onTaskSubmit);
    taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onTaskSubmit();
      }
    });
  }

  /**
   * Toggles the telemetry drawer open/closed.
   */
  function toggleTelemetryDrawer() {
    const body = document.getElementById('ps-drawer-body');
    const arrow = document.getElementById('ps-drawer-arrow');
    if (body.style.display === 'none') {
      body.style.display = 'flex';
      arrow.textContent = '▲';
    } else {
      body.style.display = 'none';
      arrow.textContent = '▼';
    }
  }

  /**
   * Updates progress bar and active stage badge.
   */
  function updateProgress(percent, label, activeBadgeId) {
    const statusEl = document.getElementById('ps-progress-status');
    const percentEl = document.getElementById('ps-progress-percent');
    const fillEl = document.getElementById('ps-progress-fill');

    if (statusEl) statusEl.textContent = label;
    if (percentEl) percentEl.textContent = `${percent}%`;
    if (fillEl) fillEl.style.width = `${percent}%`;

    const badges = ['badge-dom', 'badge-pii', 'badge-face', 'badge-screen', 'badge-pixel', 'badge-ocr', 'badge-vit'];
    badges.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === activeBadgeId) {
        el.className = 'ps-stage-badge active';
      } else if (badges.indexOf(id) < badges.indexOf(activeBadgeId)) {
        el.className = 'ps-stage-badge done';
      }
    });
  }

  /**
   * The One-Button Flow Trigger:
   * Single click scans visible DOM + takes screenshot + runs local PII + runs BlazeFace + runs screen model + redacts DOM & pixels + runs Screen ViT vision model.
   */
  async function onOneButtonClick() {
    if (pipelineState.isScanning) return;
    pipelineState.isScanning = true;
    stopDynamicFaceScanner();

    const panel = document.getElementById('ps-panel');
    const fab = document.querySelector('.ps-fab-button');
    panel.style.display = 'flex';
    fab.classList.add('ps-active');

    // Reset view states
    document.getElementById('ps-stats-grid').style.display = 'none';
    document.getElementById('ps-preview-box').style.display = 'none';
    document.getElementById('ps-task-box').style.display = 'none';
    document.getElementById('ps-result-card').style.display = 'none';

    // Start Telemetry Session
    instrumentation.startSession('one_button_scan_and_redact');

    try {
      // 1. DOM Scan & Text PII / NER Detection
      updateProgress(15, 'Scanning DOM & Analyzing Text PII...', 'badge-dom');
      instrumentation.startStage('dom_text_pii_scan');
      
      const domRedactionResult = domRedactor.redactPageDOM();
      instrumentation.endStage('dom_text_pii_scan', { piiCount: domRedactionResult.totalRedacted });

      // 2. Face / Visual PII Detection (BlazeFace ML + Fallback with Timeout)
      updateProgress(30, 'Running Local BlazeFace Face Detection...', 'badge-face');
      instrumentation.startStage('local_face_detection');

      let detectedFaces = [];
      let faceStatus = faceDetector.getStatus();
      try {
        detectedFaces = await faceDetector.scanPageImages();
        faceStatus = faceDetector.getStatus();
        
        // --- LIVE DOM FACE OVERLAY REDACTION ---
        const injectedOverlaysCount = domRedactor.redactDOMFaces(detectedFaces);
        console.log(`[PrivacyShield] Injected ${injectedOverlaysCount} live DOM face redaction overlays.`);
      } catch (faceErr) {
        console.warn('[PrivacyShield] Face detection failed gracefully:', faceErr);
      }
      instrumentation.endStage('local_face_detection', { facesCount: detectedFaces.length, backend: faceStatus.activeBackend });

      // 3. Screen-Understanding & UI Structure Model (Component 1)
      updateProgress(45, 'Executing Local Screen-Understanding Model...', 'badge-screen');
      instrumentation.startStage('screen_structure_model');

      const screenAnalysis = screenAnalyzer.analyzeScreen();
      pipelineState.screenStructure = screenAnalysis;
      instrumentation.endStage('screen_structure_model', { totalElements: screenAnalysis.totalElements });

      // 4. Tab Screenshot Capture & Pixel-Level Canvas Redaction
      updateProgress(65, 'Capturing & Redacting Screenshot Pixels...', 'badge-pixel');
      instrumentation.startStage('screenshot_capture_and_canvas_redaction');

      // Request tab screenshot from background service worker
      const captureResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'CAPTURE_VISIBLE_TAB' }, (res) => resolve(res));
      });

      let sanitizedImageBase64 = null;
      let ocrRedactionCount = 0;
      let ocrBoxes = [];

      if (captureResponse && captureResponse.success && captureResponse.dataUrl) {
        // --- 4a. OCR Text Recognition on Screenshot ---
        updateProgress(70, 'Running Local OCR on Screenshot...', 'badge-ocr');
        instrumentation.startStage('ocr_text_extraction');
        
        if (ocrWorker) {
          const ocrResult = await ocrWorker.recognize(captureResponse.dataUrl);
          if (ocrResult && ocrResult.words) {
            for (const word of ocrResult.words) {
              if (word.confidence < 50) continue; // Skip very low confidence
              const analysis = textDetector.detectAndSanitize(word.text);
              if (analysis.detectedSpans.length > 0) {
                // We have a PII hit in this word. Create an ocrBox for the canvasRedactor.
                ocrRedactionCount++;
                const span = analysis.detectedSpans[0];
                ocrBoxes.push({
                  x: word.bbox.x0,
                  y: word.bbox.y0,
                  width: word.bbox.x1 - word.bbox.x0,
                  height: word.bbox.y1 - word.bbox.y0,
                  tokens: [span.token]
                });
              }
            }
          }
        }
        instrumentation.endStage('ocr_text_extraction', { ocrRedactionCount });

        // --- 4b. Canvas Pixel Redaction ---
        const redactCanvasResult = await canvasRedactor.redactScreenshot(
          captureResponse.dataUrl,
          domRedactionResult.boundingBoxes,
          detectedFaces,
          ocrBoxes
        );
        sanitizedImageBase64 = redactCanvasResult.sanitizedImageBase64;
      }
      pipelineState.sanitizedScreenshotBase64 = sanitizedImageBase64;
      instrumentation.endStage('screenshot_capture_and_canvas_redaction');

      // 4b. Local Vision Transformer Model (Screen ViT - Runs strictly on REDACTED Canvas)
      updateProgress(80, 'Running Local Screen ViT Vision Model...', 'badge-vit');
      instrumentation.startStage('screen_vit_model');

      let vitResult = null;
      if (screenViT && sanitizedImageBase64) {
        vitResult = await screenViT.classifyScreen(sanitizedImageBase64);
      } else if (screenViT) {
        vitResult = screenViT.getFallbackResult();
      }

      if (vitResult && pipelineState.screenStructure) {
        pipelineState.screenStructure.visualSignal = vitResult;
      }
      pipelineState.vitResult = vitResult;
      instrumentation.endStage('screen_vit_model', {
        pageType: vitResult?.visualPageType,
        provider: vitResult?.executionProvider
      });

      // 5. Local Decision-Making Engine (Component 4)
      updateProgress(90, 'Evaluating Local Strategy & Delta Fingerprint...', 'badge-screen');
      instrumentation.startStage('local_decision_engine');

      const decision = decisionEngine.evaluateDecision(screenAnalysis, '');
      pipelineState.localDecision = decision;
      instrumentation.endStage('local_decision_engine', { pageType: decision.pageClassification.pageType });

      // Finalize Telemetry Session
      const sessionSummary = instrumentation.endSession();
      pipelineState.lastTelemetry = sessionSummary;

      // Update UI with Results
      updateProgress(100, 'Redaction Complete (Zero PII Transmitted)', 'badge-vit');
      ['badge-dom', 'badge-pii', 'badge-face', 'badge-screen', 'badge-pixel', 'badge-ocr', 'badge-vit'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.className = 'ps-stage-badge done';
      });

      // Show Statistics
      document.getElementById('stat-pii-count').textContent = domRedactionResult.totalRedacted;
      document.getElementById('stat-ocr-count').textContent = ocrRedactionCount;
      document.getElementById('stat-faces-count').textContent = detectedFaces.length;
      document.getElementById('ps-stats-grid').style.display = 'grid';

      // Show Redacted Preview Image
      if (sanitizedImageBase64) {
        const previewImg = document.getElementById('ps-preview-img');
        previewImg.src = sanitizedImageBase64;
        document.getElementById('ps-preview-box').style.display = 'block';
      }

      // Render Telemetry Waterfall Breakdown
      renderTelemetryUI(sessionSummary, faceStatus, decision);

      // Reveal Task Input Pre-Focused
      const taskBox = document.getElementById('ps-task-box');
      taskBox.style.display = 'flex';
      const taskInput = document.getElementById('ps-task-input');
      taskInput.focus();

      pipelineState.isRedacted = true;
      startDynamicFaceScanner();
    } catch (err) {
      console.error('[PrivacyShield] Error in pipeline execution:', err);
      updateProgress(0, `Error: ${err.message}`, 'badge-dom');
    } finally {
      pipelineState.isScanning = false;
      fab.classList.remove('ps-active');
    }
  }

  /**
   * Renders the latency waterfall chart, memory snapshots, and decision audit logs in the drawer.
   */
  function renderTelemetryUI(session, faceStatus, decision) {
    if (!session) return;

    document.getElementById('ps-total-latency').textContent = `${session.totalDurationMs} ms`;
    document.getElementById('meta-hw').textContent = instrumentation.getSystemDiagnostics().hardwareProvider;
    document.getElementById('meta-face').textContent = faceStatus.activeBackend;
    
    // Per-Image Audit Telemetry Breakdown
    const tb = faceDetector.telemetryBreakdown || {};
    const imgAuditStr = `Images: ${tb.totalImagesOnPage || 0} Total | Skipped: ${(tb.skippedTooSmall || 0) + (tb.skippedNotLoaded || 0)} (<40px / pending) | Scanned: ${tb.scannedCount || 0} | Faces: ${tb.facesFound || 0}`;
    
    const decisionMetaEl = document.getElementById('ps-decision-meta');
    if (decisionMetaEl) {
      decisionMetaEl.innerHTML = `
        Decision: <strong id="meta-decision" style="color:#D97757;">[${decision.pageClassification.pageType}] ${decision.selectedStrategy}</strong>
        <div style="font-size:10px;color:#6E6D6A;margin-top:4px;">${imgAuditStr}</div>
      `;
    }

    const container = document.getElementById('ps-waterfall-container');
    container.innerHTML = '';

    const stageLabels = {
      dom_text_pii_scan: '1. DOM PII Scan & Mask',
      local_face_detection: '2. BlazeFace Face ML',
      screen_structure_model: '3. Screen Understanding',
      ocr_text_extraction: '4. Tesseract OCR Image Scan',
      screenshot_capture_and_canvas_redaction: '5. Canvas Pixel Redaction',
      screen_vit_model: '6. Screen ViT ML',
      local_decision_engine: '7. Local Decision Delta',
      server_agent_roundtrip: '8. Server VLM Proxy',
      action_execution_dom: '9. Live Action Runner'
    };

    for (const [key, stage] of Object.entries(session.stages)) {
      const label = stageLabels[key] || key;
      const row = document.createElement('div');
      row.className = 'ps-waterfall-row';
      row.innerHTML = `
        <div class="ps-waterfall-name" title="${label}">${label}</div>
        <div class="ps-waterfall-bar-track">
          <div class="ps-waterfall-bar" style="width: ${Math.max(4, Math.min(100, (stage.durationMs / session.totalDurationMs) * 100))}%;"></div>
        </div>
        <div class="ps-waterfall-val">${stage.durationMs}ms</div>
      `;
      container.appendChild(row);
    }
  }

  /**
   * Submits the user's task prompt along with sanitized screen context to the secure proxy server.
   */
  async function onTaskSubmit() {
    const taskInput = document.getElementById('ps-task-input');
    const task = (taskInput.value || '').trim();
    if (!task) return;

    const goBtn = document.getElementById('ps-go-btn');
    const resultCard = document.getElementById('ps-result-card');
    const resultContent = document.getElementById('ps-result-content');
    const resultTitle = document.getElementById('ps-result-title');

    goBtn.disabled = true;
    goBtn.innerHTML = `<span>Synthesizing...</span>`;

    resultCard.style.display = 'flex';
    resultContent.innerHTML = `<div style="color:#94a3b8;">Processing sanitized context with proxy agent...</div>`;

    // Start Action Roundtrip Session
    const actionSession = instrumentation.startSession('agent_task_execution');
    instrumentation.startStage('server_agent_roundtrip');

    try {
      // 1. Evaluate Decision for Task
      const decision = decisionEngine.evaluateDecision(pipelineState.screenStructure, task);

      // 2. Prepare Sanitized Text Context (Extracted from DOM without real PII)
      const sanitizedDOMText = document.body.innerText.slice(0, 4000);

      // 3. Send Proxy Agent Request (Background -> Proxy Server)
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'PROXY_AGENT_REQUEST',
          payload: {
            sanitizedText: sanitizedDOMText,
            sanitizedImageBase64: pipelineState.sanitizedScreenshotBase64,
            screenStructure: pipelineState.screenStructure,
            task: task,
            pageClassification: decision.pageClassification
          }
        }, (res) => resolve(res));
      });

      instrumentation.endStage('server_agent_roundtrip', { durationMs: response?.networkDurationMs });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Proxy server response failed.');
      }

      const agentData = response.data;
      console.log('[PrivacyShield] Agent Response:', agentData);

      // 4. Handle Server Response (Action vs Text Response)
      if (agentData.type === 'action' && Array.isArray(agentData.actions)) {
        resultTitle.textContent = `Autonomous Actions (${agentData.actions.length})`;
        resultContent.innerHTML = `
          <div style="margin-bottom:8px;color:#38bdf8;">Executing ${agentData.actions.length} UI actions on live DOM:</div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            ${agentData.actions.map(a => `<div class="ps-action-pill">⚡ ${a.type.toUpperCase()}: ${a.selector || a.fieldType || 'viewport'}</div>`).join('')}
          </div>
        `;

        // Execute Actions on live unredacted DOM
        instrumentation.startStage('action_execution_dom');
        const execResults = await actionExecutor.executeActions(agentData.actions);
        instrumentation.endStage('action_execution_dom', { resultsCount: execResults.length });

        resultContent.innerHTML += `
          <div style="margin-top:8px;color:#34d399;font-weight:600;">✔ Actions executed with local profile data safely injected!</div>
        `;
      } else {
        // Plain conversational answer / summary
        resultTitle.textContent = 'Agent Response';
        resultContent.innerHTML = `<div style="white-space:pre-wrap;">${agentData.text || agentData.response || JSON.stringify(agentData)}</div>`;
      }

      // Complete Session
      const completedSession = instrumentation.endSession();
      renderTelemetryUI(completedSession, faceDetector.getStatus(), decision);
    } catch (err) {
      console.error('[PrivacyShield] Task submission error:', err);
      resultTitle.textContent = 'Error';
      resultContent.innerHTML = `
        <div style="color:#ef4444;">${err.message}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px;">
          Make sure your local proxy server is running at <code>http://localhost:3001</code> with a valid API key in <code>server/.env</code>.
        </div>
      `;
    } finally {
      goBtn.disabled = false;
      goBtn.innerHTML = `<span>Go</span> <svg style="width:14px;height:14px;fill:currentColor;" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    }
  }

  // Dynamic Face Scanning for Lazy-Loaded Thumbnails (e.g. YouTube, Infinite Scroll)
  let dynamicFaceObserver = null;
  let dynamicScrollTimer = null;
  let dynamicallyScannedImages = new WeakSet();

  function isElementInOrNearViewport(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return false;
    const rect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;
    return (
      rect.bottom >= -300 &&
      rect.top <= windowHeight + 300 &&
      rect.right >= -300 &&
      rect.left <= windowWidth + 300
    );
  }

  async function scanAndRedactSingleImage(img) {
    if (!pipelineState.isRedacted) return;
    if (!img || dynamicallyScannedImages.has(img)) return;
    if (img.closest && img.closest('#privacyshield-root')) return;

    dynamicallyScannedImages.add(img);
    if (img.classList) img.classList.add('ps-scanned');

    try {
      const faceBoxes = await faceDetector.scanSingleImage(img);
      if (faceBoxes && faceBoxes.length > 0 && pipelineState.isRedacted) {
        const injected = domRedactor.redactDOMFaces(faceBoxes);
        if (injected > 0) {
          console.log(`[PrivacyShield Dynamic Scan] Redacted ${injected} faces on dynamic thumbnail.`);
          const statFaces = document.getElementById('stat-faces-count');
          if (statFaces) {
            statFaces.textContent = parseInt(statFaces.textContent || '0', 10) + injected;
          }
        }
      }
    } catch (err) {
      // Gracefully handle any dynamic scan error
    }
  }

  function handleCandidateImage(img) {
    if (!pipelineState.isRedacted || !img || dynamicallyScannedImages.has(img)) return;
    if (img.closest && img.closest('#privacyshield-root')) return;

    const rect = img.getBoundingClientRect();
    if (rect.width < 32 || rect.height < 32) return;

    if (img.tagName && img.tagName.toLowerCase() === 'img') {
      if (!img.complete || img.naturalWidth === 0) {
        img.addEventListener('load', () => {
          if (pipelineState.isRedacted && isElementInOrNearViewport(img)) {
            scanAndRedactSingleImage(img);
          }
        }, { once: true });
        return;
      }
    }

    if (isElementInOrNearViewport(img)) {
      scanAndRedactSingleImage(img);
    }
  }

  function onDebouncedScroll() {
    if (!pipelineState.isRedacted) return;
    if (dynamicScrollTimer) clearTimeout(dynamicScrollTimer);
    dynamicScrollTimer = setTimeout(() => {
      if (!pipelineState.isRedacted) return;
      const images = document.querySelectorAll('img:not(.ps-scanned), [role="img"]:not(.ps-scanned)');
      for (const img of images) {
        handleCandidateImage(img);
      }
    }, 200);
  }

  function startDynamicFaceScanner() {
    stopDynamicFaceScanner();

    // Mark currently existing images as known if already processed
    const existing = document.querySelectorAll('img, [role="img"]');
    for (const img of existing) {
      if (img.complete && img.naturalWidth > 0 && isElementInOrNearViewport(img)) {
        dynamicallyScannedImages.add(img);
        if (img.classList) img.classList.add('ps-scanned');
      }
    }

    // Observe DOM for newly added nodes (e.g. YouTube ytd-rich-item-renderer)
    dynamicFaceObserver = new MutationObserver((mutations) => {
      if (!pipelineState.isRedacted) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.id === 'privacyshield-root' || (node.closest && node.closest('#privacyshield-root'))) continue;

          if (node.tagName && node.tagName.toLowerCase() === 'img') {
            handleCandidateImage(node);
          } else if (node.querySelectorAll) {
            const imgs = node.querySelectorAll('img, [role="img"]');
            for (const img of imgs) {
              handleCandidateImage(img);
            }
          }
        }
      }
    });

    dynamicFaceObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener('scroll', onDebouncedScroll, { passive: true });
  }

  function stopDynamicFaceScanner() {
    if (dynamicFaceObserver) {
      dynamicFaceObserver.disconnect();
      dynamicFaceObserver = null;
    }
    if (dynamicScrollTimer) {
      clearTimeout(dynamicScrollTimer);
      dynamicScrollTimer = null;
    }
    window.removeEventListener('scroll', onDebouncedScroll);
    document.querySelectorAll('.ps-scanned').forEach(el => el.classList.remove('ps-scanned'));
    dynamicallyScannedImages = new WeakSet();
  }

  /**
   * Restores original DOM content when requested.
   */
  function onRestorePage() {
    stopDynamicFaceScanner();
    domRedactor.restorePageDOM();
    pipelineState.isRedacted = false;
    updateProgress(0, 'Page Restored to Original', 'badge-dom');
    document.getElementById('ps-stats-grid').style.display = 'none';
  }

  // Initialize UI on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI);
  } else {
    injectUI();
  }
})();
