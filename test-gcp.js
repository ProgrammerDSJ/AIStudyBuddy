// test-gcp.js - Run this separately to test GCP connection
import { Storage } from "@google-cloud/storage";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

console.log("🧪 Testing GCP Storage Configuration\n");
console.log("=".repeat(50));

// Step 1: Check environment variables
console.log("\n📋 Step 1: Checking Environment Variables");
console.log("-".repeat(50));
console.log("GCP_PROJECT_ID:", process.env.GCP_PROJECT_ID || "❌ NOT SET");
console.log("GCS_BUCKET_NAME:", process.env.GCS_BUCKET_NAME || "❌ NOT SET");
console.log("GCP_KEYFILE_PATH:", process.env.GCP_KEYFILE_PATH || "❌ NOT SET");

if (!process.env.GCP_PROJECT_ID || !process.env.GCS_BUCKET_NAME || !process.env.GCP_KEYFILE_PATH) {
  console.error("\n❌ Missing required environment variables!");
  console.log("\nAdd these to your .env file:");
  console.log("GCP_PROJECT_ID=your-project-id");
  console.log("GCS_BUCKET_NAME=your-bucket-name");
  console.log("GCP_KEYFILE_PATH=./your-service-account-key.json");
  process.exit(1);
}

// Step 2: Check keyfile exists
console.log("\n📄 Step 2: Checking Service Account Key File");
console.log("-".repeat(50));

if (!fs.existsSync(process.env.GCP_KEYFILE_PATH)) {
  console.error("❌ Key file not found at:", process.env.GCP_KEYFILE_PATH);
  console.log("\nMake sure the JSON key file exists at this path");
  process.exit(1);
}

console.log("✅ Key file found at:", process.env.GCP_KEYFILE_PATH);

// Step 3: Validate keyfile content
console.log("\n🔍 Step 3: Validating Key File Content");
console.log("-".repeat(50));

let keyfileData;
try {
  keyfileData = JSON.parse(fs.readFileSync(process.env.GCP_KEYFILE_PATH, 'utf8'));
  console.log("✅ Key file is valid JSON");
  console.log("Project ID from keyfile:", keyfileData.project_id);
  console.log("Service Account Email:", keyfileData.client_email);
  console.log("Key Type:", keyfileData.type);
  
  if (keyfileData.project_id !== process.env.GCP_PROJECT_ID) {
    console.warn("⚠️  WARNING: Project ID mismatch!");
    console.log("   .env file:", process.env.GCP_PROJECT_ID);
    console.log("   Key file:", keyfileData.project_id);
  }
} catch (err) {
  console.error("❌ Invalid key file:", err.message);
  process.exit(1);
}

// Step 4: Initialize Storage
console.log("\n🔧 Step 4: Initializing Storage Client");
console.log("-".repeat(50));

let storage, bucket;
try {
  storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GCP_KEYFILE_PATH,
  });
  console.log("✅ Storage client initialized");
  
  bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
  console.log("✅ Bucket reference created:", process.env.GCS_BUCKET_NAME);
} catch (err) {
  console.error("❌ Failed to initialize storage:", err.message);
  process.exit(1);
}

// Step 5: Test bucket access
console.log("\n🪣 Step 5: Testing Bucket Access");
console.log("-".repeat(50));

async function testBucket() {
  try {
    const [exists] = await bucket.exists();
    if (!exists) {
      console.error("❌ Bucket does not exist or is not accessible");
      console.log("\nPossible issues:");
      console.log("1. Bucket name is wrong");
      console.log("2. Service account doesn't have access to the bucket");
      console.log("3. Bucket is in a different project");
      return false;
    }
    
    console.log("✅ Bucket exists and is accessible");
    
    // Get bucket metadata
    const [metadata] = await bucket.getMetadata();
    console.log("\nBucket Details:");
    console.log("  - Location:", metadata.location);
    console.log("  - Storage Class:", metadata.storageClass);
    console.log("  - Created:", metadata.timeCreated);
    
    return true;
  } catch (err) {
    console.error("❌ Error accessing bucket:", err.message);
    console.error("Error code:", err.code);
    
    if (err.code === 403) {
      console.log("\n💡 Permission denied. Make sure:");
      console.log("   1. Service account has 'Storage Object Admin' role");
      console.log("   2. Bucket IAM permissions include the service account");
    }
    
    return false;
  }
}

// Step 6: Test file upload
console.log("\n📤 Step 6: Testing File Upload");
console.log("-".repeat(50));

async function testUpload() {
  try {
    const testFileName = `test-uploads/test_${Date.now()}.txt`;
    const testContent = "This is a test file uploaded at " + new Date().toISOString();
    const file = bucket.file(testFileName);
    
    console.log("Uploading test file:", testFileName);
    
    await file.save(testContent, {
      contentType: 'text/plain',
      resumable: false
    });
    
    console.log("✅ File uploaded successfully");
    
    // Try to make it public
    try {
      await file.makePublic();
      console.log("✅ File made public successfully");
      
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      console.log("📎 Public URL:", publicUrl);
      console.log("\n✨ Test the URL in your browser to confirm it works");
      
    } catch (publicError) {
      console.warn("⚠️  Warning: Could not make file public");
      console.log("Error:", publicError.message);
      console.log("\nThis might be fine if your bucket requires authentication");
      console.log("Or you may need to adjust bucket permissions");
    }
    
    // Clean up - delete test file
    console.log("\n🧹 Cleaning up test file...");
    await file.delete();
    console.log("✅ Test file deleted");
    
    return true;
  } catch (err) {
    console.error("❌ Upload test failed:", err.message);
    console.error("Error code:", err.code);
    console.error("Full error:", err);
    
    if (err.code === 403) {
      console.log("\n💡 Permission denied during upload. Check:");
      console.log("   1. Service account has 'Storage Object Creator' or 'Storage Object Admin' role");
      console.log("   2. Bucket permissions allow the service account to write");
    }
    
    return false;
  }
}

// Step 7: Check IAM permissions
console.log("\n🔐 Step 7: Checking IAM Permissions");
console.log("-".repeat(50));

async function checkPermissions() {
  try {
    const [policy] = await bucket.iam.getPolicy();
    console.log("✅ Successfully retrieved IAM policy");
    
    const serviceAccountEmail = keyfileData.client_email;
    let hasPermissions = false;
    
    console.log("\nSearching for service account in IAM bindings...");
    policy.bindings.forEach(binding => {
      if (binding.members.includes(`serviceAccount:${serviceAccountEmail}`)) {
        console.log(`✅ Found in role: ${binding.role}`);
        hasPermissions = true;
      }
    });
    
    if (!hasPermissions) {
      console.warn("⚠️  Service account not found in bucket IAM policy");
      console.log("This means the service account might have project-level permissions");
      console.log("or the bucket is using legacy ACLs instead of uniform IAM");
    }
    
    return true;
  } catch (err) {
    console.warn("⚠️  Could not check IAM policy:", err.message);
    console.log("This is okay - continuing with other tests");
    return true;
  }
}

// Run all tests
async function runAllTests() {
  console.log("\n" + "=".repeat(50));
  console.log("🚀 Starting GCP Storage Tests");
  console.log("=".repeat(50));
  
  const bucketOk = await testBucket();
  if (!bucketOk) {
    console.log("\n❌ Bucket test failed. Fix bucket access before continuing.");
    process.exit(1);
  }
  
  await checkPermissions();
  
  const uploadOk = await testUpload();
  if (!uploadOk) {
    console.log("\n❌ Upload test failed. Fix upload permissions.");
    process.exit(1);
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("✅ ALL TESTS PASSED!");
  console.log("=".repeat(50));
  console.log("\n🎉 Your GCP Storage is properly configured!");
  console.log("You can now use file uploads in your application.\n");
}

runAllTests().catch(err => {
  console.error("\n💥 Fatal error:", err);
  process.exit(1);
});