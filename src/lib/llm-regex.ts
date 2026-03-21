export type IntentType = 'send' | 'batch_send' | 'out_ramp' | 'check_status' | 'check_balance' | 'get_rate' | 'help' | 'save_contact' | 'unknown';

export interface ParsedIntent {
  intentType: IntentType;
  transactionId?: string | null;
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
  provider: 'openai' | 'gemini' | 'regex' | 'backend';
}

export function parseIntentWithRegex(userInput: string): ParsedIntent | null {
  const lower = userInput.toLowerCase();

  // 1. Batch Send
  const batchRegex = /(?:send|transfer|pay)\s+([\d.]+)\s*(\w+)?\s+to\s+([^\s,]+)(?:\s*(?:and|,)\s*(?:send|transfer|pay)?\s*([\d.]+)\s*(\w+)?\s+to\s+([^\s,]+))+/i;
  const batchMatch = userInput.match(batchRegex);
  if (batchMatch) {
    const items = [];
    const parts = userInput.split(/and|,/i);
    for (const p of parts) {
      const m = p.match(/(?:send|transfer|pay)?\s*([\d.]+)\s*(\w+)?\s+to\s+([^\s,]+)/i);
      if (m) items.push({ amount: m[1], currency: (m[2] || 'USDC').toUpperCase(), recipient: m[3] });
    }
    if (items.length > 0) {
      return { intentType: 'batch_send', batch: items, amount: null, currency: null, recipient: null, targetCurrency: null };
    }
  }

  // 2. Off-ramp / Remittance
  if (lower.includes('bank') || lower.includes('naira') || lower.includes('kes') || lower.includes('ngn') || lower.includes('shilling')) {
    const amountMatch = userInput.match(/([\d.]+)\s*(usdc|cusd|usd)?/i);
    const accMatch = userInput.match(/(\d{10})/);
    let target = 'NGN';
    if (lower.includes('kes') || lower.includes('shilling')) target = 'KES';
    
    return {
      intentType: 'out_ramp',
      amount: amountMatch ? amountMatch[1] : null,
      currency: (amountMatch && amountMatch[2] ? amountMatch[2].toUpperCase() : 'USDC'),
      recipient: null,
      targetCurrency: target,
      accountNumber: accMatch ? accMatch[1] : null,
    };
  }

  // 3. Bridge
  const bridgeMatch = userInput.match(/bridge\s+([\d.]+)\s*(\w+)?\s+from\s+(\w+)\s+to\s+(\w+)/i);
  if (bridgeMatch) {
    return {
      intentType: 'send',
      amount: bridgeMatch[1],
      currency: (bridgeMatch[2] || 'USDC').toUpperCase(),
      recipient: null,
      sourceChain: bridgeMatch[3],
      targetChain: bridgeMatch[4],
      targetCurrency: null
    };
  }

  // 4. Simple Send
  const sendMatch = userInput.match(/(?:send|transfer|pay)\s+([\d.]+)\s*(\w+)?\s+to\s+([^\s,]+)/i);
  if (sendMatch) {
    return {
      intentType: 'send',
      amount: sendMatch[1],
      currency: (sendMatch[2] || 'USDC').toUpperCase(),
      recipient: sendMatch[3],
      targetCurrency: null
    };
  }

  return { intentType: 'unknown', amount: null, currency: null, recipient: null, targetCurrency: null };
}
