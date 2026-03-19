import { createPublicClient, http } from 'viem';
import { celoSepolia, celo } from 'viem/chains';

export const testnet = celoSepolia;
export const mainnet = celo;

// Stablecoins by chainId
export const STABLECOINS_BY_CHAIN: Record<number, { cUSD: string; USDC: string }> = {
  // Celo Mainnet (42220)
  42220: {
    cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
    USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
  },
  // Celo Sepolia (44787)
  44787: {
    cUSD: '0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80',
    USDC: '0x01C5C0122039549Ad1493B8220cABEdD739BC44E',
  },
};

// Default to Sepolia for backwards compatibility
export const STABLECOINS = STABLECOINS_BY_CHAIN[44787];

export const DECIMALS: Record<string, number> = {
  cUSD: 18,
  USDC: 6,
};

export const publicClient = createPublicClient({
  chain: testnet,
  transport: http(),
});
