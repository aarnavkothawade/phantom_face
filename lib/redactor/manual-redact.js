/**
 * PrivacyShield — Manual Region Redaction Engine (Select-to-Redact)
 * 
 * Provides pure coordinate-based manual masking independent of the PII classifier.
 * Fully offline, interactive multi-region selection overlay.
 * Reuses existing window.canvasRedactor.redactScreenshot without modifying its logic.
 */
(function() {
  'use strict';

  if (window.__PRIVACY_SHIELD_MANUAL_REDACT_INITIALIZED__) return;
  window.__PRIVACY_SHIELD_MANUAL_REDACT_INITIALIZED__ = true;

  console.log('[PrivacyShield] Manual Select-to-Redact module active.');

  let currentOverlay = null;
  let currentScreenshotDataUrl = null;
  let selectedRegions = [];
  let activeDomMasks = [];

  function getHostRoot() {
    return document.getElementById('privacyshield-root') || document.body;
  }

  // -------------------------------------------------------------------------
  // 1. Hook into in-page FAB Menu & Post-Redaction Preview
  // -------------------------------------------------------------------------
  function setupInPageHooks() {
    let checkTimer = setInterval(() => {
      const fabMenu = document.getElementById('ps-fab-menu');
      if (fabMenu) {
        attachFabMenuButton();
        clearInterval(checkTimer);
      }
    }, 250);

    const observer = new MutationObserver(() => {
      attachFabMenuButton();
      attachRedactMoreButton();
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    attachFabMenuButton();
    attachRedactMoreButton();

    const restoreBtn = document.getElementById('ps-restore-btn');
    if (restoreBtn) {
      restoreBtn.addEventListener('click', clearLiveDomMasks);
    }
  }

  function attachFabMenuButton() {
    const fabMenu = document.getElementById('ps-fab-menu');
    if (!fabMenu) return;
    if (document.getElementById('ps-mr-select-btn')) return;

    // Create the "Select to Redact" button matching the exact menu styling
    const selectBtn = document.createElement('button');
    selectBtn.className = 'ps-fab-menu-btn';
    selectBtn.id = 'ps-mr-select-btn';
    selectBtn.title = 'Select to Redact';
    selectBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;display:block;margin:auto;">
        <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
        <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
        <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
        <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
        <rect x="7" y="7" width="10" height="10" stroke-dasharray="2 2"/>
      </svg>
    `;

    selectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startManualRedaction();
    });

    const rescanBtn = document.getElementById('ps-rescan-btn');
    if (rescanBtn) {
      fabMenu.insertBefore(selectBtn, rescanBtn);
    } else {
      fabMenu.appendChild(selectBtn);
    }
  }

  function attachRedactMoreButton() {
    const previewBox = document.getElementById('ps-preview-box');
    if (!previewBox) return;
    if (document.getElementById('ps-mr-redact-more-btn')) return;

    const previewImg = document.getElementById('ps-preview-img');
    const redactMoreBtn = document.createElement('button');
    redactMoreBtn.id = 'ps-mr-redact-more-btn';
    redactMoreBtn.className = 'ps-mr-btn-more';
    redactMoreBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      <span>Manually redact more</span>
    `;

    redactMoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const baseImg = previewImg && previewImg.src && !previewImg.src.startsWith('data:,') ? previewImg.src : null;
      startManualRedaction(baseImg);
    });

    previewBox.appendChild(redactMoreBtn);
  }

  // -------------------------------------------------------------------------
  // 2. Message Dispatcher
  // -------------------------------------------------------------------------
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.action === 'START_MANUAL_SELECTION') {
      startManualRedaction(message.baseImage || null);
      sendResponse({ success: true });
      return true;
    }
  });

  // -------------------------------------------------------------------------
  // 3. Selection Lifecycle
  // -------------------------------------------------------------------------
  async function startManualRedaction(existingImage = null) {
    if (currentOverlay) {
      currentOverlay.remove();
      currentOverlay = null;
    }

    if (existingImage) {
      currentScreenshotDataUrl = existingImage;
      buildSelectionOverlay();
      return;
    }

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'CAPTURE_VISIBLE_TAB' }, resolve);
      });

      if (response && response.success && response.dataUrl) {
        currentScreenshotDataUrl = response.dataUrl;
        selectedRegions = [];
        buildSelectionOverlay();
      } else {
        alert('[PrivacyShield] Unable to capture tab screenshot for manual selection.');
      }
    } catch (err) {
      console.error('[PrivacyShield] Tab capture failed:', err);
      alert('[PrivacyShield] Tab capture failed: ' + (err.message || err));
    }
  }

  function buildSelectionOverlay() {
    const root = getHostRoot();
    const overlay = document.createElement('div');
    overlay.className = 'ps-mr-overlay';
    overlay.id = 'ps-mr-overlay';
    overlay.setAttribute('data-ps-ignore', 'true');

    // Background Image matching exact viewport 1:1
    // Mark with ps-scanned and data-ps-ignore so content.js dynamic scanner ignores it
    const img = document.createElement('img');
    img.className = 'ps-mr-screenshot ps-scanned';
    img.setAttribute('data-ps-ignore', 'true');
    img.src = currentScreenshotDataUrl;
    overlay.appendChild(img);

    // Top Instruction Bar
    const topbar = document.createElement('div');
    topbar.className = 'ps-mr-topbar';
    topbar.setAttribute('data-ps-ignore', 'true');
    topbar.innerHTML = `
      <span>✏️ Click & drag to draw redaction boxes</span>
      <span class="ps-mr-badge" id="ps-mr-region-count">0 regions</span>
      <span style="font-size: 11px; opacity: 0.8;">[ESC to cancel • ENTER to redact]</span>
    `;
    overlay.appendChild(topbar);

    // Dynamic Drawing Box
    const activeRect = document.createElement('div');
    activeRect.className = 'ps-mr-active-rect';
    activeRect.style.display = 'none';
    overlay.appendChild(activeRect);

    // Bottom Action Dock
    const dock = document.createElement('div');
    dock.className = 'ps-mr-dock';
    dock.setAttribute('data-ps-ignore', 'true');
    dock.innerHTML = `
      <button type="button" class="ps-mr-btn ps-mr-btn-cancel" id="ps-mr-btn-cancel">✕ Cancel (ESC)</button>
      <button type="button" class="ps-mr-btn ps-mr-btn-clear" id="ps-mr-btn-clear">🗑 Clear All</button>
      <button type="button" class="ps-mr-btn ps-mr-btn-confirm" id="ps-mr-btn-confirm">🛡️ Confirm & Redact (Enter)</button>
    `;
    overlay.appendChild(dock);

    let isDrawing = false;
    let startX = 0;
    let startY = 0;

    overlay.addEventListener('mousedown', (e) => {
      if (e.target.closest('.ps-mr-dock') || e.target.closest('.ps-mr-topbar') || e.target.closest('.ps-mr-region-tag')) {
        return;
      }
      if (e.button !== 0) return;

      isDrawing = true;
      startX = e.clientX;
      startY = e.clientY;
      activeRect.style.left = `${startX}px`;
      activeRect.style.top = `${startY}px`;
      activeRect.style.width = '0px';
      activeRect.style.height = '0px';
      activeRect.style.display = 'block';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const curX = e.clientX;
      const curY = e.clientY;

      const left = Math.min(startX, curX);
      const top = Math.min(startY, curY);
      const width = Math.abs(curX - startX);
      const height = Math.abs(curY - startY);

      activeRect.style.left = `${left}px`;
      activeRect.style.top = `${top}px`;
      activeRect.style.width = `${width}px`;
      activeRect.style.height = `${height}px`;
    });

    window.addEventListener('mouseup', (e) => {
      if (!isDrawing) return;
      isDrawing = false;
      activeRect.style.display = 'none';

      const curX = e.clientX;
      const curY = e.clientY;

      const x = Math.min(startX, curX);
      const y = Math.min(startY, curY);
      const width = Math.abs(curX - startX);
      const height = Math.abs(curY - startY);

      if (width >= 8 && height >= 8) {
        addRegion(x, y, width, height, overlay);
      }
    });

    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        cleanupOverlay();
      } else if (e.key === 'Enter') {
        confirmManualRedaction();
      }
    };
    window.addEventListener('keydown', keyHandler);

    dock.querySelector('#ps-mr-btn-cancel').addEventListener('click', cleanupOverlay);
    dock.querySelector('#ps-mr-btn-clear').addEventListener('click', () => {
      selectedRegions = [];
      overlay.querySelectorAll('.ps-mr-region').forEach(el => el.remove());
      updateCountBadge(overlay);
    });
    dock.querySelector('#ps-mr-btn-confirm').addEventListener('click', confirmManualRedaction);

    function cleanupOverlay() {
      window.removeEventListener('keydown', keyHandler);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      currentOverlay = null;
    }

    currentOverlay = overlay;
    root.appendChild(overlay);

    selectedRegions.forEach(r => renderRegionDOM(r, overlay));
    updateCountBadge(overlay);
  }

  function addRegion(x, y, width, height, overlay) {
    const region = {
      id: 'reg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      x,
      y,
      width,
      height
    };
    selectedRegions.push(region);
    renderRegionDOM(region, overlay);
    updateCountBadge(overlay);
  }

  function renderRegionDOM(region, overlay) {
    const el = document.createElement('div');
    el.className = 'ps-mr-region';
    el.id = region.id;
    el.style.left = `${region.x}px`;
    el.style.top = `${region.y}px`;
    el.style.width = `${region.width}px`;
    el.style.height = `${region.height}px`;

    const tag = document.createElement('div');
    tag.className = 'ps-mr-region-tag';
    tag.innerHTML = `
      <span>[MANUAL_MASK ${region.width}×${region.height}]</span>
      <button type="button" class="ps-mr-region-delete" title="Delete region">✕</button>
    `;

    tag.querySelector('.ps-mr-region-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      selectedRegions = selectedRegions.filter(r => r.id !== region.id);
      el.remove();
      updateCountBadge(overlay);
    });

    el.appendChild(tag);
    overlay.appendChild(el);
  }

  function updateCountBadge(overlay) {
    const countBadge = overlay.querySelector('#ps-mr-region-count');
    if (countBadge) {
      countBadge.textContent = `${selectedRegions.length} region${selectedRegions.length === 1 ? '' : 's'}`;
    }
  }

  // -------------------------------------------------------------------------
  // 4. Confirm & Execute Redaction via window.canvasRedactor & Live DOM Mask
  // -------------------------------------------------------------------------
  async function confirmManualRedaction() {
    if (selectedRegions.length === 0) {
      alert('[PrivacyShield] Please select at least one region to redact before confirming.');
      return;
    }

    if (!window.canvasRedactor || typeof window.canvasRedactor.redactScreenshot !== 'function') {
      alert('[PrivacyShield] Canvas redactor engine is not available.');
      return;
    }

    try {
      const domBoxes = selectedRegions.map((r, idx) => ({
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        tokens: [`[MANUAL_REDACT_${idx + 1}]`]
      }));

      const result = await window.canvasRedactor.redactScreenshot(
        currentScreenshotDataUrl,
        domBoxes,
        [],
        []
      );

      if (currentOverlay) {
        currentOverlay.remove();
        currentOverlay = null;
      }

      applyLiveDomMasks(domBoxes);
      showPreviewModal(result.sanitizedImageBase64);

    } catch (err) {
      console.error('[PrivacyShield] Manual redaction execution error:', err);
      alert('[PrivacyShield] Failed to render manual redaction: ' + err.message);
    }
  }

  function applyLiveDomMasks(domBoxes) {
    clearLiveDomMasks();
    const root = getHostRoot();

    domBoxes.forEach((box, idx) => {
      const mask = document.createElement('div');
      mask.className = 'ps-mr-dom-mask';
      mask.style.left = `${box.x + window.scrollX}px`;
      mask.style.top = `${box.y + window.scrollY}px`;
      mask.style.width = `${box.width}px`;
      mask.style.height = `${box.height}px`;
      mask.innerHTML = `<span>${box.tokens[0] || '[MANUALLY_REDACTED]'}</span>`;
      root.appendChild(mask);
      activeDomMasks.push(mask);
    });
  }

  function clearLiveDomMasks() {
    activeDomMasks.forEach(mask => {
      if (mask.parentNode) mask.parentNode.removeChild(mask);
    });
    activeDomMasks = [];
  }

  // -------------------------------------------------------------------------
  // 5. Result Preview Modal (Download / Clipboard / Re-select)
  // -------------------------------------------------------------------------
  function showPreviewModal(sanitizedBase64) {
    const existing = document.getElementById('ps-mr-preview-modal');
    if (existing) existing.remove();

    const root = getHostRoot();
    const backdrop = document.createElement('div');
    backdrop.className = 'ps-mr-modal-backdrop';
    backdrop.id = 'ps-mr-preview-modal';
    backdrop.setAttribute('data-ps-ignore', 'true');

    backdrop.innerHTML = `
      <div class="ps-mr-modal-card" role="dialog" aria-label="Manual Redaction Preview">
        <div class="ps-mr-modal-header">
          <div class="ps-mr-modal-title">
            <span>🛡️</span>
            <span>Manual Redaction Preview (${selectedRegions.length} region${selectedRegions.length === 1 ? '' : 's'} masked)</span>
          </div>
          <button type="button" class="ps-mr-modal-close" id="ps-mr-modal-close">✕</button>
        </div>
        <div class="ps-mr-modal-body">
          <img class="ps-mr-preview-img ps-scanned" data-ps-ignore="true" src="${sanitizedBase64}" alt="Sanitized Preview" />
        </div>
        <div class="ps-mr-modal-footer">
          <button type="button" class="ps-mr-btn ps-mr-btn-cancel" id="ps-mr-btn-reselect">
            ✏️ Re-select
          </button>
          <div style="display:flex; gap:10px;">
            <button type="button" class="ps-mr-btn ps-mr-btn-cancel" id="ps-mr-btn-copy">
              📋 Copy to Clipboard
            </button>
            <button type="button" class="ps-mr-btn ps-mr-btn-confirm" id="ps-mr-btn-download">
              ⬇ Download Image
            </button>
          </div>
        </div>
      </div>
    `;

    root.appendChild(backdrop);

    backdrop.querySelector('#ps-mr-modal-close').addEventListener('click', () => backdrop.remove());

    backdrop.querySelector('#ps-mr-btn-download').addEventListener('click', () => {
      const link = document.createElement('a');
      link.download = `privacy-shield-redacted-${Date.now()}.jpg`;
      link.href = sanitizedBase64;
      link.click();
      showToast('Image downloaded successfully!');
    });

    backdrop.querySelector('#ps-mr-btn-copy').addEventListener('click', async () => {
      try {
        const res = await fetch(sanitizedBase64);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        showToast('Copied to clipboard!');
      } catch (err) {
        console.warn('Clipboard write error:', err);
        showToast('Clipboard write failed. Use Download instead.');
      }
    });

    backdrop.querySelector('#ps-mr-btn-reselect').addEventListener('click', () => {
      backdrop.remove();
      clearLiveDomMasks();
      buildSelectionOverlay();
    });
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'ps-mr-toast';
    toast.textContent = msg;
    getHostRoot().appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2500);
  }

  setupInPageHooks();

})();
