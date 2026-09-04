/**
 * PrivacyShield - Client-Side AI Action Executor
 * Executes UI actions (click, fill, scroll) on the real, live DOM with glowing visual feedback.
 * Safely substitutes form field values from the local mock user profile (zero server roundtrip of real PII).
 */
(function() {
  'use strict';

  const config = (typeof window !== 'undefined' && window.PrivacyShieldConfig) || (typeof require !== 'undefined' ? require('../../config') : null);

  class ActionExecutor {
    constructor() {
      this.isExecuting = false;
      this.actionHistory = [];
    }

    /**
     * Highlights an element with an animated glowing neon aura before performing an action.
     */
    async highlightElement(el, durationMs = 700) {
      if (!el || !el.getBoundingClientRect) return;

      const rect = el.getBoundingClientRect();
      const highlight = document.createElement('div');
      highlight.className = 'ps-action-highlight-overlay';
      highlight.style.cssText = `
        position: fixed;
        left: ${rect.left - 4}px;
        top: ${rect.top - 4}px;
        width: ${rect.width + 8}px;
        height: ${rect.height + 8}px;
        border: 2px solid #00f2fe;
        border-radius: 6px;
        background: rgba(0, 242, 254, 0.2);
        box-shadow: 0 0 20px #00f2fe, inset 0 0 10px #00f2fe;
        pointer-events: none;
        z-index: 2147483640;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        animation: ps-pulse-aura 0.7s infinite alternate;
      `;

      document.body.appendChild(highlight);

      return new Promise((resolve) => {
        setTimeout(() => {
          if (highlight.parentNode) {
            highlight.parentNode.removeChild(highlight);
          }
          resolve();
        }, durationMs);
      });
    }

    /**
     * Resolves appropriate local mock value for a given field category without touching server.
     */
    resolveLocalProfileValue(fieldType, fallbackValue) {
      const profile = config?.MOCK_PROFILE || {
        name: 'Aarav Sharma',
        email: 'aarav.sharma@example.com',
        phone: '+91 98765 43210',
        aadhaar: '2345 6789 0123',
        pan: 'ABCDE1234F',
        address: 'Flat 402, Lotus Heights, Bengaluru'
      };

      if (!fieldType) return fallbackValue || '';

      const key = fieldType.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (key.includes('email')) return profile.email;
      if (key.includes('first')) return profile.first_name || profile.name.split(' ')[0];
      if (key.includes('last')) return profile.last_name || profile.name.split(' ')[1];
      if (key.includes('name')) return profile.name;
      if (key.includes('phone') || key.includes('mobile') || key.includes('contact')) return profile.phone;
      if (key.includes('aadhaar') || key.includes('uid')) return profile.aadhaar;
      if (key.includes('pan')) return profile.pan;
      if (key.includes('addr')) return profile.address;
      if (key.includes('city')) return profile.city || 'Bengaluru';
      if (key.includes('state')) return profile.state || 'Karnataka';
      if (key.includes('pin') || key.includes('zip')) return profile.pincode || '560103';

      return fallbackValue || profile[key] || '';
    }

    /**
     * Dispatches proper reactive input events so modern frameworks (React, Vue, Svelte) catch updates.
     */
    setNativeInputValue(el, value) {
      if (!el) return;

      // Handle Select element
      if (el.tagName.toLowerCase() === 'select') {
        let matchedOption = false;
        for (let i = 0; i < el.options.length; i++) {
          if (el.options[i].text.toLowerCase().includes(value.toLowerCase()) || el.options[i].value.toLowerCase().includes(value.toLowerCase())) {
            el.selectedIndex = i;
            matchedOption = true;
            break;
          }
        }
        if (!matchedOption && el.options.length > 0) {
          el.selectedIndex = 0;
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }

      // Handle Checkbox / Radio
      if (el.type === 'checkbox' || el.type === 'radio') {
        el.checked = (value === true || value === 'true' || value === '1');
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }

      // Handle standard text inputs
      el.focus();
      const lastValue = el.value;
      el.value = value;

      // Call React / DOM tracker if present
      const tracker = el._valueTracker;
      if (tracker) {
        tracker.setValue(lastValue);
      }

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.blur();
    }

    /**
     * Executes a single UI action.
     */
    async executeSingleAction(action) {
      const { type, selector, fieldType, value, scrollY } = action;
      let targetEl = null;

      if (selector) {
        try {
          targetEl = document.querySelector(selector);
        } catch (e) {
          console.warn(`[PrivacyShield] Invalid selector: ${selector}`, e);
        }
      }

      // 1. FILL Action
      if (type === 'fill') {
        if (!targetEl) {
          // Fallback heuristic: search by name or placeholder matching fieldType
          if (fieldType) {
            targetEl = document.querySelector(`input[name*="${fieldType}" i], input[placeholder*="${fieldType}" i], input[type="${fieldType}"]`);
          }
        }

        if (targetEl) {
          await this.highlightElement(targetEl, 500);
          const safeValue = this.resolveLocalProfileValue(fieldType, value);
          this.setNativeInputValue(targetEl, safeValue);
          return { success: true, action: 'fill', selector, valueApplied: '••••••••' };
        } else {
          return { success: false, error: `Target element not found for selector: ${selector}` };
        }
      }

      // 2. CLICK Action
      if (type === 'click') {
        if (targetEl) {
          await this.highlightElement(targetEl, 600);
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetEl.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
          targetEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          targetEl.click();
          targetEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          return { success: true, action: 'click', selector };
        } else {
          return { success: false, error: `Click target element not found: ${selector}` };
        }
      }

      // 3. SCROLL Action
      if (type === 'scroll') {
        const top = (scrollY !== undefined) ? scrollY : (targetEl ? targetEl.getBoundingClientRect().top + window.scrollY - 100 : 300);
        window.scrollTo({ top: top, behavior: 'smooth' });
        return { success: true, action: 'scroll', top };
      }

      return { success: false, error: `Unknown action type: ${type}` };
    }

    /**
     * Executes an array of actions sequentially.
     * @param {Array} actions 
     * @returns {Promise<Array>} Results
     */
    async executeActions(actions) {
      if (!Array.isArray(actions) || actions.length === 0) return [];
      this.isExecuting = true;
      const results = [];

      for (const action of actions) {
        try {
          const result = await this.executeSingleAction(action);
          results.push(result);
          this.actionHistory.push({ timestamp: Date.now(), action, result });
          // Brief pause between actions for natural feel
          await new Promise(r => setTimeout(r, 250));
        } catch (err) {
          results.push({ success: false, error: err.message });
        }
      }

      this.isExecuting = false;
      return results;
    }
  }

  const actionExecutorInstance = new ActionExecutor();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ActionExecutor,
      actionExecutor: actionExecutorInstance
    };
  } else if (typeof window !== 'undefined') {
    window.ActionExecutor = ActionExecutor;
    window.actionExecutor = actionExecutorInstance;
  }
})();
