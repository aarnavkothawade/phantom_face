/**
 * PrivacyShield - In-Place Reversible DOM Redaction Engine (Component 5)
 * Traverses visible DOM text nodes with TreeWalker, redacts PII in-place with styled badges,
 * and maintains in-memory token maps with instantaneous "Restore Page" and "Reveal Original" toggles.
 */
(function() {
  'use strict';

  const textDetector = (typeof window !== 'undefined' && window.textPIIDetector) || (typeof require !== 'undefined' ? require('../pii/text-detector').detector : null);

  class DOMRedactor {
    constructor() {
      this.mutatedElements = []; // [{ element, originalHTML, originalText, spans, tokens }]
      this.redactedNodeRects = []; // Bounding boxes for screenshot pixel masking
      this.isRedacted = false;
      this.revealedTokens = new Set();
    }

    /**
     * Resets redactor state and cleans tracking arrays.
     */
    reset() {
      this.mutatedElements = [];
      this.redactedNodeRects = [];
      this.isRedacted = false;
      this.revealedTokens.clear();
    }

    /**
     * Filters out non-content or internal extension DOM subtrees.
     */
    shouldSkipElement(el) {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'textarea', 'iframe', 'svg', 'canvas'].includes(tag)) {
        return true;
      }
      if (el.id === 'privacyshield-root' || el.closest('#privacyshield-root')) {
        return true;
      }
      if (el.classList && el.classList.contains('ps-injected')) {
        return true;
      }
      return false;
    }

    /**
     * Scans all visible text nodes in the DOM, redacts sensitive entities,
     * and injects subtle interactive privacy badges with reveal tooltips.
     * @returns {Object} Redaction summary { totalRedacted, tokens, boundingBoxes }
     */
    redactPageDOM(rootNode = document.body, isPartial = false) {
      const startTime = performance.now();
      if (!isPartial) {
        this.reset();
      }

      if (!textDetector) {
        console.error('[PrivacyShield] TextPIIDetector not initialized.');
        return { totalRedacted: 0, durationMs: 0 };
      }

      // Collect eligible text nodes using TreeWalker
      const walker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent || this.shouldSkipElement(parent)) {
              return NodeFilter.FILTER_REJECT;
            }
            if (!node.nodeValue || node.nodeValue.trim().length === 0) {
              return NodeFilter.FILTER_SKIP;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      const textNodes = [];
      let currentNode;
      while ((currentNode = walker.nextNode())) {
        textNodes.push(currentNode);
      }

      let totalRedacted = 0;
      const allTokens = [];

      for (const textNode of textNodes) {
        const rawText = textNode.nodeValue;
        const result = textDetector.detectAndSanitize(rawText);

        if (result.detectedSpans.length > 0) {
          totalRedacted += result.detectedSpans.length;
          const parent = textNode.parentElement;

          // Save mutation state for lossless restoration
          const wrapper = document.createElement('span');
          wrapper.style.display = 'contents';
          wrapper.className = 'ps-redaction-wrapper';

          this.mutatedElements.push({
            parent: parent,
            textNode: textNode,
            originalText: rawText,
            spans: result.detectedSpans,
            wrapper: wrapper
          });

          // Replace text node content with sanitized token spans
          const fragment = document.createDocumentFragment();
          let lastIdx = 0;

          for (const span of result.detectedSpans) {
            allTokens.push(span.token);

            // Preceding text
            if (span.start > lastIdx) {
              fragment.appendChild(document.createTextNode(rawText.substring(lastIdx, span.start)));
            }

            // Create interactive redacted badge
            const badge = document.createElement('span');
            badge.className = 'ps-redacted-badge';
            badge.setAttribute('data-token', span.token);
            badge.setAttribute('data-category', span.prefix);
            badge.setAttribute('title', `PrivacyShield: ${span.category} Masked (Click to Reveal)`);
            badge.textContent = span.token;

            // Inline badge styling for robust encapsulation
            badge.style.cssText = `
              background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95));
              color: #38bdf8;
              border: 1px solid #0284c7;
              border-radius: 4px;
              padding: 1px 5px;
              font-family: ui-monospace, monospace;
              font-size: 0.88em;
              font-weight: 600;
              letter-spacing: 0.03em;
              cursor: pointer;
              box-shadow: 0 0 8px rgba(2, 132, 199, 0.25);
              transition: all 0.2s ease;
              display: inline-block;
              user-select: all;
            `;

            // Click-to-reveal toggle event
            badge.addEventListener('click', (e) => {
              e.stopPropagation();
              e.preventDefault();
              this.toggleRevealBadge(badge, span.token, span.text);
            });

            fragment.appendChild(badge);
            lastIdx = span.end;
          }

          // Trailing text
          if (lastIdx < rawText.length) {
            fragment.appendChild(document.createTextNode(rawText.substring(lastIdx)));
          }

          // Swap text node with wrapper in live DOM
          wrapper.appendChild(fragment);
          parent.replaceChild(wrapper, textNode);

          // Record bounding rect of the redacted region for canvas synchronization
          const parentRect = parent.getBoundingClientRect();
          this.redactedNodeRects.push({
            x: Math.round(parentRect.left + window.scrollX),
            y: Math.round(parentRect.top + window.scrollY),
            width: Math.round(parentRect.width),
            height: Math.round(parentRect.height),
            tokens: result.detectedSpans.map(s => s.token)
          });
        }
      }

      this.isRedacted = true;
      const durationMs = performance.now() - startTime;

      return {
        totalRedacted: totalRedacted,
        tokens: allTokens,
        mutatedCount: this.mutatedElements.length,
        boundingBoxes: this.redactedNodeRects,
        durationMs: Math.round(durationMs * 100) / 100
      };
    }

    /**
     * Redacts detected faces on the live webpage DOM by injecting non-destructive overlay elements over face regions.
     * Never mutates img.src or img.crossOrigin, ensuring zero broken images or CORS corruptions.
     * @param {Array} faceBoxes - [{ x, y, width, height, confidence }]
     */
    redactDOMFaces(faceBoxes = []) {
      if (!Array.isArray(faceBoxes) || faceBoxes.length === 0) return 0;

      let count = 0;
      for (const face of faceBoxes) {
        if (!face.width || !face.height) continue;

        const overlay = document.createElement('div');
        overlay.className = 'ps-face-overlay ps-injected';

        // Absolute positioning using scroll coordinates
        const left = face.x + window.scrollX;
        const top = face.y + window.scrollY;

        const borderRadius = face.borderRadius || '10px';
        overlay.style.cssText = `
          position: absolute !important;
          left: ${left}px !important;
          top: ${top}px !important;
          width: ${face.width}px !important;
          height: ${face.height}px !important;
          background: rgba(15, 23, 42, 0.78) !important;
          backdrop-filter: blur(20px) brightness(0.7) !important;
          -webkit-backdrop-filter: blur(20px) brightness(0.7) !important;
          border: 1.5px dashed #D97757 !important;
          border-radius: ${borderRadius} !important;
          z-index: 2147483640 !important;
          pointer-events: auto !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: #FAF9F5 !important;
          font-size: 10px !important;
          font-weight: 600 !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25) !important;
          user-select: none !important;
          overflow: hidden !important;
          transition: all 0.2s ease !important;
        `;

        overlay.innerHTML = `<span style="background:#D97757;color:#FFFFFF;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;">[FACE_BLURRED]</span>`;

        document.body.appendChild(overlay);
        this.mutatedElements.push({ isOverlay: true, element: overlay });
        count++;

        // Explicit debugging logs for DOM verification
        const rect = overlay.getBoundingClientRect();
        console.log(`[PrivacyShield Live Face Redaction ${count}]`, {
          targetX: left,
          targetY: top,
          width: face.width,
          height: face.height,
          attachedToDOM: overlay.isConnected,
          computedWidth: rect.width,
          computedHeight: rect.height,
          visible: rect.width > 0 && rect.height > 0
        });
      }

      return count;
    }

    /**
     * Toggles reveal/mask for an individual redacted badge.
     */
    toggleRevealBadge(badge, token, originalText) {
      if (this.revealedTokens.has(token)) {
        // Re-mask
        this.revealedTokens.delete(token);
        badge.textContent = token;
        badge.style.color = '#38bdf8';
        badge.style.borderColor = '#0284c7';
        badge.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))';
      } else {
        // Reveal
        this.revealedTokens.add(token);
        badge.textContent = originalText;
        badge.style.color = '#f59e0b';
        badge.style.borderColor = '#f59e0b';
        badge.style.background = 'rgba(245, 158, 11, 0.15)';
      }
    }

    /**
     * Completely restores the webpage DOM back to original unredacted text and removes all face overlays.
     */
    restorePageDOM() {
      if (!this.isRedacted) return;

      for (const item of this.mutatedElements) {
        if (item.isOverlay && item.element && item.element.parentNode) {
          item.element.parentNode.removeChild(item.element);
        } else if (item.wrapper && item.wrapper.parentNode) {
          item.wrapper.parentNode.replaceChild(item.textNode, item.wrapper);
        }
      }

      // Also clean up any lingering overlays
      const overlays = document.querySelectorAll('.ps-face-overlay');
      overlays.forEach(el => el.remove());

      this.reset();
    }
  }

  const domRedactorInstance = new DOMRedactor();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      DOMRedactor,
      domRedactor: domRedactorInstance
    };
  } else if (typeof window !== 'undefined') {
    window.DOMRedactor = DOMRedactor;
    window.domRedactor = domRedactorInstance;
  }
})();
