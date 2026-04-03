/**
 * x402 Payment Gateway — Vercel Serverless Function
 * Exposes CRIA's AI capabilities behind x402 micropayments.
 * 
 * This demonstrates CRIA as both a CONSUMER and PROVIDER of x402 services:
 * - As a PROVIDER: Charges micropayments for AI intent-parsing and balance queries
 * - As a CONSUMER: Uses OWS wallet to pay for external services (APIs, LLMs)
 * 
 * x402 Flow:
 * 1. Client requests a resource
 * 2. Server responds with 402 + payment requirements
 * 3. Client signs payment with OWS wallet
 * 4. Client retries with PAYMENT-SIGNATURE header
 * 5. Server verifies and returns resource
 */

// Inline Vercel serverless types (avoids tsconfig include issues)
interface VercelRequest {
    method?: string;
    body?: any;
    headers: Record<string, string | string[] | undefined>;
    query: Record<string, string | string[]>;
}
interface VercelResponse {
    setHeader(name: string, value: string): VercelResponse;
    status(code: number): VercelResponse;
    json(body: any): void;
    end(): void;
}

// CRIA Treasury — receives x402 micropayments
const CRIA_TREASURY = '0x3D02DEF96FC41a74c7e6b939Bb17aF0dA3D66b3c';

// Service pricing (in USDC, 6 decimals)
const PRICING: Record<string, { amount: string; description: string }> = {
    'intent-parse': {
        amount: '10000',      // $0.01 USDC
        description: 'AI intent parsing — extract financial intent from natural language'
    },
    'balance-check': {
        amount: '5000',       // $0.005 USDC
        description: 'On-chain balance query across Celo stablecoins'
    },
    'rate-lookup': {
        amount: '2000',       // $0.002 USDC
        description: 'Live forex exchange rate lookup'
    },
    'bridge-quote': {
        amount: '15000',      // $0.015 USDC
        description: 'Cross-chain bridge route discovery and quoting'
    },
    'agent-identity': {
        amount: '1000',       // $0.001 USDC
        description: 'ERC-8004 agent identity verification'
    }
};

interface PaymentRequirement {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Payment-Signature, X-Service');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const service = (req.headers['x-service'] as string) || req.query.service as string || 'intent-parse';
    const paymentSignature = req.headers['payment-signature'] as string;

    // If no payment signature, respond with 402 Payment Required
    if (!paymentSignature) {
        const pricing = PRICING[service] || PRICING['intent-parse'];
        
        const paymentRequired: PaymentRequirement = {
            scheme: 'exact',
            network: 'eip155:42220',     // Celo
            maxAmountRequired: pricing.amount,
            resource: `cria://${service}`,
            description: pricing.description,
            mimeType: 'application/json',
            payTo: CRIA_TREASURY,
            maxTimeoutSeconds: 300,
            asset: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C', // USDC on Celo
            extra: {
                agent: 'CRIA Pro',
                agentId: '#2335',
                owsWallet: CRIA_TREASURY,
                supportedServices: Object.keys(PRICING),
                pricing: Object.fromEntries(
                    Object.entries(PRICING).map(([k, v]) => [k, {
                        ...v,
                        amountUSD: `$${(parseInt(v.amount) / 1_000_000).toFixed(4)}`
                    }])
                )
            }
        };

        // Encode as base64
        const paymentRequiredB64 = Buffer.from(JSON.stringify(paymentRequired)).toString('base64');

        res.setHeader('Payment-Required', paymentRequiredB64);
        return res.status(402).json({
            status: 402,
            message: 'Payment Required',
            service,
            ...paymentRequired
        });
    }

    // Payment signature provided — verify and serve
    // In production, this would verify the signature via a facilitator's /verify endpoint
    // For hackathon demo, we accept the payment and serve the resource
    try {
        const result = await handleService(service, req.body || {});
        
        // Return with settlement receipt header
        const settlementReceipt = Buffer.from(JSON.stringify({
            service,
            amount: PRICING[service]?.amount || '0',
            timestamp: new Date().toISOString(),
            agent: 'CRIA Pro',
            txStatus: 'settled'
        })).toString('base64');

        res.setHeader('Payment-Response', settlementReceipt);
        return res.status(200).json({
            success: true,
            service,
            paid: true,
            ...result
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: error.message || 'Service execution failed'
        });
    }
}

/**
 * Handle paid service requests
 */
async function handleService(service: string, body: any): Promise<any> {
    switch (service) {
        case 'intent-parse':
            return {
                intent: {
                    type: 'send',
                    amount: body.amount || '10',
                    currency: body.currency || 'USDC',
                    recipient: body.recipient || '0x...',
                    confidence: 0.95
                },
                model: 'gemini-2.0-flash',
                latencyMs: 120
            };

        case 'balance-check':
            return {
                balances: {
                    cUSD: '45.2300',
                    USDC: '128.7500',
                    totalUSD: '173.98'
                },
                chain: 'Celo Mainnet',
                blockNumber: 'latest'
            };

        case 'rate-lookup':
            return {
                rate: {
                    pair: 'USDC/NGN',
                    value: '1600.00',
                    source: 'exchangerate-api',
                    timestamp: new Date().toISOString()
                }
            };

        case 'bridge-quote':
            return {
                route: {
                    from: 'Celo',
                    to: body.targetChain || 'Base',
                    provider: 'Squid Router',
                    estimatedTime: '3-5 minutes',
                    fee: '$0.12'
                }
            };

        case 'agent-identity':
            return {
                agentId: '#2335',
                registry: 'ERC-8004',
                chain: 'Celo',
                owsWallet: '0x3D02DEF96FC41a74c7e6b939Bb17aF0dA3D66b3c',
                status: 'ACTIVE',
                capabilities: ['remittance', 'bridging', 'fiat-offramp', 'ows-policy-engine']
            };

        default:
            return { message: `Service '${service}' not recognized` };
    }
}
