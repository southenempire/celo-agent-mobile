/**
 * PayoutService handles real-world bank transfers via Chimoney.
 * Supports Nigeria (NGN), Kenya (KES), and Ghana (GHS).
 */

export interface PayoutResult {
    success: boolean;
    transactionId?: string;
    message: string;
}

export class PayoutService {
    private static API_BASE = 'https://api.chimoney.io/v0.2.4';
    private static API_KEY = import.meta.env.VITE_CHIMONEY_API_KEY || 'sandbox-key';

    /**
     * Initiates a bank payout in Nigeria, Kenya, or Ghana.
     */
    static async initiateBankPayout(params: {
        accountNumber: string;
        bankName: string;
        accountName: string;
        amount: number;
        currency: string;
    }): Promise<PayoutResult> {
        try {
            console.log('[PayoutService] Initiating Chimoney payout:', params);

            let valueInUSD = params.amount;
            if (params.currency === 'NGN') valueInUSD = Number((params.amount / 1600).toFixed(2));
            if (params.currency === 'KES') valueInUSD = Number((params.amount / 130).toFixed(2));

            const payload = {
                banks: [
                    {
                        countryToSend: this.getCountryName(params.currency),
                        account_bank: params.bankName,
                        account_number: params.accountNumber,
                        valueInUSD,
                        fullname: params.accountName
                    }
                ]
            };

            const response = await fetch(`${this.API_BASE}/payouts/bank`, {
                method: 'POST',
                headers: {
                    'X-API-KEY': this.API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.status === 'success') {
                return {
                    success: true,
                    transactionId: data.data?.[0]?.txId || 'cm-' + Date.now(),
                    message: 'Bank transfer initiated successfully via Chimoney.'
                };
            }

            return {
                success: false,
                message: data.error || data.message || 'Chimoney payout failed.'
            };
        } catch (error) {
            console.error('[PayoutService] Error:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Unknown payout error'
            };
        }
    }

    /**
     * Checks the status of a payout using a transaction ID (chiRef)
     */
    static async getPayoutStatus(chiRef: string): Promise<{ status: string; message: string }> {
        try {
            const response = await fetch(`${this.API_BASE}/payouts/status`, {
                method: 'POST',
                headers: {
                    'X-API-KEY': this.API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ chiRef })
            });

            const data = await response.json();
            if (data.status === 'success') {
                return {
                    status: data.data?.status || 'unknown',
                    message: `Payout Status: ${data.data?.status || 'Processing'}`
                };
            }
            return { status: 'error', message: data.message || 'Failed to fetch status' };
        } catch (error) {
            return { status: 'error', message: 'Status check failed' };
        }
    }

    /**
     * Map currency to country name for Chimoney API
     */
    private static getCountryName(currency: string): string {
        switch (currency.toUpperCase()) {
            case 'NGN': return 'Nigeria';
            case 'KES': return 'Kenya';
            case 'GHS': return 'Ghana';
            default: return 'Nigeria';
        }
    }
}
