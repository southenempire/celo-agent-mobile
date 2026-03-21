import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

// Import a snippet of the regex parsing logic since we can't easily import from the vite file directly here
function parseIntentWithRegex(userInput: string) {
  const lower = userInput.toLowerCase();

  // Remittance intent (Naira, Cedi, Shilling)
  const remittanceRegex = /send\s+([\d.]+)\s*(?:usd|usdc)?\s*(?:to|as)?\s*(naira|niara|cedi|shilling|ngn|kes|ghs)\s*(?:to)?\s*([\w\s0-9]+)/i;
  const remMatch = userInput.match(remittanceRegex);
  if (remMatch) {
    return {
      intentType: 'out_ramp',
      amount: remMatch[1],
      currency: remMatch[2].toUpperCase(),
      recipient: null,
      targetCurrency: remMatch[2].toUpperCase(),
      accountNumber: /^\d+$/.test(remMatch[3].trim()) ? remMatch[3].trim() : null,
      accountName: /^\d+$/.test(remMatch[3].trim()) ? null : remMatch[3].trim(),
    };
  }

  // Bridge intent
  const bridgeRegex = /(?:send|bridge)\s+([\d.]+)\s*(?:usdc|usd)?\s+from\s+(solana|base|ethereum)\s+(?:to\s+)?([\w\s0-9x...]+)/i;
  const bridgeMatch = userInput.match(bridgeRegex);
  if (bridgeMatch) {
    return {
      intentType: 'send',
      amount: bridgeMatch[1],
      currency: 'USDC',
      recipient: bridgeMatch[3].trim(),
      sourceChain: bridgeMatch[2].charAt(0).toUpperCase() + bridgeMatch[2].slice(1),
      targetChain: 'Celo',
    };
  }

  // Send intent (base case)
  const sendRegex = /send\s+([\d.]+)\s*(\w+)?\s+to\s+([\w\s0-9x]+)/i;
  const sendMatch = userInput.match(sendRegex);
  if (sendMatch) {
    return {
      intentType: 'send',
      amount: sendMatch[1],
      currency: (sendMatch[2] || 'USDC').toUpperCase(),
      recipient: sendMatch[3].trim(),
    };
  }

  return { intentType: 'unknown' };
}

const TEST_CASES = [
    "Send 5000 Naira to Mom",
    "Send 10 USDC from Solana to 0x123...",
    "Bridge 5 from Base to Celo",
    "Send 10 to Mom",
    "Send 5000 Naira to 1234567890"
];

async function runTests() {
    console.log("🚀 Starting Local Regex Verification...\n");
    for (const test of TEST_CASES) {
        console.log(`Input: "${test}"`);
        const result = parseIntentWithRegex(test);
        console.log(`Result: ${JSON.stringify(result, null, 2)}`);
        console.log("---");
    }
}

runTests();
