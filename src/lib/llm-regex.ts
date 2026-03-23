export type IntentType = 'send' | 'batch_send' | 'out_ramp' | 'bridge' | 'check_status' | 'check_balance' | 'get_rate' | 'help' | 'save_contact' | 'confirmation' | 'unknown';

export interface ParsedIntent {
  intentType: IntentType;
// ... (rest of interface remains همان)
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

  // 0. Confirmation (High Priority)
  if (lower === 'yes' || lower === 'confirm' || lower === 'proceed') {
    return { intentType: 'confirmation', amount: null, currency: null, recipient: null, targetCurrency: null, confirmed: true };
  }

  // 1. Batch Send
// ...
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

  // 2. Off-ramp / Remittance (e.g., "Withdraw 5000 NGN to 1234567890 at Kuda Bank")
  if (lower.includes('bank') || lower.includes('naira') || lower.includes('kes') || lower.includes('ngn') || lower.includes('shilling') || lower.includes('withdraw')) {
    const amountMatch = userInput.match(/([\d.]+)\s*(usdc|cusd|usd|ngn|kes)?/i);
    const accMatch = userInput.match(/(\d{10})/);
    // Refined bankMatch: Capture the bank name more cleanly
    const bankMatch = userInput.match(/(?:at|to|in)\s+([a-zA-Z0-9\s]{3,20})(?:\s+bank|$)/i);
    
    let bankName = bankMatch ? bankMatch[1].trim() : null;
    // Filter out common filler words
    const fillers = ['my', 'the', 'a', 'his', 'her', 'their'];
    if (bankName && fillers.includes(bankName.toLowerCase().split(' ')[0])) {
        // If the first word is a filler, try to take the rest or null it
        const split = bankName.split(' ');
        if (split.length > 1) bankName = split.slice(1).join(' ');
        else bankName = null;
    }

    let target = 'NGN';
    if (lower.includes('kes') || lower.includes('shilling')) target = 'KES';
    
    return {
      intentType: 'out_ramp',
      amount: amountMatch ? amountMatch[1] : null,
      currency: (amountMatch && amountMatch[2] ? amountMatch[2].toUpperCase() : 'USDC'),
      recipient: null,
      targetCurrency: target,
      accountNumber: accMatch ? accMatch[1] : null,
      bankName: bankName
    };
  }

  // 3. Bridge (e.g., "Bridge 5 USDC to Base 0x..." or "Bridge 0.5 to Solana [address]")
  const bridgeRegex = /bridge\s+([\d.]+)\s*(\w+)?(?:\s+from\s+(\w+))?\s+to\s+(\w+)(?:\s+([^\s,]+))?/i;
  const bridgeMatch = userInput.match(bridgeRegex);
  if (bridgeMatch) {
    return {
      intentType: 'send',
      amount: bridgeMatch[1],
      currency: (bridgeMatch[2] || 'USDC').toUpperCase(),
      recipient: bridgeMatch[5] || null,
      sourceChain: bridgeMatch[3] || 'Celo',
      targetChain: bridgeMatch[4],
      targetCurrency: null
    };
  }

  // 4. Save Contact (e.g., "Save 0x... as Mom")
  const saveMatch = userInput.match(/save\s+(0x[a-fA-F0-9]{40}|[a-zA-Z0-9]{32,44})\s+as\s+([a-zA-Z0-9\s]+)/i);
  if (saveMatch) {
    return {
      intentType: 'save_contact',
      amount: null,
      currency: null,
      recipient: saveMatch[1],
      contactName: saveMatch[2].trim(),
      targetCurrency: null
    };
  }

  // 5. Help
  if (lower.includes('help') || lower.includes('capabilities') || lower.includes('what can you do')) {
    return { intentType: 'help', amount: null, currency: null, recipient: null, targetCurrency: null };
  }

  // 6. Balance Check
  if (lower.includes('balance') || lower.includes('how much') || lower.includes('wallet')) {
    return { intentType: 'check_balance', amount: null, currency: null, recipient: null, targetCurrency: null };
  }

  // 7. Exchange Rate
  if (lower.includes('rate') || lower.includes('price') || lower.includes('exchange')) {
    return { intentType: 'get_rate', amount: null, currency: null, recipient: null, targetCurrency: null };
  }

  // 8. Simple Send
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
