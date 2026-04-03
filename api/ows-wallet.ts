/**
 * OWS Wallet API — Vercel Serverless Function
 * Wraps the Open Wallet Standard SDK for policy-gated agent wallet operations.
 * 
 * Endpoints (via POST body action):
 *   - create:   Create a new OWS agent wallet
 *   - info:     Get wallet info (addresses, policies)
 *   - sign:     Sign a transaction through OWS policy engine
 *   - policies: List or create spending policies
 *   - keys:     Manage API keys for agent access
 */

const AGENT_WALLET_NAME = 'cria-agent-treasury';
const VAULT_PATH = '/tmp/.ows'; // Ephemeral vault for serverless

// Default CRIA spending policy
const CRIA_POLICY = {
    id: 'cria-remittance-limits',
    name: 'CRIA Remittance Safety Policy',
    version: 1,
    created_at: new Date().toISOString(),
    rules: [
        {
            type: 'allowed_chains',
            chain_ids: [
                'eip155:42220',  // Celo Mainnet
                'eip155:44787',  // Celo Alfajores (testnet)
                'eip155:8453',   // Base
                'eip155:1',      // Ethereum Mainnet
                'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Solana
            ]
        },
        {
            type: 'expires_at',
            timestamp: '2027-01-01T00:00:00Z' // Valid for ~9 months
        }
    ],
    action: 'deny'
};

// OWS SDK — loaded lazily. Falls back to demo mode when unavailable.
let owsSdk: any = null;
let owsLoaded = false;

async function loadOWS(): Promise<any> {
    if (!owsLoaded) {
        owsLoaded = true;
        try {
            owsSdk = await import('@open-wallet-standard/core' as string);
        } catch {
            console.warn('[OWS] SDK not available — running in demo mode');
        }
    }
    return owsSdk;
}

export default async function handler(req: any, res: any) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { action, ...params } = req.body || {};

    // Lazy-load OWS SDK
    const ows = await loadOWS();

    // If OWS SDK is not available, return demo responses
    if (!ows) {
        return res.status(200).json(getDemoResponse(action, params));
    }

    try {
        switch (action) {
            case 'create': {
                const wallet = ows.createWallet(AGENT_WALLET_NAME, undefined, 12, VAULT_PATH);
                ows.createPolicy(JSON.stringify(CRIA_POLICY), VAULT_PATH);
                const apiKey = ows.createApiKey(
                    'cria-agent-key',
                    [AGENT_WALLET_NAME],
                    [CRIA_POLICY.id],
                    '',
                    undefined,
                    VAULT_PATH
                );
                return res.status(200).json({
                    success: true,
                    wallet: { name: wallet.name, id: wallet.id, accounts: wallet.accounts, createdAt: wallet.createdAt },
                    policy: CRIA_POLICY,
                    apiKey: { id: apiKey.id, name: apiKey.name }
                });
            }

            case 'info': {
                const wallet = ows.getWallet(AGENT_WALLET_NAME, VAULT_PATH);
                const policies = ows.listPolicies(VAULT_PATH);
                return res.status(200).json({
                    success: true,
                    wallet: { name: wallet.name, id: wallet.id, accounts: wallet.accounts, createdAt: wallet.createdAt },
                    policies
                });
            }

            case 'sign': {
                const { chain, txHex } = params;
                if (!chain || !txHex) {
                    return res.status(400).json({ error: 'chain and txHex required' });
                }
                const result = ows.signTransaction(AGENT_WALLET_NAME, chain, txHex, undefined, 0, VAULT_PATH);
                return res.status(200).json({
                    success: true,
                    signature: result.signature,
                    recoveryId: result.recoveryId
                });
            }

            case 'policies': {
                const policies = ows.listPolicies(VAULT_PATH);
                return res.status(200).json({ success: true, policies });
            }

            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }
    } catch (error: any) {
        console.error('[OWS] Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'OWS operation failed'
        });
    }
}

/**
 * Demo responses when OWS SDK is not available
 */
function getDemoResponse(action: string, _params: any) {
    const demoWallet = {
        name: AGENT_WALLET_NAME,
        id: 'ows-7a2f1b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c',
        accounts: [
            { chainId: 'eip155:42220', address: '0x3D02DEF96FC41a74c7e6b939Bb17aF0dA3D66b3c', derivationPath: "m/44'/60'/0'/0/0" },
            { chainId: 'eip155:8453', address: '0x3D02DEF96FC41a74c7e6b939Bb17aF0dA3D66b3c', derivationPath: "m/44'/60'/0'/0/0" },
            { chainId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', address: 'DzkqyvQrBvLqKSMhCoXoGK65e9PvyWjb6YjS4BqcxN2i', derivationPath: "m/44'/501'/0'/0'" },
        ],
        createdAt: new Date().toISOString()
    };

    switch (action) {
        case 'create':
        case 'info':
            return {
                success: true,
                wallet: demoWallet,
                policy: CRIA_POLICY,
                apiKey: { id: 'demo-key', name: 'cria-agent-key' },
                demo: true
            };
        case 'sign':
            return {
                success: true,
                signature: '0xdemo_signature_policy_approved',
                recoveryId: 27,
                demo: true
            };
        case 'policies':
            return { success: true, policies: [CRIA_POLICY], demo: true };
        default:
            return { error: `Unknown action: ${action}`, demo: true };
    }
}
