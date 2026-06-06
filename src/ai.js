const { GoogleGenAI, Type } = require('@google/genai');

class AILayer {
    constructor() {
        this.ai = new GoogleGenAI({});
        this.chatSession = null;
    }

    async determineAnswer(questionText, optionsText) {
        console.log("[AI] Analyzing question and options...");
        const prompt = `
You are an expert taking a quiz.
Question: ${questionText}
Options:
${optionsText.join('\n')}

Based on your knowledge, please select the most correct option.
Return a structured output with the following fields:
- "selectedOption": Only the letter (A, B, C, or D) corresponding to your answer.
- "confidenceScore": An integer from 0 to 100 representing your confidence.
- "reasoning": A brief explanation of why this option is correct.
`;

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                selectedOption: {
                    type: Type.STRING,
                    description: "The letter of the selected option, e.g., A, B, C, or D",
                },
                confidenceScore: {
                    type: Type.INTEGER,
                    description: "A score from 0 to 100 indicating confidence in the answer.",
                },
                reasoning: {
                    type: Type.STRING,
                    description: "Brief reasoning for why this answer was chosen.",
                },
            },
            required: ["selectedOption", "confidenceScore", "reasoning"],
        };

        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                }
            });

            const resultText = response.text;
            const parsed = JSON.parse(resultText);

            // Initialize a chat session for follow-ups about this question
            this.chatSession = this.ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: `You are a helpful AI security expert taking a quiz. The user is asking you follow-up questions about your reasoning. 
Current Question: ${questionText}
Options: ${optionsText.join(', ')}
You chose Option ${parsed.selectedOption} with ${parsed.confidenceScore}% confidence because: ${parsed.reasoning}.
Keep your responses concise, friendly, and educational.`
                }
            });

            return parsed;
        } catch (error) {
            console.error("[AI] Error during reasoning:", error.message);
            return null;
        }
    }

    async chat(message) {
        if (!this.chatSession) {
            return "I am not analyzing a question right now.";
        }
        try {
            console.log(`[AI Chat] Processing message...`);
            const response = await this.chatSession.sendMessage({ message });
            return response.text;
        } catch (error) {
            console.error("[AI Chat] Error:", error.message);
            return "Sorry, I ran into an error processing that request.";
        }
    }
}

module.exports = AILayer;
