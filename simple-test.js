// simple-test.js - Dead simple Gemini test
import { GoogleGenerativeAI } from "@google/generative-ai";

// PASTE YOUR API KEY DIRECTLY HERE FOR TESTING
const API_KEY = "AIzaSyBpdKki8mtaq54eVDnrDlD8eWDyAYsibj4";

console.log("🔑 Testing with API Key:", API_KEY.substring(0, 15) + "...\n");

if (!API_KEY || API_KEY === "PLEASE PASTE YOUR API KEY HERE") {
  console.error("❌ Please paste your API key in this file first!");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

async function testGemini() {
  try {
    console.log("🔄 Attempting to connect to Gemini...\n");
    
    // Try the simplest model first
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    console.log("📝 Sending test message...\n");
    
    const result = await model.generateContent("Say hello");
    const response = await result.response;
    const text = response.text();
    
    console.log("✅ SUCCESS! Gemini is working!\n");
    console.log("Response:", text);
    console.log("\n🎉 Your API key is valid and working!");
    
  } catch (error) {
    console.error("❌ ERROR:", error.message);
    console.error("\nFull error:", error);
    
    if (error.message.includes("API_KEY_INVALID")) {
      console.log("\n💡 Your API key is invalid. Please:");
      console.log("1. Go to: https://aistudio.google.com/app/apikey");
      console.log("2. Create a new API key");
      console.log("3. Copy it exactly as shown");
      console.log("4. Paste it in this file");
    }
  }
}

testGemini();