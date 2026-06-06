let apiKey = '';
let chatHistory = [];

document.addEventListener('DOMContentLoaded', async () => {
    const data = await chrome.storage.local.get('apiKey');
    if (data.apiKey) {
        apiKey = data.apiKey;
        document.getElementById('setup-section').classList.add('hidden');
        document.getElementById('main-section').classList.remove('hidden');
    }

    document.getElementById('save-key-btn').addEventListener('click', async () => {
        const key = document.getElementById('api-key').value.trim();
        if (key) {
            await chrome.storage.local.set({ apiKey: key });
            apiKey = key;
            document.getElementById('setup-section').classList.add('hidden');
            document.getElementById('main-section').classList.remove('hidden');
        }
    });

    document.getElementById('analyze-btn').addEventListener('click', analyzePage);
    document.getElementById('chat-send').addEventListener('click', sendChatMessage);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
});

async function analyzePage() {
    const btn = document.getElementById('analyze-btn');
    btn.textContent = "Analyzing...";
    btn.disabled = true;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Execute script to extract text from the active tab
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.body.innerText
        });

        const pageText = result;

        const prompt = `
You are an expert acting as an educational assistant.
Here is the text extracted from the webpage:
${pageText.substring(0, 5000)}

Based on your knowledge, identify if there is a quiz question present. If so, determine the most correct option.
Return a JSON object with the following schema:
{"selectedOption": "A", "confidenceScore": 100, "reasoning": "brief explanation"}
If no clear question is found, return "N/A" for selectedOption and explain why in reasoning.
`;

        chatHistory = [{ role: "user", parts: [{ text: prompt }] }];

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: chatHistory,
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const data = await response.json();
        
        if (data.error) throw new Error(data.error.message);

        const rawText = data.candidates[0].content.parts[0].text;
        chatHistory.push(data.candidates[0].content); // save to history

        const parsed = JSON.parse(rawText);
        
        document.getElementById('result-card').classList.remove('hidden');
        document.getElementById('res-option').textContent = parsed.selectedOption;
        document.getElementById('res-confidence').textContent = parsed.confidenceScore;
        document.getElementById('res-reasoning').textContent = parsed.reasoning;

        const chatUI = document.getElementById('chat-history');
        chatUI.innerHTML += `<div style="margin-bottom:8px; color:#4caf50;"><b>AI:</b> Analysis complete. I selected Option ${parsed.selectedOption}. Ask me any questions!</div>`;

    } catch (e) {
        alert("Error analyzing page: " + e.message);
    } finally {
        btn.textContent = "Analyze Active Page";
        btn.disabled = false;
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    input.value = '';
    input.disabled = true;
    
    const chatUI = document.getElementById('chat-history');
    chatUI.innerHTML += `<div style="margin-bottom:8px;"><b>You:</b> ${msg}</div>`;
    chatUI.scrollTop = chatUI.scrollHeight;

    chatHistory.push({ role: "user", parts: [{ text: msg }] });

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: chatHistory })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const aiMsg = data.candidates[0].content.parts[0].text;
        chatHistory.push(data.candidates[0].content);

        chatUI.innerHTML += `<div style="margin-bottom:8px; color:#4caf50;"><b>AI:</b> ${aiMsg}</div>`;
    } catch (e) {
        chatUI.innerHTML += `<div style="margin-bottom:8px; color:red;"><b>Error:</b> ${e.message}</div>`;
    } finally {
        input.disabled = false;
        input.focus();
        chatUI.scrollTop = chatUI.scrollHeight;
    }
}
