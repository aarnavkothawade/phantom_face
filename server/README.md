# PrivacyShield Proxy Server

A lightweight, zero-leakage proxy server that accepts sanitized DOM text, pixel-redacted screenshots, and structured screen JSON, routing them to open-weight Vision-Language Models (VLMs).

## Security Guarantee
- **API keys live ONLY here** as environment variables in `server/.env`.
- The browser extension never sees, stores, or transmits API keys.
- Real user PII is stripped client-side before any network request reaches this server.

## Quick Start

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your API key:
```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
VLM_MODEL=qwen/qwen-2-vl-72b-instruct
```

### 3. Start the Server
```bash
npm start
```
The server will start at `http://localhost:3001`.

## Endpoints

### `GET /health`
Returns server status, active VLM provider, and model name.

### `POST /api/agent`
Accepts:
```json
{
  "sanitizedText": "User [NAME_1] submitted form with email [EMAIL_1]...",
  "sanitizedImageBase64": "data:image/jpeg;base64,...",
  "screenStructure": { "elements": [...] },
  "task": "fill this form",
  "pageClassification": { "pageType": "FORM_SUBMISSION" }
}
```
Returns:
```json
{
  "success": true,
  "data": {
    "type": "action",
    "actions": [
      { "type": "fill", "selector": "input#email", "fieldType": "email" },
      { "type": "click", "selector": "button#submit" }
    ]
  },
  "durationMs": 420
}
```

## Deployment Options
- **Render / Railway / Fly.io**: Create a Web Service pointing to `server/`, set `OPENROUTER_API_KEY` in dashboard environment variables, and update the extension's `config.js` with the public URL.
- **Vercel**: Can be deployed as a serverless function (`/api/agent`).
