import { createPublicClient, http } from 'viem';
import { celoSepolia, celo } from 'viem/chains';

export const testnet = celoSepolia;
export const mainnet = celo;

// Stablecoins by chainId
export const STABLECOINS_BY_CHAIN: Record<number, { cUSD: string; USDC: string }> = {
  // Celo Mainnet (42220)
  42220: {
    cUSD: '0x765de816845861e75a25fca122bb6898b8b1282a',
    USDC: '0xceba9300f2b948710d2653dd7b07f33a8b32118c',
  },
  // Celo Sepolia (44787)
  44787: {
    cUSD: '0xef4d55d6de8e8d73232827cd1e9b2f2dbb45bc80',
    USDC: '0x01c5c0122039549ad1493b8220cabedd739bc44e',
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
