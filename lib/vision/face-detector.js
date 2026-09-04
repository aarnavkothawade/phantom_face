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
     */
    async init() {
      if (this.isModelLoaded || this.isLoading) return;
      this.isLoading = true;
      this.detectorStatus = 'loading';

      try {
        // Check if global TFJS and BlazeFace are loaded
        if (typeof tf !== 'undefined' && typeof blazeface !== 'undefined') {
          // Initialize TF backend (try WebGL first, fallback to CPU)
          await tf.ready();
          const currentBackend = tf.getBackend();
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
     * Heuristic fallback detector for face/headshot detection using skin-tone color space and facial aspect ratios.
     */
    detectHeuristicFaces(canvas, ctx) {
      const width = canvas.width;
      const height = canvas.height;
      if (width < 32 || height < 32) return [];

      const imgData = ctx.getImageData(0, 0, width, height);
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
        } else {
          // Fallback heuristic detection via temporary canvas
          const canvas = document.createElement('canvas');
          const w = element.naturalWidth || element.width || 120;
          const h = element.naturalHeight || element.height || 120;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(element, 0, 0, w, h);

          const heuristicResults = this.detectHeuristicFaces(canvas, ctx);
          faceBoxes.push(...heuristicResults);
        }
      } catch (err) {
        console.warn('[PrivacyShield] Face detection error on element:', err);
      }

      const durationMs = performance.now() - startTime;
      this.lastInferenceTimeMs = Math.round(durationMs * 100) / 100;
      this.detectionCount += faceBoxes.length;

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

      // Global timeout safeguard for the whole face detection scan (6 seconds max)
      const scanPromise = (async () => {
        for (const img of rawImages) {
          // Skip hidden or extension UI or already processed elements
          if (img.closest('#privacyshield-root') || processedElements.has(img)) continue;
          processedElements.add(img);

          // 1. Strict Size Threshold: Skip icons, small avatars, badges (< 40x40px)
          const rect = img.getBoundingClientRect();
          if (rect.width < 40 || rect.height < 40) {
            skippedTooSmall++;
            continue;
          }

          // 2. Readiness Check: Skip lazy-loaded images that haven't finished loading yet
          if (img.tagName && img.tagName.toLowerCase() === 'img') {
            if (!img.complete || img.naturalWidth === 0) {
              skippedNotLoaded++;
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

            // In-memory clone for cross-origin image testing - NEVER mutates original live DOM element
            if (!img.crossOrigin && img.src && img.src.startsWith('http')) {
              targetImg = new Image();
              targetImg.crossOrigin = 'anonymous';
              
              const imgLoadPromise = new Promise((resolve, reject) => {
                targetImg.onload = resolve;
                targetImg.onerror = () => reject(new Error('CORS block or image load failure'));
              });

              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Image CORS load timed out (1.5s limit)')), 1500);
              });

              targetImg.src = img.src;

              try {
                await Promise.race([imgLoadPromise, timeoutPromise]);
              } catch (corsErr) {
                // If CORS clone fails, fall back to analyzing original img directly without breaking page
                targetImg = img;
              }
            }

            const faces = await this.detectFacesInElement(targetImg);
            
            // Re-scale bounding boxes back to original element screen coordinates
            const scaleX = rect.width / (img.naturalWidth || targetImg.naturalWidth || rect.width);
            const scaleY = rect.height / (img.naturalHeight || targetImg.naturalHeight || rect.height);

            for (const f of faces) {
              allFaceBoxes.push({
                x: Math.round(rect.left + f.x * scaleX),
                y: Math.round(rect.top + f.y * scaleY),
                width: Math.round(f.width * scaleX),
                height: Math.round(f.height * scaleY),
                confidence: f.confidence,
                isHeuristic: f.isHeuristic || false
              });
            }
          } catch (e) {
            failCount++;
            console.warn(`[PrivacyShield] Face detection skipped for image (${img.src ? img.src.slice(0, 60) : 'unknown'}):`, e.message);
          }
        }
        return allFaceBoxes;
      })();

      // Overall scan timeout safeguard (6 seconds)
      const globalTimeout = new Promise((resolve) => {
        setTimeout(() => {
          console.warn('[PrivacyShield] Face detection scan timed out after 6000ms. Returning partial results.');
          resolve(allFaceBoxes);
        }, 6000);
      });

      const results = await Promise.race([scanPromise, globalTimeout]);
      
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
