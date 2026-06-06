const Tesseract = require('tesseract.js');
const Jimp = require('jimp');
const path = require('path');

class OCRLayer {
    constructor() {}

    async preprocessImage(inputPath, outputPath) {
        console.log(`[OCR] Preprocessing image: ${inputPath}`);
        try {
            // Read the image
            const image = await Jimp.read(inputPath);
            
            // Convert to grayscale, increase contrast/sharpness for better OCR
            image.greyscale()
                 .contrast(0.5)
                 .normalize();
                 
            await image.writeAsync(outputPath);
            return outputPath;
        } catch (error) {
            console.error("[OCR] Image preprocessing failed:", error);
            // Return original if preprocessing fails
            return inputPath;
        }
    }

    async extractText(imagePath) {
        console.log(`[OCR] Extracting text from: ${imagePath}`);
        try {
            const result = await Tesseract.recognize(
                imagePath,
                'eng',
                { logger: m => {} } // suppress verbose logging
            );
            
            const text = result.data.text;
            return this.parseExtractedText(text);
        } catch (error) {
            console.error("[OCR] Tesseract extraction failed:", error);
            return null;
        }
    }

    parseExtractedText(rawText) {
        console.log("[OCR] Parsing extracted text...");
        // Simple heuristic to split question from options
        // Assuming options start with A), B), C), D) or A., B., C., D.
        const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        let questionLines = [];
        let options = [];
        
        const optionRegex = /^[A-D][\)\.]\s*(.*)/i;

        for (const line of lines) {
            const match = line.match(optionRegex);
            if (match) {
                options.push(line);
            } else {
                if (options.length === 0) {
                    questionLines.push(line);
                } else {
                    // It's a continuation of the last option, or trailing text.
                    // For simplicity, append to the last option if there is one.
                    options[options.length - 1] += ' ' + line;
                }
            }
        }

        return {
            question: questionLines.join(' ').trim(),
            options: options.map(o => o.trim())
        };
    }
}

module.exports = OCRLayer;
