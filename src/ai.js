const { GoogleGenAI, Type } = require('@google/genai');
const { OpenAI } = require('openai');

class AILayer {
    constructor(modelName = 'gemini-2.5-flash') {
        this.modelName = modelName;
        this.isOpenRouter = this.modelName.includes('/');
        
        if (this.isOpenRouter) {
            this.openRouter = new OpenAI({
                baseURL: "https://openrouter.ai/api/v1",
                apiKey: process.env.OPENROUTER_API_KEY,
                defaultHeaders: {
                    "HTTP-Referer": "http://localhost",
                    "X-Title": "AI Quiz Assistant",
                }
            });
            this.chatHistory = [];
        } else {
            this.ai = new GoogleGenAI({});
            this.chatSession = null;
        }
    }

    async determineAnswer(questionText, optionsText) {
        console.log(`[AI] Analyzing question using model: ${this.modelName}...`);
        
        const systemPrompt = "You are an expert educational assistant taking a quiz. Apply deep reasoning and academic rigor.";
        const userPrompt = `
Question: ${questionText}
Options:
${optionsText.join('\\n')}

Based on your knowledge, please select the most correct option.
Return your answer as a structured JSON object. Use exactly these keys:
- "selectedOption": Only the letter (A, B, C, or D) corresponding to your answer.
- "confidenceScore": An integer from 0 to 100 representing your confidence.
- "reasoning": A brief explanation of why this option is correct.
`;

        try {
            let parsed = null;

            if (this.isOpenRouter) {
                // OpenRouter API
                if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is missing from .env");

                const response = await this.openRouter.chat.completions.create({
                    model: this.modelName,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt + "\nEnsure you output ONLY valid JSON. No markdown formatting." }
                    ]
                });
                
                const resultText = response.choices[0].message.content;
                // Strip possible markdown
                const cleanText = resultText.replace(/```json/gi, '').replace(/```/gi, '').trim();
                parsed = JSON.parse(cleanText);

                // Initialize chat history for OpenRouter
                this.chatHistory = [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Question: ${questionText}\\nOptions: ${optionsText.join(', ')}` },
                    { role: "assistant", content: `I chose Option ${parsed.selectedOption} with ${parsed.confidenceScore}% confidence because: ${parsed.reasoning}.` }
                ];

            } else {
                // Google Gemini API natively
                const responseSchema = {
                    type: Type.OBJECT,
                    properties: {
                        selectedOption: { type: Type.STRING },
                        confidenceScore: { type: Type.INTEGER },
                        reasoning: { type: Type.STRING }
                    },
                    required: ["selectedOption", "confidenceScore", "reasoning"],
                };

                const response = await this.ai.models.generateContent({
                    model: this.modelName,
                    contents: userPrompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: responseSchema,
                    }
                });

                parsed = JSON.parse(response.text);

                // Initialize chat session for Gemini
                this.chatSession = this.ai.chats.create({
                    model: this.modelName,
                    config: {
                        systemInstruction: `You are an AI taking a quiz. You chose Option ${parsed.selectedOption} because: ${parsed.reasoning}.`
                    }
                });
            }

            return parsed;
        } catch (error) {
            console.error("[AI] Error during reasoning:", error.message);
            return null;
        }
    }

    async chat(message) {
        try {
            console.log(`[AI Chat] Processing message with ${this.modelName}...`);
            if (this.isOpenRouter) {
                if (this.chatHistory.length === 0) return "I am not analyzing a question right now.";
                
                this.chatHistory.push({ role: "user", content: message });
                const response = await this.openRouter.chat.completions.create({
                    model: this.modelName,
                    messages: this.chatHistory
                });
                
                const reply = response.choices[0].message.content;
                this.chatHistory.push({ role: "assistant", content: reply });
                return reply;
            } else {
                if (!this.chatSession) return "I am not analyzing a question right now.";
                const response = await this.chatSession.sendMessage({ message });
                return response.text;
            }
        } catch (error) {
            console.error("[AI Chat] Error:", error.message);
            return "Sorry, I ran into an error processing that request.";
        }
    }
}

module.exports = AILayer;
