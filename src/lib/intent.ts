import { parseUnits } from 'viem';

export interface RemittanceIntent {
    amount: string;
    currency: string;
    recipient: `0x${string}`;
}

/**
 * Parses user input into a RemittanceIntent.
 * In a production agent, this would call an LLM (OpenAI/Anthropic).
 * For this demo, we'll use a regex-based parser.
 */
export function parseIntent(input: string): RemittanceIntent | null {
    // Example: "Send 10 cUSD to 0x123..."
    const regex = /send\s+([\d.]+)\s+(\w+)\s+to\s+(0x[a-fA-f0-9]{40})/i;
    const match = input.match(regex);

    if (match) {
        return {
            amount: match[1],
            currency: match[2].toUpperCase(),
            recipient: match[3] as `0x${string}`,
        };
    }

    return null;
}
