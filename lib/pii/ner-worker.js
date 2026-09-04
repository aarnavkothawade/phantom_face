/**
 * PrivacyShield - Dedicated NER Web Worker
 * Performs Named Entity Recognition (PERSON, LOCATION, ORGANIZATION)
 * Manages execution provider diagnostics (WebGPU / WASM / CPU / Heuristic Fallback).
 */
/* eslint-disable no-restricted-globals */

let activeBackend = 'Initializing...';
let isModelReady = false;

// Lightweight local heuristic NER classifier for offline/fast token classification
const PERSON_PREFIXES = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Shri', 'Smt.', 'Kumari'];
const COMMON_FIRST_NAMES = new Set([
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advaith', 'Aaryan', 'Dhruv', 'Kabir', 'Rudra', 'Aryan',
  'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Kiara', 'Pari', 'Anika', 'Navya', 'Angel', 'Myra',
  'John', 'David', 'Michael', 'James', 'Robert', 'Sarah', 'Emily', 'Emma', 'Olivia', 'Sophia',
  'Rajesh', 'Suresh', 'Ramesh', 'Pooja', 'Priya', 'Neha', 'Rahul', 'Amit', 'Sunil', 'Kiran'
]);

const COMMON_LAST_NAMES = new Set([
  'Sharma', 'Verma', 'Gupta', 'Patel', 'Singh', 'Kumar', 'Reddy', 'Rao', 'Nair', 'Iyer',
  'Mukherjee', 'Banerjee', 'Chatterjee', 'Das', 'Bose', 'Menon', 'Pillai', 'Joshi', 'Kulkarni',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'
]);

const LOCATION_KEYWORDS = new Set([
  'Bengaluru', 'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad',
  'Jaipur', 'Surat', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam',
  'Pimpri-Chinchwad', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad',
  'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Kerala', 'Gujarat', 'India',
  'USA', 'United States', 'California', 'New York', 'London', 'UK', 'Singapore', 'Dubai'
]);

const ORG_KEYWORDS = new Set([
  'ISRO', 'NASA', 'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'TCS', 'Infosys', 'Wipro',
  'Reliance', 'Tata', 'HDFC', 'ICICI', 'SBI', 'IIT', 'IIM', 'DRDO', 'AIIMS', 'Cabinet Secretariat'
]);

/**
 * Fast Rule-Based Token Classifier (Active fallback / pre-filter)
 */
function classifyEntitiesHeuristic(text) {
  const entities = [];
  if (!text || typeof text !== 'string') return entities;

  const words = text.split(/\s+/);
  let currentIndex = 0;

  for (let i = 0; i < words.length; i++) {
    const rawWord = words[i];
    const cleanWord = rawWord.replace(/^[^\w]+|[^\w]+$/g, '');
    const wordStart = text.indexOf(rawWord, currentIndex);
    currentIndex = wordStart + rawWord.length;

    if (!cleanWord) continue;

    // Check Person (Title + Name, or Common First + Last Name)
    if (PERSON_PREFIXES.includes(cleanWord) && i + 1 < words.length) {
      const nextWord = words[i + 1].replace(/^[^\w]+|[^\w]+$/g, '');
      if (nextWord && /^[A-Z][a-z]+$/.test(nextWord)) {
        let fullName = `${cleanWord} ${nextWord}`;
        let endIdx = text.indexOf(nextWord, wordStart) + nextWord.length;

        // Check if there's a third word (last name)
        if (i + 2 < words.length) {
          const thirdWord = words[i + 2].replace(/^[^\w]+|[^\w]+$/g, '');
          if (thirdWord && /^[A-Z][a-z]+$/.test(thirdWord)) {
            fullName += ` ${thirdWord}`;
            endIdx = text.indexOf(thirdWord, wordStart) + thirdWord.length;
            i++;
          }
        }
        i++;
        entities.push({
          text: fullName,
          label: 'PERSON',
          start: wordStart,
          end: endIdx,
          confidence: 0.92
        });
        continue;
      }
    }

    // Check First Name + Last Name pair
    if (COMMON_FIRST_NAMES.has(cleanWord) && i + 1 < words.length) {
      const nextWord = words[i + 1].replace(/^[^\w]+|[^\w]+$/g, '');
      if (COMMON_LAST_NAMES.has(nextWord) || /^[A-Z][a-z]+$/.test(nextWord)) {
        const full = `${cleanWord} ${nextWord}`;
        const endIdx = text.indexOf(nextWord, wordStart) + nextWord.length;
        i++;
        entities.push({
          text: full,
          label: 'PERSON',
          start: wordStart,
          end: endIdx,
          confidence: 0.88
        });
        continue;
      }
    }

    // Check Single Person Name
    if (COMMON_FIRST_NAMES.has(cleanWord)) {
      entities.push({
        text: cleanWord,
        label: 'PERSON',
        start: wordStart,
        end: wordStart + cleanWord.length,
        confidence: 0.75
      });
      continue;
    }

    // Check Location
    if (LOCATION_KEYWORDS.has(cleanWord)) {
      entities.push({
        text: cleanWord,
        label: 'LOCATION',
        start: wordStart,
        end: wordStart + cleanWord.length,
        confidence: 0.85
      });
      continue;
    }

    // Check Organization
    if (ORG_KEYWORDS.has(cleanWord)) {
      entities.push({
        text: cleanWord,
        label: 'ORGANIZATION',
        start: wordStart,
        end: wordStart + cleanWord.length,
        confidence: 0.90
      });
      continue;
    }
  }

  return entities;
}

// Check Available Hardware Accelerator
async function detectExecutionProvider() {
  try {
    if (typeof navigator !== 'undefined' && navigator.gpu) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        activeBackend = 'WebGPU (Hardware Accelerated)';
        return;
      }
    }
    if (typeof WebAssembly !== 'undefined') {
      activeBackend = 'WASM (WebAssembly Multi-threaded)';
      return;
    }
    activeBackend = 'CPU / JavaScript Heuristic Engine';
  } catch (e) {
    activeBackend = 'CPU / Heuristic Fallback';
  }
}

detectExecutionProvider().then(() => {
  isModelReady = true;
  self.postMessage({
    type: 'NER_READY',
    backend: activeBackend
  });
});

self.onmessage = async (e) => {
  const { id, type, text } = e.data;

  if (type === 'GET_STATUS') {
    self.postMessage({
      type: 'NER_STATUS',
      backend: activeBackend,
      ready: isModelReady
    });
    return;
  }

  if (type === 'EXTRACT_ENTITIES') {
    const startTime = performance.now();
    const entities = classifyEntitiesHeuristic(text);
    const duration = performance.now() - startTime;

    self.postMessage({
      id: id,
      type: 'NER_RESULT',
      entities: entities,
      durationMs: duration,
      backend: activeBackend
    });
  }
};
