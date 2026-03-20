# CRIA Pro — Celo Remittance Intent Agent

CRIA (Celo Remittance Intent Agent) is an autonomous, intelligent agent designed to simplify and accelerate cross-border remittances on the Celo blockchain. By combining natural language processing with Celo's fast settlement and stablecoin-native infrastructure, CRIA provides a "human-to-agent" interface for moving money globally.

## 🚀 Vision
Remittances today are slow, expensive, and technically intimidating for most users. CRIA removes these barriers by allowing users to interact with their funds using plain language, while the agent handles the underlying blockchain complexities, exchange rates, and ERC-8004 identity verification.

## ✨ Key Features (Hackathon Upgrades)
- **Natural Language Payments**: "Send 10 USDC to Mom" — CRIA now resolves names from your local memory.
- **Address Book (AgentVault-lite)**: "Remember 0x... as Mom" or "Save this address to my contacts as Sister."
- **Fee Comparison Engine**: Real-time savings analysis vs. Western Union ($12.40 saved!).
- **"Native" Fiat Support**: Automatic conversion from fiat amounts (NGN, KES, GHS, GBP, EUR) to USDC/cUSD using live exchange rates.
- **ERC-8004 Agent Identity**: Trustless registration and identity verification on the Celo blockchain.
- **Hybrid Intent Architecture**: High-accuracy LLM-based intent parsing with redundant fallbacks.
- **Micro-Fee Abstraction (x402-style)**: Modular service fee collection built into the agent's core protocol.
- **~5 Second Settlement**: Leveraging Celo's ultra-fast block times for near-instant global transfers.

## 🛠 Technical Stack
- **Blockchain**: Celo L2 (Stablecoins & Low Fees)
- **Identity Standard**: ERC-8004 (Trustless Agents Standard)
- **LLM Integration**: OpenAI (GPT-3.5) & Google Gemini (1.5 Flash)
- **Communication Protocol**: Intent-based financial operations
- **Frontend**: React, Vite, Tailwind CSS, Framer Motion
- **Wallet Integration**: Reown AppKit & Wagmi

## 📋 Hackathon Evaluation
CRIA was built for the **Celo: Build Agents for the Real World V2 Hackathon**. It aligns with all core judging criteria:
- **Technological Implementation**: Full on-chain ERC-8004 lifecycle.
- **Real-World Utility**: Directly targets the $800B+ remittance market.
- **Agent Intelligence**: Autonomous reasoning and tool-agnostic intent parsing.

## 📦 Getting Started

### Prerequisites
- Node.js & npm
- A Celo-compatible wallet (e.g., MetaMask, Valora)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/[your-repo]/celo-agent-mobile
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with your API keys:
   ```env
   VITE_OPENAI_API_KEY=your_openai_key
   VITE_GEMINI_API_KEY=your_gemini_key
   VITE_PROJECT_ID=your_reown_project_id
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## 📜 License
MIT
