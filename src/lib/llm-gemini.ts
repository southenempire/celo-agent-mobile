import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

export async function parseIntentWithGemini(userInput: string) {
    if (!apiKey || apiKey === 'REPLACE_WITH_YOUR_GEMINI_KEY') {
        throw new Error("Gemini API Key missing");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
            responseMimeType: "application/json",
        }
    });

    const prompt = `
You are CRIA, an intelligent Celo remittance agent. Analyze the user's message and classify it.

User message: "${userInput}"

Return ONLY a JSON object with the following structure:
{
  "intentType": "send" | "check_balance" | "get_rate" | "help" | "unknown",
  "amount": "10.5" | null,
  "currency": "USDC" | "cUSD" | "NGN" | "KES" | "GHS" | "GBP" | "EUR" | null,
  "recipient": "0x..." | null,
  "targetCurrency": "NGN" | "KES" | "GHS" | "GBP" | "USD" | null
}

Rules:
- intentType "send": user wants to transfer tokens or fiat to an address
- intentType "check_balance": user asks about their balance, funds, or holdings
- intentType "get_rate": user asks about exchange rates, conversion, or currency prices
- intentType "help": user asks how to use the app, what CRIA can do, etc.
- intentType "unknown": anything else
- amount: only for "send" intents, must be a number string
- currency: the stablecoin OR fiat currency. If user says NGN/KES/etc, use that fiat code — the agent will convert it. Default to "USDC" if unspecified.
- recipient: only for "send" intents, must be an Ethereum-style 0x address
- targetCurrency: for "get_rate", which fiat currency they are asking about

Examples:
- "Send 5 USDC to 0xabc..." → { "intentType": "send", "amount": "5", "currency": "USDC", "recipient": "0xabc...", "targetCurrency": null }
- "Send 5000 NGN to 0xabc..." → { "intentType": "send", "amount": "5000", "currency": "NGN", "recipient": "0xabc...", "targetCurrency": null }
- "Send ₦5000 to 0xabc..." → { "intentType": "send", "amount": "5000", "currency": "NGN", "recipient": "0xabc...", "targetCurrency": null }
- "Send 500 KES to 0xabc..." → { "intentType": "send", "amount": "500", "currency": "KES", "recipient": "0xabc...", "targetCurrency": null }
- "What is my balance?" → { "intentType": "check_balance", "amount": null, "currency": null, "recipient": null, "targetCurrency": null }
- "What is the NGN rate?" → { "intentType": "get_rate", "amount": null, "currency": null, "recipient": null, "targetCurrency": "NGN" }
- "what can you do" → { "intentType": "help", "amount": null, "currency": null, "recipient": null, "targetCurrency": null }
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    if (!content) throw new Error("Gemini failed to return content");

    return JSON.parse(content) as {
        intentType: 'send' | 'check_balance' | 'get_rate' | 'help' | 'unknown';
        amount: string | null;
        currency: string | null;
        recipient: string | null;
        targetCurrency: string | null;
    };
}

export async function generateConversationalReply(userInput: string): Promise<string> {
    if (!apiKey || apiKey === 'REPLACE_WITH_YOUR_GEMINI_KEY') {
        throw new Error("Gemini API Key missing");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are CRIA, a friendly AI agent for fast remittances on the Celo blockchain. 
The user said: "${userInput}"

Respond helpfully in 2-3 short sentences. If it's off-topic, gently redirect them to what CRIA can do: 
send USDC/cUSD, check balances, and check exchange rates (NGN, KES, GHS, EUR, GBP).
Do NOT use markdown. Keep it conversational and warm.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
}
