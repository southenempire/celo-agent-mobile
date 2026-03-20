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
import { LocalMemory } from './local-memory';
import { FeeService, type FeeComparison } from './fee-service';
import { ConversationState } from './conversation-state';

// Agent Treasury for service fees (x402-style)
export const AGENT_TREASURY = '0x3D02DEF96FC41a74c7e6b939Bb17aF0dA3D66b3c';

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
    comparison?: FeeComparison;
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
        // First check if we are in the middle of a multi-step out-ramp
        if (ConversationState.isOutRampActive()) {
            return this.handleOutRamp(input);
        }

        const { intent, provider } = await getResilientIntent(input);

        switch (intent.intentType) {
            case 'out_ramp':
                return this.handleOutRamp(input, intent, provider);
            case 'check_balance':
                return this.handleBalanceCheck(intent, provider);

            case 'get_rate':
                return this.handleGetRate(intent, provider);

            case 'save_contact':
                return this.handleSaveContact(intent, provider);

            case 'help':
                return {
                    intent,
                    provider,
                    replyText: `Hey there! 🟡 I'm CRIA, your friendly Celo finance buddy.\n\nI can help you with:\n• 💸 **Sending**: "Send 5 USDC to Mom"\n• 👯 **Batching**: "Send 1 to Mom and 2 to Sister"\n• 📖 **Address Book**: "Remember 0x... as Brother"\n• 💰 **Balances**: "What's in my wallet?"\n• 📈 **Rates**: "What's the NGN exchange rate?"\n\nHow can I help you today?`,
                };

            case 'batch_send':
                return this.handleBatchSend(intent, provider);

            case 'send':
                return this.handleSend(intent, provider);

            default: {
                let replyText = `I'm sorry, I didn't quite catch that! 😅 Could you try saying it a bit differently? Maybe "Send 5 USDC to Mom" or "Save 0x... as Dad"?`;
                try {
                    replyText = await generateConversationalReply(input);
                } catch {
                    // keep the friendly fallback
                }
                return { intent, provider, replyText };
            }
        }
    }

    private async handleOutRamp(input: string, intent?: ParsedIntent, provider?: AIProvider): Promise<AgentResult> {
        let session = ConversationState.getSession();

        // If no session exists, start one
        if (!session && intent) {
            session = {
                amount: intent.amount || null,
                currency: intent.currency || null,
                accountNumber: intent.accountNumber || null,
                bankName: intent.bankName || null,
                accountName: intent.accountName || null,
                confirmed: false,
                step: 'AWAITING_ACCOUNT_NUMBER'
            };
            ConversationState.setSession(session);
        }

        if (!session) {
            throw new Error("I lost track of our conversation! 😅 Let's start over. Try 'Send $10 to Naira'.");
        }

        // LLM help to extract fields from the new input if we are in a session
        if (!intent) {
            const { intent: newIntent, provider: p } = await getResilientIntent(input);
            intent = newIntent;
            provider = p;
            
            // Update session with any new fields discovered
            ConversationState.updateSession({
                accountNumber: intent.accountNumber || session.accountNumber,
                bankName: intent.bankName || session.bankName,
                accountName: intent.accountName || session.accountName,
                confirmed: intent.confirmed ?? session.confirmed
            });
            session = ConversationState.getSession()!;
        }

        // State Machine
        if (!session.accountNumber) {
            return { intent: intent!, provider: provider!, replyText: "Got it! 💸 Please provide the **account number** for the transfer." };
        }
        
        if (!session.bankName) {
            ConversationState.updateSession({ step: 'AWAITING_BANK_NAME' });
            return { intent: intent!, provider: provider!, replyText: `Thanks! Now, what is the **bank name** for account ${session.accountNumber}?` };
        }

        if (!session.accountName) {
            ConversationState.updateSession({ step: 'AWAITING_ACCOUNT_NAME' });
            return { intent: intent!, provider: provider!, replyText: `Almost there! Who is the **account holder** (name) at ${session.bankName}?` };
        }

        if (!session.confirmed && !intent.confirmed) {
            ConversationState.updateSession({ step: 'AWAITING_CONFIRMATION' });
            return { 
                intent: intent!, 
                provider: provider!, 
                replyText: `🚀 **Ready to Send!**\n\n• **Amount**: ${session.amount} ${session.currency}\n• **To**: ${session.accountName}\n• **Bank**: ${session.bankName}\n• **Acc #**: ${session.accountNumber}\n\nShall I proceed? (Say "Yes" or "Confirm")` 
            };
        }

        // Final Execution
        if (session.confirmed || intent.confirmed) {
            ConversationState.clear();
            const res = await this.handleSend({
                ...intent!,
                intentType: 'send',
                amount: session.amount,
                currency: session.currency,
                recipient: AGENT_TREASURY // In a real out-ramp, this goes to a bridge/ramp address
            }, provider!);
            
            return {
                ...res,
                replyText: `✅ **Transfer Initiated!**\nYour ${session.amount} ${session.currency} is on its way to ${session.accountName}'s bank account at ${session.bankName}.\n\nEstimated arrival: 30-60 minutes. 🏦💨`
            };
        }

        return { intent: intent!, provider: provider!, replyText: "I'm a bit confused. Should I proceed with the transfer? (Yes/No)" };
    }

    private async handleBatchSend(intent: ParsedIntent, provider: AIProvider): Promise<AgentResult> {
        if (!intent.batch || intent.batch.length === 0) {
            throw new Error("I couldn't find any recipients in your batch request. Try: 'Send 5 to Mom and 10 to Sister'");
        }

        const results = [];
        let totalSavings = 0;
        let totalTraditionalFee = 0;

        for (const item of intent.batch) {
            try {
                // We reuse handleSend logic for each item
                const subIntent: ParsedIntent = {
                    ...intent,
                    intentType: 'send',
                    amount: item.amount,
                    currency: item.currency,
                    recipient: item.recipient,
                    batch: null
                };
                const res = await this.handleSend(subIntent, provider);
                results.push(res);
                if (res.comparison) {
                    totalSavings += res.comparison.savings;
                    totalTraditionalFee += res.comparison.traditionalFee;
                }
            } catch (e: any) {
                console.error(`Batch item failed: ${item.recipient}`, e);
            }
        }

        if (results.length === 0) {
            throw new Error("All transfers in the batch failed. Please check your balances!");
        }

        const successCount = results.length;
        const totalSent = intent.batch.length;
        
        return {
            intent,
            provider,
            hash: results[0].hash, // Show first hash
            comparison: {
                criaFee: 0.01 * successCount,
                traditionalFee: totalTraditionalFee,
                savings: totalSavings,
                savingsPercent: (totalSavings / totalTraditionalFee) * 100
            },
            replyText: `🚀 **Batch Sent!**\nSuccessfully sent ${successCount} of ${totalSent} transfers.\n\nYou just saved a total of **$${totalSavings.toFixed(2)}** compared to Western Union! 🥳`
        };
    }

    private async handleBalanceCheck(intent: ParsedIntent, provider: AIProvider): Promise<AgentResult> {
        const address = this.walletClient.account?.address as `0x${string}`;
        const balances = await this.checkBalance(address);
        const totalUSD = (parseFloat(balances.cUSD) + parseFloat(balances.USDC)).toFixed(4);

        return {
            intent,
            provider,
            balances,
            replyText: `💰 Your Balance on Celo:\n• USDC: ${balances.USDC}\n• cUSD: ${balances.cUSD}\n• Total: ~$${totalUSD} USD`,
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

    private async handleSaveContact(intent: ParsedIntent, provider: AIProvider): Promise<AgentResult> {
        const name = (intent as any).contactName;
        const address = intent.recipient;

        if (!name || !address || !address.startsWith('0x')) {
            throw new Error("I need a name and a valid 0x address to save a contact. Try: 'Save 0x... as Mom'");
        }

        LocalMemory.saveContact(name, address);
        return {
            intent,
            provider,
            replyText: `💾 Contact Saved!\nI'll remember **${name}** as ${address.slice(0, 6)}...${address.slice(-4)}.\n\nYou can now say "Send 10 USDC to ${name}".`
        };
    }

    private async handleSend(intent: ParsedIntent, provider: AIProvider): Promise<AgentResult> {
        if (!intent.amount || !intent.recipient) {
            throw new Error("I need an amount and a recipient. Try: 'Send 5 USDC to 0x...' or 'Send 10 to Mom'");
        }

        let recipientAddress = intent.recipient;
        // Try to resolve name from memory
        if (!recipientAddress.startsWith('0x')) {
            const resolved = LocalMemory.resolveName(recipientAddress);
            if (!resolved) {
                throw new Error(`Aww, I don't know who "${recipientAddress}" is yet! 🥺\n\nYou can teach me by saying "Remember 0x... as ${recipientAddress}". I have a great memory!`);
            }
            recipientAddress = resolved;
        }

        let amount = intent.amount;
        let currency = intent.currency || 'USDC';
        
        // Map phonetic variations to ISO codes
        const currencyMap: Record<string, string> = {
            'Naira': 'NGN', 'Niara': 'NGN', 'niara': 'NGN',
            'Cedi': 'GHS', 'Cedis': 'GHS',
            'Shilling': 'KES', 'Shillings': 'KES',
            'Pounds': 'GBP', 'Euro': 'EUR', 'Euros': 'EUR'
        };
        if (currencyMap[currency]) {
            currency = currencyMap[currency];
        }

        let conversionMsg = '';
        const stablecoins = this.stablecoins;

        // Check if intent currency is a fiat currency we support for conversion
        const fiatCurrencies = ['NGN', 'KES', 'GHS', 'GBP', 'EUR', 'USD'];
        let comparison: FeeComparison | undefined;

        if (fiatCurrencies.includes(currency)) {
            const fiatSymbol = currency === 'USD' ? 'GBP' : currency; // Small hack for generic USD if needed
            const rateData = await this.getExchangeRate(currency === 'USD' ? 'NGN' : currency); 
            const rate = parseFloat(rateData.rate);
            
            // If it's USD, rate is 1. If not, convert.
            const usdAmount = currency === 'USD' ? parseFloat(amount) : (parseFloat(amount) / rate);
            const convertedAmount = usdAmount.toFixed(2);
            
            if (currency !== 'USD') {
                conversionMsg = `Converted ${amount} ${currency} to ${convertedAmount} USDC (Rate: ${rateData.formatted})\n`;
            }
            
            comparison = FeeService.getComparison(usdAmount, currency);
            
            amount = convertedAmount;
            currency = 'USDC'; // Default to USDC for fiat conversions
        } else if (currency === 'USDC' || currency === 'cUSD') {
            comparison = FeeService.getComparison(parseFloat(amount), 'USD');
        }

        // Handle invisible bridging
        if (intent.sourceChain && intent.sourceChain !== 'Celo') {
            return {
                intent,
                provider,
                replyText: `🌉 **Bridging Initiated!**\nI'm reaching out to **${intent.sourceChain}** to move your ${amount} ${currency} to Celo. \n\nThis will happen in the background. I'll let you know as soon as the funds arrive! 🤝`
            };
        }

        if (intent.targetChain && intent.targetChain !== 'Celo') {
             return {
                intent,
                provider,
                replyText: `🚀 **Cross-chain Transfer!**\nI'm sending ${amount} ${currency} from Celo to **${intent.targetChain}**. \n\nSit tight! The bridge is doing its magic... ✨`
            };
        }

        const tokenAddress = (stablecoins as any)[currency] as `0x${string}`;
        if (!tokenAddress) {
            throw new Error(`Unsupported currency: ${currency}. I support cUSD and USDC.`);
        }

        const amountNum = parseFloat(amount);
        const treasuryFee = amountNum * 0.005; // 0.5% fee
        const SERVICE_FEE = treasuryFee.toString();
        
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
            args: [recipientAddress as `0x${string}`, amountInUnits],
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
                account: this.walletClient.account!,
            } as any);
        } catch (e) {
            console.warn("Service fee collection failed, primary tx succeeded:", e);
        }

        const resolvedName = LocalMemory.resolveAddress(recipientAddress);
        const savingsText = comparison ? `\n\nYou just saved **$${comparison.savings.toFixed(2)}** compared to Western Union! 🥳` : '';

        let replyText = `✅ **Sent ${amountNum} ${currency} to ${resolvedName || recipientAddress.slice(0, 8)}...**\n\nA tiny **$${treasuryFee.toFixed(2)}** service fee was added to support the CRIA Treasury. 💛\n\nTotal Fee: $${(treasuryFee + 0.001).toFixed(3)} (Still way cheaper than Western Union!)${savingsText}`;
        if (conversionMsg) {
            replyText = `✅ ${conversionMsg}${replyText}`;
        }

        return {
            hash,
            explorerUrl: `https://celoscan.io/tx/${hash}`,
            intent: { ...intent, amount, currency, recipient: recipientAddress }, // Return converted intent
            provider,
            comparison,
            replyText
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
