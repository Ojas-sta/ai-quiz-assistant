const Jimp = require('jimp');
const { GoogleGenAI } = require('@google/genai');

class GeminiPipeline {
    constructor() {
        const key = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim().replace(/^["']|["']$/g, '') : undefined;
        this.ai = new GoogleGenAI({ apiKey: key });
    }

    async preprocessImageBase64(base64Image) {
        try {
            // Convert base64 to buffer
            const buffer = Buffer.from(base64Image, 'base64');
            const image = await Jimp.read(buffer);

            // Resize if too large (max 2048x2048)
            if (image.bitmap.width > 2048 || image.bitmap.height > 2048) {
                image.scaleToFit(2048, 2048);
            }

            // Grayscale and enhance contrast for better structure visibility
            image.greyscale().contrast(0.5).normalize();

            // Convert back to base64
            const processedBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
            return processedBuffer.toString('base64');
        } catch (e) {
            console.error("[Gemini Pipeline] Preprocessing failed, returning original image:", e.message);
            return base64Image;
        }
    }

    buildUniversalPrompt(questionHint) {
        return `You are an expert at interpreting educational images.

Analyze the given image carefully.

1. Extract all visible text under the heading "Text:".
2. Describe all visual elements (arrows, shapes, graphs, labels) under "Structure:".
3. Explain relationships between elements under "Meaning:".
4. If it's a diagram, describe the process step-by-step.
5. If it's a graph, explain axes, trends, and meaning.
6. Finally, answer the question. If a question hint or OCR text is provided, use it to guide your answer.

Ensure your final answer contains ONLY valid JSON (no markdown formatting) in this exact format:
{
  "Text": "extracted text here",
  "Structure": "visual elements described here",
  "Meaning": "relationships and trends here",
  "selectedOption": "A",
  "confidenceScore": 95,
  "reasoning": "Step by step reasoning"
}

Question Hint: ${questionHint || "None"}
`;
    }

    async execute(base64Image, questionHint = "", modelName = "gemini-2.5-flash") {
        try {
            console.log("[Gemini Pipeline] Starting preprocessing...");
            const processedBase64 = await this.preprocessImageBase64(base64Image);

            const prompt = this.buildUniversalPrompt(questionHint);

            console.log(`[Gemini Pipeline] Sending multimodal request to ${modelName}...`);
            const response = await this.ai.models.generateContent({
                model: modelName,
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: prompt },
                            { inlineData: { mimeType: "image/png", data: processedBase64 } }
                        ]
                    }
                ]
            });

            const resultText = response.text || "";
            return this.parseGeminiOutput(resultText);

        } catch (error) {
            console.error("[Gemini Pipeline] Execution Failed:", error);
            throw error;
        }
    }

    parseGeminiOutput(text) {
        let cleanText = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
        let parsed = null;

        try {
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                parsed = JSON.parse(cleanText);
            }
        } catch (e) {
            console.log(`[Gemini Pipeline] JSON parse failed, attempting heuristic fallback on output...`);
            const optMatch = cleanText.match(/Option\s*([A-D])/i) || cleanText.match(/"selectedOption"\s*:\s*"([A-D])/i) || cleanText.match(/\b([A-D])\b/);
            parsed = {
                Text: "Failed to extract JSON format.",
                Structure: "N/A",
                Meaning: "N/A",
                selectedOption: optMatch ? optMatch[1].toUpperCase() : "?",
                confidenceScore: 80,
                reasoning: cleanText
            };
        }
        
        return {
            selectedOption: parsed.selectedOption,
            confidenceScore: parsed.confidenceScore,
            reasoning: `**Extracted Text:**\n${parsed.Text}\n\n**Visual Structure:**\n${parsed.Structure}\n\n**Meaning/Analysis:**\n${parsed.Meaning}\n\n**Final Reasoning:**\n${parsed.reasoning}`
        };
    }
}

module.exports = GeminiPipeline;
