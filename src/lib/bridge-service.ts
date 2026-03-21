import { Squid } from "@0xsquid/sdk";
import { type WalletClient, type PublicClient } from "viem";

/**
 * BridgeService handles cross-chain asset transfers using Squid Router.
 * Focuses on moving USDC/USDT from Solana/Base to Celo for off-ramping.
 */
export class BridgeService {
  private static squid = new Squid({
    baseUrl: "https://apiplus.squidrouter.com",
    integratorId: import.meta.env.VITE_SQUID_INTEGRATOR_ID || "cria-agent",
  });

  private static initialized = false;

  /**
   * Initializes the Squid SDK
   */
  private static async init() {
    if (this.initialized) return;
    try {
      await this.squid.init();
      this.initialized = true;
      console.log("[BridgeService] Squid SDK initialized.");
    } catch (error) {
      console.error("[BridgeService] Initialization failed:", error);
    }
  }

  /**
   * Gets a quote for a bridge transaction.
   */
  static async getBridgeQuote(params: {
    fromChain: string;
    toChain: string;
    fromToken: string;
    toToken: string;
    fromAmount: string; // in base units
    fromAddress: string;
    toAddress: string;
  }) {
    await this.init();
    try {
      const { route } = await this.squid.getRoute({
        fromChain: params.fromChain,
        toChain: params.toChain,
        fromToken: params.fromToken,
        toToken: params.toToken,
        fromAmount: params.fromAmount,
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        quoteOnly: true,
      });

      return {
        success: true,
        estimate: route.estimate,
        route,
        message: `Estimated arrival: ${Math.ceil(route.estimate.estimatedRouteDuration / 60)} mins`,
      };
    } catch (error) {
      console.error("[BridgeService] Quote error:", error);
      return {
        success: false,
        message: "Could not find a valid bridge route at this time.",
      };
    }
  }

  /**
   * Completes the execution loop by signing the Squid payload natively via Viem
   */
  static async executeBridge(route: any, signer: WalletClient) {
    if (!signer.account) throw new Error("Wallet connection required for cross-chain execution.");

    console.log("[BridgeService] Executing true on-chain bridge payload passing to Viem...", route);
    try {
      // Security Check: Target address must exist in route
      if (!route.transactionRequest?.targetAddress) {
        throw new Error("Squid Router failed to return a valid executable target contract.");
      }

      const hash = await signer.sendTransaction({
        to: route.transactionRequest.targetAddress as `0x${string}`,
        data: route.transactionRequest.data as `0x${string}`,
        value: BigInt(route.transactionRequest.value || 0),
        account: signer.account,
        chain: signer.chain,
      });

      return {
         success: true,
         hash,
         message: "Cross-chain payload secured and submitted to the Celo network."
      };
    } catch (error: any) {
      console.error("[BridgeService] Natively failed to execute cross-chain transaction:", error);
      return {
         success: false,
         hash: "",
         message: error.message || "Execution blocked. User declined or network error."
      };
    }
  }
}
