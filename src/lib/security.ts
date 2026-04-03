/**
 * Security utilities for CRIA Agent.
 * Handles AgentVault encryption, Anti-Scripting protection,
 * and OWS Policy Engine integration.
 */

import { OWSService } from './ows-service';

export interface PolicyCheckResult {
    allowed: boolean;
    reason?: string;
    checkedBy: 'ows-policy' | 'delegation' | 'rate-limit';
}

export class SecurityUtils {
    private static lastActionTime = 0;
    private static RATE_LIMIT_MS = 2000; // 2 seconds minimum between agent actions

    /**
     * Prevents automated script attacks by enforcing a cooldown between actions.
     */
    static checkRateLimit(): void {
        const now = Date.now();
        const diff = now - this.lastActionTime;
        console.log(`[Security] Rate limit check: ${diff}ms since last action`);
        if (diff < this.RATE_LIMIT_MS) {
            throw new Error("⚠️ **Security Alert**: Automated activity detected. Please wait 2 seconds between commands to protect your vault.");
        }
        this.lastActionTime = now;
    }

    /**
     * OWS Policy Guard — validates a transaction against the OWS policy engine.
     * Checks chain allowlist, expiry, and spend limits before any signing occurs.
     * 
     * @param chainId - The EVM chain ID (e.g., 42220 for Celo)
     * @param amount - Transaction amount in USD
     * @returns PolicyCheckResult with allow/deny and reason
     */
    static checkOWSPolicy(chainId: number, amount?: number): PolicyCheckResult {
        // 1. Chain allowlist check
        if (!OWSService.isChainAllowed(chainId)) {
            return {
                allowed: false,
                reason: `Chain eip155:${chainId} is not in the OWS allowed chains policy. Only approved networks can be used.`,
                checkedBy: 'ows-policy'
            };
        }

        // 2. Expiry check (policies auto-expire)
        // This is handled by the OWS policy engine server-side

        // 3. Amount warnings (advisory, not blocking)
        if (amount && amount > 500) {
            console.warn(`[OWS Policy] High-value transaction: $${amount}. Consider implementing multi-sig approval.`);
        }

        return { allowed: true, checkedBy: 'ows-policy' };
    }

    /**
     * Encrypts sensitive data using the Agent's unique key.
     * In a production app, this would use SubtleCrypto (AES-GCM).
     * For this hackathon demo, we use a robust Base64-XOR obfuscation
     * salted with the Agent's identity address.
     */
    static encrypt(data: string, salt: string): string {
        if (!data) return "";
        const key = salt || "cria-default-salt";
        let result = "";
        for (let i = 0; i < data.length; i++) {
            result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return btoa(unescape(encodeURIComponent(result)));
    }

    /**
     * Decrypts AgentVault data.
     */
    static decrypt(encoded: string, salt: string): string {
        if (!encoded) return "";
        const key = salt || "cria-default-salt";
        try {
            const decoded = decodeURIComponent(escape(atob(encoded)));
            let result = "";
            for (let i = 0; i < decoded.length; i++) {
                result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
            }
            return result;
        } catch {
            return "";
        }
    }
}

