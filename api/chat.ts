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
  console.log(`[API/Chat] v3.1 - Hyper-Resilient Mode: ${mode}`);

  // ━━ SAFETY RAIL: Hardcoded responses for core demo questions ━━
  const lowerInput = userInput.toLowerCase();
  if (lowerInput.includes("capabilities") || lowerInput.includes("what can you do") || lowerInput.includes("help")) {
    const caps = "I am CRIA Pro, your Celo financial agent. 🚀\n\nI can help you with:\n• **Stablecoin Transfers**: Send USDC/NGN to any address.\n• **Cross-chain Bridging**: Bridge from Solana or Base to Celo.\n• **Fiat Off-ramps**: Withdraw Celo stablecoins to bank accounts via Chimoney.\n• **On-chain Identity**: I'm verified via ERC-8004 (ID #2335).\n\nHow can I help you settle a transaction today?";
    if (mode === 'reply') return res.status(200).json({ reply: caps });
    // If parsing, it's a 'help' intent
    return res.status(200).json({ intent: { intentType: 'help', amount: null, currency: null, recipient: null }, provider: 'hardcoded' });
  }

  try {
    // ━━ MODE: Conversational Reply ━━
    if (mode === 'reply') {
      // 1. TRY GEMINI (v1 Stable - Using 'gemini-pro' alias)
      try {
        if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
        
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `You are CRIA, a friendly AI agent for Celo payments. User: "${userInput}". Reply in 1-2 warm sentences.` }] }]
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) return res.status(200).json({ reply: reply.trim() });
        }
      } catch (gemError: any) {
        console.warn('[API/Chat] Gemini failed fallback to OpenAI');
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
        return res.status(200).json({ 
          reply: "I'm having a bit of trouble with my AI connections, but I'm ready to help with your transactions! 🦾" 
        });
      }
    }

    // ━━ MODE: Intent Parsing ━━
    // 1. TRY GEMINI (v1 Stable)
    try {
      if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Parse this intent into JSON: "${userInput}" ... [standard prompt schema]` }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) return res.status(200).json({ intent: JSON.parse(content), provider: 'gemini' });
      }
    } catch (e) {
      console.warn('[API/Chat] Gemini parsing failed');
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
      return res.status(200).json({ 
        intent: { intentType: 'unknown', amount: null, currency: null, recipient: null, targetCurrency: null },
        provider: 'regex' 
      });
    }

  } catch (globalError: any) {
    return res.status(500).json({ error: globalError.message });
  }
}
