import { type ParsedIntent } from './llm';

export interface OutRampSession {
    amount: string | null;
    currency: string | null;
    accountNumber: string | null;
    bankName: string | null;
    accountName: string | null;
    confirmed: boolean;
    step: 'AWAITING_ACCOUNT_NUMBER' | 'AWAITING_BANK_NAME' | 'AWAITING_ACCOUNT_NAME' | 'AWAITING_CONFIRMATION' | 'COMPLETED';
}

export class ConversationState {
    private static session: OutRampSession | null = null;

    static getSession(): OutRampSession | null {
        return this.session;
    }

    static setSession(session: OutRampSession | null) {
        this.session = session;
    }

    static updateSession(updates: Partial<OutRampSession>) {
        if (this.session) {
            this.session = { ...this.session, ...updates };
        }
    }

    static clear() {
        this.session = null;
    }

    static isOutRampActive(): boolean {
        return this.session !== null && this.session.step !== 'COMPLETED';
    }
}
