/**
 * PrivacyShield — Popup Manual Redaction Hook
 * Handles click on "Redact Selection" button inside extension popup.
 */
(function() {
  'use strict';

  const btnManualRedact = document.getElementById('btn-manual-redact');
  if (!btnManualRedact) return;

  btnManualRedact.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'START_MANUAL_SELECTION' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('[PrivacyShield Popup] Content script not responding, injecting manual-redact:', chrome.runtime.lastError.message);
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['lib/redactor/manual-redact.js']
            }, () => {
              chrome.tabs.sendMessage(tab.id, { action: 'START_MANUAL_SELECTION' });
            });
          }
        });
        window.close();
      }
    } catch (err) {
      console.error('[PrivacyShield Popup] Failed to trigger manual redaction:', err);
    }
  });
})();
