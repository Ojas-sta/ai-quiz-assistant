const { GoogleGenAI, Type } = require('@google/genai');
const { OpenAI } = require('openai');

class AILayer {
    constructor(modelName = 'gemini-2.5-flash') {
        this.modelName = modelName;
        this.isOpenRouter = this.modelName.includes('/');
        
        if (this.isOpenRouter) {
            const key = process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_API_KEY.trim().replace(/^["']|["']$/g, '') : undefined;
            this.openRouter = new OpenAI({
                baseURL: "https://openrouter.ai/api/v1",
                apiKey: key,
                defaultHeaders: {
                    "HTTP-Referer": "http://localhost",
                    "X-Title": "Qalify+",
                }
            });
            this.chatHistory = [];
        } else {
            const key = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim().replace(/^["']|["']$/g, '') : undefined;
            this.ai = new GoogleGenAI({ apiKey: key });
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
                let cleanText = resultText.replace(/```json/gi, '').replace(/```/gi, '').trim();
                
                try {
                    // Try to isolate a JSON block if there's conversational text around it
                    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        parsed = JSON.parse(jsonMatch[0]);
                    } else {
                        parsed = JSON.parse(cleanText);
                    }
                } catch (e) {
                    // Fallback heuristics if the model completely ignored the JSON prompt
                    console.log(`[AI] JSON parse failed, attempting heuristic fallback on: ${cleanText.substring(0, 50)}...`);
                    const optMatch = cleanText.match(/Option\s*([A-D])/i) || cleanText.match(/\b([A-D])\b/);
                    if (!optMatch) throw new Error(`Model did not return JSON. Raw output: ${cleanText.substring(0, 100)}...`);
                    
                    parsed = {
                        selectedOption: optMatch[1].toUpperCase(),
                        confidenceScore: 85,
                        reasoning: cleanText
                    };
                }

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
            return { error: `API Error: ${error.message}` };
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
            return `<span style="color:red">API Error: ${error.message}</span>`;
        }
    }
}

module.exports = AILayer;
