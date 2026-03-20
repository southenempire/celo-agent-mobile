import OpenAI from 'openai';
import { parseIntentWithGemini } from './llm-gemini';

const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: openaiKey,
  baseURL: window.location.origin + '/v1/openai',
  dangerouslyAllowBrowser: true,
});

export type AIProvider = 'openai' | 'gemini' | 'regex';

export type IntentType = 'send' | 'batch_send' | 'out_ramp' | 'check_balance' | 'get_rate' | 'help' | 'save_contact' | 'unknown';

export interface ParsedIntent {
  intentType: IntentType;
  amount: string | null;
  currency: string | null;
  recipient: string | null;
  targetCurrency: string | null;
  contactName?: string | null;
  sourceChain?: string | null;
  targetChain?: string | null;
  accountNumber?: string | null;
  bankName?: string | null;
  accountName?: string | null;
  confirmed?: boolean | null;
  batch?: { amount: string; currency: string; recipient: string }[] | null;
}

export interface ResilientIntentResult {
  intent: ParsedIntent;
  provider: AIProvider;
}

// Simple regex-based fallback for common commands
function parseIntentWithRegex(userInput: string): ParsedIntent | null {
  const lower = userInput.toLowerCase();

  // Save contact intent
  const saveRegex = /(?:save|remember)\s+(0x[a-fA-f0-9]{40})\s+(?:as|to)\s+(\w+)/i;
  const saveMatch = userInput.match(saveRegex);
  if (saveMatch) {
    return {
      intentType: 'save_contact',
      amount: null,
      currency: null,
      recipient: saveMatch[1],
      targetCurrency: null,
      contactName: saveMatch[2],
    };
  }

  // Send intent
  const sendRegex = /send\s+([\d.]+)\s+(\w+)\s+to\s+([\w\s]+)/i;
  const sendMatch = userInput.match(sendRegex);
  if (sendMatch) {
    return {
      intentType: 'send',
      amount: sendMatch[1],
      currency: sendMatch[2].toUpperCase(),
      recipient: sendMatch[3].trim(),
      targetCurrency: null,
    };
  }

  // Balance check
  if (lower.includes('balance') || lower.includes('how much') || lower.includes('my funds') || lower.includes('my wallet')) {
    return { intentType: 'check_balance', amount: null, currency: null, recipient: null, targetCurrency: null };
  }

  // Exchange rate
  const rateRegex = /rate\s+(?:for|of)?\s*([A-Z]{2,4})|([A-Z]{2,4})\s+rate|exchange.*([A-Z]{2,4})/i;
  const rateMatch = userInput.match(rateRegex);
  if (rateMatch || lower.includes('rate') || lower.includes('exchange') || lower.includes('convert')) {
    const currencies = ['NGN', 'KES', 'GHS', 'GBP', 'EUR', 'USD'];
    const foundCurrency = currencies.find(c => lower.includes(c.toLowerCase())) || null;
    return { intentType: 'get_rate', amount: null, currency: null, recipient: null, targetCurrency: foundCurrency };
  }

  // Help / Greeting
  if (lower.includes('help') || lower.includes('what can you') || lower.includes('how do i') || lower.includes('capabilities') || lower === 'hi' || lower === 'hello' || lower === 'hey') {
    return { intentType: 'help', amount: null, currency: null, recipient: null, targetCurrency: null };
  }

  return null;
}

export async function getResilientIntent(userInput: string): Promise<ResilientIntentResult> {
  // 1. Try OpenAI
  try {
    if (openaiKey && openaiKey !== 'YOUR_OPENAI_KEY') {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{
          role: "system",
          content: `You are a remittance agent AI. Analyze user messages and return a JSON object with:
- intentType: "send" | "check_balance" | "get_rate" | "help" | "save_contact" | "unknown"
- amount: string or null (for send)
- currency: "USDC" | "cUSD" or fiat codes or null
- recipient: "0x..." address OR a name like "Mom" or null
- targetCurrency: fiat currency code or null (for get_rate)
- contactName: name to save or null (for save_contact)`
        }, {
          role: "user",
          content: userInput
        }],
        temperature: 0,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (content) {
        const parsed = JSON.parse(content) as ParsedIntent;
        return { intent: parsed, provider: 'openai' };
      }
    }
  } catch (e: any) {
    console.warn("OpenAI Failed:", e.message);
  }

  // 2. Try Gemini
  try {
    const intent = await parseIntentWithGemini(userInput);
    return { intent, provider: 'gemini' };
  } catch (e: any) {
    console.warn("Gemini Failed:", e.message);
  }

  // 3. Regex fallback
  const regexIntent = parseIntentWithRegex(userInput);
  if (regexIntent) {
    return { intent: regexIntent, provider: 'regex' };
  }

  // 4. Default to unknown
  return {
    intent: { intentType: 'unknown', amount: null, currency: null, recipient: null, targetCurrency: null },
    provider: 'regex'
  };
}
