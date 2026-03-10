/**
 * ERC-8004: Trustless Agents Standard
 * This standard uses on-chain registries for agent identity.
 * For this hackathon, we'll implement the "Agent Card" metadata and identity structure.
 */

export interface AgentCard {
    name: string;
    description: string;
    version: string;
    endpoint: string;
    paymentAddress: string;
    capabilities: string[];
    reputationRegistry?: string;
}

export const CRIA_AGENT_CARD: AgentCard = {
    name: "Celo Remittance Intent Agent (CRIA)",
    description: "An autonomous agent for fast, low-cost remittances on Celo.",
    version: "1.0.0",
    endpoint: "https://cria.agent.com", // Placeholder
    paymentAddress: "0x...", // Should be the agent's wallet address
    capabilities: [
        "remittance",
        "stablecoin-transfer",
        "fee-abstraction",
        "intent-parsing"
    ]
};

export function generateAgentIdentity(address: string): AgentCard {
    return {
        ...CRIA_AGENT_CARD,
        paymentAddress: address
    };
}
