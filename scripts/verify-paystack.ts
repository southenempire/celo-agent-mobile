
import { getResilientIntent } from '../src/lib/llm';

async function test() {
    console.log("--- Testing Out-ramp Regex with User Data ---");
    
    // Test 1: Full sentence with special bank name
    const input1 = "Withdraw 5000 NGN to 9854748374 bank Paystack-Titan name Charles Duke Alaba";
    const result1 = await getResilientIntent(input1);
    console.log("Input 1:", input1);
    console.log("Result 1:", JSON.stringify(result1.intent, null, 2));

    // Test 2: Simplified sentence
    const input2 = "Send 10 to 9854748374 bank Paystack-Titan";
    const result2 = await getResilientIntent(input2);
    console.log("\nInput 2:", input2);
    console.log("Result 2:", JSON.stringify(result2.intent, null, 2));

    if (result1.intent.bankName === 'Paystack-Titan' && result1.intent.accountNumber === '9854748374') {
        console.log("\n✅ SUCCESS: Regex correctly parsed Paystack-Titan and account number.");
    } else {
        console.log("\n❌ FAILURE: Regex failed to parse Paystack-Titan or account number correctly.");
    }
}

test();
