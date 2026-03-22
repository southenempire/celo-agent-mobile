/**
 * ERC-8004: Trustless Agents Standard
 * Identity Registry — live on Celo Sepolia
 * Contract uses ERC-721 with register() function
 *
 * Registry addresses (deterministic across EVM chains):
 * Ethereum Mainnet:   0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
 * Ethereum Sepolia:   0x8004A818BFB912233c491871b3d84c89A494BD9e
 * Celo Sepolia:       0x8004A818BFB912233c491871b3d84c89A494BD9e (same as ETH Sepolia testnet)
 */

import type { WalletClient, PublicClient } from 'viem';
import { celoSepolia } from 'viem/chains';

// ERC-8004 Identity Registry (Deterministic)
export const ERC8004_REGISTRY_MAINNET = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as const; // ETH, Base, Celo
export const ERC8004_REGISTRY_SEPOLIA = '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const; // ETH Sepolia, Celo Sepolia

// Default registry
export const ERC8004_REGISTRY = ERC8004_REGISTRY_SEPOLIA;
export const CHAIN_ID = celoSepolia.id; 

export const ERC8004_ABI = [
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'tokenOfOwnerByIndex',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'Registered',
    type: 'event',
    inputs: [
      { type: 'uint256', name: 'agentId', indexed: true },
      { type: 'string', name: 'agentURI' },
      { type: 'address', name: 'owner', indexed: true },
    ],
  },
] as const;

export interface AgentCard {
  name: string;
  description: string;
  version: string;
  endpoint: string;
  paymentAddress: string;
  capabilities: string[];
  reputationRegistry?: string;
}

export const CRIA_AGENT_CARD: Omit<AgentCard, 'paymentAddress'> = {
  name: "Celo Remittance Intent Agent (CRIA)",
  description: "An autonomous agent for fast, low-cost remittances on Celo. Understands natural language, settles in ~5 seconds, with ERC-8004 identity and Self Protocol verification.",
  version: "2.0.0",
  endpoint: "https://celo-agent-mobile.vercel.app",
  capabilities: [
    "remittance",
    "stablecoin-transfer",
    "fee-abstraction",
    "intent-parsing",
    "balance-check",
    "exchange-rate",
  ],
};

export function generateAgentIdentity(address: string): AgentCard {
  return {
    ...CRIA_AGENT_CARD,
    paymentAddress: address,
  };
}

/**
 * Build a base64-encoded on-chain agent URI for ERC-8004 registration
 */
export function buildAgentURI(address: string, deployedUrl?: string): string {
  const card = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "CRIA - Celo Remittance Intent Agent",
    description: CRIA_AGENT_CARD.description,
    image: "https://celo-agent-mobile.vercel.app/icon-512.png",
    services: [
      {
        name: "web",
        endpoint: deployedUrl || "https://celo-agent-mobile.vercel.app",
      },
    ],
    x402Support: true,
    active: true,
  };
  const json = JSON.stringify(card);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `data:application/json;base64,${b64}`;
}

/**
 * Register CRIA as an ERC-8004 agent on-chain.
 * Returns the agentId (tokenId) upon success.
 */
export async function registerAgentOnChain(
  walletClient: WalletClient,
  publicClient: PublicClient,
  deployedUrl?: string
): Promise<{ agentId: string; txHash: string }> {
  const address = walletClient.account?.address as `0x${string}`;
  const agentURI = buildAgentURI(address, deployedUrl);
  
  // Use Registry based on chainId (Mainnet/L2 vs Sepolia)
  const chainId = await walletClient.getChainId();
  const registry = (chainId === 42220 || chainId === 8453 || chainId === 1) 
    ? ERC8004_REGISTRY_MAINNET 
    : ERC8004_REGISTRY_SEPOLIA;

  // Check if already registered (has a token)
  try {
    const balance = await publicClient.readContract({
      address: registry,
      abi: ERC8004_ABI,
      functionName: 'balanceOf',
      args: [address],
    });

    if (balance > 0n) {
      // Already registered — get existing agentId
      const agentId = await publicClient.readContract({
        address: registry,
        abi: ERC8004_ABI,
        functionName: 'tokenOfOwnerByIndex',
        args: [address, 0n],
      });
      return { agentId: agentId.toString(), txHash: '' };
    }
  } catch {
    // tokenOfOwnerByIndex may not exist on all registries — continue to register
  }

  // Mint new agent identity
  const hash = await walletClient.writeContract({
    address: registry,
    abi: ERC8004_ABI,
    functionName: 'register',
    args: [agentURI],
    chain: walletClient.chain,
    account: walletClient.account!,
  } as any);

  // Wait for receipt and parse the Registered event
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  let agentId = 'pending';
  for (const log of receipt.logs) {
    try {
      // The Registered event topic[1] is the agentId
      if (log.topics[1]) {
        agentId = BigInt(log.topics[1]).toString();
        break;
      }
    } catch { /* */ }
  }

  return { agentId, txHash: hash };
}

/**
 * Format the full ERC-8004 agent registry string
 * Format: eip155:{chainId}:{registryAddress}
 */
export function formatAgentRegistry(chainId: number): string {
  const registry = (chainId === 42220 || chainId === 8453 || chainId === 1) 
    ? ERC8004_REGISTRY_MAINNET 
    : ERC8004_REGISTRY_SEPOLIA;
  return `eip155:${chainId}:${registry}`;
}
