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

## 🔑 Getting Your API Keys (Required)

To power the AI analysis, you will need at least one API key. You can get both entirely for free!

### 1. Google Gemini API Key (Recommended for General Use)
Gemini 2.5 Flash is incredibly fast, smart, and provides a very generous free tier.
*   **Link:** [Google AI Studio API Keys](https://aistudio.google.com/app/apikey)
*   **How to get it:**
    1. Click the link above and sign in with your Google Account.
    2. Click the blue **"Create API key"** button on the screen.
    3. Select a project (or create a new one) and generate the key.
    4. Copy your key (it usually starts with `AIza...`).

### 2. OpenRouter API Key (Recommended for Specialized Models)
OpenRouter gives you access to hundreds of open-source models, including powerful free models specifically optimized for Math (Qwen) and Academia (Owl Alpha).
*   **Link:** [OpenRouter API Keys](https://openrouter.ai/settings/keys)
*   **How to get it:**
    1. Create a free account on OpenRouter.
    2. Navigate to your settings and click **"Create Key"**.
    3. Give the key a name (e.g., "Quiz Assistant").
    4. Copy the key (it starts with `sk-or-v1-...`). *Note: Make sure you copy it immediately, as it is only shown once!*

---

## 📦 Setup & Installation

You do not need to download the code to use the assistant! It has been published globally to the NPM registry.

1. **Ensure Node.js is installed:** Make sure you have [Node.js](https://nodejs.org/) (v18+) installed on your machine.
2. **Install Playwright Browsers (One-time setup):**
   Because the assistant uses a hidden browser to read and analyze quizzes, you need to install the browser engine first:
   ```bash
   npx playwright install chromium
   ```
3. **Run the universal command:**
   Open your terminal and type:
   ```bash
   npx ai-quiz-assistant@latest https://google.com
   ```
4. **Interactive Setup:** On your very first run, the tool will automatically pause and ask you to paste the API keys you generated above. It securely saves them so you never have to enter them again!

---

## 🕹️ Usage Guide

### Mode 1: The Universal UI Overlay (Recommended)
This mode launches a custom browser, navigates to a URL you specify, and injects our custom AI Assistant overlay into the page.

```bash
npx ai-quiz-assistant@latest "https://example-quiz-site.com/login"
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
