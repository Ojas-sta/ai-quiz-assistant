const { chromium } = require('playwright');

class BrowserLayer {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async init() {
        console.log("[Browser] Attempting to connect to existing Chrome (CDP on 9222)...");
        try {
            this.browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
            console.log("[Browser] Connected to existing browser via Remote Debugging.");
            const context = this.browser.contexts()[0];
            this.page = await context.newPage();
        } catch (error) {
            console.log("[Browser] Could not connect to CDP. Launching new visual browser.");
            this.browser = await chromium.launch({ headless: false });
            this.page = await this.browser.newPage();
        }

        await this.page.addInitScript(() => {
            document.addEventListener('DOMContentLoaded', () => {
                const cursor = document.createElement('div');
                cursor.id = 'ai-custom-cursor';
                cursor.style.width = '20px';
                cursor.style.height = '20px';
                cursor.style.borderRadius = '50%';
                cursor.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
                cursor.style.border = '2px solid white';
                cursor.style.position = 'absolute';
                cursor.style.zIndex = '2147483647';
                cursor.style.pointerEvents = 'none';
                cursor.style.transition = 'top 0.05s, left 0.05s';
                cursor.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
                document.body.appendChild(cursor);

                document.addEventListener('mousemove', (e) => {
                    cursor.style.left = (e.pageX - 10) + 'px';
                    cursor.style.top = (e.pageY - 10) + 'px';
                });
            });
        });
    }

    async setupChatCallback(callback) {
        // Expose a function that the browser UI can call
        await this.page.exposeFunction('sendChatMessageToNode', async (msg) => {
            return await callback(msg);
        });
    }

    async navigateToQuiz(url, stressMode = false) {
        const finalUrl = stressMode ? `${url}?stress=true` : url;
        console.log(`[Browser] Navigating to: ${finalUrl}`);
        await this.page.goto(finalUrl);
        await this.page.waitForLoadState('networkidle');
    }

    async extractFromDOM() {
        console.log("[Browser] Attempting DOM extraction...");
        try {
            const questionElement = await this.page.$('.question-text');
            const optionsElements = await this.page.$$('.option label');

            if (!questionElement || optionsElements.length === 0) {
                return null;
            }

            const questionText = await questionElement.innerText();
            const options = [];
            for (const el of optionsElements) {
                options.push(await el.innerText());
            }

            return {
                question: questionText.trim(),
                options: options.map(o => o.trim())
            };
        } catch (error) {
            console.error("[Browser] DOM Extraction encountered error:", error.message);
            return null;
        }
    }

    async captureScreenshot(outputPath) {
        await this.page.screenshot({ path: outputPath, fullPage: true });
    }

    async showAIReasoning(aiOutput) {
        console.log("[Browser] Displaying AI Reasoning Overlay with Chatbot...");
        await this.page.evaluate((aiData) => {
            let overlay = document.getElementById('ai-reasoning-overlay');
            if (overlay) {
                overlay.remove(); // Remove old overlay if cycling
            }
            
            overlay = document.createElement('div');
            overlay.id = 'ai-reasoning-overlay';
            overlay.style.position = 'fixed';
            overlay.style.bottom = '20px';
            overlay.style.right = '20px';
            overlay.style.width = '350px';
            overlay.style.backgroundColor = '#1e1e1e';
            overlay.style.color = '#f0f0f0';
            overlay.style.padding = '20px';
            overlay.style.borderRadius = '12px';
            overlay.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
            overlay.style.zIndex = '2147483646';
            overlay.style.fontFamily = 'sans-serif';
            overlay.style.border = '1px solid #444';
            
            overlay.innerHTML = `
                <h3 style="margin-top: 0; color: #4caf50;">AI Agent Analysis</h3>
                <p><strong>Selected:</strong> Option ${aiData.selectedOption}</p>
                <p><strong>Confidence:</strong> ${aiData.confidenceScore}%</p>
                <p style="font-size: 0.9em; line-height: 1.4; color: #aaa; max-height:80px; overflow-y:auto;"><strong>Reasoning:</strong><br/> ${aiData.reasoning}</p>
                <hr style="border-color: #444; margin: 15px 0;" />
                <div id="ai-chat-history" style="height: 150px; overflow-y: auto; margin-bottom: 10px; font-size: 0.85em; color: #ccc;"></div>
                <div style="display: flex;">
                    <input type="text" id="ai-chat-input" placeholder="Ask AI a follow-up..." style="flex-grow: 1; padding: 8px; border-radius: 4px; border: 1px solid #555; background: #333; color: white;" />
                    <button id="ai-chat-send" style="margin-left: 5px; background: #4caf50; color: white; border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer; font-weight:bold;">Send</button>
                </div>
            `;
            document.body.appendChild(overlay);

            // Wire up chat functionality
            const sendBtn = document.getElementById('ai-chat-send');
            const inputField = document.getElementById('ai-chat-input');
            const history = document.getElementById('ai-chat-history');

            const sendMessage = async () => {
                const msg = inputField.value.trim();
                if (!msg) return;
                
                // Disable while waiting
                inputField.disabled = true;
                sendBtn.disabled = true;

                history.innerHTML += `<div style="margin-bottom:8px;"><b>You:</b> ${msg}</div>`;
                inputField.value = '';
                history.scrollTop = history.scrollHeight;
                
                if (window.sendChatMessageToNode) {
                    try {
                        const aiResponse = await window.sendChatMessageToNode(msg);
                        history.innerHTML += `<div style="margin-bottom:8px; color: #4caf50;"><b>AI:</b> ${aiResponse}</div>`;
                    } catch (e) {
                        history.innerHTML += `<div style="margin-bottom:8px; color: red;"><b>Error:</b> Failed to get response.</div>`;
                    }
                }
                
                history.scrollTop = history.scrollHeight;
                inputField.disabled = false;
                sendBtn.disabled = false;
                inputField.focus();
            };

            sendBtn.addEventListener('click', sendMessage);
            inputField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage();
            });

        }, aiOutput);
    }

    async clickOption(selectedLetter) {
        console.log(`[Browser] Simulating click on option ${selectedLetter}`);
        
        const targetElement = await this.page.evaluateHandle((letter) => {
            const standardOptions = Array.from(document.querySelectorAll('.option'));
            const target = standardOptions.find(opt => opt.getAttribute('data-val') === letter);
            if (target) return target;
            return document.getElementById(`q_${letter.toLowerCase()}`) || document.querySelector('body'); 
        }, selectedLetter);

        if (targetElement) {
            const box = await targetElement.boundingBox();
            if (box) {
                const targetX = box.x + box.width / 2;
                const targetY = box.y + box.height / 2;

                await this.page.mouse.move(targetX, targetY, { steps: 25 });
                await this.page.waitForTimeout(500);
                await this.page.mouse.down();
                await this.page.waitForTimeout(100);
                await this.page.mouse.up();
            }
        }
    }
    
    async getCurrentContainerText() {
        return await this.page.evaluate(() => {
            const c = document.getElementById('q-container');
            return c ? c.textContent.trim() : "";
        });
    }

    async waitForQuestionChange(previousText) {
        console.log("[Browser] Monitoring page for question changes...");
        try {
            await this.page.waitForFunction((prev) => {
                const c = document.getElementById('q-container');
                if (!c) return false;
                const current = c.textContent.trim();
                return current !== prev && current !== "";
            }, previousText, { timeout: 0 }); // Wait indefinitely until the user clicks 'Next'
            
            const newText = await this.getCurrentContainerText();
            if (newText.includes("Quiz Completed")) {
                console.log("[Browser] Quiz Completed state detected.");
                return false; // stop loop
            }
            return true; // continue loop
        } catch (error) {
            console.error("Error waiting for change:", error);
            return false;
        }
    }

    async close() {
        if (this.browser) {
            if (this.page) await this.page.close();
            await this.browser.close();
        }
    }
}

module.exports = BrowserLayer;
