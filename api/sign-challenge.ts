import { createPrivateKey, sign } from 'crypto';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { challengeHash } = req.body;
  const privHex = process.env.AGENT_ED25519_PRIV;

  if (!challengeHash) {
    return res.status(400).json({ error: 'Missing challengeHash' });
  }

  if (!privHex) {
    return res.status(500).json({ error: 'AGENT_ED25519_PRIV unset in environment' });
  }

  try {
    // Construct Ed25519 PKCS8 key from raw hex
    const privateKey = createPrivateKey({
      key: Buffer.concat([
        Buffer.from('302e020100300506032b657004220420', 'hex'), 
        Buffer.from(privHex.replace('0x', ''), 'hex')
      ]),
      format: 'der',
      type: 'pkcs8'
    });

    // Remove 0x prefix if present for the sign function
    const message = Buffer.from(challengeHash.replace('0x', ''), 'hex');
    const signature = sign(null, message, privateKey);

    return res.status(200).json({ signature: signature.toString('hex') });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
