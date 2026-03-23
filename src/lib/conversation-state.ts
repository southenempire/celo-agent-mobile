import { type ParsedIntent } from './llm';

export interface OutRampSession {
    type: 'out_ramp';
    amount: string | null;
    currency: string | null;
    accountNumber: string | null;
    bankName: string | null;
    accountName: string | null;
    confirmed: boolean;
    step: 'AWAITING_ACCOUNT_NUMBER' | 'AWAITING_BANK_NAME' | 'AWAITING_ACCOUNT_NAME' | 'AWAITING_CONFIRMATION' | 'COMPLETED';
}

export interface BridgeSession {
    type: 'bridge';
    fromChain: string;
    toChain: string;
    fromToken: string;
    toToken: string;
    amount: string;
    recipient: string;
    quoteMessage: string;
    route: any;
    confirmed: boolean;
    step: 'AWAITING_CONFIRMATION' | 'COMPLETED';
}

export type AgentSession = OutRampSession | BridgeSession;

export class ConversationState {
    private static session: AgentSession | null = null;

    static getSession(): AgentSession | null {
        return this.session;
    }

    static getOutRampSession(): OutRampSession | null {
        if (this.session?.type === 'out_ramp') return this.session;
        return null;
    }

    static getBridgeSession(): BridgeSession | null {
        if (this.session?.type === 'bridge') return this.session;
        return null;
    }

    static setSession(session: AgentSession | null) {
        this.session = session;
    }

    static updateSession(updates: Partial<AgentSession>) {
        if (this.session) {
            this.session = { ...this.session, ...updates } as any;
        }
    }

    static clear() {
        this.session = null;
    }

    static isOutRampActive(): boolean {
        return this.session !== null && this.session.type === 'out_ramp' && this.session.step !== 'COMPLETED';
    }

    static isBridgeActive(): boolean {
        return this.session !== null && this.session.type === 'bridge' && this.session.step !== 'COMPLETED';
    }
}
