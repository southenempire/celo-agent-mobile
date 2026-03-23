/**
 * Security utilities for CRIA Agent.
 * Handles AgentVault encryption and Anti-Scripting protection.
 */

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
