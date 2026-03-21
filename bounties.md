# Bounty Cheat Sheet: CRIA Agent 🤖

This document outlines how the **CRIA (Celo Remittance Intent Agent)** qualifies for specific partner bounties in the Celo hackathons.

## 1. Celo Main Track (Real-World Utility)
- **Feature**: End-to-end remittance to NGN, KES, and GHS bank accounts.
- **Innovation**: Intent-based interface that handles phonetic currency variations and calculates real-time savings against Western Union.

## 2. ENS Track (Human-Readable Identity)
- **Integration**: The agent core resolves ENS names in the chat interface. You can say "Send 10 USDC to southen.eth" and CRIA will resolve it instantly.
- **Synergy**: Combines ENS lookup with ERC-8004 persistent agent identity for a better UX.

## 3. Squid & Uniswap (Cross-chain Bridging)
- **Feature**: "Invisible Bridging" from Solana, Base, and Ethereum to Celo.
- **Integration**: Uses the **Squid SDK** (powered by Uniswap) to find the best cross-chain route within the agent's logic.

## 4. Self Protocol (ZK-Powered Identity)
- **Integration**: CRIA uses **ERC-8004** to register its identity on Celo. It stores user preferences and contact reputation in a way that is compatible with Self Protocol's human verification frameworks.

## 5. Filecoin (Decentralized Memory)
- **Integration**: Agent memory (AgentVault) is decentralized using **IPFS/Pinata** (Filecoin infrastructure) to ensure user contacts and history are persistent and censorship-resistant.

## 6. Olas Track
- **Integration**: Designed following autonomous agent patterns, CRIA is ready for registration on the Olas marketplace as a specialized Remittance Agent.
