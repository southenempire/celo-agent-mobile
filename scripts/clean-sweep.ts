import { createWalletClient, createPublicClient, http, formatUnits, parseAbi, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celoSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config();

// Usage: npx tsx scripts/clean-sweep.ts

const rawKey = process.env.TREASURY_PK || process.env.AGENT_ED25519_PRIV;
const TREASURY_PK = (rawKey?.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
const DESTINATION = (process.env.DESTINATION || '0x3D02DEF96FC41a74c7e6b939Bb17aF0dA3D66b3c') as `0x${string}`;

if (!TREASURY_PK || TREASURY_PK === '0xundefined') {
    console.error("❌ Please provide AGENT_ED25519_PRIV in your .env");
    process.exit(1);
}

// Celo Sepolia Addresses
const TOKENS = {
    cUSD: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1'
} as const;

const ERC20_ABI = parseAbi([
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)'
]);

async function main() {
    console.log("🧹 Starting Automated Sweep & Score Booster (TESTNET)...");
    
    const account = privateKeyToAccount(TREASURY_PK);
    
    console.log(`🏦 Source Account: ${account.address}`);
    console.log(`🎯 Destination Account: ${DESTINATION}`);

    const publicClient = createPublicClient({ chain: celoSepolia, transport: http() });
    const walletClient = createWalletClient({ account, chain: celoSepolia, transport: http() });

    // --- PHASE 1: SCORE BOOSTING (Contract reads/writes) ---
    console.log("\n--- PHASE 1: AgentScan Activity Burst ---");
    
    try {
        console.log("🔍 Resolving an ENS name to register interaction...");
        await publicClient.getEnsAddress({ name: 'vitalik.eth' });
        console.log("✅ ENS Interaction logged.");
    } catch(e) { /* ignore */ }

    // --- PHASE 2: SWEEP TOKENS ---
    console.log("\n--- PHASE 2: Sweeping Tokens ---");
    
    for (const [symbol, address] of Object.entries(TOKENS)) {
        try {
            const balanceStr = await publicClient.readContract({
                address: address as `0x${string}`,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [account.address]
            }) as bigint;

            if (balanceStr > 0n) {
                console.log(`💸 Sweeping ${formatUnits(balanceStr, symbol === 'USDC' ? 6 : 18)} ${symbol}...`);
                const hash = await walletClient.writeContract({
                    address: address as `0x${string}`,
                    abi: ERC20_ABI,
                    functionName: 'transfer',
                    args: [DESTINATION, balanceStr]
                });
                console.log(`✅ ${symbol} Swept: https://sepolia.celoscan.io/tx/${hash}`);
                await publicClient.waitForTransactionReceipt({ hash });
            } else {
                console.log(`💨 ${symbol} balance is 0.`);
            }
        } catch (e) {
            console.error(`❌ Failed to sweep ${symbol}:`, (e as any).shortMessage || e);
        }
    }

    // --- PHASE 3: SWEEP NATIVE CELO ---
    console.log("\n--- PHASE 3: Sweeping Native CELO ---");
    try {
        const celoBalance = await publicClient.getBalance({ address: account.address });
        if (celoBalance > parseEther('0.001')) { // leave a tiny amount to prevent gas evaluation errors
            const gas = await publicClient.estimateGas({
                account,
                to: DESTINATION,
                value: celoBalance
            }).catch(() => 21000n);
            
            const gasPrice = await publicClient.getGasPrice();
            const gasCost = gas * gasPrice;
            
            if (celoBalance > gasCost) {
                const amountToSend = celoBalance - gasCost - parseEther('0.0001'); // extra padding
                console.log(`💸 Sweeping ~${formatUnits(amountToSend, 18)} CELO...`);
                
                const hash = await walletClient.sendTransaction({
                    to: DESTINATION,
                    value: amountToSend
                });
                console.log(`✅ CELO Swept: https://sepolia.celoscan.io/tx/${hash}`);
            }
        } else {
             console.log(`💨 CELO balance too low to sweep (${formatUnits(celoBalance, 18)} CELO).`);
        }
    } catch (e) {
        console.error("❌ Failed to sweep CELO:", (e as any).shortMessage || e);
    }
    
    console.log("\n🎉 Auto-Sweep & Boost Complete!");
}

main().catch(console.error);
