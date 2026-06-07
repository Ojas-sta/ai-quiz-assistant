#!/usr/bin/env node
require('dotenv').config();
require('./banner');
const path = require('path');
const BrowserLayer = require('./browser');
const OCRLayer = require('./ocr');
const AILayer = require('./ai');
const AnalyzerLayer = require('./analyzer');

async function main() {
    const args = process.argv.slice(2);
    const stressMode = args.includes('--stress');
    
    console.log("=========================================");
    console.log("   QUIZ AUTOMATION SIMULATOR STARTING   ");
    console.log("=========================================");
    if (stressMode) {
        console.log("[!] STRESS MODE ACTIVATED - Simulating Obfuscated DOM");
    }
    
    if (!process.env.GEMINI_API_KEY) {
        console.warn("\n[WARNING] GEMINI_API_KEY environment variable is not set.");
        console.warn("The AI Reasoning layer will fail. Please set it before running for full functionality.\n");
    }

    const browserLayer = new BrowserLayer();
    const ocrLayer = new OCRLayer();
    const aiLayer = new AILayer();
    const analyzerLayer = new AnalyzerLayer();

    try {
        await browserLayer.init();
        
        // Expose chat function to browser overlay
        await browserLayer.setupChatCallback(async (msg) => {
            return await aiLayer.chat(msg);
        });

        const targetUrl = `file://${path.resolve(__dirname, '../test/quiz.html')}`;
        await browserLayer.navigateToQuiz(targetUrl, stressMode);

        let isRunning = true;
        let questionNumber = 1;

        while (isRunning) {
            console.log(`\n--- Processing Question ${questionNumber} ---`);
            let extractedData = null;
            let extractionMethod = 'None';

            // 1. Attempt DOM Extraction
            extractedData = await browserLayer.extractFromDOM();
            
            if (extractedData) {
                console.log("[SUCCESS] Extracted via DOM.");
                extractionMethod = 'DOM';
            } else {
                console.log("[INFO] DOM Extraction failed or yielded no usable results. Falling back to OCR.");
                
                // 2. Fallback to OCR
                const screenshotPath = path.resolve(__dirname, '../screenshot.png');
                await browserLayer.captureScreenshot(screenshotPath);
                
                const processedImagePath = path.resolve(__dirname, '../processed_screenshot.png');
                const finalImagePath = await ocrLayer.preprocessImage(screenshotPath, processedImagePath);
                
                extractedData = await ocrLayer.extractText(finalImagePath);
                
                if (extractedData) {
                    console.log("[SUCCESS] Extracted via OCR.");
                    extractionMethod = 'OCR';
                } else {
                     console.log("[FAILURE] OCR Extraction also failed.");
                }
            }

            let base64Image = null;
            if (extractionMethod === 'OCR') {
                const fs = require('fs');
                const finalImagePath = path.resolve(__dirname, '../processed_screenshot.png');
                base64Image = fs.readFileSync(finalImagePath, { encoding: 'base64' });
            }

            // 3. AI Reasoning Layer
            if (extractedData && extractedData.question) {
                aiOutput = await aiLayer.determineAnswer(extractedData.question, extractedData.options, base64Image);
                if (aiOutput) {
                    console.log(`[AI] Selected Option: ${aiOutput.selectedOption} (${aiOutput.confidenceScore}% confidence)`);
                    
                    // VISUAL LAYER: Show reasoning and click
                    await browserLayer.showAIReasoning(aiOutput);
                    await browserLayer.clickOption(aiOutput.selectedOption);
                }
            }

            // 4. Vulnerability Analysis
            analyzerLayer.evaluate(extractedData, extractionMethod, aiOutput, stressMode);
            
            // Get the current text before waiting
            const currentContainerText = await browserLayer.getCurrentContainerText();
            
            console.log("\n[INFO] AI has answered. You can now chat in the overlay, or click 'Next Question' in the browser to continue...");
            
            // Wait for the container text to change
            isRunning = await browserLayer.waitForQuestionChange(currentContainerText);
            questionNumber++;
        }

        console.log("\n[INFO] Quiz loop finished. Printing final report...");
        analyzerLayer.printSummary();

    } catch (error) {
        console.error("Critical Error during execution:", error);
    } finally {
        await browserLayer.close();
    }
}

main();
