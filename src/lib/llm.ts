import OpenAI from 'openai';
import { parseIntentWithGemini } from './llm-gemini';

const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: openaiKey,
  baseURL: import.meta.env.DEV 
    ? window.location.origin + '/v1/openai' 
    : 'https://api.openai.com/v1',
  dangerouslyAllowBrowser: true,
});

export type AIProvider = 'openai' | 'gemini' | 'regex';

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
  provider: AIProvider;
}

// Simple regex-based fallback for common commands
function parseIntentWithRegex(userInput: string): ParsedIntent | null {
  const lower = userInput.toLowerCase();

  // 1. Batch Send Detection (Highest Priority)
  // Example: "Send 5 USDC to 0x123 and 10 to 0x456"
  const batchRegex = /(?:send|transfer|pay)\s+([\d.]+)\s*(\w+)?\s+to\s+([^\s,]+)(?:\s*(?:and|,)\s*(?:send|transfer|pay)?\s*([\d.]+)\s*(\w+)?\s+to\s+([^\s,]+))+/i;
  const batchMatch = userInput.match(batchRegex);
  if (batchMatch) {
    const items = [];
    // Extract first item
    items.push({ amount: batchMatch[1], currency: (batchMatch[2] || 'USDC').toUpperCase(), recipient: batchMatch[3] });
    
    // Extract subsequent items
    const rest = userInput.slice(batchMatch[0].length);
    const extraRegex = /(?:and|,)\s*(?:send|transfer|pay)?\s*([\d.]+)\s*(\w+)?\s+to\s+([^\s,]+)/gi;
    let m;
    while ((m = extraRegex.exec(userInput)) !== null) {
        if (m.index === batchMatch.index) continue; // skip first
        items.push({ amount: m[1], currency: (m[2] || 'USDC').toUpperCase(), recipient: m[3] });
    }
    
    return {
      intentType: 'batch_send',
      amount: items[0].amount,
      currency: items[0].currency,
      recipient: items[0].recipient,
      batch: items,
      targetCurrency: null
    };
  }

  // 2. Bridge Intent (High priority)
  const bridgeRegex = /(?:send|bridge|transfer)\s+([\d.]+)\s*(?:usdc|usd)?\s+from\s+(solana|base|ethereum|celo)\s+(?:to\s+)?([\w\s0-9x...]+)/i;
  const bridgeMatch = userInput.match(bridgeRegex);
  if (bridgeMatch) {
    const recip = bridgeMatch[3].trim();
    return {
      intentType: 'send',
      amount: bridgeMatch[1],
      currency: 'USDC',
      recipient: recip,
      sourceChain: bridgeMatch[2].charAt(0).toUpperCase() + bridgeMatch[2].slice(1),
      targetChain: /to\s+(solana|base|ethereum)/i.test(userInput) ? userInput.match(/to\s+(solana|base|ethereum)/i)![1] : 'Celo',
      targetCurrency: null,
    };
  }

  // 3. Remittance / Out-ramp intent (Naira, Cedi, Shilling, EUR, GBP)
  const remittanceRegex = /(?:send|withdraw|transfer|off-ramp|cash\s*out)\s+([\d.]+)\s*(?:usd|usdc|cUSD)?\s*(?:to|as|in)?\s*(naira|niara|cedi|shilling|ngn|kes|ghs|eur|gbp)\s*(?:to)?\s*([\w\s0-9+-]+)/i;
  const remMatch = userInput.match(remittanceRegex);
  if (remMatch) {
    const amt = remMatch[1];
    const curr = remMatch[2].toUpperCase();
    const recip = remMatch[3].trim();
    
    const accMatch = recip.match(/(?:acct|account)\s*(?:number)?\s*(\d{10,15})/i) || recip.match(/\b(\d{10,15})\b/);
    const bankMatch = recip.match(/bank\s*(?:name)?\s*(.*?)(?=\s+name\s+|\s+acct\s+|\s+account\s+|$)/i);
    let nameMatch = recip.match(/name\s*(?:of)?\s*(?:the)?\s*(?:acct|account)?\s*(?:holder)?\s*(.*?)(?=\s+bank\s+|\s+acct\s+|\s+account\s+|$)/i);
    
    let accountName = nameMatch ? nameMatch[1].trim() : null;
    if (!accountName) {
        const nameFallback = recip.match(/^(.*?)(?=\s+bank\s+|\s+acct\s+|\s+account\s+|$)/i);
        if (nameFallback && nameFallback[1].trim() && !/^\d+$/.test(nameFallback[1].trim())) {
            accountName = nameFallback[1].trim();
        }
    }

    return {
      intentType: 'out_ramp',
      amount: amt,
      currency: curr.match(/NIARA|NARRA|NAIRA/) ? 'NGN' : curr,
      recipient: null,
      targetCurrency: curr.match(/NIARA|NARRA|NAIRA/) ? 'NGN' : curr,
      accountNumber: accMatch ? accMatch[1] : null,
      bankName: bankMatch ? bankMatch[1].trim() : null,
      accountName: accountName
    };
  }

  // 4. Send intent (base case)
  const sendRegex = /send\s+([\d.]+)\s*(\w+)?\s+to\s+([\w\s0-9+-]+)/i;
  const sendMatch = userInput.match(sendRegex);
  if (sendMatch) {
    const amt = sendMatch[1];
    const curr = (sendMatch[2] || 'USDC').toUpperCase();
    const recip = sendMatch[3].trim();
    
    // Pivot to out_ramp if recipient looks like a bank request or currency is fiat
    const fiatKeywords = ['NGN', 'NAIRA', 'NIARA', 'NARRA', 'KES', 'GHS', 'EUR', 'GBP'];
    if (fiatKeywords.includes(curr) || recip.toLowerCase().includes('acct') || recip.toLowerCase().includes('account')) {
        const accMatch = recip.match(/(?:acct|account)\s*(?:number)?\s*(\d{10,15})/i);
        const bankMatch = recip.match(/bank\s*(?:name)?\s*(.*?)(?=\s+name\s+|\s+acct\s+|\s+account\s+|$)/i);
        let nameMatch = recip.match(/name\s*(?:of)?\s*(?:the)?\s*(?:acct|account)?\s*(?:holder)?\s*(.*?)(?=\s+bank\s+|\s+acct\s+|\s+account\s+|$)/i);
        
        return {
            intentType: 'out_ramp',
            amount: amt,
            currency: curr === 'NIARA' || curr === 'NARRA' ? 'NGN' : curr,
            recipient: null,
            targetCurrency: curr === 'NIARA' || curr === 'NARRA' ? 'NGN' : curr,
            accountNumber: accMatch ? accMatch[1] : null,
            bankName: bankMatch ? bankMatch[1].trim() : null,
            accountName: nameMatch ? nameMatch[1].trim() : recip.split(' ')[0]
        };
    }

    return {
      intentType: 'send',
      amount: amt,
      currency: curr,
      recipient: recip,
      targetCurrency: null,
    };
  }

  // Balance check
  if (lower.includes('balance') || lower.includes('how much') || lower.includes('my funds') || lower.includes('my wallet')) {
    return { intentType: 'check_balance', amount: null, currency: null, recipient: null, targetCurrency: null };
  }

  // Status check
  if (lower.includes('status') || lower.includes('verify') || lower.includes('track')) {
    const chiMatch = userInput.match(/chi-[a-zA-Z0-9]+|cm-\d+/);
    return { intentType: 'check_status' as any, amount: null, currency: null, recipient: null, targetCurrency: null, transactionId: chiMatch ? chiMatch[0] : null } as any;
  }

  // Exchange rate
  const rateRegex = /rate\s+(?:for|of)?\s*([A-Z]{2,4})|([A-Z]{2,4})\s+rate|exchange.*([A-Z]{2,4})/i;
  const rateMatch = userInput.match(rateRegex);
  if (rateMatch || lower.includes('rate') || lower.includes('exchange') || lower.includes('convert')) {
    const currencies = ['NGN', 'KES', 'GHS', 'GBP', 'EUR', 'USD'];
    const foundCurrency = currencies.find(c => lower.includes(c.toLowerCase())) || null;
    return { intentType: 'get_rate', amount: null, currency: null, recipient: null, targetCurrency: foundCurrency };
  }

  // Off-ramp intent
  const rampKeywords = ['withdraw', 'off-ramp', 'offramp', 'transfer to bank', 'cash out'];
  const rampMatch = userInput.match(/(?:withdraw|off-ramp|offramp|transfer to bank|cash out)\s+([\d.]+)\s+(\w+)/i);
  
  if (rampMatch || rampKeywords.some(k => lower.includes(k))) {
    return {
      intentType: 'out_ramp',
      amount: rampMatch ? rampMatch[1] : null,
      currency: rampMatch ? rampMatch[2].toUpperCase() : null,
      recipient: null,
      targetCurrency: null,
    };
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
- intentType: "send" | "batch_send" | "out_ramp" | "check_balance" | "get_rate" | "help" | "save_contact" | "unknown"
- amount: string or null
- currency: "USDC" | "cUSD" or fiat codes or null
- recipient: "0x..." address OR a name like "Mom" or null
- targetCurrency: fiat currency code or null (for get_rate or out_ramp)
- contactName: name to save or null (for save_contact)
- accountNumber: 10-digit bank account number or null (for out_ramp)
- bankName: name of the bank or null (for out_ramp)
- accountName: full name of account holder or null (for out_ramp)`
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
