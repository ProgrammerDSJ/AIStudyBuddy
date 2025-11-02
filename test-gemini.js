// test-gemini.js - Quick test for your Gemini API key
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

console.log("🔑 Testing Gemini API Key...\n");

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY not found in .env file!");
  console.log("\nAdd this to your .env file:");
  console.log("GEMINI_API_KEY=your_key_here");
  process.exit(1);
}

console.log("✅ API Key found:", process.env.GEMINI_API_KEY.substring(0, 10) + "...\n");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Test different model names
const modelsToTest = [
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash", 
  "gemini-1.5-pro-latest",
  "gemini-1.5-pro",
  "gemini-pro"
];

async function testModel(modelName) {
  try {
    console.log(`\n🔄 Testing model: ${modelName}...`);
    
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 100,
      }
    });
    
    const result = await model.generateContent("Say 'Hello! I am working!' in one sentence.");
    const response = await result.response;
    const text = response.text();
    
    console.log(`✅ SUCCESS with ${modelName}!`);
    console.log(`Response: ${text}`);
    return { success: true, model: modelName, response: text };
    
  } catch (error) {
    console.log(`❌ FAILED with ${modelName}`);
    console.log(`Error: ${error.message}`);
    return { success: false, model: modelName, error: error.message };
  }
}

async function runTests() {
  console.log("=" .repeat(60));
  console.log("TESTING ALL AVAILABLE GEMINI MODELS");
  console.log("=" .repeat(60));
  
  const results = [];
  
  for (const modelName of modelsToTest) {
    const result = await testModel(modelName);
    results.push(result);
    
    // If we find a working model, we can stop
    if (result.success) {
      console.log("\n" + "=" .repeat(60));
      console.log("🎉 FOUND WORKING MODEL!");
      console.log("=" .repeat(60));
      console.log(`\nUse this model in your server.js:`);
      console.log(`model: "${modelName}"`);
      console.log("\nYour Gemini API is working perfectly!");
      break;
    }
  }
  
  // Summary
  console.log("\n" + "=" .repeat(60));
  console.log("TEST SUMMARY");
  console.log("=" .repeat(60));
  
  const successfulModels = results.filter(r => r.success);
  const failedModels = results.filter(r => !r.success);
  
  if (successfulModels.length > 0) {
    console.log("\n✅ Working models:");
    successfulModels.forEach(r => console.log(`   - ${r.model}`));
  }
  
  if (failedModels.length > 0) {
    console.log("\n❌ Failed models:");
    failedModels.forEach(r => console.log(`   - ${r.model}: ${r.error}`));
  }
  
  if (successfulModels.length === 0) {
    console.log("\n⚠️  NO WORKING MODELS FOUND!");
    console.log("\nPossible issues:");
    console.log("1. Invalid API key");
    console.log("2. API key doesn't have access to these models");
    console.log("3. Network/firewall blocking requests");
    console.log("\nPlease check:");
    console.log("- Your API key at: https://aistudio.google.com/app/apikey");
    console.log("- Make sure it's copied correctly to .env file");
  }
}

runTests().catch(error => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});