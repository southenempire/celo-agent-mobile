import OpenAI from 'openai';
import { parseIntentWithGemini } from './llm-gemini';
import { parseIntent } from './intent';

const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: openaiKey,
  dangerouslyAllowBrowser: true,
});

export type AIProvider = 'openai' | 'gemini' | 'regex';

export interface ResilientIntentResult {
  intent: {
    amount: string;
    currency: string;
    recipient: string;
  };
  provider: AIProvider;
}

export async function getResilientIntent(userInput: string): Promise<ResilientIntentResult> {
  // 1. Try OpenAI
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "user",
        content: `Extract remittance intent from: "${userInput}". Return JSON with amount, currency (cUSD/USDC), and recipient (0x...).`
      }],
      temperature: 0,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (content) {
      return {
        intent: JSON.parse(content),
        provider: 'openai'
      };
    }
  } catch (e: any) {
    console.warn("OpenAI Failed:", e.message);
  }

  // 2. Try Gemini Fallback
  try {
    const intent = await parseIntentWithGemini(userInput);
    return {
      intent,
      provider: 'gemini'
    };
  } catch (e: any) {
    console.warn("Gemini Failed:", e.message);
  }

  // 3. Final Fallback: Regex
  const regexIntent = parseIntent(userInput);
  if (regexIntent) {
    return {
      intent: regexIntent,
      provider: 'regex'
    };
  }

  throw new Error("All AI providers and fallbacks failed to understand the intent.");
}
