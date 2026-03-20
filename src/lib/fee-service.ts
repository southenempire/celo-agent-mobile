export interface FeeComparison {
    criaFee: number;
    traditionalFee: number;
    savings: number;
    savingsPercent: number;
}

export class FeeService {
    /**
     * Estimates fees for traditional remittance providers (e.g., Western Union)
     * based on the amount and typical corridor fees (3% to 7% + flat fees).
     */
    static getComparison(amountUSD: number, targetCurrency: string): FeeComparison {
        // Average traditional fee is roughly $5 flat + 3% for higher amounts
        const traditionalFee = 4.99 + (amountUSD * 0.035);
        
        // CRIA Fee is fixed at $0.01 + gas (negligible on Celo, roughly $0.001)
        const criaFee = 0.01;
        
        const savings = traditionalFee - criaFee;
        const savingsPercent = (savings / traditionalFee) * 100;

        return {
            criaFee,
            traditionalFee: parseFloat(traditionalFee.toFixed(2)),
            savings: parseFloat(savings.toFixed(2)),
            savingsPercent: parseFloat(savingsPercent.toFixed(1))
        };
    }
}
