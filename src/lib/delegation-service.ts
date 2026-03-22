/**
 * DelegationService handles programmable spending limits and rules.
 * Aligns with MetaMask Delegation Toolkit / Smart Accounts.
 */

export interface SpendingRules {
    maxPerTransaction: number; // in USD/USDC
    dailyLimit: number;       // in USD/USDC
    approvedRecipients: string[]; // 0x addresses
    autoApproveUnder: number;  // Amount below which no manual confirmation is needed
}

const DEFAULT_RULES: SpendingRules = {
    maxPerTransaction: 50,
    dailyLimit: 200,
    approvedRecipients: [],
    autoApproveUnder: 5
};

export class DelegationService {
    private static STORAGE_KEY = 'cria_delegation_rules';
    private static HISTORY_KEY = 'cria_spending_history';

    static getRules(): SpendingRules {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        return stored ? JSON.parse(stored) : DEFAULT_RULES;
    }

    static updateRules(rules: Partial<SpendingRules>) {
        const current = this.getRules();
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ ...current, ...rules }));
    }

    /**
     * Checks if a transaction is allowed under current delegation rules.
     * Returns a reason if blocked, otherwise null.
     */
    static checkLimit(amountUSD: number, recipient: string): string | null {
        const rules = this.getRules();
        
        // 1. Per-transaction limit
        if (amountUSD > rules.maxPerTransaction) {
            return `Transaction amount ($${amountUSD}) exceeds your preset limit of $${rules.maxPerTransaction} per transfer.`;
        }

        // 2. Daily limit
        const dailySpent = this.getDailySpent();
        if (dailySpent + amountUSD > rules.dailyLimit) {
            return `Daily spending limit ($${rules.dailyLimit}) reached. You have already spent $${dailySpent} today.`;
        }

        return null;
    }

    static recordSpending(amountUSD: number) {
        const history = this.getSpendingHistory();
        const today = new Date().toISOString().split('T')[0];
        
        const todayEntry = history.find(h => h.date === today) || { date: today, spent: 0 };
        todayEntry.spent += amountUSD;

        const otherEntries = history.filter(h => h.date !== today);
        localStorage.setItem(this.HISTORY_KEY, JSON.stringify([...otherEntries, todayEntry]));
    }

    static getDailySpent(): number {
        const today = new Date().toISOString().split('T')[0];
        const history = this.getSpendingHistory();
        const todayEntry = history.find(h => h.date === today);
        return todayEntry ? todayEntry.spent : 0;
    }

    private static getSpendingHistory(): { date: string, spent: number }[] {
        const stored = localStorage.getItem(this.HISTORY_KEY);
        return stored ? JSON.parse(stored) : [];
    }
}
