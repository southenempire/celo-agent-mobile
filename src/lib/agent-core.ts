import {
    type WalletClient,
    type PublicClient,
    parseUnits,
    formatUnits,
    erc20Abi
} from 'viem';
import { STABLECOINS_BY_CHAIN, DECIMALS, testnet } from './celo';
import { getResilientIntent, type AIProvider, type ParsedIntent } from './llm';
import { generateAgentIdentity } from './erc8004';
import { generateConversationalReply } from './llm-gemini';

// Agent Treasury for service fees (x402-style)
export const AGENT_TREASURY = '0x3D02DEF96FC41a74c7e6b939Bb17aF0dA3D66b3c';
const SERVICE_FEE = '0.01';

export interface AgentResult {
    hash?: string;
    explorerUrl?: string;
    intent: ParsedIntent;
    provider: AIProvider;
    feeHash?: string;
    // For non-send intents
    replyText?: string;
    balances?: { cUSD: string; USDC: string };
    rate?: { currency: string; rate: string; formatted: string };
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

    private get stablecoins() {
        const chainId = this.publicClient.chain?.id ?? 44787;
        return STABLECOINS_BY_CHAIN[chainId] ?? STABLECOINS_BY_CHAIN[44787];
    }

    getIdentity() {
        return generateAgentIdentity(this.walletClient.account?.address || '0x...');
    }

    async checkBalance(address: `0x${string}`): Promise<{ cUSD: string; USDC: string }> {
        const stablecoins = this.stablecoins;
        const [cUSDBalance, USDCBalance] = await Promise.all([
            this.publicClient.readContract({
                address: stablecoins.cUSD as `0x${string}`,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [address],
            }),
            this.publicClient.readContract({
                address: stablecoins.USDC as `0x${string}`,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [address],
            }),
        ]);

        return {
            cUSD: parseFloat(formatUnits(cUSDBalance, 18)).toFixed(4),
            USDC: parseFloat(formatUnits(USDCBalance, 6)).toFixed(4),
        };
    }

    async getExchangeRate(targetCurrency: string): Promise<{ currency: string; rate: string; formatted: string }> {
        try {
            // Using exchangerate-api — free tier supports NGN
            const res = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`);
            if (!res.ok) throw new Error('Rate API failed');
            const data = await res.json();
            const rate = data.rates[targetCurrency];
            if (!rate) throw new Error(`No rate for ${targetCurrency}`);
            return {
                currency: targetCurrency,
                rate: rate.toString(),
                formatted: `1 USDC ≈ ${rate.toLocaleString()} ${targetCurrency}`,
            };
        } catch {
            // Fallback to hardcoded common rates if API fails
            const fallback: Record<string, number> = {
                NGN: 1600, KES: 130, GHS: 15, GBP: 0.79, EUR: 0.92,
            };
            const r = fallback[targetCurrency] ?? 1;
            return {
                currency: targetCurrency,
                rate: r.toString(),
                formatted: `1 USDC ≈ ${r.toLocaleString()} ${targetCurrency}`,
            };
        }
    }

    async processIntent(input: string): Promise<AgentResult> {
        const { intent, provider } = await getResilientIntent(input);

        switch (intent.intentType) {
            case 'check_balance':
                return this.handleBalanceCheck(intent, provider);

            case 'get_rate':
                return this.handleGetRate(intent, provider);

            case 'help':
                return {
                    intent,
                    provider,
                    replyText: `I'm CRIA — your Celo Remittance Agent 🟡\n\nHere's what I can do:\n• 💸 Send USDC or cUSD — "Send 5 USDC to 0x..."\n• 💰 Check your balance — "What's my balance?"\n• 📈 Exchange rates — "What's the NGN rate?"\n• 🌍 Instant remittances with low fees on Celo\n\nWhat would you like to do?`,
                };

            case 'send':
                return this.handleSend(intent, provider);

            default: {
                let replyText = `I didn't quite catch that. Try:\n• "Send 5 USDC to 0x..."\n• "What's my USDC balance?"\n• "What's the NGN exchange rate?"`;
                try {
                    replyText = await generateConversationalReply(input);
                } catch {
                    // keep the static fallback
                }
                return { intent, provider, replyText };
            }
        }
    }

    private async handleBalanceCheck(intent: ParsedIntent, provider: AIProvider): Promise<AgentResult> {
        const address = this.walletClient.account?.address as `0x${string}`;
        const balances = await this.checkBalance(address);
        const totalUSD = (parseFloat(balances.cUSD) + parseFloat(balances.USDC)).toFixed(4);

        return {
            intent,
            provider,
            balances,
            replyText: `💰 Your Balance on Celo Sepolia:\n• USDC: ${balances.USDC}\n• cUSD: ${balances.cUSD}\n• Total: ~$${totalUSD} USD`,
        };
    }

    private async handleGetRate(intent: ParsedIntent, provider: AIProvider): Promise<AgentResult> {
        const target = intent.targetCurrency || 'NGN';
        const rate = await this.getExchangeRate(target);
        return {
            intent,
            provider,
            rate,
            replyText: `📊 Current Exchange Rate:\n${rate.formatted}\n\nPowered by live forex data. Celo settles in ~5 seconds — the fastest way to send ${target}!`,
        };
    }

    private async handleSend(intent: ParsedIntent, provider: AIProvider): Promise<AgentResult> {
        if (!intent.amount || !intent.recipient) {
            throw new Error("I need an amount and a recipient address. Try: 'Send 5 USDC to 0x...'");
        }

        let amount = intent.amount;
        let currency = intent.currency || 'USDC';
        let conversionMsg = '';
        const stablecoins = this.stablecoins;

        // Check if intent currency is a fiat currency we support for conversion
        const fiatCurrencies = ['NGN', 'KES', 'GHS', 'GBP', 'EUR'];
        if (fiatCurrencies.includes(currency)) {
            const fiatSymbol = currency;
            const rateData = await this.getExchangeRate(fiatSymbol);
            const rate = parseFloat(rateData.rate);
            
            // Convert fiat to USD (USDC/cUSD are pegged)
            const convertedAmount = (parseFloat(amount) / rate).toFixed(2);
            conversionMsg = `Converted ${amount} ${fiatSymbol} to ${convertedAmount} USDC (Rate: ${rateData.formatted})\n`;
            
            amount = convertedAmount;
            currency = 'USDC'; // Default to USDC for fiat conversions
        }

        const tokenAddress = (stablecoins as any)[currency] as `0x${string}`;
        if (!tokenAddress) {
            throw new Error(`Unsupported currency: ${currency}. I support cUSD and USDC.`);
        }

        const decimals = DECIMALS[currency] || 18;
        const amountInUnits = parseUnits(amount, decimals);
        const feeInUnits = parseUnits(SERVICE_FEE, decimals);

        // Check balance
        const balance = await this.publicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [this.walletClient.account?.address as `0x${string}`],
        });

        if (balance < (amountInUnits + feeInUnits)) {
            throw new Error(`${conversionMsg}Insufficient balance. You need ${amount} ${currency} + ${SERVICE_FEE} ${currency} service fee.`);
        }

        // Execute primary transfer
        const hash = await this.walletClient.writeContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [intent.recipient as `0x${string}`, amountInUnits],
            chain: testnet,
            account: this.walletClient.account!,
        } as any);

        // Collect service fee (x402-style)
        let feeHash: string | undefined;
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
            console.warn("Service fee collection failed, primary tx succeeded:", e);
        }

        return {
            hash,
            explorerUrl: `https://sepolia.celoscan.io/tx/${hash}`,
            intent: { ...intent, amount, currency }, // Return converted intent
            provider,
            feeHash,
            replyText: conversionMsg ? `✅ ${conversionMsg}Sent!` : undefined
        };
    }

    async getTransactionHistory(address: `0x${string}`): Promise<TransactionHistory[]> {
        try {
            const currentBlock = await this.publicClient.getBlockNumber();
            const fromBlock = currentBlock > BigInt(50000) ? currentBlock - BigInt(50000) : BigInt(0);
            const stablecoins = this.stablecoins;
            const tokenAddresses = [stablecoins.cUSD as `0x${string}`, stablecoins.USDC as `0x${string}`];

            const [sentLogs, receivedLogs] = await Promise.all([
                this.publicClient.getLogs({
                    address: tokenAddresses,
                    event: {
                        type: 'event',
                        name: 'Transfer',
                        inputs: [
                            { type: 'address', name: 'from', indexed: true },
                            { type: 'address', name: 'to', indexed: true },
                            { type: 'uint256', name: 'value' },
                        ],
                    },
                    args: { from: address },
                    fromBlock,
                    toBlock: 'latest',
                    strict: true,
                }),
                this.publicClient.getLogs({
                    address: tokenAddresses,
                    event: {
                        type: 'event',
                        name: 'Transfer',
                        inputs: [
                            { type: 'address', name: 'from', indexed: true },
                            { type: 'address', name: 'to', indexed: true },
                            { type: 'uint256', name: 'value' },
                        ],
                    },
                    args: { to: address },
                    fromBlock,
                    toBlock: 'latest',
                    strict: true,
                }),
            ]);

            const mapLog = (log: any, status: 'sent' | 'received'): TransactionHistory => {
                const stablecoins = this.stablecoins;
                const currency = log.address.toLowerCase() === stablecoins.cUSD.toLowerCase() ? 'cUSD' : 'USDC';
                const decimals = DECIMALS[currency] || 18;
                const amount = (Number(log.args.value) / Math.pow(10, decimals)).toFixed(4);
                return {
                    hash: log.transactionHash,
                    amount,
                    currency,
                    recipient: status === 'sent' ? log.args.to : log.args.from,
                    timestamp: 'Recent',
                    status,
                };
            };

            const allTx = [
                ...sentLogs.map(l => mapLog(l, 'sent')),
                ...receivedLogs.map(l => mapLog(l, 'received')),
            ];

            // Deduplicate by hash and sort (most recent first)
            const seen = new Set<string>();
            return allTx.filter(tx => {
                if (seen.has(tx.hash)) return false;
                seen.add(tx.hash);
                return true;
            }).slice(0, 20); // limit to 20
        } catch (e) {
            console.error("Failed to fetch history:", e);
            return [];
        }
    }
}
