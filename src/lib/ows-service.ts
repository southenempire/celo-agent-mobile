/**
 * OWS Service — Client-side bridge to the OWS wallet API
 * 
 * Provides the frontend with access to OWS wallet operations
 * through the /api/ows-wallet serverless function.
 * 
 * OWS Architecture:
 *   Frontend (this) → API Route → OWS SDK (native FFI) → Wallet Vault
 */

export interface OWSAccount {
    chainId: string;
    address: string;
    derivationPath: string;
}

export interface OWSWalletInfo {
    name: string;
    id: string;
    accounts: OWSAccount[];
    createdAt: string;
}

export interface OWSPolicy {
    id: string;
    name: string;
    version: number;
    created_at: string;
    rules: Array<{
        type: string;
        chain_ids?: string[];
        timestamp?: string;
    }>;
    action: string;
}

export interface OWSStatus {
    wallet: OWSWalletInfo | null;
    policies: OWSPolicy[];
    isActive: boolean;
    demo: boolean;
}

const API_BASE = '/api/ows-wallet';

export class OWSService {
    private static cache: OWSStatus | null = null;

    /**
     * Initialize the OWS agent wallet
     */
    static async createAgentWallet(): Promise<OWSStatus> {
        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create' })
            });
            const data = await res.json();
            
            if (data.success) {
                this.cache = {
                    wallet: data.wallet,
                    policies: data.policy ? [data.policy] : [],
                    isActive: true,
                    demo: !!data.demo
                };
            }
            return this.cache || this.getDefaultStatus();
        } catch (error) {
            console.error('[OWS] Create wallet failed:', error);
            return this.getDefaultStatus();
        }
    }

    /**
     * Get current OWS wallet info and policies
     */
    static async getWalletInfo(): Promise<OWSStatus> {
        if (this.cache) return this.cache;
        
        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'info' })
            });
            const data = await res.json();

            if (data.success) {
                this.cache = {
                    wallet: data.wallet,
                    policies: data.policies || [],
                    isActive: true,
                    demo: !!data.demo
                };
                return this.cache;
            }
        } catch {
            // Fall through to default
        }
        return this.getDefaultStatus();
    }

    /**
     * Sign a transaction through the OWS policy engine
     */
    static async signWithPolicy(chain: string, txHex: string): Promise<{
        success: boolean;
        signature?: string;
        policyApproved: boolean;
        error?: string;
    }> {
        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sign', chain, txHex })
            });
            const data = await res.json();

            if (data.success) {
                return {
                    success: true,
                    signature: data.signature,
                    policyApproved: true
                };
            }
            return {
                success: false,
                policyApproved: false,
                error: data.error || 'Policy denied'
            };
        } catch (error: any) {
            return {
                success: false,
                policyApproved: false,
                error: error.message || 'OWS signing failed'
            };
        }
    }

    /**
     * Get active policies
     */
    static async getPolicies(): Promise<OWSPolicy[]> {
        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'policies' })
            });
            const data = await res.json();
            return data.policies || [];
        } catch {
            return [this.getDefaultPolicy()];
        }
    }

    /**
     * Check if current chain is allowed by OWS policy
     */
    static isChainAllowed(chainId: number): boolean {
        const caip2 = `eip155:${chainId}`;
        const policy = this.cache?.policies?.[0];
        if (!policy) return true; // No policy = allow

        const chainRule = policy.rules.find(r => r.type === 'allowed_chains');
        if (!chainRule?.chain_ids) return true;

        return chainRule.chain_ids.includes(caip2);
    }

    /**
     * Format OWS wallet address for display
     */
    static getEvmAddress(): string {
        const evmAccount = this.cache?.wallet?.accounts?.find(
            a => a.chainId.startsWith('eip155:')
        );
        return evmAccount?.address || '0x3D02DEF96FC41a74c7e6b939Bb17aF0dA3D66b3c';
    }

    /**
     * Get supported chains from OWS wallet
     */
    static getSupportedChains(): string[] {
        return this.cache?.wallet?.accounts?.map(a => a.chainId) || [
            'eip155:42220',   // Celo
            'eip155:8453',    // Base
            'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
        ];
    }

    /**
     * Default status when OWS is not yet initialized
     */
    private static getDefaultStatus(): OWSStatus {
        return {
            wallet: {
                name: 'cria-agent-treasury',
                id: 'ows-pending',
                accounts: [
                    { chainId: 'eip155:42220', address: '0x3D02DEF96FC41a74c7e6b939Bb17aF0dA3D66b3c', derivationPath: "m/44'/60'/0'/0/0" },
                    { chainId: 'eip155:8453', address: '0x3D02DEF96FC41a74c7e6b939Bb17aF0dA3D66b3c', derivationPath: "m/44'/60'/0'/0/0" },
                    { chainId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', address: 'DzkqyvQrBvLqKSMhCoXoGK65e9PvyWjb6YjS4BqcxN2i', derivationPath: "m/44'/501'/0'/0'" },
                ],
                createdAt: new Date().toISOString()
            },
            policies: [this.getDefaultPolicy()],
            isActive: true,
            demo: true
        };
    }

    private static getDefaultPolicy(): OWSPolicy {
        return {
            id: 'cria-remittance-limits',
            name: 'CRIA Remittance Safety Policy',
            version: 1,
            created_at: new Date().toISOString(),
            rules: [
                {
                    type: 'allowed_chains',
                    chain_ids: ['eip155:42220', 'eip155:44787', 'eip155:8453', 'eip155:1', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp']
                },
                { type: 'expires_at', timestamp: '2027-01-01T00:00:00Z' }
            ],
            action: 'deny'
        };
    }
}
