const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

// Read .env.local manually since we don't have dotenv installed in this temp script context usually
try {
    const envPath = path.resolve(__dirname, '.env.local'); // Assuming run from root
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf-8');
        envConfig.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length === 2) {
                process.env[parts[0].trim()] = parts[1].trim();
            }
        });
    }
} catch (e) {
    console.log("Error reading .env.local", e);
}

const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

if (!apiKey) {
    console.error("No GOOGLE_GEMINI_API_KEY found in environment or .env.local");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
    try {
        console.log("Listing available models...");

        // User switched to gemini-2.5-flash-lite, let's test that specifically, plus fallbacks
        // Adding v1beta option explicitly in case that is needed for newer models
        const modelsToTry = ["gemini-2.5-flash-lite", "gemini-1.5-flash", "gemini-pro"];

        for (const mName of modelsToTry) {
            try {
                console.log(`Trying model: ${mName}`);
                const m = genAI.getGenerativeModel({ model: mName });
                const p = "Hello";
                const r = await m.generateContent(p);
                console.log(`SUCCESS: Model ${mName} worked!`);
                return; // Exit on first success
            } catch (e) {
                console.log(`FAILED: Model ${mName} - ${e.message.split('\n')[0]}`);
            }
        }
    } catch (error) {
        console.error("Error in run loop:", error);
    }
}

run();
