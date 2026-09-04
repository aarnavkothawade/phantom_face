/**
 * PrivacyShield - Comprehensive PII Detection Rule Engine
 * Combines Regex patterns, Checksum validators (Verhoeff, Luhn), and Shannon-Entropy Secret Analyzers.
 */
(function() {
  'use strict';

  const VerhoeffValidator = (typeof Verhoeff !== 'undefined') ? Verhoeff : (typeof require !== 'undefined' ? require('./verhoeff') : null);
  const LuhnValidator = (typeof Luhn !== 'undefined') ? Luhn : (typeof require !== 'undefined' ? require('./luhn') : null);

  /**
   * Calculates Shannon Entropy of a string to detect high-entropy API keys / passwords / secrets.
   * @param {string} str 
   * @returns {number}
   */
  function calculateShannonEntropy(str) {
    if (!str || str.length === 0) return 0;
    const len = str.length;
    const frequencies = {};

    for (let i = 0; i < len; i++) {
      const char = str.charAt(i);
      frequencies[char] = (frequencies[char] || 0) + 1;
    }

    let entropy = 0;
    for (const char in frequencies) {
      const p = frequencies[char] / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  const PIIRules = [
    // 1. CREDIT / DEBIT CARDS (Priority 100 - High Specificity + Luhn Check)
    {
      id: 'CREDIT_CARD',
      name: 'Credit/Debit Card',
      tokenPrefix: 'CARD',
      priority: 100,
      pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b|\b\d{4}[-\s]?\d{6}[-\s]?\d{4,5}\b|\b\d{13,19}\b/g,
      validate: (match) => {
        if (!LuhnValidator) return true;
        return LuhnValidator.validate(match);
      }
    },

    // 2. INDIAN AADHAAR NUMBER (Priority 95 - 12 Digits + Verhoeff Checksum)
    {
      id: 'AADHAAR',
      name: 'Indian Aadhaar UID',
      tokenPrefix: 'AADHAAR',
      priority: 95,
      pattern: /\b[2-9]\d{3}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      validate: (match) => {
        if (!VerhoeffValidator) return true;
        return VerhoeffValidator.validate(match);
      }
    },

    // 3. INDIAN PAN CARD (Priority 90: 5 Letters + 4 Digits + 1 Letter)
    {
      id: 'PAN',
      name: 'Indian PAN Number',
      tokenPrefix: 'PAN',
      priority: 90,
      pattern: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g,
      validate: (match) => {
        return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(match);
      }
    },

    // 4. API KEYS & CREDENTIALS (Priority 85)
    {
      id: 'AWS_KEY',
      name: 'AWS Access Key ID',
      tokenPrefix: 'AWS_KEY',
      priority: 85,
      pattern: /\b(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/g
    },
    {
      id: 'GITHUB_TOKEN',
      name: 'GitHub Personal Access Token',
      tokenPrefix: 'GITHUB_TOKEN',
      priority: 85,
      pattern: /\b(?:ghp_[0-9a-zA-Z]{36}|gho_[0-9a-zA-Z]{36}|ghu_[0-9a-zA-Z]{36}|ghs_[0-9a-zA-Z]{36}|ghr_[0-9a-zA-Z]{36}|github_pat_[0-9a-zA-Z_]{82})\b/g
    },
    {
      id: 'GOOGLE_API_KEY',
      name: 'Google API Key',
      tokenPrefix: 'GOOGLE_KEY',
      priority: 85,
      pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g
    },
    {
      id: 'OPENAI_KEY',
      name: 'OpenAI API Key',
      tokenPrefix: 'OPENAI_KEY',
      priority: 85,
      pattern: /\bsk-(?:proj-|live-|admin-)?[a-zA-Z0-9_-]{32,70}\b/g
    },
    {
      id: 'ANTHROPIC_KEY',
      name: 'Anthropic API Key',
      tokenPrefix: 'ANTHROPIC_KEY',
      priority: 85,
      pattern: /\bsk-ant-(?:api03-)?[a-zA-Z0-9_\-]{32,95}\b/g
    },
    {
      id: 'SLACK_TOKEN',
      name: 'Slack Token',
      tokenPrefix: 'SLACK_TOKEN',
      priority: 85,
      pattern: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/g
    },
    {
      id: 'JWT_TOKEN',
      name: 'JSON Web Token (JWT)',
      tokenPrefix: 'JWT',
      priority: 80,
      pattern: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g
    },

    // 5. EMAIL ADDRESSES (Priority 75)
    {
      id: 'EMAIL',
      name: 'Email Address',
      tokenPrefix: 'EMAIL',
      priority: 75,
      pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
      validate: (match) => {
        return match.includes('.') && match.length <= 100;
      }
    },

    // 6. PHONE NUMBERS (Priority 70: Indian Mobile & International E.164)
    {
      id: 'PHONE',
      name: 'Phone Number',
      tokenPrefix: 'PHONE',
      priority: 70,
      pattern: /(?:\+91[-.\s]?|0)?[6-9]\d{4}[-.\s]?\d{5}\b|\+\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g,
      validate: (match) => {
        const digits = match.replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 14) return false;
        if (/^(\d)\1{9,}$/.test(digits)) return false;
        return true;
      }
    },

    // 7. IP ADDRESSES (Priority 65)
    {
      id: 'IP_ADDRESS',
      name: 'IP Address',
      tokenPrefix: 'IP',
      priority: 65,
      pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b|(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g
    },

    // 8. HIGH-ENTROPY SECRETS / PASSWORD TOKENS (Priority 50 - Fallback)
    {
      id: 'SECRET_ENTROPY',
      name: 'High-Entropy Secret',
      tokenPrefix: 'SECRET',
      priority: 50,
      pattern: /\b[A-Za-z0-9+/=_\-]{16,64}\b/g,
      validate: (match) => {
        if (/^[a-zA-Z]+$/.test(match) || /^\d+$/.test(match)) return false;
        const entropy = calculateShannonEntropy(match);
        return entropy >= 3.8;
      }
    }
  ];

  const PIIRulesEngine = {
    rules: PIIRules,
    calculateEntropy: calculateShannonEntropy
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PIIRulesEngine;
  } else if (typeof window !== 'undefined') {
    window.PIIRulesEngine = PIIRulesEngine;
  }
})();
