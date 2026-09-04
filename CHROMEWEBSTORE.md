# Chrome Web Store Listing & Compliance - PrivacyShield

## Metadata
- **Name**: PrivacyShield - Local Privacy-Preserving Vision Agent
- **Short Description**: Autonomous AI vision agent that redacts PII, faces, and sensitive screen pixels locally before cloud VLM inference.
- **Category**: Productivity / Privacy & Security
- **Version**: 1.0.0
- **Supported Browsers**: Google Chrome (Manifest V3), Mozilla Firefox (Manifest V3), Microsoft Edge, Brave.

---

## Detailed Description

PrivacyShield is an enterprise-grade, privacy-preserving browser extension and autonomous vision agent built for the Smart India Hackathon (ISRO Problem Statement). It enables users to deploy multimodal AI vision agents (like Qwen2-VL and LLaVA) across any web application without ever transmitting raw personally identifiable information (PII), confidential credentials, or unredacted screen pixels.

### How It Works (The 1-Click Privacy Pipeline):
1. **1-Click Floating Shield**: Click the floating PrivacyShield button on any page.
2. **Local Multi-Modal Sanitization (In-Place)**:
   - **Indian Aadhaar UID**: Verhoeff checksum algorithm prevents false positives.
   - **Credit/Debit Cards**: Luhn checksum validation (Visa, MasterCard, Amex, RuPay).
   - **PAN & Tax Identifiers**: 10-digit Indian PAN validation.
   - **Contact PII**: Emails (RFC 5322) & International/Indian Phone numbers.
   - **Secrets & API Keys**: AWS, GitHub, Google, Slack, OpenAI, Anthropic, JWT, and Shannon-Entropy secret detection.
   - **Biometric Faces**: Bundled BlazeFace model detects human faces on canvas/images and applies multi-pass Gaussian blur & mosaic pixelation.
   - **Screen-Understanding Model**: Hybrid accessibility-tree and visual topology detector that structures interactive UI elements (`{elements: [{type, bbox, label, confidence}]}`).
3. **Task Synthesis**: Type your prompt (e.g. "Fill this form", "Summarize record", "Submit").
4. **Secure Proxy Routing**: Only sanitized tokens (e.g. `[AADHAAR_1]`, `[EMAIL_1]`) and blurred screenshots are routed to the server proxy.
5. **Local Action Execution**: When the VLM returns UI actions, PrivacyShield executes clicks/fills on the live DOM with glowing neon visual feedback and substitutes mock profile values locally—real data never touches the network.

---

## Permissions Justification

| Permission | Technical Requirement | Justification for Review Team |
|---|---|---|
| `activeTab` | Required for user-gesture tab interactions | Used to capture the active webpage context and execute safe UI actions when the user clicks the extension action or floating shield button. |
| `tabs` | `chrome.tabs.captureVisibleTab` | Required to capture the visible tab's screenshot so the local canvas redactor can mask DOM text bounding boxes and blur detected faces before proxy transmission. |
| `storage` | `chrome.storage.local` | Stores local mock user profile configurations and user-configured proxy server URLs entirely on the user's device. No telemetry or PII is transmitted to cloud storage. |
| `scripting` | `chrome.scripting.executeScript` | Allows programmatic initialization of the PrivacyShield floating action button across active browser tabs upon user trigger. |
| `host_permissions` (`<all_urls>`) | Universal Webpage Compatibility | Required because PrivacyShield is designed as a universal browser assistant that must protect user privacy on arbitrary government portals, banking dashboards, forms, and enterprise web applications. |

---

## Privacy Policy & Data Handling Disclosures

- **Zero Client-Side API Keys**: PrivacyShield client software does not store, request, or embed external AI API keys. All inference is brokered by a dedicated server proxy.
- **No Third-Party Analytics / Tracking**: The extension contains no tracking pixels, external telemetry SDKs, or analytics trackers.
- **Local In-Memory Sanitization**: Redaction token mappings are stored strictly in browser memory and discarded when the session ends or when "Restore Page" is pressed.
- **Data Minimization**: The extension strictly transmits sanitized tokens and blurred pixels. Raw biometric images and plaintext identity records never leave the local browser environment.
