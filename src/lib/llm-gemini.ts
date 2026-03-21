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
You are CRIA, an intelligent, empathetic, and ultra-friendly Celo remittance agent. You're here to help "normies" (non-crypto users) move money globally with ease.

User message: "${userInput}"

Return ONLY a JSON object with the following structure:
{
  "intentType": "send" | "batch_send" | "out_ramp" | "check_balance" | "get_rate" | "help" | "save_contact" | "unknown",
  "amount": "10.5" | null,
  "currency": "USDC" | "cUSD" | "NGN" | "KES" | "GHS" | "GBP" | "EUR" | "Naira" | "Niara" | "Cedi" | "Shillings" | "USD" | null,
  "recipient": "0x..." | "Mom" | "Sister" | null,
  "targetCurrency": "NGN" | "KES" | "GHS" | "GBP" | "USD" | null,
  "contactName": "name to save" | null,
  "accountNumber": "1234567890" | null,
  "bankName": "Bank ABC" | null,
  "accountName": "John Doe" | null,
  "confirmed": true | false | null,
  "sourceChain": "Solana" | "Ethereum" | "Celo" | "Base" | null,
  "targetChain": "Solana" | "Ethereum" | "Celo" | "Base" | null,
  "batch": [
    { "amount": "5", "currency": "USDC", "recipient": "Mom" },
    { "amount": "10", "currency": "USDC", "recipient": "Sister" }
  ] | null
}

Rules & Persona:
- Be WARM and encouraging. If the user says "Hi", treat it as "help" but keep it conversational.
- intentType "batch_send": Use this if the user wants to send money to MULTIPLE people at once. 
- sourceChain / targetChain: If the user mentions moving money from one chain to another (e.g., "Bridge $10 from Solana to Celo" or "Send from Solana to Mom"), populate these.
- amount/currency: If it's a single send, populate these. If it's a batch, put the details in "batch".
- Resolve names like "Mom" or "Sister" as strings in the recipient field.

Examples:
- "Send 1 USDC from Solana to Mom" → { "intentType": "send", "amount": "1", "currency": "USDC", "recipient": "Mom", "sourceChain": "Solana", "targetChain": "Celo", "batch": null }
- "Bridge 10 USDC from Celo to Solana" → { "intentType": "send", "amount": "10", "currency": "USDC", "recipient": null, "sourceChain": "Celo", "targetChain": "Solana", "batch": null }
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    if (!content) throw new Error("Gemini failed to return content");

    return JSON.parse(content) as {
        intentType: 'send' | 'batch_send' | 'out_ramp' | 'check_balance' | 'get_rate' | 'help' | 'save_contact' | 'unknown';
        amount: string | null;
        currency: string | null;
        recipient: string | null;
        targetCurrency: string | null;
        contactName: string | null;
        accountNumber: string | null;
        bankName: string | null;
        accountName: string | null;
        confirmed: boolean | null;
        sourceChain: string | null;
        targetChain: string | null;
        batch: { amount: string; currency: string; recipient: string }[] | null;
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
