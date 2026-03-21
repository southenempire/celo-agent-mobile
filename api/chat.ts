import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userInput, mode = 'parse' } = req.body;

  if (!userInput) {
    return res.status(400).json({ error: 'Missing userInput' });
  }

  // Diagnostic Logs (visible in Vercel Logs)
  console.log(`[API/Chat] Mode: ${mode}, Input Length: ${userInput.length}`);
  console.log(`[API/Chat] Gemini Key Set: ${!!process.env.GEMINI_API_KEY}`);
  console.log(`[API/Chat] OpenAI Key Set: ${!!process.env.OPENAI_API_KEY}`);

  try {
    if (mode === 'reply') {
      if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured on the server.");
      
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `You are CRIA, a friendly AI agent for fast remittances on Celo. User: "${userInput}". Reply in 1-2 warm sentences.`;
      
      const result = await model.generateContent(prompt);
      return res.status(200).json({ reply: result.response.text().trim() });
    }

    // Default: Parse Intent
    try {
      if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing for parsing.");
      
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `
        You are CRIA, an intelligent remittance agent. Parse this intent into JSON: "${userInput}"
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
        }
      `;

      const result = await model.generateContent(prompt);
      const content = result.response.text();
      return res.status(200).json({ intent: JSON.parse(content), provider: 'gemini' });
    } catch (geminiError) {
      console.error('[API/Chat] Gemini intent parsing failed:', geminiError);

      if (!process.env.OPENAI_API_KEY) throw new Error("Gemini failed and OPENAI_API_KEY is not configured.");

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a financial intent parser. Return JSON only.' },
          { role: 'user', content: `Parse: "${userInput}"` }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('OpenAI empty response');
      return res.status(200).json({ intent: JSON.parse(content), provider: 'openai' });
    }
  } catch (globalError: any) {
    console.error('[API/Chat] Global error:', globalError.message);
    return res.status(500).json({ 
      error: globalError.message,
      type: 'ServerlessFunctionError'
    });
  }
}
