import {
    type WalletClient,
    type PublicClient,
    parseUnits,
    erc20Abi
} from 'viem';
import { STABLECOINS, DECIMALS, testnet } from './celo';
import { getResilientIntent, type AIProvider } from './llm';
import { generateAgentIdentity } from './erc8004';

// Agent Treasury for service fees
const AGENT_TREASURY = '0x3D02DEF96FC41a74c7e6b939Bb17aF0dA3D66b3c';
const SERVICE_FEE = '0.01';

export interface AgentResult {
    hash: string;
    explorerUrl: string;
    intent: {
        amount: string;
        currency: string;
        recipient: string;
    };
    provider: AIProvider;
    feeHash?: string;
}

export interface TransactionHistory {
    hash: string;
    amount: string;
    currency: string;
    recipient: string;
    timestamp: string;
    status: 'sent' | 'received';
}

export class CeloAgent {
    constructor(
        private walletClient: WalletClient,
        private publicClient: PublicClient
    ) { }

    getIdentity() {
        return generateAgentIdentity(this.walletClient.account?.address || '0x...');
    }

    async processIntent(input: string): Promise<AgentResult> {
        // 1. Get Resilient Intent (OpenAI -> Gemini -> Regex)
        const { intent, provider } = await getResilientIntent(input);

        if (!intent || !intent.amount || !intent.recipient) {
            throw new Error("I couldn't quite understand that. Please use a format like 'Send 10 USDC to 0x...'");
        }

        const tokenAddress = (STABLECOINS as any)[intent.currency] as `0x${string}`;
        if (!tokenAddress) {
            throw new Error(`Unsupported currency: ${intent.currency}. I currently support cUSD and USDC.`);
        }

        const decimals = DECIMALS[intent.currency] || 18;
        const amountInUnits = parseUnits(intent.amount, decimals);
        const feeInUnits = parseUnits(SERVICE_FEE, decimals);

        // 2. Check balance
        const balance = await this.publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [this.walletClient.account?.address as `0x${string}`],
        });

        if (balance < (amountInUnits + feeInUnits)) {
            throw new Error(`Insufficient balance for amount + service fee (${SERVICE_FEE} ${intent.currency}).`);
        }

        // 3. Execute Primary Transfer
        const hash = await this.walletClient.writeContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [intent.recipient as `0x${string}`, amountInUnits],
            chain: testnet,
            account: this.walletClient.account!,
        } as any);

        // 4. Collect Service Fee (x402 style)
        let feeHash;
        try {
            feeHash = await this.walletClient.writeContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'transfer',
                args: [AGENT_TREASURY as `0x${string}`, feeInUnits],
                chain: testnet,
                account: this.walletClient.account!,
            } as any);
        } catch (e) {
            console.warn("Service fee collection failed, but primary tx succeeded:", e);
        }

        return {
            hash,
            explorerUrl: `https://sepolia.celoscan.io/tx/${hash}`,
            intent,
            provider,
            feeHash
        };
    }

    async getTransactionHistory(address: `0x${string}`): Promise<TransactionHistory[]> {
        try {
            const logs = await this.publicClient.getLogs({
                address: [STABLECOINS.cUSD as `0x${string}`, STABLECOINS.USDC as `0x${string}`],
                event: {
                    type: 'event',
                    name: 'Transfer',
                    inputs: [
                        { type: 'address', name: 'from', indexed: true },
                        { type: 'address', name: 'to', indexed: true },
                        { type: 'uint256', name: 'value' },
                    ],
                },
                args: {
                    from: address,
                },
                fromBlock: 'latest', // For demo, usually we'd go back N blocks or use an indexer
                strict: true,
            });

            return logs.map((log: any) => {
                const currency = log.address.toLowerCase() === STABLECOINS.cUSD.toLowerCase() ? 'cUSD' : 'USDC';
                const decimals = DECIMALS[currency] || 18;
                const amount = (Number(log.args.value) / Math.pow(10, decimals)).toFixed(2);

                return {
                    hash: log.transactionHash,
                    amount,
                    currency,
                    recipient: log.args.to,
                    timestamp: 'Just now',
                    status: 'sent' as const,
                };
            }).reverse();
        } catch (e) {
            console.error("Failed to fetch history:", e);
            return [];
        }
    }
}
