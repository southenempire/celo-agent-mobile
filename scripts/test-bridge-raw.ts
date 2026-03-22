import { createWalletClient, createPublicClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config();

// Usage: npx tsx scripts/test-bridge-raw.ts

const rawKey = process.env.PRIVATE_KEY || process.env.AGENT_ED25519_PRIV;
const privateKey = (rawKey?.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;

// Squid Router Integrator ID is mandatory for Mainnet routes
const integratorId = process.env.INTEGRATOR_ID || process.env.VITE_SQUID_INTEGRATOR_ID || "cria-agent";

// Testing: Celo (Native CELO) -> Base (USDC)
const fromChainId = "42220"; 
const toChainId = "8453"; 
const fromToken = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"; 
const toToken = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; 
const amount = "100000000000000000"; // 0.1 CELO

const account = privateKeyToAccount(privateKey);
const walletClient = createWalletClient({ account, chain: celo, transport: http() });
const publicClient = createPublicClient({ chain: celo, transport: http() });

const getRoute = async (params: any) => {
    const response = await fetch("https://v2.api.squidrouter.com/v2/route", {
        method: "POST",
        headers: {
            "x-integrator-id": integratorId,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Squid API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const requestId = response.headers.get("x-request-id");
    return { data, requestId };
};

(async () => {
    console.log("🌉 Starting Raw API Cross-Chain Transfer Test...");
    console.log(`🔑 Using Integrator ID: ${integratorId}`);

    const params = {
        fromAddress: account.address,
        fromChain: fromChainId,
        fromToken: fromToken,
        fromAmount: amount,
        toChain: toChainId,
        toToken: toToken,
        toAddress: account.address,
    };

    console.log("📦 Requesting route parameters:", params);

    try {
        const routeResult = await getRoute(params);
        console.log("✅ Route successfully found!");
        
        const transactionRequest = routeResult.data.route.transactionRequest;
        console.log("Transaction Target:", transactionRequest.targetAddress);

        console.log("⚠️ Halting before Viem execution: This wallet does not have sufficient CELO on mainnet to execute.");
        
    } catch (error: any) {
        console.error("❌ " + error.message);
        console.log("\n💡 Why did this fail? The raw API also strictly enforces the 'x-integrator-id' header.");
        console.log("💡 You must register for a free Squid Integrator ID and add it to .env as INTEGRATOR_ID=...");
    }
})();
