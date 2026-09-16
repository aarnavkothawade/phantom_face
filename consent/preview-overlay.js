/**
 * PrivacyShield — Pre-Send Consent Preview Overlay
 * Provides human-in-the-loop verification before external transmission.
 * 
 * OPT-IN HOOK: This module is purely additive and dormant by default.
 * Activate via:
 *    window.PhantomConsent.enable();
 * 
 * When enabled, interceptors can call:
 *    const approved = await window.PhantomConsent.requestConsent({
 *      sanitizedImageBase64: '...',
 *      sanitizedTokens: ['[AADHAAR_1]', '[PAN_1]'],
 *      destinationUrl: 'http://localhost:3000/api/analyze'
 *    });
 */
(function() {
  'use strict';

  if (typeof window === 'undefined') return;
  if (window.PhantomConsent) return;

  let isConsentEnabled = false;
  let activeModal = null;

  class ConsentController {
    constructor() {
      this.enabled = false;
      this.logPrefix = '[Phantom AI Pre-Send Consent]';
    }

    /**
     * Enables human-in-the-loop pre-send consent preview.
     */
    enable() {
      this.enabled = true;
      isConsentEnabled = true;
      console.log(`${this.logPrefix} Opt-in consent interceptor ENABLED.`);
      return true;
    }

    /**
     * Disables pre-send consent preview (immediate transparent passthrough).
     */
    disable() {
      this.enabled = false;
      isConsentEnabled = false;
      console.log(`${this.logPrefix} Opt-in consent interceptor DISABLED.`);
      return false;
    }

    /**
     * Checks if consent preview is currently enabled.
     */
    isEnabled() {
      return this.enabled;
    }

    /**
     * Displays the sanitized transmission payload and prompts user for authorization.
     * @param {Object} payload - { sanitizedImageBase64, sanitizedTokens, destinationUrl, taskPrompt }
     * @returns {Promise<boolean>} Resolves true if approved, false if aborted.
     */
    async requestConsent(payload = {}) {
      if (!this.enabled) {
        // Transparent passthrough when not enabled
        return true;
      }

      if (activeModal) {
        activeModal.remove();
        activeModal = null;
      }

      return new Promise((resolve) => {
        const root = document.body || document.documentElement;

        const backdrop = document.createElement('div');
        backdrop.className = 'ps-consent-backdrop';
        backdrop.setAttribute('data-ps-ignore', 'true');
        backdrop.style.cssText = `
          position: fixed !important;
          inset: 0 !important;
          background: rgba(8, 12, 28, 0.88) !important;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
          z-index: 2147483647 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          padding: 20px !important;
          box-sizing: border-box !important;
        `;

        const modal = document.createElement('div');
        modal.className = 'ps-consent-modal';
        modal.setAttribute('data-ps-ignore', 'true');
        modal.style.cssText = `
          background: #0f172a !important;
          border: 1px solid rgba(56, 189, 248, 0.4) !important;
          border-radius: 14px !important;
          width: 95vw !important;
          max-width: 820px !important;
          max-height: 90vh !important;
          display: flex !important;
          flex-direction: column !important;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(56,189,248,0.2) !important;
          overflow: hidden !important;
          color: #f8fafc !important;
        `;

        const tokenBadges = (payload.sanitizedTokens || []).map(t => 
          `<span style="background:#0369a1;color:#bae6fd;padding:2px 8px;border-radius:12px;font-size:11px;font-family:monospace;font-weight:700;">${t}</span>`
        ).join(' ') || '<span style="color:#94a3b8;font-size:12px;">No sensitive text detected on active viewport</span>';

        const destUrl = payload.destinationUrl || 'http://localhost:3000/api/analyze (Local Intranet)';

        modal.innerHTML = `
          <div style="padding:16px 20px;background:#1e293b;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:10px;height:10px;border-radius:50%;background:#38bdf8;box-shadow:0 0 8px #38bdf8;"></div>
              <h2 style="font-size:15px;font-weight:700;margin:0;color:#fff;letter-spacing:0.02em;">
                🛡️ Phantom AI — Outgoing Transmission Security Check
              </h2>
            </div>
            <span style="font-size:11px;background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.4);color:#34d399;padding:3px 8px;border-radius:12px;font-weight:700;">
              Local Pre-Send Inspection
            </span>
          </div>

          <div style="padding:18px 20px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:16px;">
            <!-- Security Audit Notice -->
            <div style="background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px;font-size:12px;line-height:1.6;">
              <p style="margin:0 0 6px 0;color:#e2e8f0;font-weight:600;">
                Review sanitized payload before forwarding to the local reasoning model:
              </p>
              <ul style="margin:0;padding-left:18px;color:#94a3b8;font-size:11px;">
                <li><strong>Biometrics:</strong> Facial regions blurred via local multi-pass Gaussian box-blur.</li>
                <li><strong>Identifiers:</strong> Real Aadhaar/PAN/Cards replaced with reversible local tokens.</li>
                <li><strong>Destination:</strong> ${destUrl}</li>
              </ul>
            </div>

            <!-- Sanitized Screenshot Frame -->
            <div>
              <div style="font-size:12px;color:#94a3b8;font-weight:600;margin-bottom:6px;display:flex;justify-content:space-between;">
                <span>Sanitized Visual Frame (What VLM Receives)</span>
                <span style="color:#38bdf8;">✔ Biometrics & Text Masked</span>
              </div>
              <div style="background:#090d16;border:1px solid #334155;border-radius:8px;padding:8px;display:flex;align-items:center;justify-content:center;max-height:280px;overflow:hidden;">
                ${payload.sanitizedImageBase64 ? 
                  `<img src="${payload.sanitizedImageBase64}" style="max-width:100%;max-height:260px;object-fit:contain;border-radius:4px;" alt="Sanitized Payload Preview" />` : 
                  `<div style="padding:40px;color:#64748b;font-size:12px;font-family:monospace;">[Simulated Sanitized Canvas Frame: All Pixels Scrubbed]</div>`
                }
              </div>
            </div>

            <!-- Protected Tokens List -->
            <div>
              <div style="font-size:12px;color:#94a3b8;font-weight:600;margin-bottom:6px;">
                Redacted Entities Substituted in Context:
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;background:#090d16;padding:10px;border-radius:6px;border:1px solid #1e293b;">
                ${tokenBadges}
              </div>
            </div>
          </div>

          <div style="padding:14px 20px;background:#1e293b;border-top:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;">
            <button type="button" id="ps-consent-abort" style="
              background:rgba(239,68,68,0.15);
              border:1px solid rgba(239,68,68,0.3);
              color:#f87171;
              padding:8px 16px;
              border-radius:8px;
              font-size:12px;
              font-weight:600;
              cursor:pointer;
              transition:all 0.15s;
            ">
              ✕ Cancel / Abort Transmission
            </button>
            <div style="display:flex;gap:10px;">
              <button type="button" id="ps-consent-approve" style="
                background:#0284c7;
                border:none;
                color:#fff;
                padding:8px 20px;
                border-radius:8px;
                font-size:12px;
                font-weight:700;
                cursor:pointer;
                box-shadow:0 2px 10px rgba(2,132,199,0.4);
                transition:all 0.15s;
              ">
                ✓ Authorize & Forward to VLM
              </button>
            </div>
          </div>
        `;

        backdrop.appendChild(modal);
        root.appendChild(backdrop);
        activeModal = backdrop;

        const cleanup = (approved) => {
          if (activeModal && activeModal.parentNode) {
            activeModal.parentNode.removeChild(activeModal);
          }
          activeModal = null;
          resolve(approved);
        };

        modal.querySelector('#ps-consent-abort').addEventListener('click', () => cleanup(false));
        modal.querySelector('#ps-consent-approve').addEventListener('click', () => cleanup(true));
      });
    }
  }

  const consentInstance = new ConsentController();
  window.PhantomConsent = consentInstance;

  console.log('[PrivacyShield] Pre-send consent module loaded (Opt-in via window.PhantomConsent.enable()).');
})();
