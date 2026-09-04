/**
 * PrivacyShield Options Page Controller
 */
document.addEventListener('DOMContentLoaded', async () => {
  const proxyInput = document.getElementById('input-proxy-url');
  const testProxyBtn = document.getElementById('btn-test-proxy');
  const statusMsg = document.getElementById('proxy-status-msg');
  const saveBtn = document.getElementById('btn-save-settings');
  const toast = document.getElementById('save-toast');

  // Form Fields
  const nameInput = document.getElementById('profile-name');
  const emailInput = document.getElementById('profile-email');
  const phoneInput = document.getElementById('profile-phone');
  const aadhaarInput = document.getElementById('profile-aadhaar');
  const panInput = document.getElementById('profile-pan');
  const cityInput = document.getElementById('profile-city');
  const addressInput = document.getElementById('profile-address');

  // Load Saved Settings from storage
  chrome.storage.local.get(['proxyUrl', 'mockProfile'], (data) => {
    if (data.proxyUrl) {
      proxyInput.value = data.proxyUrl;
    }
    if (data.mockProfile) {
      const p = data.mockProfile;
      if (p.name) nameInput.value = p.name;
      if (p.email) emailInput.value = p.email;
      if (p.phone) phoneInput.value = p.phone;
      if (p.aadhaar) aadhaarInput.value = p.aadhaar;
      if (p.pan) panInput.value = p.pan;
      if (p.city) cityInput.value = p.city;
      if (p.address) addressInput.value = p.address;
    }
  });

  // Test Proxy Endpoint Connection
  testProxyBtn.addEventListener('click', async () => {
    const url = proxyInput.value.trim();
    statusMsg.style.color = '#38bdf8';
    statusMsg.textContent = 'Testing connection...';

    try {
      // Derive base health url or test ping
      const parsed = new URL(url);
      const healthUrl = `${parsed.protocol}//${parsed.host}/health`;

      const res = await fetch(healthUrl, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        statusMsg.style.color = '#34d399';
        statusMsg.textContent = `✔ Connected! VLM Provider: ${data.provider || 'Ready'} (${data.model || 'VLM Active'})`;
      } else {
        statusMsg.style.color = '#f59e0b';
        statusMsg.textContent = `Proxy responded with HTTP ${res.status}. Endpoint is reachable.`;
      }
    } catch (err) {
      statusMsg.style.color = '#ef4444';
      statusMsg.textContent = `✕ Could not connect to ${url}. Make sure your proxy server is running.`;
    }
  });

  // Save Settings
  saveBtn.addEventListener('click', () => {
    const proxyUrl = proxyInput.value.trim() || 'http://localhost:3001/api/agent';
    const mockProfile = {
      name: nameInput.value.trim(),
      first_name: nameInput.value.trim().split(' ')[0] || '',
      last_name: nameInput.value.trim().split(' ').slice(1).join(' ') || '',
      email: emailInput.value.trim(),
      phone: phoneInput.value.trim(),
      aadhaar: aadhaarInput.value.trim(),
      pan: panInput.value.trim(),
      city: cityInput.value.trim(),
      address: addressInput.value.trim()
    };

    chrome.storage.local.set({ proxyUrl, mockProfile }, () => {
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    });
  });
});
