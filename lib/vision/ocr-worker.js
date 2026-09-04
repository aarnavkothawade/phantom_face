/**
 * PrivacyShield - Local OCR Text Recognition Engine
 * Uses Tesseract.js to detect and extract text from screenshots for PII redaction.
 */
(function() {
  'use strict';

  class OCRWorker {
    constructor() {
      this.worker = null;
      this.isReady = false;
      this.isLoading = false;
    }

    async init() {
      if (this.isReady || this.isLoading) return;
      this.isLoading = true;

      try {
        if (typeof Tesseract === 'undefined') {
          throw new Error('Tesseract library not loaded');
        }

        const extUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) 
          ? chrome.runtime.getURL('') 
          : '';

        const workerOptions = {
          workerPath: extUrl + 'lib/vision/tesseract/worker.min.js',
          corePath: extUrl + 'lib/vision/tesseract/tesseract-core.wasm.js',
          langPath: extUrl + 'lib/vision/tesseract/',
          workerBlobURL: false,
          gzip: true
        };

        try {
          this.worker = await Tesseract.createWorker('eng', 1, workerOptions);
        } catch (blobErr) {
          console.warn('[PrivacyShield] Direct worker instantiation failed, trying fallback:', blobErr);
          this.worker = await Tesseract.createWorker('eng', 1, {
            ...workerOptions,
            workerBlobURL: true
          });
        }
        
        this.isReady = true;
        console.log('[PrivacyShield] Tesseract OCR Worker Ready.');
      } catch (err) {
        console.error('[PrivacyShield] Failed to initialize OCR:', err);
      } finally {
        this.isLoading = false;
      }
    }

    /**
     * @param {string|HTMLImageElement|HTMLCanvasElement} image 
     * @returns {Promise<Object>} { text, words }
     */
    async recognize(image) {
      if (!this.isReady) await this.init();
      if (!this.worker) return { text: '', words: [] };

      try {
        const result = await this.worker.recognize(image);
        return {
          text: result.data.text,
          words: result.data.words.map(w => ({
            text: w.text,
            bbox: w.bbox, // {x0, y0, x1, y1}
            confidence: w.confidence
          }))
        };
      } catch (e) {
        console.error('[PrivacyShield] OCR error:', e);
        return { text: '', words: [] };
      }
    }
  }

  const ocrWorkerInstance = new OCRWorker();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OCRWorker, ocrWorker: ocrWorkerInstance };
  } else if (typeof window !== 'undefined') {
    window.OCRWorker = OCRWorker;
    window.ocrWorker = ocrWorkerInstance;
  }
})();
