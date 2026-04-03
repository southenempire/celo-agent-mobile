// Type declarations for serverless API dependencies
// These modules are available in the Vercel serverless runtime or
// are native Rust FFI bindings loaded at deploy time.

declare module '@open-wallet-standard/core' {
    export function createWallet(name: string, mnemonic: string | undefined, words: number, vault: string): any;
    export function getWallet(name: string, vault: string): any;
    export function createPolicy(json: string, vault: string): any;
    export function listPolicies(vault: string): any[];
    export function signTransaction(wallet: string, chain: string, tx: string, policy: string | undefined, account: number, vault: string): any;
    export function createApiKey(name: string, wallets: string[], policies: string[], desc: string, exp: string | undefined, vault: string): any;
}

declare module '@x402/core' {
    export interface PaymentRequirement {
        scheme: string;
        network: string;
        maxAmountRequired: string;
        resource: string;
        description: string;
        mimeType: string;
        payTo: string;
        maxTimeoutSeconds: number;
        asset: string;
        extra?: Record<string, any>;
    }
}

declare module '@x402/fetch' {
    export function fetchWithPayment(url: string, options?: any): Promise<Response>;
}
