import { createPublicClient, http } from 'viem';
import { celoSepolia } from 'viem/chains';

// Celo Sepolia (L2) with fee currency support
export const testnet = celoSepolia;

export const publicClient = createPublicClient({
  chain: testnet,
  transport: http(),
});

// Celo Sepolia Stablecoins
export const STABLECOINS = {
  cUSD: '0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80', // Sepolia
  USDC: '0x01C5C0122039549AD1493B8220cABEdD739BC44E', // Sepolia (Circle)
};

export const DECIMALS: Record<string, number> = {
  cUSD: 18,
  USDC: 6,
};
