/**
 * PrivacyShield Popup Controller
 */
document.addEventListener('DOMContentLoaded', async () => {
  const proxyDisplay = document.getElementById('proxy-url-display');
  const triggerBtn = document.getElementById('btn-trigger-active-tab');
  const benchmarkBtn = document.getElementById('btn-open-benchmark');
  const optionsBtn = document.getElementById('btn-open-options');

  // Load active proxy configuration
  try {
    chrome.storage.local.get(['proxyUrl'], (result) => {
      const url = result.proxyUrl || 'http://localhost:3001/api/agent';
      try {
        const parsed = new URL(url);
        proxyDisplay.textContent = parsed.host;
      } catch (e) {
        proxyDisplay.textContent = 'localhost:3001';
      }
    });
  } catch (e) {
    console.warn(e);
  }

  // Activate on Active Page
  triggerBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const fab = document.querySelector('.ps-fab-button');
          if (fab) fab.click();
        }
      });
      window.close();
    }
  });

  // Open Benchmark Test Page
  benchmarkBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('test/evaluation_page.html') });
    window.close();
  });

  // Open Options Page
  optionsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
    }
    window.close();
  });
});
