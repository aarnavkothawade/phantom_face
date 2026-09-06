# PrivacyShield (Phantom Prototype 1.1) - Tech Stack

This document outlines the complete technology stack used in the PrivacyShield browser extension and its backend proxy server, along with the purpose of each component.

## 1. Core Platform & Languages
* **WebExtensions API (Manifest V3):** The core framework for the browser extension, ensuring compatibility with Google Chrome and Mozilla Firefox. It utilizes Service Workers, Content Scripts, and Web Workers.
* **JavaScript (ES6+):** The primary programming language for both the client-side extension and the backend proxy server.
* **HTML5 & CSS3:** Used for the extension's user interface (Popup, Options page, and the floating Action Shield injected into web pages). Utilizes CSS grid/flexbox and glassmorphism styling.

## 2. Machine Learning & Computer Vision (Client-Side)
These tools run entirely within the user's browser to analyze the screen without sending data externally.
* **TensorFlow.js (`@tensorflow/tfjs`):** The underlying machine learning runtime that allows models to run directly in the browser utilizing WebGL, WebAssembly (WASM), or CPU backends.
* **BlazeFace (`@tensorflow-models/blazeface`):** A lightweight, fast neural network running on TensorFlow.js used specifically for detecting human faces in screenshots so they can be blurred.
* **Tesseract.js (`tesseract.js`):** A WebAssembly-based optical character recognition (OCR) engine used to extract text from images locally.
* **Screen ViT (Vision Transformer):** A custom, lightweight local image classifier that determines the page layout type (e.g., e-commerce, login) directly from the redacted canvas pixels.
* **Canvas API (HTML5):** Used heavily for pixel-level manipulation, such as drawing opaque rectangles over sensitive text and applying multi-pass Gaussian box-blurs over detected faces before the screenshot is sent to the VLM.

## 3. Algorithmic & PII Validation Engines
Custom algorithms implemented in vanilla JavaScript to validate Personally Identifiable Information (PII) before redaction.
* **Verhoeff Checksum Algorithm:** Mathematically validates 12-digit Indian Aadhaar numbers to prevent false positives.
* **Luhn Algorithm (Mod 10):** Validates credit and debit card sequences (Visa, Mastercard, RuPay, etc.).
* **Shannon Entropy Engine:** Calculates the randomness of strings to identify high-entropy secrets like AWS Access Keys or GitHub Personal Access Tokens.
* **Regex Engine:** Pre-compiled regular expressions used to identify PAN cards, emails, and international telephone numbers.

## 4. Backend Proxy Server (Node.js)
A secure intermediary that receives the *sanitized and redacted* data from the client and forwards it to external AI models.
* **Node.js (v18+):** The JavaScript runtime for the backend server.
* **Express.js:** The web framework used to build the proxy API endpoints.
* **`cors` Middleware:** Handles Cross-Origin Resource Sharing, allowing the browser extension to securely communicate with the local server.
* **`dotenv`:** Manages sensitive environment variables (like API keys for the external VLMs) so they are never exposed to the client browser.

## 5. External AI / Vision-Language Models (VLMs)
The proxy server connects to these powerful cloud models to reason about the webpage and decide on actions, but only ever sends them sanitized data.
* **Google Gemini API:** Supports multimodal models like `gemini-1.5-flash` and `gemini-1.5-pro` for visual and text reasoning.
* **OpenRouter API:** Acts as a router to access open-weight multimodal models like **Qwen2-VL** (`qwen-2-vl-72b-instruct`) and **LLaVA** (`llava-1.5-7b-hf`).
* **Groq API:** Supported for ultra-fast VLM inference.

## 6. Build Tools & Testing
* **ESBuild:** A fast JavaScript bundler used to package the standalone vision and ML modules (creating `bundle-vision.js`) for the extension.
* **Custom Benchmark Suite (`test/evaluate.js` & `test/evaluation_page.html`):** A Node-based automated evaluation script and a synthetic HTML page used to test the precision, recall, and F1-score of the PII detection engines.
