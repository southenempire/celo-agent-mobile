import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.VITE_GEMINI_API_KEY;

async function test() {
    if (!apiKey) {
        console.error("No API key found");
        return;
    }
    console.log("Testing with key:", apiKey.slice(0, 10) + "...");
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hi");
        console.log("Success:", result.response.text());
    } catch (e: any) {
        console.error("Failed:", e.message);
        if (e.status) console.error("Status:", e.status);
    }
}

test();
