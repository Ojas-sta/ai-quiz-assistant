#!/usr/bin/env node
const os = require('os');
const path = require('path');
const fs = require('fs');

const globalEnvPath = path.join(os.homedir(), '.ai-quiz-assistant.env');
require('dotenv').config();
require('./banner');
require('dotenv').config({ path: globalEnvPath }); // Load global keys if they exist

const { chromium } = require('playwright');
const readline = require('readline');
const OCRLayer = require('./ocr');
const AILayer = require('./ai');
const { marked } = require('marked');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
    let url = process.argv[2];
    if (!url) {
        console.error("Usage: node src/generic.js <URL>");
        process.exit(1);
    }

    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
        url = 'https://' + url;
    }

    // Check for API Keys
    if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
        console.log("\n❌ No API keys found. Let's set them up globally!");
        let geminiKey = await new Promise(resolve => rl.question("Enter your Gemini API Key (or press Enter to skip): ", resolve));
        let openRouterKey = await new Promise(resolve => rl.question("Enter your OpenRouter API Key (or press Enter to skip): ", resolve));
        
        geminiKey = geminiKey ? geminiKey.trim().replace(/^["']|["']$/g, '') : '';
        openRouterKey = openRouterKey ? openRouterKey.trim().replace(/^["']|["']$/g, '') : '';

        if (!geminiKey && !openRouterKey) {
            console.error("You must provide at least one API key. Exiting.");
            process.exit(1);
        }

        let envContent = '';
        if (geminiKey) {
            envContent += `GEMINI_API_KEY=${geminiKey}\n`;
            process.env.GEMINI_API_KEY = geminiKey;
        }
        if (openRouterKey) {
            envContent += `OPENROUTER_API_KEY=${openRouterKey}\n`;
            process.env.OPENROUTER_API_KEY = openRouterKey;
        }

        fs.writeFileSync(globalEnvPath, envContent);
        console.log(`✅ Saved keys permanently to ${globalEnvPath}\n`);
    }

    console.log(`[Qalify+] Booting up... please wait 3 seconds.`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log(`[Qalify+] Launching browser to navigate to: ${url}`);
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();

    const ocrLayer = new OCRLayer();
    let currentAILayer = new AILayer();

    // 1. Expose a function so the browser UI can trigger the Node.js OCR pipeline
    await page.exposeFunction('triggerNodeOCR', async (modelName) => {
        currentAILayer = new AILayer(modelName || 'gemini-2.5-flash');
        console.log(`\n[Overlay] 'Analyze' button clicked! Model: ${currentAILayer.modelName}`);
        
        // Hide the overlay so it isn't captured in the screenshot
        await page.evaluate(() => {
            const container = document.getElementById('ai-assistant-container');
            if(container) container.style.display = 'none';
        });

        const screenshotPath = path.join(__dirname, '..', 'temp_screenshot.png');
        await page.screenshot({ path: screenshotPath });

        // Bring the overlay back immediately after screenshot
        await page.evaluate(() => {
            const container = document.getElementById('ai-assistant-container');
            if(container) container.style.display = 'block';
        });

        const preprocessedPath = path.join(__dirname, '..', 'temp_preprocessed.png');
        const finalImagePath = await ocrLayer.preprocessImage(screenshotPath, preprocessedPath);

        const ocrResult = await ocrLayer.extractText(finalImagePath);
        if (!ocrResult || !ocrResult.question) {
            console.error("[Generic] OCR failed to extract meaningful text.");
            return { error: "OCR failed to extract clear text." };
        } else {
            console.log(`\n--- Extracted OCR Text ---\n${ocrResult.question}`);
            const answer = await currentAILayer.determineAnswer(ocrResult.question, ocrResult.options);
            if (answer && answer.reasoning) {
                answer.reasoning = marked.parse(answer.reasoning);
            }
            return answer || { error: "AI failed to generate an answer." };
        }
    });

    // 1b. Expose a function for DOM text extraction
    await page.exposeFunction('triggerNodeDOM', async (pageText, modelName) => {
        currentAILayer = new AILayer(modelName || 'gemini-2.5-flash');
        console.log(`\n[Overlay] 'Analyze (DOM)' button clicked! Model: ${currentAILayer.modelName}`);
        if (!pageText || pageText.trim() === '') {
            return { error: "No text found in DOM." };
        }
        console.log(`\n--- Extracted DOM Text ---\n${pageText.substring(0, 300)}...`);
        // We pass the raw text as the question and an empty array for options.
        const answer = await currentAILayer.determineAnswer(pageText.substring(0, 5000), []);
        if (answer && answer.reasoning) {
            answer.reasoning = marked.parse(answer.reasoning);
        }
        return answer || { error: "AI failed to generate an answer." };
    });

    // 1c. Expose a function for Chat interaction
    await page.exposeFunction('triggerNodeChat', async (message) => {
        const response = await currentAILayer.chat(message);
        return marked.parse(response);
    });

    // 2. Inject the UI overlay every time the page finishes loading or navigating
    page.on('domcontentloaded', async (currentPage) => {
        try {
            await currentPage.evaluate(() => {
                if (document.getElementById('ai-reasoning-overlay')) return;
                
                const container = document.createElement('div');
                container.id = 'ai-assistant-container';
                container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; font-family: sans-serif;';

                const restoreBtn = document.createElement('button');
                restoreBtn.id = 'ai-restore-btn';
                restoreBtn.style.cssText = 'display: none; width: 40px; height: 40px; background: #4caf50; color: white; border: none; cursor: pointer; border-radius: 50%; font-weight: bold; font-size: 18px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); padding: 0; text-align: center; line-height: 40px;';
                restoreBtn.innerText = 'Q';

                const overlay = document.createElement('div');
                overlay.id = 'ai-reasoning-overlay';
                overlay.style.cssText = `
                    width: 350px;
                    background-color: #1e1e1e; color: #f0f0f0; padding: 20px;
                    border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);
                    border: 1px solid #444; position: relative;
                `;
                overlay.innerHTML = `
                    <button id="ai-hide-btn" style="position: absolute; top: 10px; right: 10px; background: transparent; border: none; color: #aaa; cursor: pointer; font-size: 16px;">✖</button>
                    <h3 style="margin-top: 0; margin-bottom: 15px; color: #4caf50;">Qalify+ Assistant</h3>
                    <select id="ai-model-select" style="width: 100%; height: 36px; padding-left: 8px; margin-bottom: 8px; background: #2a2a2a; color: white; border: 1px solid #444; border-radius: 4px; font-size: 14px; box-sizing: border-box; cursor: pointer;">
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="openrouter/owl-alpha">Owl Alpha (Academia)</option>
                        <option value="openai/gpt-oss-120b">GPT-OSS 120B (Reasoning)</option>
                        <option value="poolside/laguna-m.1:free">Laguna M.1 (Science/Code)</option>
                        <option value="qwen/qwen3-coder:free">Qwen3 480B (Math)</option>
                    </select>
                    <button id="ai-analyze-dom-btn" style="width: 100%; padding: 10px; background: #2196F3; color: white; border: none; cursor: pointer; border-radius: 4px; font-weight: bold; margin-bottom: 8px;">Analyze Screen (DOM)</button>
                    <button id="ai-analyze-ocr-btn" style="width: 100%; padding: 10px; background: #4caf50; color: white; border: none; cursor: pointer; border-radius: 4px; font-weight: bold;">Analyze Screen (OCR)</button>
                    <div id="ai-result" style="margin-top: 15px; font-size: 0.9em; display: none;"></div>
                    <div id="ai-chat-container" style="margin-top: 15px; display: none; border-top: 1px solid #444; padding-top: 10px;">
                        <div id="ai-chat-log" style="max-height: 150px; overflow-y: auto; margin-bottom: 10px; font-size: 0.85em; display: flex; flex-direction: column; gap: 8px;"></div>
                        <div style="display: flex; gap: 5px;">
                            <input type="text" id="ai-chat-input" placeholder="Ask a follow-up..." style="flex: 1; padding: 8px; border-radius: 4px; border: 1px solid #444; background: #2a2a2a; color: white;">
                            <button id="ai-chat-send" style="padding: 8px 12px; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">Send</button>
                        </div>
                    </div>
                `;
                container.appendChild(restoreBtn);
                container.appendChild(overlay);
                document.body.appendChild(container);

                // Setup Hide/Show Logic
                document.getElementById('ai-hide-btn').addEventListener('click', () => {
                    overlay.style.display = 'none';
                    restoreBtn.style.display = 'block';
                });
                
                restoreBtn.addEventListener('click', () => {
                    restoreBtn.style.display = 'none';
                    overlay.style.display = 'block';
                });

                // Setup DOM Button
                document.getElementById('ai-analyze-dom-btn').addEventListener('click', async () => {
                    const resultDiv = document.getElementById('ai-result');
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = "<em>Extracting DOM & Analyzing...</em>";
                    document.getElementById('ai-analyze-dom-btn').disabled = true;
                    document.getElementById('ai-analyze-ocr-btn').disabled = true;

                    try {
                        const container = document.getElementById('ai-assistant-container');
                        container.style.display = 'none';
                        const pageText = document.body.innerText;
                        container.style.display = 'block';

                        const selectedModel = document.getElementById('ai-model-select').value;
                        const answer = await window.triggerNodeDOM(pageText, selectedModel);
                        if (answer.error) {
                            resultDiv.innerHTML = `<div style="color: red;">${answer.error}</div>`;
                        } else {
                            resultDiv.innerHTML = `
                                <p><strong>Selected:</strong> Option ${answer.selectedOption}</p>
                                <p><strong>Confidence:</strong> ${answer.confidenceScore}%</p>
                                <p style="color: #aaa;"><strong>Reasoning:</strong><br/>${answer.reasoning}</p>
                            `;
                        }
                    } catch (e) {
                        resultDiv.innerHTML = `<div style="color: red;">Error: ${e.message}</div>`;
                    }
                    document.getElementById('ai-analyze-dom-btn').disabled = false;
                    document.getElementById('ai-analyze-ocr-btn').disabled = false;
                    if (!resultDiv.innerHTML.includes('Error')) {
                        document.getElementById('ai-chat-container').style.display = 'block';
                    }
                });

                // Setup OCR Button
                document.getElementById('ai-analyze-ocr-btn').addEventListener('click', async () => {
                    const resultDiv = document.getElementById('ai-result');
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = "<em>Taking screenshot & running OCR...</em>";
                    document.getElementById('ai-analyze-dom-btn').disabled = true;
                    document.getElementById('ai-analyze-ocr-btn').disabled = true;

                    try {
                        const selectedModel = document.getElementById('ai-model-select').value;
                        const answer = await window.triggerNodeOCR(selectedModel);
                        if (answer.error) {
                            resultDiv.innerHTML = `<div style="color: red;">${answer.error}</div>`;
                        } else {
                            resultDiv.innerHTML = `
                                <p><strong>Selected:</strong> Option ${answer.selectedOption}</p>
                                <p><strong>Confidence:</strong> ${answer.confidenceScore}%</p>
                                <p style="color: #aaa;"><strong>Reasoning:</strong><br/>${answer.reasoning}</p>
                            `;
                        }
                    } catch (e) {
                        resultDiv.innerHTML = `<div style="color: red;">Error: ${e.message}</div>`;
                    }
                    document.getElementById('ai-analyze-dom-btn').disabled = false;
                    document.getElementById('ai-analyze-ocr-btn').disabled = false;
                });

                // Setup Chat
                const chatSendBtn = document.getElementById('ai-chat-send');
                const chatInput = document.getElementById('ai-chat-input');
                const chatLog = document.getElementById('ai-chat-log');

                async function handleChat() {
                    const msg = chatInput.value.trim();
                    if (!msg) return;
                    
                    chatLog.innerHTML += `<div style="align-self: flex-end; background: #2196F3; padding: 6px 10px; border-radius: 12px; max-width: 80%;">${msg}</div>`;
                    chatInput.value = '';
                    chatSendBtn.disabled = true;

                    const loadingId = 'loading-' + Date.now();
                    chatLog.innerHTML += `<div id="${loadingId}" style="align-self: flex-start; background: #444; padding: 6px 10px; border-radius: 12px; max-width: 80%;"><em>...</em></div>`;
                    chatLog.scrollTop = chatLog.scrollHeight;

                    try {
                        const response = await window.triggerNodeChat(msg);
                        document.getElementById(loadingId).innerHTML = response;
                    } catch (e) {
                        document.getElementById(loadingId).innerHTML = `<span style="color:red">Error: ${e.message}</span>`;
                    }
                    chatSendBtn.disabled = false;
                    chatLog.scrollTop = chatLog.scrollHeight;
                }

                chatSendBtn.addEventListener('click', handleChat);
                chatInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') handleChat();
                });
            });
        } catch (e) {
            // Ignore frame injection errors during navigation
        }
    });

    await page.goto(url);
    console.log("\n==================================================================");
    console.log("[Qalify+] Browser launched. The Qalify+ Overlay has been injected!");
    console.log("==================================================================");
    console.log("- Click 'Analyze Screen (OCR)' in the browser to run the pipeline.");
    console.log("- Type messages here in the terminal to chat with the AI.");
    console.log("- Type 'exit' to close the simulator.");
    console.log("==================================================================\n");

    rl.on('line', async (input) => {
        const command = input.trim().toLowerCase();
        if (command === 'exit' || command === 'quit') {
            console.log("[Generic] Closing...");
            await browser.close();
            process.exit(0);
        } else if (command !== '') {
            console.log(`\\n[You]: ${input}`);
            const response = await currentAILayer.chat(input);
            console.log(`[AI]: ${response}\\n`);
        }
    });
}

main().catch(console.error);
