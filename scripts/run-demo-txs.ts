import { createWalletClient, http, parseUnits, erc20Abi, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo, celoSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load .env
dotenv.config({ path: join(process.cwd(), '.env') });

const PRIVATE_KEY = (process.env.AGENT_PRIVATE_KEY || process.env.VITE_AGENT_PRIVATE_KEY || process.env.PRIVATE_KEY) as `0x${string}`;
const TREASURY = '0x3D02DEF96FC41a74c7e6b939Bb17aF0dA3D66b3c';

// Celo Mainnet is now default (Track 3 eligibility)
const USE_MAINNET = process.env.USE_MAINNET !== 'false';
const CHAIN = USE_MAINNET ? celo : celoSepolia;
const USDC_ADDR = USE_MAINNET 
  ? '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' // Mainnet
  : '0x01C5C0122039549Ad1493B8220cABEdD739BC44E'; // Sepolia

const AMOUNT = '0.01';

if (!PRIVATE_KEY) {
  console.error('❌ AGENT_PRIVATE_KEY not found in .env');
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);
const client = createWalletClient({
  account,
  chain: CHAIN,
  transport: http(),
});

const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(),
});

async function runDemo() {
  console.log(`🚀 Starting demo transaction on ${CHAIN.name} from ${account.address}...`);
  
  try {
    const hash = await client.writeContract({
      address: USDC_ADDR as `0x${string}`,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [TREASURY as `0x${string}`, parseUnits(AMOUNT, 6)],
    });

    console.log(`✅ Success! Tx Hash: ${hash}`);
    const explorer = USE_MAINNET ? 'https://celoscan.io' : 'https://sepolia.celoscan.io';
    console.log(`🔗 View on Explorer: ${explorer}/tx/${hash}`);
  } catch (error) {
    if (!USE_MAINNET) {
      console.log('\n💡 Tip: If you need test tokens, visit https://faucet.celo.org/sepolia');
    }
    console.error('❌ Transaction failed:', error);
  }
}

runDemo();
