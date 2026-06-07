# Feature Timeline: AI Quiz Assistant

## ✅ Completed Features
- **Core Automation:** Basic Playwright autonomous loop to auto-click and auto-navigate quizzes.
- **Visual Analysis:** OCR implementation via Tesseract.js & Jimp image preprocessing.
- **Browser Portability:** Chrome Extension (Manifest V3) version for standard DOM extraction.
- **Universal Overlay:** Generic Playwright UI overlay injection for testing on any website.
- **Interactive Chat:** In-browser LLM Chatbot via Playwright function exposure.
- **Multi-Model Support:** OpenRouter API integration supporting Academic/Code/Math specific models (Owl Alpha, Qwen, Laguna).
- **Beautiful Output:** Native Markdown formatting for AI reasoning using `marked`.
- **Robust Parsing:** Heuristic fallback for non-JSON conversational models (like Owl Alpha).
- **Anti-Inception Capture:** Overlay auto-hides during DOM/Screenshot capture to prevent the AI from reading its own UI.

## 🚀 Planned Features
- [ ] Add support for Anthropic Claude models.
- [ ] Implement local, offline LLM support via Ollama.
- [ ] Add visual bounding boxes to highlight extracted question elements on the screen.
- [ ] Export chat logs and analysis history to Markdown files.
- [ ] Add PDF and Word document parsing support.
