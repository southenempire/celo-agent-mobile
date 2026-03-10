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
    You are a remittance agent for the Celo network. 
    Extract the following information from the user's message:
    1. amount (string, number only)
    2. currency (choose from: cUSD, USDC)
    3. recipient (address/0x...)

    User message: "${userInput}"

    Return ONLY a JSON object like this:
    {
      "amount": "10.5",
      "currency": "USDC",
      "recipient": "0x..."
    }
  `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    if (!content) throw new Error("Gemini failed to return content");

    return JSON.parse(content) as { amount: string; currency: string; recipient: string };
}
