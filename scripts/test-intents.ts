
function parseIntentWithRegex(userInput: string) {
  const lower = userInput.toLowerCase();

  // Bridge intent (Highest priority)
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

  // Remittance / Out-ramp intent (Naira, Cedi, Shilling, EUR, GBP)
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

  return { intentType: 'unknown' };
}

const TEST_CASES = [
    "Send 5000 Naira to Mom",
    "Send 10 USDC from Solana to AUpmAvbCTQQ7meNKZBFxUMSoupE5GLrtVhMXbDaBmfyW",
    "Withdraw 5000 NGN to 9854748374 bank Paystack-Titan name Charles Duke Alaba"
];

function runTests() {
    console.log("🚀 Starting Local Regex Verification...\n");
    for (const test of TEST_CASES) {
        console.log(`Input: "${test}"`);
        const result = parseIntentWithRegex(test);
        console.log(`Result: ${JSON.stringify(result, null, 2)}`);
        console.log("---");
    }
}

runTests();
