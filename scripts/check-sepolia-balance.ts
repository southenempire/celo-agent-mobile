import { createPublicClient, http, formatEther } from 'viem';
import { sepolia } from 'viem/chains';

async function checkBalances() {
    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http("https://rpc.sepolia.org") // Public Sepolia RPC
    });

    const addresses = [
        { name: "Treasury (Original Agent Wallet)", address: "0x3D02DEF96FC41a74c7e6b939Bb17aF0dA3D66b3c" },
        { name: "Testnet Dev Wallet", address: "0x662DC678Cd955A731F379f6DD4181ae2319c5f26" }
    ];

    console.log("🔍 Checking Ethereum Sepolia Balances...");
    for (const { name, address } of addresses) {
        try {
            const balance = await publicClient.getBalance({ address: address as `0x${string}` });
            console.log(`- ${name} (${address}): ${formatEther(balance)} SepoliaETH`);
        } catch (error: any) {
            console.error(`❌ Failed to fetch balance for ${name}:`, error.message);
        }
    }
}

checkBalances().catch(console.error);
