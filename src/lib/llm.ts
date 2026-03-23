import { parseIntentWithRegex, type ParsedIntent, type ResilientIntentResult, type IntentType } from './llm-regex';

export type AIProvider = 'openai' | 'gemini' | 'regex' | 'backend';

const SYSTEM_PROMPT = `You are the CRIA Agent (Celo Remittance Intent Agent). 
Parse user input into a JSON intent.
Intent Schema: { intentType: 'send'|'balance_check'|'save_contact'|'bridge'|'out_ramp', amount?: string, currency?: string, recipient?: string, targetCurrency?: string, bankName?: string, accountNumber?: string, accountName?: string }`;

export async function getResilientIntent(userInput: string): Promise<ResilientIntentResult> {
  // 1. Check Regex first (fast, local)
  const regexResult = parseIntentWithRegex(userInput);
  if (regexResult && regexResult.intentType !== 'unknown' && (regexResult.intentType as string) !== 'confirmation') {
    return { intent: regexResult, provider: 'regex' };
  }

  // 2. Try Backend
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput }),
    });
    if (response.ok) {
      const data = await response.json();
      return { intent: data.intent, provider: data.provider };
    }
  } catch (e) {
    console.warn("Backend unavailable, falling back to client-side LLM", e);
  }

  // 3. Client-side Fallback (Gemini)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\nUser: ${userInput}\nJSON:` }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return { intent: JSON.parse(text), provider: 'gemini' };
      }
    } catch (e) {
        console.error("Client-side Gemini failed", e);
    }
  }

  return {
    intent: regexResult || { intentType: 'unknown', amount: null, currency: null, recipient: null, targetCurrency: null },
    provider: 'regex'
  };
}

export async function generateConversationalReply(userInput: string): Promise<string> {
  // Try Backend
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput, mode: 'reply' }),
    });
    if (response.ok) {
      const data = await response.json();
      return data.reply;
    }
  } catch (e) { /* ignore */ }

  // Client-side Fallback (Gemini)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a helpful financial assistant for Celo. Give a friendly, short reply to: "${userInput}"` }] }]
        })
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm still here to help! 😅";
    } catch (e) { /* ignore */ }
  }

  return "I'm having a little trouble connecting to my brain, but I'm still here to help! 😅";
}

export type { ParsedIntent, ResilientIntentResult, IntentType };
