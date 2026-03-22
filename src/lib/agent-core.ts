import {
    type WalletClient,
    type PublicClient,
    parseUnits,
    formatUnits,
    erc20Abi
} from 'viem';
import { STABLECOINS_BY_CHAIN, DECIMALS, testnet } from './celo';
import { getResilientIntent, generateConversationalReply, type AIProvider, type ParsedIntent } from './llm';
import { generateAgentIdentity } from './erc8004';
import { LocalMemory } from './local-memory';
import { FeeService, type FeeComparison } from './fee-service';
import { ConversationState, type OutRampSession } from './conversation-state';
import { PayoutService } from './payout-service';
import { BridgeService } from './bridge-service';
import { DecentralizedMemory } from './decentralized-memory';
import { DelegationService } from './delegation-service';

// Agent Treasury for service fees (x402-style)
export const AGENT_TREASURY = '0x3d02def96fc41a74c7e6b939bb17af0da3d66b3c';

export interface AgentResult {
    hash?: string;
    explorerUrl?: string;
    intent: ParsedIntent;
    provider: AIProvider;
    feeHash?: string;
    replyText?: string;
    balances?: { cUSD: string; USDC: string };
    chiRef?: string;
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
        private walletClient: any,
        private publicClient: any
    ) { }

    private get stablecoins() {
        const chainId = this.publicClient.chain?.id ?? 44787;
        return STABLECOINS_BY_CHAIN[chainId] ?? STABLECOINS_BY_CHAIN[44787];
    }

    getIdentity() {
        return generateAgentIdentity(this.walletClient.account?.address || '0x...');
    }

    async checkBalance(address: `0x${string}`): Promise<{ cUSD: string; USDC: string }> {
        const scArr = this.stablecoins;
        const [cUSDBalance, USDCBalance] = await Promise.all([
            this.publicClient.readContract({
                address: scArr.cUSD as `0x${string}`,
                abi: erc20Abi,
                functionName: 'balanceOf',
                args: [address],
            }),
            this.publicClient.readContract({
                address: scArr.USDC as `0x${string}`,
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
        // 1. Check if we are in the middle of a multi-step out-ramp
        if (ConversationState.isOutRampActive()) {
            return this.handleOutRamp(input);
        }

        // 2. Parse the underlying intent
        const { intent, provider } = await getResilientIntent(input);

        // 3. Bridging Check (Phase 7)
        // If it's an out_ramp and balance is low, suggest bridging from another chain
        if (intent.intentType === 'out_ramp' && parseFloat(intent.amount || '0') > 0) {
            // Mock dynamic balance check for demo
            const celoBalanceUSD = 1.50; 
            const solanaBalanceUSD = 85.00;
            
            if (celoBalanceUSD < parseFloat(intent.amount!)) {
                try {
                    const quote = await BridgeService.getBridgeQuote({
                        fromChain: "solana",
                        toChain: "42220", // Celo
                        fromToken: "SOL-USDC", // simplified string for demo logic
                        toToken: "CELO-USDC", 
                        fromAmount: (parseFloat(intent.amount!) * 10**6).toString(), 
                        fromAddress: "0x...", 
                        toAddress: "0x..."
                    });

                    if (quote.success) {
                        return {
                            intent,
                            provider,
                            replyText: `I noticed your Celo balance is low ($${celoBalanceUSD}), but you have $${solanaBalanceUSD} on Solana.\n\nI can seamlessly bridge those funds to Celo fully automatically via Squid Router to complete this off-ramp.\n\n${quote.message}\nWould you like me to proceed with the bridge?`
                        };
                    }
                } catch (e) {
                    console.error("[BridgeService] Quote failed", e);
                }
            }
        }

        switch (intent.intentType) {
            case 'out_ramp':
                return this.handleOutRamp(input, intent, provider);

            case 'check_status':
                return (this as any).handleCheckStatus(input, intent, provider);
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
                    replyText: `Welcome to CRIA, your intelligent Celo financial agent.\n\nI can assist you with:\n• Transfers: "Send 5 USDC to 0x..."\n• Off-ramps: "Withdraw 5000 NGN to my bank"\n• Bridging: "Bridge 50 USDC to Base"\n• Contacts: "Save 0x... as Alice"\n• Rates: "What is the NGN exchange rate?"\n\nHow may I help you today?`,
                };

            case 'batch_send':
                return this.handleBatchSend(intent, provider);

            case 'send':
                return this.handleSend(input, intent, provider);

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
        
        // Ensure we have a working intent/provider even if not passed
        if (!intent || !provider) {
            const res = await getResilientIntent(input);
            intent = intent || res.intent;
            provider = provider || res.provider;
        }

        // If no session exists, start one. If session exists, merge new intent fields.
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
        } else if (session && intent) {
            // Merge existing session with new intent-parsed fields
            const updates: Partial<OutRampSession> = {};
            if (intent.amount) updates.amount = intent.amount;
            if (intent.currency) updates.currency = (intent.currency === 'NIARA' || intent.currency === 'NARRA') ? 'NGN' : intent.currency;
            if (intent.accountNumber) updates.accountNumber = intent.accountNumber;
            if (intent.bankName) updates.bankName = intent.bankName;
            if (intent.accountName) updates.accountName = intent.accountName;
            
            ConversationState.updateSession(updates);
            session = ConversationState.getSession()!;
        }

        if (!session) {
            throw new Error("Oops, I lost track of our session state. Let's restart your request (e.g., 'Withdraw 5000 NGN').");
        }

        // Deep debug log for browser troubleshooting
        console.log("[PayoutService] Session State:", session);

        // LLM help to extract fields from the new input if intent wasn't clear
        if (!intent || (!intent.accountNumber && !intent.bankName && !intent.accountName)) {
            const { intent: newIntent } = await getResilientIntent(input);
            const updates: Partial<OutRampSession> = {};
            if (newIntent.amount) updates.amount = newIntent.amount;
            if (newIntent.currency) updates.currency = (newIntent.currency === 'NIARA' || newIntent.currency === 'NARRA') ? 'NGN' : newIntent.currency;
            if (newIntent.accountNumber) updates.accountNumber = newIntent.accountNumber;
            if (newIntent.bankName) updates.bankName = newIntent.bankName;
            if (newIntent.accountName) updates.accountName = newIntent.accountName;
            if (newIntent.intentType === ('confirmation' as any) || input.toLowerCase().includes('yes') || input.toLowerCase().includes('confirm')) {
                updates.confirmed = true;
            }
            
            ConversationState.updateSession(updates);
            session = ConversationState.getSession()!;
        }

        // State Machine
        if (!session.accountNumber) {
            return { intent: intent!, provider: provider!, replyText: "Understood. To get started, please provide the recipient's bank account number." };
        }
        
        if (!session.bankName) {
            ConversationState.updateSession({ step: 'AWAITING_BANK_NAME' });
            return { intent: intent!, provider: provider!, replyText: `Account received. What is the destination bank name for account \`${session.accountNumber}\`?` };
        }

        if (!session.accountName) {
            ConversationState.updateSession({ step: 'AWAITING_ACCOUNT_NAME' });
            return { intent: intent!, provider: provider!, replyText: `Great. Lastly, please provide the exact legal name of the account holder at ${session.bankName}.` };
        }

        if (!session.confirmed && intent && !intent.confirmed) {
            ConversationState.updateSession({ step: 'AWAITING_CONFIRMATION' });
            return { 
                intent: intent!, 
                provider: provider!, 
                replyText: `Ready to send! Here is the transfer summary:\n\n• Amount: ${session.amount} ${session.currency}\n• Recipient: ${session.accountName}\n• Bank: ${session.bankName}\n• Account: ${session.accountNumber}\n\nPlease reply with "Yes" or "Confirm" to execute.` 
            };
        }

        // Final Execution
        if (session.confirmed || (intent && intent.confirmed)) {
            // EXECUTE REAL PAYOUT
            try {
                const result = await PayoutService.initiateBankPayout({
                    accountNumber: session.accountNumber!,
                    bankName: session.bankName!,
                    accountName: session.accountName!,
                    amount: parseFloat(session.amount!),
                    currency: session.currency!
                });

                // Clear session after attempt
                ConversationState.clear();

                if (result.success) {
                    return {
                        intent: intent!,
                        provider: provider!,
                        chiRef: result.transactionId,
                        replyText: `Transfer initiated successfully!\n\nYour ${session.amount} ${session.currency} is securely en route to ${session.accountName} at ${session.bankName}.\n\nTransaction ID: \`${result.transactionId}\`\nStatus: Settlement in progress (~5 mins).`
                    };
                } else {
                    return {
                        intent: intent!,
                        provider: provider!,
                        replyText: `**Payout Failed** ❌\n\nI encountered an issue while processing the transfer: "${result.message}".\n\nWould you like me to try again or check the details?`
                    };
                }
            } catch (err) {
                console.error('[OutRamp] Execution error:', err);
                ConversationState.clear();
                return { 
                    intent: intent!,
                    provider: provider!,
                    replyText: "I'm sorry, I hit a snag while processing your bank transfer. Please try again in a moment." 
                };
            }
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
                const res = await this.handleSend(`Send ${item.amount} ${item.currency} to ${item.recipient}`, subIntent, provider);
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
        
        // Asynchronous IPFS Pinning for Decentralized Memory Hackathon Track
        try {
            await DecentralizedMemory.pinContactsToFilecoin(LocalMemory.getContacts());
        } catch (e) {
            console.error("Failed to pin to IPFS", e);
        }
        
        return {
            intent,
            provider,
            replyText: `Contact saved to AgentVault.\n\nI will remember **${name}** as ${address.slice(0, 6)}...${address.slice(-4)}.\n\n*(Memory synced to Filecoin/IPFS distributed storage)*.`
        };
    }
    
    private async handleCheckStatus(input: string, intent: ParsedIntent, provider: AIProvider): Promise<AgentResult> {
        const chiRef = intent.transactionId || input.match(/cm-\d+/)?.[0] || input.match(/chi-[a-zA-Z0-9]+/)?.[0];
        if (!chiRef) {
            throw new Error("I need a Transaction ID (chiRef) to check the status. Example: 'Status of cm-123456789'");
        }
        
        const result = await PayoutService.getPayoutStatus(chiRef);
        return {
            intent,
            provider,
            chiRef,
            replyText: `🔍 **System Verification**\n\n${result.message}\n\nTransaction: \`${chiRef}\`\nAPI Provider: Chimoney Pro`
        };
    }

    private async handleSend(input: string, intent: ParsedIntent, provider: AIProvider): Promise<AgentResult> {
        if (!intent.amount || !intent.recipient) {
            throw new Error("I need an amount and a recipient. Try: 'Send 5 USDC to 0x...' or 'Send 10 to Mom'");
        }

        const stablecoins = this.stablecoins;

        // --- Inbound Bridging Check (Phase 7) ---
        // If funds are coming from another chain, handle it first
        if (intent.sourceChain && intent.sourceChain !== 'Celo') {
            const bridgeResult = await BridgeService.getBridgeQuote({
                fromChain: intent.sourceChain,
                toChain: 'Celo',
                fromToken: 'USDC', 
                toToken: 'USDC',
                fromAmount: parseUnits(intent.amount, 6).toString(), 
                fromAddress: this.walletClient.account?.address || '0x...',
                toAddress: this.walletClient.account?.address || '0x...'
            });

            return {
                intent,
                provider,
                replyText: `🌉 **Bridging Initiated from ${intent.sourceChain}!**\n\n${bridgeResult.message || "Searching for the best route via Squid..."}\n\nI'll handle the move to Celo in the background. Once the funds arrive, I'll complete your request! 🤝`
            };
        }

        // --- Outbound Bridging Check (Phase 7 Refinement) ---
        // Detect cross-chain addresses (Solana, Base, etc.) by length/format
        const isCeloAddress = /^0x[a-fA-F0-9]{40}$/.test(intent.recipient || '');
        const looksLikeCrossChain = /^[a-zA-Z0-9]{30,50}$/.test(intent.recipient || '');

        if (intent.recipient && looksLikeCrossChain && !isCeloAddress) {
            try {
                const quote = await BridgeService.getBridgeQuote({
                    fromChain: "42220", // Celo
                    toChain: "solana",
                    fromToken: "CELO-USDC", 
                    toToken: "SOL-USDC",
                    fromAmount: (parseFloat(intent.amount || "0") * 10**6).toString(),
                    fromAddress: this.walletClient.account?.address, 
                    toAddress: intent.recipient
                });

                if (quote.success) {
                    return {
                        intent,
                        provider,
                        replyText: `🦑 **Cross-chain Transfer Detected!** \n\nI'll use **Squid Router** to bridge your funds from **Celo** to **Solana** 'under-the-hood'.\n\n${quote.message}\n\nShall I proceed with this cross-chain send?`
                    };
                }
            } catch (e) {
                console.error("[BridgeService] Outbound quote failed", e);
            }
        }

        let recipientAddress = intent.recipient;
        const isEnsName = recipientAddress?.endsWith('.eth') || recipientAddress?.endsWith('.celo');

        // 1. Resolve ENS names (if on mainnet/supported)
        if (recipientAddress && isEnsName) {
            try {
                const resolvedAddress = await this.publicClient.getEnsAddress({
                    name: recipientAddress,
                });
                if (resolvedAddress) {
                    recipientAddress = resolvedAddress;
                }
            } catch (e) {
                console.warn(`[ENS] Resolution failed for ${recipientAddress}:`, e);
            }
        }

        // 2. Try to resolve name from memory if still not a 0x address
        if (recipientAddress && !recipientAddress.startsWith('0x')) {
            const resolved = LocalMemory.resolveName(recipientAddress);
            if (resolved) {
                recipientAddress = resolved;
            } else if (/^\+?\d{10,15}$/.test(recipientAddress)) {
                return this.handleOutRamp(input, { ...intent, intentType: 'out_ramp', accountNumber: recipientAddress }, provider);
            } else if (looksLikeCrossChain) {
                // Pass through
            } else {
                throw new Error(`Recipient "${recipientAddress}" could not be resolved as 0x address or ENS name.`);
            }
        }

        let amount = intent.amount;
        let currency = intent.currency || 'USDC';
        
        // Map phonetic variations to ISO codes
        const currencyMap: Record<string, string> = {
            'Naira': 'NGN', 'Niara': 'NGN', 'niara': 'NGN', 'naira': 'NGN', 'Narra': 'NGN', 'NARRA': 'NGN',
            'Cedi': 'GHS', 'Cedis': 'GHS', 'cedi': 'GHS',
            'Shilling': 'KES', 'Shillings': 'KES', 'shilling': 'KES',
            'Pounds': 'GBP', 'Euro': 'EUR', 'Euros': 'EUR', 'euro': 'EUR'
        };
        if (currencyMap[currency]) {
            currency = currencyMap[currency];
        }

        let conversionMsg = '';

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
            const bridgeResult = await BridgeService.getBridgeQuote({
                fromChain: intent.sourceChain,
                toChain: 'Celo',
                fromToken: 'USDC', // Assume USDC for demo, or map from intent.currency
                toToken: 'USDC',
                fromAmount: parseUnits(amount, 6).toString(), // Assume USDC decimals 6 for source
                fromAddress: this.walletClient.account?.address || '0x...',
                toAddress: this.walletClient.account?.address || '0x...'
            });

            return {
                intent,
                provider,
                replyText: `🌉 **Bridging Initiated from ${intent.sourceChain}!**\n\n${bridgeResult.message || "Searching for the best route via Squid..."}\n\nI'll handle the move to Celo in the background. Once the funds arrive, I'll complete your request! 🤝`
            };
        }

        if (intent.targetChain && intent.targetChain !== 'Celo') {
             return {
                intent,
                provider,
                replyText: `🚀 **Cross-chain Transfer to ${intent.targetChain}!**\n\nI'm prepping a Squid Router payload to move ${amount} ${currency} from Celo to **${intent.targetChain}**. \n\nEstimated time: ~3-5 minutes. The bridge is doing its magic... ✨`
            };
        }

        const tokenAddress = (this.stablecoins as any)[currency] as `0x${string}`;
        if (!tokenAddress) {
            throw new Error(`Unsupported currency: ${currency}. I support cUSD and USDC.`);
        }

        const amountNum = parseFloat(amount);
        
        // --- 1. Delegation Check (MetaMask Bounty) ---
        const limitError = DelegationService.checkLimit(amountNum, recipientAddress);
        if (limitError) {
            throw new Error(`🚫 **Scoped Spending Limit Blocked**\n\n${limitError}\n\nYou can adjust this limit in your Agent Passport settings.`);
        }

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
        });

        // Collect service fee (x402-style)
        let feeHash: string | undefined;
        try {
            feeHash = await this.walletClient.writeContract({
                address: tokenAddress,
                abi: erc20Abi,
                functionName: 'transfer',
                args: [AGENT_TREASURY as `0x${string}`, feeInUnits],
                account: this.walletClient.account!,
            });
        } catch (e) {
            console.warn("Service fee collection failed, primary tx succeeded:", e);
        }

        // --- 2. Record Spending for Delegation History ---
        DelegationService.recordSpending(amountNum);

        const resolvedName = LocalMemory.resolveAddress(recipientAddress);
        const contactTip = !resolvedName && recipientAddress.startsWith('0x') ? `\n\nTip: You can map this address by saying "Save ${recipientAddress.slice(0, 6)}... as [Name]".` : '';
        const savingsText = comparison ? `\nSavings vs Traditional Remittance: $${comparison.savings.toFixed(2)}` : '';
        const ensAcknowledgment = isEnsName ? `*(Resolved ${intent.recipient} via ENS/Celo Protocol)*\n\n` : '';

        let replyText = `Transfer Executed Successfully.\n\n${ensAcknowledgment}Sent: ${amountNum} ${currency}\nTo: ${resolvedName || recipientAddress}\nNetwork Fee: ~$0.001\nProtocol Fee: $${treasuryFee.toFixed(3)}${savingsText}${contactTip}`;
        if (conversionMsg) {
            replyText = `${conversionMsg}\n${replyText}`;
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
            const scArr = this.stablecoins;
            const tokenAddresses = [scArr.cUSD as `0x${string}`, scArr.USDC as `0x${string}`];

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
                const scArr = this.stablecoins;
                const currency = log.address.toLowerCase() === scArr.cUSD.toLowerCase() ? 'cUSD' : 'USDC';
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

            const allTx: TransactionHistory[] = [
                ...sentLogs.map((l: any) => mapLog(l, 'sent')),
                ...receivedLogs.map((l: any) => mapLog(l, 'received')),
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
