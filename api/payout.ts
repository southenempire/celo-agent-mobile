const API_BASE = 'https://api.chimoney.io/v0.2.4';
const API_KEY = process.env.CHIMONEY_API_KEY;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { type, payload } = req.body;

  try {
    let endpoint = '/payouts/bank';
    let body = payload;

    if (type === 'status') {
      endpoint = '/payouts/status';
      body = { chiRef: payload.chiRef };
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': API_KEY || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
