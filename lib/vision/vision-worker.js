/**
 * PrivacyShield - Dedicated Vision Web Worker (visionWorker.js)
 * Processes image bitmaps, calculates face coordinates, and computes visual bounding boxes off the main thread.
 */
/* eslint-disable no-restricted-globals */

let isInitialized = false;
let activeBackend = 'Worker (WASM/Canvas Heuristic)';

self.onmessage = async (e) => {
  const { id, type, imageBitmap, imageData, width, height } = e.data;

  if (type === 'INIT_VISION') {
    isInitialized = true;
    self.postMessage({
      type: 'VISION_READY',
      backend: activeBackend
    });
    return;
  }

  if (type === 'DETECT_FACES_BITMAP') {
    const startTime = performance.now();
    const faceBoxes = [];

    try {
      // Heuristic face analysis on ImageData in worker
      if (imageData && width && height) {
        const data = imageData.data;
        let skinPixels = 0;
        let minX = width, minY = height, maxX = 0, maxY = 0;
        const step = Math.max(1, Math.floor(Math.min(width, height) / 60));

        for (let y = 0; y < height; y += step) {
          for (let x = 0; x < width; x += step) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

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

        if (skinRatio > 0.12 && maxX > minX && maxY > minY) {
          const fw = maxX - minX;
          const fh = maxY - minY;
          faceBoxes.push({
            x: minX,
            y: minY,
            width: fw,
            height: fh,
            confidence: 0.72,
            isHeuristic: true
          });
        }
      }
    } catch (err) {
      console.warn('[Vision Worker] Processing error:', err);
    }

    const duration = performance.now() - startTime;
    self.postMessage({
      id: id,
      type: 'FACES_DETECTED',
      faceBoxes: faceBoxes,
      durationMs: duration,
      backend: activeBackend
    });
  }
};
