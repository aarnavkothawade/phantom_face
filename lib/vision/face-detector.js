/**
 * PrivacyShield - Local Face & Visual PII Detection Engine (Component 2)
 * Loads BlazeFace via TensorFlow.js runtime.
 * Provides real face bounding box extraction from DOM images and screenshots,
 * with transparent diagnostic logging ("BlazeFace ML" vs "Heuristic fallback active").
 */
(function() {
  'use strict';

  class LocalFaceDetector {
    constructor() {
      this.model = null;
      this.isModelLoaded = false;
      this.isLoading = false;
      this.activeBackend = 'Not Initialized';
      this.detectorStatus = 'unloaded'; // 'blazeface_ready' | 'heuristic_fallback' | 'loading'
      this.lastInferenceTimeMs = 0;
      this.detectionCount = 0;
    }

    /**
     * Initializes the BlazeFace model using local bundled TFJS runtime.
     * Tries WebGL first, falling back cleanly to CPU if WebGL is unsupported.
     */
    async init() {
      if (this.isModelLoaded || this.isLoading) return;
      this.isLoading = true;
      this.detectorStatus = 'loading';

      try {
        // Check if global TFJS and BlazeFace are loaded
        if (typeof tf !== 'undefined' && typeof blazeface !== 'undefined') {
          let backendSet = false;
          try {
            backendSet = await tf.setBackend('webgl');
            if (backendSet) {
              await tf.ready();
            }
          } catch (webglErr) {
            console.warn('[PrivacyShield] WebGL backend failed to initialize, falling back to CPU:', webglErr.message || webglErr);
          }

          if (!backendSet || tf.getBackend() !== 'webgl') {
            try {
              console.log('[PrivacyShield] Initializing CPU backend for BlazeFace...');
              await tf.setBackend('cpu');
              await tf.ready();
            } catch (cpuErr) {
              console.warn('[PrivacyShield] CPU backend initialization failed:', cpuErr.message || cpuErr);
            }
          }

          const currentBackend = tf.getBackend() || 'cpu';
          this.activeBackend = `TensorFlow.js (${currentBackend.toUpperCase()})`;

          console.log(`[PrivacyShield] Initializing BlazeFace on ${this.activeBackend}...`);
          this.model = await blazeface.load();
          this.isModelLoaded = true;
          this.detectorStatus = 'blazeface_ready';
          console.log('[PrivacyShield] BlazeFace model loaded successfully.');
        } else {
          console.warn('[PrivacyShield] BlazeFace bundle not found in global scope. Enabling Heuristic Fallback.');
          this.activeBackend = 'Skin-Tone / Contour Heuristic';
          this.detectorStatus = 'heuristic_fallback';
        }
      } catch (err) {
        console.error('[PrivacyShield] Error loading BlazeFace model:', err);
        this.activeBackend = 'Skin-Tone / Contour Heuristic (BlazeFace Failed)';
        this.detectorStatus = 'heuristic_fallback';
      } finally {
        this.isLoading = false;
      }
    }

    /**
     * Calculates the rendered content box and scaling offsets for images using object-fit: cover, contain, or fill.
     */
    getObjectFitLayout(img, rect) {
      const nw = img.naturalWidth || rect.width;
      const nh = img.naturalHeight || rect.height;
      if (nw === 0 || nh === 0) {
        return { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
      }

      let objectFit = 'fill';
      try {
        const computed = window.getComputedStyle(img);
        objectFit = computed.objectFit || 'fill';
      } catch (e) {
        objectFit = 'fill';
      }

      if (objectFit === 'cover') {
        const scale = Math.max(rect.width / nw, rect.height / nh);
        const renderW = nw * scale;
        const renderH = nh * scale;
        const offsetX = (rect.width - renderW) / 2;
        const offsetY = (rect.height - renderH) / 2;
        return { scaleX: scale, scaleY: scale, offsetX, offsetY };
      } else if (objectFit === 'contain') {
        const scale = Math.min(rect.width / nw, rect.height / nh);
        const renderW = nw * scale;
        const renderH = nh * scale;
        const offsetX = (rect.width - renderW) / 2;
        const offsetY = (rect.height - renderH) / 2;
        return { scaleX: scale, scaleY: scale, offsetX, offsetY };
      }

      return {
        scaleX: rect.width / nw,
        scaleY: rect.height / nh,
        offsetX: 0,
        offsetY: 0
      };
    }

    /**
     * Heuristic fallback detector for face/headshot detection using skin-tone color space and facial aspect ratios.
     */
    detectHeuristicFaces(canvas, ctx) {
      const width = canvas.width;
      const height = canvas.height;
      if (width < 32 || height < 32) return [];

      let imgData;
      try {
        imgData = ctx.getImageData(0, 0, width, height);
      } catch (e) {
        // Prevent [object DOMException] on cross-origin tainted canvas
        return [];
      }
      const data = imgData.data;

      let skinPixels = 0;
      let totalPixels = width * height;
      let minX = width, minY = height, maxX = 0, maxY = 0;

      // Sample pixels for skin tone distribution (RGB rules for human skin under standard lighting)
      const step = Math.max(1, Math.floor(Math.min(width, height) / 80));
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Standard normalized RGB skin cluster
          const isSkin = (r > 95 && g > 40 && b > 20 &&
            (Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
            Math.abs(r - g) > 15 && r > g && r > b);

          if (isSkin) {
            skinPixels++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      const sampledTotal = (width / step) * (height / step);
      const skinRatio = skinPixels / sampledTotal;

      // If dense skin cluster found matching face proportions
      if (skinRatio > 0.12 && maxX > minX && maxY > minY) {
        const fw = maxX - minX;
        const fh = maxY - minY;
        const aspect = fh / fw;

        if (aspect >= 0.7 && aspect <= 1.8) {
          return [{
            x: minX,
            y: minY,
            width: fw,
            height: fh,
            confidence: Math.min(0.78, 0.5 + skinRatio * 0.4),
            isHeuristic: true
          }];
        }
      }

      return [];
    }

    /**
     * Detects faces in an image or canvas element.
     * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} element
     * @returns {Promise<Array>} Normalized bounding boxes [{x, y, width, height, confidence}]
     */
    async detectFacesInElement(element) {
      const startTime = performance.now();
      const faceBoxes = [];

      try {
        if (this.detectorStatus === 'blazeface_ready' && this.model) {
          try {
            // Real BlazeFace inference
            const predictions = await this.model.estimateFaces(element, false);
            for (const pred of predictions) {
              // BlazeFace returns topLeft: [x, y], bottomRight: [x, y], probability: [score]
              const start = pred.topLeft;
              const end = pred.bottomRight;
              const x = Math.round(start[0]);
              const y = Math.round(start[1]);
              const w = Math.round(end[0] - start[0]);
              const h = Math.round(end[1] - start[1]);
              const prob = (pred.probability && pred.probability[0]) ? pred.probability[0] : 0.90;

              if (prob >= 0.5) {
                faceBoxes.push({
                  x,
                  y,
                  width: w,
                  height: h,
                  confidence: Math.round(prob * 100) / 100,
                  isHeuristic: false
                });
              }
            }
          } catch (modelErr) {
            // Silently handle any element-level model inference failure
          }
        }
        
        // Fallback heuristic detection if BlazeFace returned nothing or failed
        if (faceBoxes.length === 0) {
          try {
            const canvas = document.createElement('canvas');
            const w = element.naturalWidth || element.width || 120;
            const h = element.naturalHeight || element.height || 120;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(element, 0, 0, w, h);

            const heuristicResults = this.detectHeuristicFaces(canvas, ctx);
            faceBoxes.push(...heuristicResults);
          } catch (canvasErr) {
            // Silently handle canvas/DOMException
          }
        }
      } catch (err) {
        // Suppress unhandled DOMException
      }

      const durationMs = performance.now() - startTime;
      this.lastInferenceTimeMs = Math.round(durationMs * 100) / 100;
      this.detectionCount += faceBoxes.length;

      return faceBoxes;
    }

    /**
     * Scans a single image element and returns bounding boxes in viewport coordinates.
     */
    async scanSingleImage(img) {
      if (!img || img.closest('#privacyshield-root')) return [];
      const rect = img.getBoundingClientRect();
      if (rect.width < 32 || rect.height < 32) return [];

      if (img.tagName && img.tagName.toLowerCase() === 'img') {
        if (!img.complete || img.naturalWidth === 0) return [];
      }

      let targetImg = img;
      if (!img.crossOrigin && img.src && img.src.startsWith('http')) {
        try {
          const corsImg = new Image();
          corsImg.crossOrigin = 'anonymous';

          const loadPromise = new Promise((resolve, reject) => {
            corsImg.onload = () => resolve(corsImg);
            corsImg.onerror = () => reject(new Error('CORS error'));
          });
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('CORS timeout')), 500);
          });

          const url = new URL(img.src, window.location.href);
          url.searchParams.set('ps_cors', '1');
          corsImg.src = url.toString();

          targetImg = await Promise.race([loadPromise, timeoutPromise]);
        } catch (corsErr) {
          targetImg = img;
        }
      }

      const faces = await this.detectFacesInElement(targetImg);
      const fit = this.getObjectFitLayout(img, rect);
      const faceBoxes = [];

      for (const f of faces) {
        faceBoxes.push({
          x: Math.round(rect.left + fit.offsetX + f.x * fit.scaleX),
          y: Math.round(rect.top + fit.offsetY + f.y * fit.scaleY),
          width: Math.round(f.width * fit.scaleX),
          height: Math.round(f.height * fit.scaleY),
          confidence: f.confidence,
          isHeuristic: f.isHeuristic || false
        });
      }

      return faceBoxes;
    }

    /**
     * Scans all visible <img> elements on the page and returns absolute screen coordinates for detected faces.
     * @returns {Promise<Array>} Face bounding boxes relative to viewport
     */
    async scanPageImages() {
      await this.init();
      const allFaceBoxes = [];
      const rawImages = Array.from(document.querySelectorAll('img, [role="img"]'));

      let totalImagesOnPage = rawImages.length;
      let skippedTooSmall = 0;
      let skippedNotLoaded = 0;
      let scannedCount = 0;
      let failCount = 0;

      const processedElements = new Set();

      for (const img of rawImages) {
        // Skip hidden or extension UI or already processed elements
        if (img.closest('#privacyshield-root') || processedElements.has(img)) continue;
        processedElements.add(img);

        // 1. Strict Size Threshold: Skip icons, small avatars, badges (< 36x36px)
        const rect = img.getBoundingClientRect();
        if (rect.width < 36 || rect.height < 36) {
          skippedTooSmall++;
          continue;
        }

        // 2. Readiness Check: Skip lazy-loaded images that haven't finished loading yet
        if (img.tagName && img.tagName.toLowerCase() === 'img') {
          if (!img.complete || img.naturalWidth === 0) {
            skippedNotLoaded++;
            // Attach listener for dynamic loading
            if (this.onDynamicImageLoad) {
              img.addEventListener('load', () => this.onDynamicImageLoad(img), { once: true });
            }
            continue;
          }
        }

        if (img.offsetParent === null && rect.width === 0 && rect.height === 0) {
          skippedTooSmall++;
          continue;
        }

        scannedCount++;
        try {
          let targetImg = img;

          // In-memory clone for cross-origin image testing - avoids cache pollution with query param
          if (!img.crossOrigin && img.src && img.src.startsWith('http')) {
            try {
              const corsImg = new Image();
              corsImg.crossOrigin = 'anonymous';

              const loadPromise = new Promise((resolve, reject) => {
                corsImg.onload = () => resolve(corsImg);
                corsImg.onerror = () => reject(new Error('CORS error'));
              });
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('CORS timeout')), 500);
              });

              const url = new URL(img.src, window.location.href);
              url.searchParams.set('ps_cors', '1');
              corsImg.src = url.toString();

              targetImg = await Promise.race([loadPromise, timeoutPromise]);
            } catch (corsErr) {
              targetImg = img;
            }
          }

          const faces = await this.detectFacesInElement(targetImg);
          
          // Re-scale bounding boxes back to original element screen coordinates with object-fit support
          const fit = this.getObjectFitLayout(img, rect);

          for (const f of faces) {
            allFaceBoxes.push({
              x: Math.round(rect.left + fit.offsetX + f.x * fit.scaleX),
              y: Math.round(rect.top + fit.offsetY + f.y * fit.scaleY),
              width: Math.round(f.width * fit.scaleX),
              height: Math.round(f.height * fit.scaleY),
              confidence: f.confidence,
              isHeuristic: f.isHeuristic || false
            });
          }
        } catch (e) {
          failCount++;
          console.warn(`[PrivacyShield] Face detection skipped for image (${img.src ? img.src.slice(0, 60) : 'unknown'}):`, e.message);
        }
      }

      const results = allFaceBoxes;
      
      this.telemetryBreakdown = {
        totalImagesOnPage,
        skippedTooSmall,
        skippedNotLoaded,
        scannedCount,
        failedCount: failCount,
        facesFound: results.length
      };

      console.log(`[PrivacyShield] Face Detection Telemetry: Total=${totalImagesOnPage}, SkippedSmall=${skippedTooSmall}, SkippedNotLoaded=${skippedNotLoaded}, Scanned=${scannedCount}, FacesFound=${results.length}`);
      return results;
    }

    /**
     * Returns the current status of the face detection pipeline for the UI/debug panel.
     */
    getStatus() {
      return {
        status: this.detectorStatus,
        activeBackend: this.activeBackend,
        isModelLoaded: this.isModelLoaded,
        totalDetections: this.detectionCount,
        lastDurationMs: this.lastInferenceTimeMs
      };
    }
  }

  const faceDetectorInstance = new LocalFaceDetector();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      LocalFaceDetector,
      faceDetector: faceDetectorInstance
    };
  } else if (typeof window !== 'undefined') {
    window.LocalFaceDetector = LocalFaceDetector;
    window.faceDetector = faceDetectorInstance;
  }
})();
