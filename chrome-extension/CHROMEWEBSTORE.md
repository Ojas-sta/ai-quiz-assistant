# Chrome Web Store Metadata: Quiz Assistant

## 1. Store Listing Copy

**Title:** Quiz Assistant (Max 45 chars)
**Short Description:** An interactive AI assistant that analyzes active web pages to identify and explain educational quiz questions. (Max 132 chars)

**Detailed Description:**
Quiz Assistant is an educational tool designed to help you understand complex questions and study material on the web. By opening the side panel, the assistant analyzes the text of the page you are currently viewing. If it identifies a quiz question or a learning scenario, it leverages advanced AI to provide a suggested answer along with a detailed, plain-English explanation of its reasoning.

Features:
- **One-Click Analysis:** Instantly reads the text on your current tab.
- **AI-Powered Reasoning:** Provides clear explanations for why a specific answer is correct, helping you learn rather than just guessing.
- **Interactive Chatbot:** Ask follow-up questions directly in the side panel to dive deeper into the topic.
- **Privacy First:** You provide your own API key which is stored securely in your browser's local storage. The extension only analyzes the page when you explicitly click the "Analyze" button.

*Note: You must provide your own Gemini API Key to use this extension.*

## 2. Permissions Justification

| Permission | Justification |
| :--- | :--- |
| `activeTab` | Required to allow the extension to read the text of the currently active tab when the user clicks the "Analyze Active Page" button. |
| `scripting` | Required to execute a script that extracts the `document.body.innerText` from the active tab so the AI can analyze the content. |
| `sidePanel` | Required to host the extension's interactive chat and analysis UI in the browser's native side panel. |
| `storage` | Required to securely save the user's provided Gemini API key locally on their device so they do not have to re-enter it every time. |

### Host Permissions
| Host | Justification |
| :--- | :--- |
| `<all_urls>` | Required because the user might need educational assistance or question analysis on any website or domain they are currently studying on. |

## 3. Privacy Policy & Data Use

**Does this extension collect or use user data?**
Yes.

**Data Collection & Usage:**
1. **API Keys:** The extension asks for your Gemini API key. This key is stored entirely locally on your device using `chrome.storage.local`. It is never transmitted to our servers or any third-party other than Google's official Gemini API endpoint for the purpose of fulfilling your chat requests.
2. **Web Page Content:** When you explicitly click "Analyze Active Page", the extension reads the text of the web page you are currently viewing. This text is sent directly to the Google Gemini API to generate an analysis. We do not store, log, or track your browsing history or the content of the pages you analyze.

**Data Retention:**
We do not operate any backend servers. All data (API keys and chat history) is stored locally within your Chrome browser profile and is cleared when you uninstall the extension or clear your extension data.

## 4. Pre-Publish Checklist
- [x] manifest.json is V3
- [x] All permissions justified
- [x] Privacy policy documented
- [ ] Create 1280x800 promotional image
- [ ] Create 128x128 icon file (currently omitted from manifest for development)
