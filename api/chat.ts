import { OpenAI } from 'openai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userInput, mode = 'parse' } = req.body;

  if (!userInput) {
    return res.status(400).json({ error: 'Missing userInput' });
  }

  // Diagnostic Logs
  console.log(`[API/Chat] v3.0 - Resilient Mode: ${mode}`);

  try {
    // ━━ MODE: Conversational Reply ━━
    if (mode === 'reply') {
      // 1. TRY GEMINI (via Native Fetch - most reliable on Vercel)
      try {
        if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `You are CRIA, a friendly AI agent for Celo payments. User: "${userInput}". Reply in 1-2 warm sentences.` }] }]
          })
        });
        
        if (!response.ok) {
           const err = await response.json();
           throw new Error(`Gemini Fetch Failed: ${err.error?.message || response.statusText}`);
        }
        
        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) return res.status(200).json({ reply: reply.trim() });
      } catch (gemError: any) {
        console.warn('[API/Chat] Gemini failed, falling back to OpenAI:', gemError.message);
      }

      // 2. TRY OPENAI (Fallback)
      try {
        if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: userInput }],
        });
        return res.status(200).json({ reply: response.choices[0].message.content?.trim() });
      } catch (oaError: any) {
        console.error('[API/Chat] OpenAI failed:', oaError.message);
        return res.status(200).json({ 
          reply: "I'm having a bit of trouble with my AI connections, but I'm ready to help with your transactions! 🦾" 
        });
      }
    }

    // ━━ MODE: Intent Parsing ━━
    // 1. TRY GEMINI (Native Fetch)
    try {
      if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const prompt = `You are CRIA, an intelligent remittance agent. Parse this intent into JSON: "${userInput}"
        Structure: {
          "intentType": "send" | "batch_send" | "out_ramp" | "check_balance" | "get_rate" | "help" | "save_contact" | "unknown",
          "amount": string | null,
          "currency": string | null,
          "recipient": string | null,
          "targetCurrency": string | null,
          "sourceChain": string | null,
          "targetChain": string | null,
          "accountNumber": string | null,
          "bankName": string | null,
          "accountName": string | null,
          "batch": array | null
        }`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) return res.status(200).json({ intent: JSON.parse(content), provider: 'gemini' });
      }
    } catch (e) {
      console.warn('[API/Chat] Gemini parsing failed fallback to OpenAI');
    }

    // 2. TRY OPENAI (Standard Fallback)
    try {
      if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: 'Return JSON only.' }, { role: 'user', content: `Parse: "${userInput}"` }],
        response_format: { type: 'json_object' }
      });
      const content = response.choices[0].message.content;
      if (content) return res.status(200).json({ intent: JSON.parse(content), provider: 'openai' });
    } catch (e) {
      // Final hard fallback to regex
      return res.status(200).json({ 
        intent: { intentType: 'unknown', amount: null, currency: null, recipient: null, targetCurrency: null },
        provider: 'regex' 
      });
    }

  } catch (globalError: any) {
    console.error('[API/Chat] Global error:', globalError.message);
    return res.status(500).json({ error: globalError.message });
  }
}
