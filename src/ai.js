const { GoogleGenAI, Type } = require('@google/genai');
const { OpenAI } = require('openai');

class AILayer {
    constructor(providerName = 'gemini', modelName = 'gemini-2.5-flash', keyIndex = "1") {
        this.providerName = providerName;
        this.modelName = modelName;
        this.keyIndex = keyIndex;
        this.isOpenRouter = (this.providerName === 'openrouter');
        this.isPuter = (this.providerName === 'puter');
        
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
        } else if (this.isPuter) {
            this.puter = require('@heyputer/puter.js').puter;
            this.chatHistory = [];
        } else {
            let envKeyName = 'GEMINI_API_KEY';
            if (this.keyIndex && this.keyIndex !== "1") {
                envKeyName = `GEMINI_API_KEY_${this.keyIndex}`;
            }
            let key = process.env[envKeyName] ? process.env[envKeyName].trim().replace(/^["']|["']$/g, '') : undefined;
            
            // Fallback to default key if the specific indexed key doesn't exist
            if (!key && this.keyIndex !== "1") {
                console.log(`[AI] ${envKeyName} not found, falling back to GEMINI_API_KEY`);
                key = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim().replace(/^["']|["']$/g, '') : undefined;
            }

            this.geminiKey = key;
            this.ai = new GoogleGenAI({ apiKey: key });
            this.chatSession = null;
        }
    }

    async determineAnswer(questionText, optionsText, base64Image = null) {
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

            if (this.isPuter) {
                const combinedPrompt = `${systemPrompt}\n\n${userPrompt}\nEnsure you output ONLY valid JSON. No markdown formatting.`;
                let response = await this.puter.ai.chat(combinedPrompt, { model: this.modelName });
                
                let resultText = "";
                if (typeof response === 'string') {
                    resultText = response;
                } else if (response && response.message && response.message.content && response.message.content[0]) {
                    resultText = response.message.content[0].text;
                } else if (response && response.text) {
                    resultText = response.text;
                }
                
                let cleanText = resultText.replace(/```json/gi, '').replace(/```/gi, '').trim();
                
                try {
                    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
                    else parsed = JSON.parse(cleanText);
                } catch (e) {
                    console.log(`[AI] JSON parse failed, attempting heuristic fallback on: ${cleanText.substring(0, 50)}...`);
                    const optMatch = cleanText.match(/Option\s*([A-D])/i) || cleanText.match(/\b([A-D])\b/);
                    if (!optMatch) throw new Error(`Model did not return JSON. Raw output: ${cleanText.substring(0, 100)}...`);
                    parsed = { selectedOption: optMatch[1].toUpperCase(), confidenceScore: 85, reasoning: cleanText };
                }

                this.chatHistory = [
                    `Question: ${questionText}\nOptions: ${optionsText.join(', ')}`,
                    `I chose Option ${parsed.selectedOption} with ${parsed.confidenceScore}% confidence because: ${parsed.reasoning}.`
                ];

            } else if (this.isOpenRouter) {
                // OpenRouter API
                if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is missing from .env");

                const messages = [
                    { role: "system", content: systemPrompt }
                ];

                const supportsVision = /sonnet|gpt-4o|gemini|vision/i.test(this.modelName);

                if (base64Image && supportsVision) {
                    messages.push({
                        role: "user",
                        content: [
                            { type: "text", text: userPrompt + "\nEnsure you output ONLY valid JSON. No markdown formatting." },
                            { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } }
                        ]
                    });
                } else {
                    messages.push({ role: "user", content: userPrompt + "\nEnsure you output ONLY valid JSON. No markdown formatting." });
                }

                const response = await this.openRouter.chat.completions.create({
                    model: this.modelName,
                    messages: messages
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
                    { role: "user", content: `Question: ${questionText}\nOptions: ${optionsText.join(', ')}` },
                    { role: "assistant", content: `I chose Option ${parsed.selectedOption} with ${parsed.confidenceScore}% confidence because: ${parsed.reasoning}.` }
                ];

            } else {
                // Google Gemini API natively
                if (!this.geminiKey) throw new Error("A GEMINI_API_KEY is missing from .env");

                if (base64Image) {
                    // Use the new Standalone Multimodal Pipeline!
                    const GeminiPipeline = require('./gemini-pipeline');
                    const pipeline = new GeminiPipeline(this.geminiKey);
                    
                    const questionHint = `Question: ${questionText}\nOptions: ${optionsText.join(', ')}`;
                    parsed = await pipeline.execute(base64Image, questionHint, this.modelName);
                    
                    this.chatSession = null; // No chat session maintained for raw pipeline yet
                    return parsed;
                }
                const responseSchema = {
                    type: Type.OBJECT,
                    properties: {
                        selectedOption: { type: Type.STRING },
                        confidenceScore: { type: Type.INTEGER },
                        reasoning: { type: Type.STRING }
                    },
                    required: ["selectedOption", "confidenceScore", "reasoning"],
                };

                let reqContents = [userPrompt];
                if (base64Image) {
                    reqContents.push({
                        inlineData: {
                            data: base64Image,
                            mimeType: "image/png"
                        }
                    });
                }

                const response = await this.ai.models.generateContent({
                    model: this.modelName,
                    contents: reqContents,
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
            console.log(`[AI Chat] Processing message with ${this.modelName} via ${this.providerName}...`);
            if (this.isPuter) {
                this.chatHistory.push(message);
                const combinedPrompt = this.chatHistory.join("\n\n");
                let response = await this.puter.ai.chat(combinedPrompt, { model: this.modelName });
                
                let reply = "";
                if (typeof response === 'string') {
                    reply = response;
                } else if (response && response.message && response.message.content && response.message.content[0]) {
                    reply = response.message.content[0].text;
                } else if (response && response.text) {
                    reply = response.text;
                }
                
                this.chatHistory.push(reply);
                return reply;
            } else if (this.isOpenRouter) {
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
