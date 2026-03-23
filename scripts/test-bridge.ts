
import { Squid } from '@0xsquid/sdk';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config();

const rawKey = process.env.PRIVATE_KEY || process.env.AGENT_ED25519_PRIV;
const PRIVATE_KEY = (rawKey?.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;

async function main() {
    console.log("🌉 Initializing Squid Router Multi-Route Test (MAINNET ROUTING)...");

    if (!PRIVATE_KEY || PRIVATE_KEY === '0xundefined') {
        throw new Error("Missing private key.");
    }
    const account = privateKeyToAccount(PRIVATE_KEY);

    const squid = new Squid({
        baseUrl: "https://v2.api.squidrouter.com",
        integratorId: "cria-pro-7a7fa785-e34a-40a7-a3ca-d6af0231b9d4",
    });

    await squid.init();
    console.log("✅ Squid SDK Initialized\n");

    const routesToTest = [
        {
            name: "Celo to Ethereum (USDC)",
            fromChain: "42220",
            toChain: "1", // Ethereum
            fromToken: "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
            toToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
            toAddress: account.address
        },
        {
            name: "Celo to Solana (USDC)",
            fromChain: "42220",
            toChain: "solana", // SVM
            fromToken: "0x765DE816845861e75A25fCA122bb6898B8B1282a", // cUSD
            toToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Solana USDC
            toAddress: "FvHpmE7nK2NfB5GjVfA2i4s2Bf6tqW8R5T8A9w1xXvR" // Dummy Sol address
        }
    ];

    const fromAmount = "1000000000000000000"; // 1 cUSD

    for (const route of routesToTest) {
        console.log(`🔍 Requesting: ${route.name}...`);
        try {
            const { route: squidRoute } = await squid.getRoute({
                fromChain: route.fromChain,
                toChain: route.toChain,
                fromToken: route.fromToken,
                toToken: route.toToken,
                fromAmount,
                fromAddress: account.address,
                toAddress: route.toAddress,
            });

            console.log(`🚀 Route found! Estimated bridging time: ${Math.ceil(squidRoute.estimate.estimatedRouteDuration / 60)} minutes.`);
            console.log(`💸 Estimated received amount: ${Number(squidRoute.estimate.toAmountMin) / 1e6} USDC on destination`);
            console.log("📦 Generated Payload Target Contract:", (squidRoute.transactionRequest as any)?.targetAddress || (squidRoute.transactionRequest as any)?.target);
            console.log("--------------------------------------------------\n");
        } catch (error: any) {
            console.error(`❌ Bridge Error for ${route.name}:`, error.response?.data?.errors || error.message);
            console.log("--------------------------------------------------\n");
        }
    }
}

main().catch(console.error);
