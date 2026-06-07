# AI Quiz Assistant & Vulnerability Simulator

An educational toolkit demonstrating how modern web quizzes can be analyzed and automated using AI (Gemini 2.5 Flash), DOM extraction, and OCR (Tesseract.js). 

This project explores the security boundaries of online assessments by highlighting how easily DOM-based quizzes can be read, and how even obfuscated (Canvas/Image-based) questions can be bypassed using automated screenshots and Optical Character Recognition (OCR).

---

## 🚀 Features

*   **Generic Playwright Overlay (`src/generic.js`):** Injects a sleek, interactive dark-mode UI overlay into **any** website you visit. It provides dual-mode extraction:
    *   **Analyze (DOM):** Instantly extracts the text from standard HTML web pages.
    *   **Analyze (OCR):** Takes a background screenshot, sharpens the image, and runs it through Tesseract.js to defeat anti-scraping canvas/image obfuscation.
*   **Interactive AI Chatbot:** After extracting a question, the UI allows you to chat directly with the AI to ask follow-up questions or have it explain its reasoning.
*   **Multi-Model Support:** Integrates with both Google Gemini and OpenRouter, allowing you to seamlessly swap between models optimized for math (Qwen), academia (Owl Alpha), or coding (Laguna).
*   **Native Markdown Rendering:** Chat bubbles and reasoning outputs natively parse LLM Markdown into clean HTML (bolding, lists, code blocks).
*   **Anti-Inception Capture:** The UI overlay automatically hides itself in a fraction of a millisecond during screen capture to prevent the AI from "reading" its own UI elements.
*   **Chrome Extension Version:** A lightweight Manifest V3 Chrome Extension version of the DOM analyzer, ready for unlisted publishing.
*   **Local Autonomous Loop (`src/main.js`):** An automated loop that navigates a local test quiz, continuously identifying questions, selecting the best AI-determined answer, and auto-clicking the "Next" button.

---

## 🛠️ Prerequisites

*   [Node.js](https://nodejs.org/) (v16+ recommended)
*   A [Google Gemini API Key](https://aistudio.google.com/app/apikey)

---

## 📦 Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Ojas-sta/ai-quiz-assistant.git
   cd ai-quiz-assistant
   ```

2. **Install Node dependencies:**
   This will install Playwright, Tesseract.js, Jimp, and the Google Gen AI SDK.
   ```bash
   npm install
   ```

3. **Install Playwright Browsers:**
   ```bash
   npx playwright install chromium
   ```

4. **Configure your API Key:**
   Create a `.env` file in the root of the project and add your API keys:
   ```env
   GEMINI_API_KEY=your_actual_gemini_key_here
   OPENROUTER_API_KEY=sk-or-v1-your_openrouter_key_here
   ```

---

## 🕹️ Usage Guide

### Mode 1: The Universal UI Overlay (Recommended)
This mode launches a custom browser, navigates to a URL you specify, and injects our custom AI Assistant overlay into the page.

```bash
node src/generic.js "https://example-quiz-site.com/login"
```
*   **How to use:** Navigate the browser manually (log in, pass captchas, etc.). When a question is on screen, click either the **DOM** or **OCR** analyze buttons in the floating overlay.
*   **Chat:** After an analysis, a chat window will slide down allowing you to interrogate the AI about its answer.

### Mode 2: Chrome Extension (DOM-only)
A lightweight version you can install directly into your primary Chrome browser. Because of Chrome Web Store security limits on screenshots and WASM models, this version only uses DOM extraction (no OCR).

1. Open Chrome and navigate to `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** (top left).
4. Select the `chrome-extension` folder inside this project.
5. Click the extension icon in your browser to open the Side Panel. Don't forget to paste your API Key into the settings!

### Mode 3: The Autonomous Local Simulator
This runs an aggressive automated bot against a local test file (`test/quiz.html`). It auto-detects questions, selects radio buttons, and advances to the next page entirely on its own.

```bash
node src/main.js
```

---

## 🏗️ Architecture & Modules

*   **`src/ai.js`:** Wraps the Gemini 2.5 API. Uses strict JSON Schema to force the LLM to return `selectedOption`, `confidenceScore`, and `reasoning`. Also maintains chat history for follow-ups.
*   **`src/ocr.js`:** The heavy lifting. Takes a raw Playwright screenshot, uses Jimp to increase contrast and greyscale the image, and feeds it into the Tesseract.js engine to extract raw text.
*   **`src/analyzer.js`:** Orchestrates the flow between extracting text, querying the AI, and parsing the response.
*   **`src/browser.js`:** The autonomous Playwright controller that hunts for specific DOM selectors like `.question-text` and `#next-btn`.

---

## ⚠️ Disclaimer

**Educational Purposes Only.** This toolkit was developed to demonstrate the vulnerabilities inherent in client-side web assessments and to explore the defensive boundaries of CAPTCHAs, Canvas obfuscation, and DOM scraping. Do not use these tools to violate the terms of service of third-party platforms or to bypass academic integrity policies.
