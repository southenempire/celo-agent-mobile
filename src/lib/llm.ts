import { parseIntentWithRegex, type ParsedIntent, type ResilientIntentResult, type IntentType } from './llm-regex';

export type AIProvider = 'openai' | 'gemini' | 'regex' | 'backend';

export async function getResilientIntent(userInput: string): Promise<ResilientIntentResult> {
  // 1. Check Regex first (fast, local)
  const regexResult = parseIntentWithRegex(userInput);
  if (regexResult && regexResult.intentType !== 'unknown') {
    return { intent: regexResult, provider: 'regex' };
  }

  // 2. Call Secure Backend
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Unknown backend error' }));
      throw new Error(errData.error || 'Backend failed');
    }
    const data = await response.json();
    return { intent: data.intent, provider: data.provider };
  } catch (error: any) {
    console.error('Intent parsing failed:', error);
    return {
      intent: { intentType: 'unknown', amount: null, currency: null, recipient: null, targetCurrency: null },
      provider: 'regex'
    };
  }
}

export async function generateConversationalReply(userInput: string): Promise<string> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput, mode: 'reply' }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Unknown backend error' }));
      throw new Error(errData.error || 'Backend failed');
    }
    const data = await response.json();
    return data.reply;
  } catch (error: any) {
    console.error('Conversational reply failed:', error);
    return "I'm having a little trouble connecting to my brain, but I'm still here to help! 😅";
  }
}

export type { ParsedIntent, ResilientIntentResult, IntentType };
