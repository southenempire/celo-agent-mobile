import { createPrivateKey, sign } from 'node:crypto';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Signs a hex-encoded challenge hash with an Ed25519 private key.
 * 
 * Usage: npx tsx scripts/sign-challenge.ts <challenge_hex>
 */

const challengeHex = process.argv[2] || "e555c07e277e8f61e53408269ef187ce50fef764e4bb4c499c95eef021440cb0";
const privKeyHex = process.env.AGENT_ED25519_PRIV;

if (!privKeyHex) {
    console.error("❌ AGENT_ED25519_PRIV not found in .env");
    process.exit(1);
}

// Ensure the private key is handled correctly for Node's crypto
// Ed25519 raw private keys are 32 bytes.
const privKeyBuffer = Buffer.from(privKeyHex, 'hex');
const challengeBuffer = Buffer.from(challengeHex.replace('0x', ''), 'hex');

try {
    // Creating a KeyObject for Ed25519
    const keyObject = createPrivateKey({
        key: privKeyBuffer,
        format: 'der',
        type: 'pkcs8'
    });
    
    // Note: Node 12+ supports Ed25519 but the 'key' argument for createPrivateKey 
    // for Ed25519 usually requires a specific PKCS8 wrapper if passing raw bytes.
    // However, many agent frameworks use tweetnacl for raw bytes.
    // If this fails, I'll use a raw implementation.
    
    console.log("Challenge:", challengeHex);
    console.log("Signing...");
    
    // This is the standard way if the key is PKCS8. 
    // If it's pure raw bytes, we might need a tiny helper or use tweetnacl.
} catch (e) {
    // Fallback: If Node crypto fails due to raw key format, provide a manual signing script
    // using a temporary installation of tweetnacl or a standalone snippet.
}

// Let's use a simpler approach that definitely works with raw 32-byte keys.
// I'll use a small JS snippet that implements the Ed25519 signature or use an online tool logic.
// Actually, I'll try to use the most common library if I can find it.
