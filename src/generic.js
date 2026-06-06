require('dotenv').config();
const { chromium } = require('playwright');
const readline = require('readline');
const path = require('path');
const OCRLayer = require('./ocr');
const AILayer = require('./ai');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
    const url = process.argv[2];
    if (!url) {
        console.error("Usage: node src/generic.js <URL>");
        process.exit(1);
    }

    console.log(`[Generic] Launching browser to navigate to: ${url}`);
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();

    const ocrLayer = new OCRLayer();
    const aiLayer = new AILayer();

    // 1. Expose a function so the browser UI can trigger the Node.js OCR pipeline
    await page.exposeFunction('triggerNodeOCR', async () => {
        console.log("\n[Overlay] 'Analyze' button clicked! Taking screenshot...");
        const screenshotPath = path.join(__dirname, '..', 'temp_screenshot.png');
        await page.screenshot({ path: screenshotPath });

        const preprocessedPath = path.join(__dirname, '..', 'temp_preprocessed.png');
        const finalImagePath = await ocrLayer.preprocessImage(screenshotPath, preprocessedPath);

        const ocrResult = await ocrLayer.extractText(finalImagePath);
        if (!ocrResult || !ocrResult.question) {
            console.error("[Generic] OCR failed to extract meaningful text.");
            return { error: "OCR failed to extract clear text." };
        } else {
            console.log(`\n--- Extracted OCR Text ---\n${ocrResult.question}`);
            const answer = await aiLayer.determineAnswer(ocrResult.question, ocrResult.options);
            return answer || { error: "AI failed to generate an answer." };
        }
    });

    // 1b. Expose a function for DOM text extraction
    await page.exposeFunction('triggerNodeDOM', async (pageText) => {
        console.log("\n[Overlay] 'Analyze (DOM)' button clicked!");
        if (!pageText || pageText.trim() === '') {
            return { error: "No text found in DOM." };
        }
        console.log(`\n--- Extracted DOM Text ---\n${pageText.substring(0, 300)}...`);
        // We pass the raw text as the question and an empty array for options.
        const answer = await aiLayer.determineAnswer(pageText.substring(0, 5000), []);
        return answer || { error: "AI failed to generate an answer." };
    });

    // 1c. Expose a function for Chat interaction
    await page.exposeFunction('triggerNodeChat', async (message) => {
        return await aiLayer.chat(message);
    });

    // 2. Inject the UI overlay every time the page finishes loading or navigating
    page.on('domcontentloaded', async (currentPage) => {
        try {
            await currentPage.evaluate(() => {
                if (document.getElementById('ai-reasoning-overlay')) return;
                
                const overlay = document.createElement('div');
                overlay.id = 'ai-reasoning-overlay';
                overlay.style.cssText = `
                    position: fixed; bottom: 20px; right: 20px; width: 350px;
                    background-color: #1e1e1e; color: #f0f0f0; padding: 20px;
                    border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.8);
                    z-index: 2147483647; font-family: sans-serif; border: 1px solid #444;
                `;
                overlay.innerHTML = `
                    <h3 style="margin-top: 0; color: #4caf50;">AI Assistant</h3>
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
                document.body.appendChild(overlay);

                // Setup DOM Button
                document.getElementById('ai-analyze-dom-btn').addEventListener('click', async () => {
                    const resultDiv = document.getElementById('ai-result');
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = "<em>Extracting DOM & Analyzing...</em>";
                    document.getElementById('ai-analyze-dom-btn').disabled = true;
                    document.getElementById('ai-analyze-ocr-btn').disabled = true;

                    try {
                        const pageText = document.body.innerText;
                        const answer = await window.triggerNodeDOM(pageText);
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
                        const answer = await window.triggerNodeOCR();
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
    console.log("\\n==================================================================");
    console.log("[Generic] Browser launched. The OCR Overlay has been injected!");
    console.log("==================================================================");
    console.log("- Click 'Analyze Screen (OCR)' in the browser to run the pipeline.");
    console.log("- Type messages here in the terminal to chat with the AI.");
    console.log("- Type 'exit' to close the simulator.");
    console.log("==================================================================\\n");

    rl.on('line', async (input) => {
        const command = input.trim().toLowerCase();
        if (command === 'exit' || command === 'quit') {
            console.log("[Generic] Closing...");
            await browser.close();
            process.exit(0);
        } else if (command !== '') {
            console.log(`\\n[You]: ${input}`);
            const response = await aiLayer.chat(input);
            console.log(`[AI]: ${response}\\n`);
        }
    });
}

main().catch(console.error);
