# 🛡️ PrivacyShield — Project Features, Architecture & Tech Stack

> **Project Name:** PrivacyShield (Phantom Prototype 1.1)  
> **Target Event/Category:** ISRO Smart India Hackathon (SIH) — SIH 171  
> **Problem Statement:** Local Privacy-Preserving Multimodal Vision Agents for Autonomous Web Assistance  
> **Platform & Ecosystem:** Google Chrome & Mozilla Firefox Browser Extension (Manifest V3 Cross-Compatible) + Secure Backend VLM Proxy

---

## 📑 Table of Contents
1. [Executive Overview](#1-executive-overview)
2. [Complete List of Features](#2-complete-list-of-features)
   - [A. On-Device PII Detection & Validation](#a-on-device-pii-detection--validation)
   - [B. Multi-Layered Redaction Engine](#b-multi-layered-redaction-engine)
   - [C. Computer Vision & Screen Understanding](#c-computer-vision--screen-understanding)
   - [D. Local Decision & Fingerprinting Engine](#d-local-decision--fingerprinting-engine)
   - [E. Autonomous UI Action Execution & Feedback](#e-autonomous-ui-action-execution--feedback)
   - [F. User Experience & Floating Extension UI](#f-user-experience--floating-extension-ui)
   - [G. Telemetry, Performance & Benchmarking](#g-telemetry-performance--benchmarking)
3. [System Architecture](#3-system-architecture)
   - [High-Level Architectural Flow](#high-level-architectural-flow)
   - [Pipeline Sequential Lifecycle](#pipeline-sequential-lifecycle)
   - [Client-Proxy Trust Boundary](#client-proxy-trust-boundary)
4. [Comprehensive Technology Stack](#4-comprehensive-technology-stack)
   - [Core Client / Extension Layer](#core-client--extension-layer)
   - [Machine Learning & Computer Vision Stack](#machine-learning--computer-vision-stack)
   - [Algorithmic & PII Validation Stack](#algorithmic--pii-validation-stack)
   - [Backend Proxy Server Stack](#backend-proxy-server-stack)
   - [External AI / VLM Providers Supported](#external-ai--vlm-providers-supported)
   - [Testing, Tooling & Build Environment](#testing-tooling--build-environment)
5. [Repository Structure Reference](#5-repository-structure-reference)

---

## 1. Executive Overview

**PrivacyShield** is a zero-trust, client-first, privacy-preserving browser agent. It bridges the gap between powerful cloud-hosted Vision-Language Models (VLMs) and strict end-user data privacy regulations (such as GDPR, DPDP, HIPAA). 

Before any webpage context or screen capture is shared with external AI reasoning models, PrivacyShield automatically performs **real-time on-device PII detection**, **reversible DOM tokenization**, **pixel-level screenshot canvas masking (DOM masking + Gaussian face blurring)**, and **UI topology analysis**. The external AI model only ever encounters non-sensitive, sanitized tokens and masked visual frames, ensuring that real personal identifiers never leave the user's device.

---

## 2. Complete List of Features

### A. On-Device PII Detection & Validation
* **Checksum-Validated Indian Aadhaar Identification:**
  * Uses the **Verhoeff algorithm** (dihedral group $D_5$) to mathematically validate 12-digit Aadhaar numbers, eliminating false positives from arbitrary 12-digit numbers.
* **Payment Card Detection (Credit/Debit Cards):**
  * Employs the **Luhn algorithm (Mod 10)** to validate Visa, Mastercard, Amex, Discover, and RuPay card sequences with prefix and check-digit confirmation.
* **National ID / Tax Identifiers:**
  * Strict regex rule matching for Indian Permanent Account Numbers (**PAN**), matching the formal 5-letter, 4-digit, 1-letter structure (`[A-Z]{5}[0-9]{4}[A-Z]`).
* **Contact & Communication Identifiers:**
  * Detects Email addresses across standard, localized, and subdomain patterns.
  * Identifies Indian (+91/0/standard 10-digit) and international telephone numbers with delimiters.
* **High-Entropy Secret & API Key Detection:**
  * Detects leaked credentials, including **AWS Access Keys** (`AKIA...`), **GitHub Personal Access Tokens** (`ghp_...`), and **Google Cloud / Firebase API Keys** (`AIza...`).
  * Calculates **Shannon Entropy** to identify pseudo-random secret tokens and prevent credential exposure.
* **Worker-Based Named Entity Recognition (NER):**
  * Offloads heavy entity scanning to a dedicated background Web Worker (`ner-worker.js`) to extract Person names, Organizations, and Geographic Locations without freezing the browser's UI thread.

### B. Multi-Layered Redaction Engine
* **Reversible In-Place DOM Redactor:**
  * Replaces raw PII text nodes with deterministic surrogate tokens (e.g., `[AADHAAR_1]`, `[EMAIL_1]`, `[PAN_1]`).
  * Stores bidirectional mappings in a private, client-side in-memory session token store.
  * Allows seamless re-hydration / restoration of original values when needed.
* **Canvas Pixel Redactor (Dual Strategy):**
  * **Element Solid Masking:** Takes exact bounding boxes of identified DOM sensitive nodes and paints solid opaque privacy rectangles over the captured screenshot canvas.
  * **Gaussian Face Blurring:** Detects human facial areas and applies multi-pass Gaussian box-blur algorithms directly over the raw pixel buffers, obfuscating biometric features while preserving page layout.
* **Zero-Leakage Guarantee:**
  * Both text and image representations are sanitized in lockstep before any network dispatch.

### C. Computer Vision & Screen Understanding
* **BlazeFace Real-Time Face Detection:**
  * Bundled client-side TensorFlow.js + BlazeFace model (`lib/vision/tf.min.js` & `blazeface.min.js`) executing via WebGL/WASM/CPU to pinpoint facial bounding boxes in screenshots.
  * Includes an automatic fallback heuristic scanner if WebGL/WASM hardware acceleration is disabled.
* **Screen-Understanding Model (Rubric 25% UI Analysis):**
  * Parses DOM and visual layout to generate an interactive element topology tree (inputs, buttons, form regions, tables, labels, aria-roles, and coordinates).
  * Hashes and abstracts page structure for downstream VLM decision context.
* **Local Vision Transformer (Screen ViT):**
  * Lightweight on-device classifier (`lib/vision/screen-vit.js`) executing via WebGPU/WASM/CPU to classify page layout categories (e.g., e-commerce, banking, login portal, form submission) directly on post-redacted canvas pixels.

### D. Local Decision & Fingerprinting Engine
* **Topological Screen Fingerprint Delta Engine:**
  * Computes structural hash signatures of current page views.
  * Determines whether the screen state has materially changed between steps, reducing redundant server roundtrips and optimizing latency.
* **Autonomous Task Routing:**
  * Evaluates whether a user instruction can be satisfied entirely on-device (e.g., local form pre-fill using mock personas, scroll operations) or requires external VLM cloud orchestration.

### E. Autonomous UI Action Execution & Feedback
* **Client-Side Autonomous Action Dispatcher:**
  * Executes directives returned by the VLM (e.g., `click`, `fill`, `scroll`, `hover`, `focus`).
  * Supports programmatic DOM event triggering (`input`, `change`, `blur`, `submit`) ensuring compatibility with modern single-page apps (React, Angular, Vue).
* **Safe Local Profile Injection:**
  * VLM responses return semantic tags like `{"type": "fill", "fieldType": "email"}`.
  * The client replaces `"fieldType"` locally using a secure mock profile (never transmitting the user's real personal profile over the wire).
* **Visual Glow & Highlighting System:**
  * Renders glowing neon feedback rings and tooltips over targeted elements during autonomous interaction, keeping the human user fully aware and in control.

### F. User Experience & Floating Extension UI
* **One-Click Glassmorphic Floating Shield:**
  * Accessible floating action button overlay on all web pages.
  * Quick-expandable drawer featuring natural language task inputs, status indicators, and live pipeline stage transitions.
* **Inspection & Audit Panel:**
  * View real-time redacted PII counts, detected categories, and visual inspection of sanitized screenshot thumbnails.
  * Collapsible Telemetry Drawer showing step-by-step millisecond latency breakdowns.
* **Extension Popup & Configuration Options:**
  * Popup dashboard for quick toggling, benchmark launch, and status overview.
  * Options page for configuring proxy endpoint URL, fallback models, mock profile personas, and redaction strictness levels.

### G. Telemetry, Performance & Benchmarking
* **Real-Time Performance Waterfall:**
  * Granular timing instrumentation using `window.performance.now()` across DOM scanning, BlazeFace inference, canvas masking, network proxy roundtrip, and DOM action execution.
* **Built-In Precision/Recall Benchmarking Suite:**
  * Synthetic benchmark test harness (`test/evaluation_page.html` & `test/evaluate.js`) assessing Ground-Truth PII targets with precision, recall, and F1 calculations.

---

## 3. System Architecture

### High-Level Architectural Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           LOCAL CLIENT (BROWSER MV3)                            │
│                                                                                 │
│  [ LIVE WEBPAGE ]                                                               │
│        │                                                                        │
│        ▼                                                                        │
│  [ 1-Click Floating Shield / content.js ]                                       │
│        │                                                                        │
│        ├─► 1. Text PII Engine (Verhoeff Aadhaar + Luhn Cards + PAN + API Keys)  │
│        ├─► 2. Local Face Detector (TensorFlow.js + BlazeFace ML via Worker)     │
│        ├─► 3. Screen Understanding Model (UI Element Hierarchy & Selectors)     │
│        ├─► 4. In-Place DOM Redactor (Reversible Deterministic Surrogate Tokens) │
│        ├─► 5. Canvas Pixel Redactor (Solid DOM Box Masks + Face Gaussian Blur)  │
│        └─► 6. Local Vision Transformer (Screen ViT on Post-Redacted Canvas)     │
│                    │                                                            │
│                    ▼                                                            │
│        [ Sanitized Context Bundle ] (Zero Raw PII / No Biometric Pixels)        │
└────────────────────┬────────────────────────────────────────────────────────────┘
                     │  HTTP POST /api/agent (Sanitized Payload only)
                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        SECURE PROXY SERVER (Node.js/Express)                    │
│                                                                                 │
│  • Holds AI Provider API keys securely in server environment (.env)             │
│  • Validates sanitized inputs and constructs constrained VLM vision prompt      │
│  • Routes to Gemini 1.5/2.0/Flash or Open-Weight VLMs (Qwen2-VL, LLaVA) via     │
│    OpenRouter or Groq                                                           │
│  • Enforces strict JSON Schema response parsing                                 │
└────────────────────┬────────────────────────────────────────────────────────────┘
                     │  Returns Action Directives: {"type":"fill","fieldType":"email"}
                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT ACTION EXECUTOR                                │
│                                                                                 │
│  • Neon highlighted visual overlay on live target elements                     │
│  • Injects values locally from mock profile (Real data never leaves device)     │
│  • Synthesizes user interaction (click, focus, fill, keyboard dispatch)         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Pipeline Sequential Lifecycle

1. **Triggering:** User activates the PrivacyShield Floating Agent on a webpage and submits a natural language instruction.
2. **Local Text Analysis:** `text-detector.js` traverses visible DOM text nodes, running regex rules combined with checksum verifications (Verhoeff for Aadhaar, Luhn for credit cards) and entropy tests.
3. **Local Face & Visual Scan:** The background script captures the viewport visible tab. `face-detector.js` uses `@tensorflow-models/blazeface` to compute facial coordinates.
4. **Redaction Execution:**
   - Text DOM nodes are masked with surrogate tokens (`[EMAIL_1]`, `[AADHAAR_1]`).
   - `canvas-redactor.js` draws opaque rectangles over text bounding boxes and applies multi-pass Gaussian box blurs over face regions.
5. **Structural Screen Analysis:** `screen-analyzer.js` extracts interactive elements (buttons, inputs, dropdowns) with selectors, accessible labels, and coordinates.
6. **Local Decision Evaluation:** `local-decision-engine.js` verifies screen fingerprint delta and determines if external VLM reasoning is required.
7. **Secure Proxy Dispatch:** `background.js` transmits the sanitized context bundle (masked base64 screenshot + tokenized DOM + UI element tree + user task) to the Node.js proxy server.
8. **VLM Reasoning:** The proxy server prompts the VLM (Gemini / Qwen2-VL / LLaVA) with strict JSON output schemas.
9. **Action Execution:** The client receives JSON action instructions, matches semantic `fieldType` against the local user persona, highlights targeted DOM elements with glowing animations, and completes the action.

### Client-Proxy Trust Boundary

| Aspect | Client Device (Browser Extension) | Backend Proxy Server (`server/`) |
|---|---|---|
| **API Keys & Secrets** | Zero API keys stored or needed | Holds `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, etc. in `.env` |
| **Real User Data / PII** | Full access locally; immediately redacted | **Never encounters raw PII** (only tokens & blurred pixels) |
| **Biometric Face Pixels**| Unmasked screenshot captured, immediately blurred | Only receives blurred, anonymized visual frames |
| **Execution Responsibility**| DOM traversal, redaction, ML face detection, UI execution | Prompt construction, VLM forwarding, schema enforcement |

---

## 4. Comprehensive Technology Stack

### Core Client / Extension Layer
* **Extension Platform:** Chrome & Firefox WebExtensions API (Manifest V3 compatible).
* **Architecture:** 
  * Background Service Worker (`background.js`) for tab capture and network mediation.
  * Isolated Content Scripts (`content.js`) with DOM injection and custom scoped styles.
  * Background Web Workers (`ner-worker.js`, `vision-worker.js`) for off-main-thread compute.
  * Interactive UI components (Popup, Options, Floating Action Shield).
* **Polyfill:** `webextension-polyfill` / `browser-polyfill.js` providing universal Promise-based Chrome and Firefox cross-compatibility.
* **Styling & Presentation:** Vanilla CSS3 with glassmorphism, CSS grid/flexbox, custom animations, and CSS custom properties (variables) for dark-theme UI components.

### Machine Learning & Computer Vision Stack
* **TensorFlow.js (`@tensorflow/tfjs` v4.22.0):** Client-side deep learning runtime supporting WebGL, WASM, and CPU backends for zero-server inference.
* **BlazeFace (`@tensorflow-models/blazeface` v0.1.0):** Sub-millisecond neural network for mobile/browser facial detection and bounding box extraction.
* **Screen ViT (`lib/vision/screen-vit.js`):** Lightweight local Vision Transformer engine implementing compact patch projection and attention classification over screen captures.
* **OCR Capability (`tesseract.js` v7.0.0):** Local WebAssembly/Web Worker OCR engine for offline text-in-image verification.
* **Canvas API:** HTML5 Canvas 2D Context for pixel manipulation, box-blur kernels, and coordinate masking.

### Algorithmic & PII Validation Stack
* **Verhoeff Checksum Algorithm:** Dihedral group $D_5$ permutations for Aadhaar number validation.
* **Luhn Algorithm:** Modulus 10 formula for credit/debit card checksum verification.
* **Shannon Entropy Analysis:** Mathematical entropy calculations ($H(X) = -\sum p(x) \log_2 p(x)$) to detect high-randomness secret keys and cryptographic tokens.
* **Regular Expressions (Regex):** Pre-compiled regex token matchers for PAN, email addresses, international telephone numbers, AWS/GCP/GitHub tokens.

### Backend Proxy Server Stack
* **Runtime:** Node.js (v18+)
* **Framework:** Express.js (v4.21.2)
* **Middleware:**
  * `cors` (v2.8.5) for cross-origin browser extension request handling.
  * `express.json({ limit: '50mb' })` for handling high-resolution base64 sanitized image payloads.
  * `dotenv` (v16.4.7) for environment variable encapsulation.

### External AI / VLM Providers Supported
* **Google Gemini API:** Native integration with models such as `gemini-2.5-flash`, `gemini-1.5-flash`, and `gemini-1.5-pro` using multi-part multimodal payloads.
* **OpenRouter API:** Router for open-weight multimodal models:
  * `qwen/qwen-2-vl-72b-instruct` (Qwen2-VL)
  * `llava-hf/llava-1.5-7b-hf` (LLaVA)
* **Groq API:** Ultra-fast VLM inference endpoint compatibility.
* **Local Simulation Fallback:** Built-in mock reasoning engine providing autonomous form fill action sequences when offline or without external API keys.

### Testing, Tooling & Build Environment
* **Bundler & Minification:** `esbuild` (v0.25.0) for fast bundling of standalone vision and ML modules (`bundle-vision.js`).
* **Benchmarking & Evaluation Harness:** 
  * `test/evaluate.js` (Node-based automated evaluation script).
  * `test/evaluation_page.html` (Ground-truth benchmark containing all 7 target PII categories).
* **Icon & Asset Generation:** `generate-icons.js` programmatic canvas script for automated extension icon rasterization (16px, 48px, 128px).

---

## 5. Repository Structure Reference

```
Phantom Prototype 1.1/
├── manifest.json                     # Cross-browser Manifest V3 configuration
├── package.json                      # NPM dependencies, scripts, and project metadata
├── config.js                         # Extension configuration, endpoints & mock profile
├── background.js                     # MV3 service worker (screenshot & proxy broker)
├── content.js                        # Main content script, floating UI & pipeline runner
├── bundle-vision.js                  # ESBuild packaging script for local vision assets
├── generate-icons.js                 # Automatic extension icon generator
│
├── styles/                           # Styling assets
│   ├── floating-shield.css           # Glassmorphic floating button & pulse animations
│   └── panel.css                     # Drawer panel, telemetry waterfall & audit logs
│
├── icons/                            # Extension brand icons (16, 48, 128 px)
│
├── lib/                              # Core algorithmic, ML and utility modules
│   ├── browser-polyfill.js           # Universal Chrome/Firefox Promise adapter
│   ├── pii/                          # PII Detection & Validation Engines
│   │   ├── verhoeff.js               # Verhoeff algorithm for Aadhaar validation
│   │   ├── luhn.js                   # Luhn algorithm for Payment Card validation
│   │   ├── regex-rules.js            # Detection rules & entropy calculation
│   │   ├── text-detector.js          # Text PII scanner & span deduplicator
│   │   └── ner-worker.js             # Web Worker for Named Entity Recognition
│   ├── vision/                       # On-Device Computer Vision & Screen Models
│   │   ├── tf.min.js                 # TensorFlow.js core runtime bundle
│   │   ├── blazeface.min.js          # BlazeFace facial recognition neural network
│   │   ├── face-detector.js          # Face detection coordinator & canvas extractors
│   │   ├── vision-worker.js          # Dedicated Web Worker for visual processing
│   │   ├── screen-analyzer.js        # Screen-understanding & UI element parser
│   │   └── screen-vit.js             # Local Screen Vision Transformer (WebGPU/WASM)
│   ├── decision/                     # Local Decision & Fingerprinting Engine
│   │   └── local-decision-engine.js  # Screen topology delta analyzer & context router
│   ├── redactor/                     # Privacy Redaction Engines
│   │   ├── dom-redactor.js           # In-place reversible DOM text masking
│   │   └── canvas-redactor.js        # Canvas pixel redactor (DOM solid + Face blur)
│   ├── executor/                     # Autonomous UI Action Execution
│   │   └── action-executor.js        # Action dispatcher with glow aura highlights
│   └── telemetry/                    # Diagnostics & Latency Measurement
│       └── instrumentation.js        # Sub-millisecond performance waterfall logger
│
├── popup/                            # Browser toolbar popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
│
├── options/                          # Extension settings & profile preferences
│   ├── options.html
│   ├── options.css
│   └── options.js
│
├── server/                           # Secure Backend VLM Proxy
│   ├── package.json
│   ├── server.js                     # Express server handling AI API keys & VLM routing
│   ├── .env.example                  # Template for API keys
│   └── README.md
│
└── test/                             # Precision & Recall Benchmarking Suite
    ├── evaluation_page.html          # Ground-truth testbed with 25 labeled PII targets
    └── evaluate.js                   # Automated F1/Precision/Recall evaluation runner
```
