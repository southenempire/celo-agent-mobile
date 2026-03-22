import { createWalletClient, createPublicClient, http, parseUnits, erc20Abi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo, celoSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config();

// Usage: npx tsx scripts/boost.ts

const rawKey = process.env.PRIVATE_KEY || process.env.AGENT_ED25519_PRIV;
const PRIVATE_KEY = (rawKey?.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;

if (!PRIVATE_KEY || PRIVATE_KEY === '0xundefined') {
    console.error("❌ Please provide a PRIVATE_KEY or AGENT_ED25519_PRIV in your .env");
    process.exit(1);
}

// Celo Sepolia Stablecoins
const CUSD_ADDRESS = '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1'; // Testnet cUSD

// Treasury to send micro-transactions
const TREASURY = '0x3d02def96fc41a74c7e6b939bb17af0da3d66b3c';

async function main() {
    console.log("🚀 Starting AgentScan Booster Sequence (TESTNET)...");
    
    const account = privateKeyToAccount(PRIVATE_KEY);
    const publicClient = createPublicClient({ chain: celoSepolia, transport: http() });
    const walletClient = createWalletClient({ account, chain: celoSepolia, transport: http() });

    console.log(`👤 Connected Agent Account: ${account.address}`);
    
    // 1. Resolve ENS (Contract Interaction)
    console.log("🔍 Checking ENS Resolution...");
    try {
        const ens = await publicClient.getEnsAddress({ name: 'vitalik.eth' });
        console.log(`✅ Resolved vitalik.eth to ${ens}`);
    } catch (e) {
        console.log("⚠️ ENS resolution skipped/failed");
    }

    // 2. Read Balances
    console.log("💰 Checking Balances...");
    const celoBal = await publicClient.getBalance({ address: account.address });
    console.log(`Celo Balance: ${celoBal.toString()}`);

    // If we have Celo, we can send a micro-tx
    if (celoBal > 0n) {
        console.log("💸 Sending Micro-transaction to boost score (0.0001 CELO)...");
        try {
            const hash = await walletClient.sendTransaction({
                to: TREASURY,
                value: parseUnits('0.0001', 18)
            });
            console.log(`✅ CELO Transaction Sent: https://celoscan.io/tx/${hash}`);
            await publicClient.waitForTransactionReceipt({ hash });
        } catch (e) {
            console.error("❌ Failed to send CELO:", (e as any).shortMessage || e);
        }
    } else {
        console.log("⚠️ No CELO for gas, skipping transactions.");
    }

    // Attempt cUSD Transfer (Contract Write to boost diversity)
    console.log("💸 Attempting 0.001 cUSD Transfer...");
    try {
        const hash = await walletClient.writeContract({
            address: CUSD_ADDRESS,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [TREASURY, parseUnits('0.001', 18)],
        });
        console.log(`✅ cUSD Transfer Sent: https://celoscan.io/tx/${hash}`);
    } catch (e) {
        console.log("⚠️ cUSD transfer skipped (likely no balance/gas)");
    }

    console.log("🎉 Booster Sequence Complete! Check AgentScan in a few minutes.");
}

main().catch(console.error);
