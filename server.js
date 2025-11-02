import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import mongoose from "mongoose";
import { Storage } from "@google-cloud/storage";
import multer from "multer";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import session from "express-session";
import MongoStore from "connect-mongo";

dotenv.config();

const app = express();

// CORS - Must be before other middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5000",
  credentials: true
}));

app.use(bodyParser.json());

// ===== Session Management (CRITICAL - Must be before routes) =====
app.use(session({
  secret: process.env.SESSION_SECRET || "ai-study-buddy-secret-2025",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    touchAfter: 24 * 3600
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
  }
}));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection failed:", err));

// Supabase connection
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Google Gemini connection
let genAI;
let model;
let geminiReady = false;

try {
  if (process.env.GEMINI_API_KEY) {
    console.log("🔑 Initializing Gemini with API key:", process.env.GEMINI_API_KEY.substring(0, 10) + "...");
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Try models in order of preference
    const modelNames = ["gemini-pro-latest"];
    
    for (const modelName of modelNames) {
      try {
        console.log(`🔄 Trying model: ${modelName}...`);
        model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        });
        
        // Test the model
        const testResult = await model.generateContent("Hello");
        await testResult.response;
        
        console.log(`✅ Google Gemini AI initialized successfully with model: ${modelName}`);
        geminiReady = true;
        break;
      } catch (err) {
        console.log(`❌ Model ${modelName} failed:`, err.message);
        continue;
      }
    }
    
    if (!geminiReady) {
      console.error("❌ All Gemini models failed to initialize");
    }
  } else {
    console.warn("⚠️ GEMINI_API_KEY not found. AI Buddy will use fallback responses.");
  }
} catch (err) {
  console.error("❌ Failed to initialize Gemini:", err.message);
}

app.use(express.static("public"));

// ===== GCP Storage Setup =====
let storage;
let bucket;
let gcpConfigured = false;

try {
  if (process.env.GCP_KEYFILE_PATH && fs.existsSync(process.env.GCP_KEYFILE_PATH)) {
    const keyfileContent = JSON.parse(fs.readFileSync(process.env.GCP_KEYFILE_PATH, 'utf8'));
    
    storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID || keyfileContent.project_id,
      keyFilename: process.env.GCP_KEYFILE_PATH,
    });

    bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
    
    bucket.exists().then(([exists]) => {
      if (exists) {
        console.log("✅ GCP bucket configured");
        gcpConfigured = true;
      }
    }).catch(err => {
      console.log("⚠️ GCP bucket check failed:", err.message);
    });
  } else {
    console.warn("⚠️ GCP not configured. File uploads disabled.");
  }
} catch (err) {
  console.error("❌ GCP initialization error:", err.message);
}

// ===== MongoDB Schemas =====
const noteSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, default: "" },
  type: { type: String, enum: ["test","assignment","project","notes"], default: "notes" },
  fileUrl: { type: String, default: "" },
  mimeType: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const chapterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  notes: [noteSchema],
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  chapters: [chapterSchema],
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const userSchema = new mongoose.Schema({
  uuid: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  subjects: [subjectSchema]
});

const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

// ===== Middleware: Check Authentication =====
const requireAuth = (req, res, next) => {
  if (!req.session.userUUID) {
    return res.status(401).json({ error: "Not authenticated. Please log in." });
  }
  next();
};

// ===== Authentication APIs =====

app.post("/api/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase.from("users").insert([
      { username, email, password: hashedPassword }
    ]).select().single();

    if (error) throw error;

    await UserModel.create({ uuid: data.id, subjects: [] });

    res.json({ message: "User registered successfully", redirect: "/login.html" });
  } catch (err) {
    console.error("Registration error:", err.message);
    res.status(500).json({ error: "Failed to register user" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  console.log("🔐 Login attempt for:", email);

  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, password, username")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("Database error:", error);
      return res.status(500).json({ error: "Database query failed" });
    }

    if (!user) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    if (!user.password) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Set session
    req.session.userUUID = user.id;
    req.session.username = user.username;
    req.session.email = user.email;
    
    console.log("✅ Login successful. User UUID:", user.id);

    res.json({
      message: "Login successful",
      redirect: "/dashboard.html",
      username: user.username,
      email: user.email,
      userId: user.id
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully" });
  });
});

// ===== AI Buddy Chat API with INTELLIGENT FALLBACK =====
app.post("/api/ai-buddy/chat", requireAuth, async (req, res) => {
  try {
    console.log("\n🤖 ===== AI BUDDY CHAT REQUEST =====");
    
    const { message, notesContext } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log("✅ Message:", message.substring(0, 50) + "...");

    if (!req.session.chatHistory) {
      req.session.chatHistory = [];
    }

    let aiResponse = "";

    // TRY GEMINI FIRST
    if (geminiReady && model) {
      try {
        let fullPrompt = `You are a friendly AI study buddy. Be encouraging and concise (2-3 sentences).

`;
        if (notesContext && notesContext.trim()) {
          fullPrompt += `Student's materials:\n${notesContext.substring(0, 300)}\n\n`;
        }

        const recentHistory = req.session.chatHistory.slice(-6);
        if (recentHistory.length > 0) {
          fullPrompt += "Recent chat:\n";
          recentHistory.forEach(msg => {
            fullPrompt += `${msg.role === "user" ? "Student" : "AI"}: ${msg.content}\n`;
          });
        }
        
        fullPrompt += `Student: ${message}\nAI Buddy:`;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        aiResponse = response.text();
        
        console.log("✅ Gemini responded");

      } catch (geminiError) {
        console.log("⚠️ Gemini failed, using fallback:", geminiError.message);
        aiResponse = null;
      }
    }

    // INTELLIGENT FALLBACK
    if (!aiResponse) {
      console.log("🎯 Using fallback responses");
      
      const lowerMsg = message.toLowerCase();
      
      if (lowerMsg.includes("hello") || lowerMsg.includes("hi") || lowerMsg.includes("hey")) {
        aiResponse = "Hi there! I'm your AI study buddy! I'm here to help you learn and understand your materials better. What would you like to study today?";
      }
      else if (lowerMsg.includes("help") || lowerMsg.includes("what can you")) {
        aiResponse = "I can help you in many ways! I can explain concepts, quiz you on topics, break down complex ideas, and provide study tips. Just ask me anything about your subjects!";
      }
      else if (lowerMsg.includes("explain") || lowerMsg.includes("what is")) {
        aiResponse = `Great question! ${notesContext ? "Based on your notes, " : ""}Let me break this down for you. This concept is fundamental - once you grasp it, everything becomes clearer! Would you like me to go deeper into any specific aspect?`;
      }
      else if (lowerMsg.includes("quiz") || lowerMsg.includes("test")) {
        aiResponse = "Excellent! Testing yourself is one of the best ways to learn. Can you explain the main concept from your recent notes in your own words? This helps reinforce understanding!";
      }
      else if (lowerMsg.includes("difficult") || lowerMsg.includes("hard") || lowerMsg.includes("don't understand")) {
        aiResponse = "Don't worry, that's completely normal! Let's break this down into smaller pieces. Which specific part is confusing? We'll tackle it step by step together!";
      }
      else if (lowerMsg.includes("exam") || lowerMsg.includes("preparation")) {
        aiResponse = "Preparing for exams? Smart! Review regularly, practice explaining concepts aloud, and test yourself frequently. Focus on understanding, not memorizing. You've got this!";
      }
      else if (lowerMsg.includes("thank")) {
        aiResponse = "You're very welcome! I'm always here to help you succeed. Keep up the great work! Is there anything else you'd like to learn about?";
      }
      else {
        aiResponse = `That's an interesting question! ${notesContext ? "Looking at your study materials, " : ""}The best approach is to break it down systematically. Can you tell me more about what you'd like to explore? I'm here to help!`;
      }
    }

    // Save to history
    req.session.chatHistory.push({ role: "user", content: message });
    req.session.chatHistory.push({ role: "assistant", content: aiResponse });

    if (req.session.chatHistory.length > 10) {
      req.session.chatHistory = req.session.chatHistory.slice(-10);
    }

    console.log("✅ Response sent\n");
    res.json({ response: aiResponse });

  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ 
      error: "I'm having a technical difficulty, but I'm still here to help! Could you try asking again?",
      details: err.message 
    });
  }
});

app.post("/api/ai-buddy/clear-chat", requireAuth, (req, res) => {
  req.session.chatHistory = [];
  res.json({ message: "Chat history cleared" });
});

// ===== User Data APIs =====

app.get("/api/user/subjects", requireAuth, async (req, res) => {
  try {
    const userDoc = await UserModel.findOne({ uuid: req.session.userUUID }).lean();

    if (!userDoc || !userDoc.subjects || userDoc.subjects.length === 0) {
      return res.json({ 
        hasSubjects: false, 
        message: "Add your first subject to get started!",
        subjects: []
      });
    }

    return res.json({ 
      hasSubjects: true, 
      subjects: userDoc.subjects 
    });
  } catch (err) {
    console.error("GET subjects error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/user/subjects", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Subject name required" });
    }

    const update = await UserModel.findOneAndUpdate(
      { uuid: req.session.userUUID },
      { $push: { subjects: { name: name.trim(), chapters: [] } } },
      { upsert: true, new: true }
    ).lean();

    return res.status(201).json({ 
      message: "Subject created", 
      subjects: update.subjects 
    });
  } catch (err) {
    console.error("POST subjects error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/user/chapters", requireAuth, async (req, res) => {
  try {
    const { subjectId, name } = req.body;
    if (!subjectId || !name) {
      return res.status(400).json({ error: "subjectId and name required" });
    }

    const user = await UserModel.findOne({ uuid: req.session.userUUID });
    if (!user) return res.status(404).json({ error: "User not found" });

    const subject = user.subjects.id(subjectId);
    if (!subject) return res.status(404).json({ error: "Subject not found" });

    subject.chapters.push({ name: name.trim(), notes: [] });
    await user.save();

    return res.status(201).json({ 
      message: "Chapter created", 
      chapters: subject.chapters 
    });
  } catch (err) {
    console.error("POST chapters error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/user/notes", requireAuth, async (req, res) => {
  try {
    const { subjectId, chapterId, title, content = "", type = "notes" } = req.body;
    if (!subjectId || !chapterId || !title) {
      return res.status(400).json({ error: "subjectId, chapterId and title required" });
    }

    const user = await UserModel.findOne({ uuid: req.session.userUUID });
    if (!user) return res.status(404).json({ error: "User not found" });

    const subject = user.subjects.id(subjectId);
    if (!subject) return res.status(404).json({ error: "Subject not found" });

    const chapter = subject.chapters.id(chapterId);
    if (!chapter) return res.status(404).json({ error: "Chapter not found" });

    chapter.notes.push({ title: title.trim(), content, type, fileUrl: "", mimeType: "" });
    await user.save();

    return res.status(201).json({ message: "Note added", notes: chapter.notes });
  } catch (err) {
    console.error("POST notes error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ===== File Upload =====
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

const allowedMimeTypes = [
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg", "image/png", "text/plain"
];

app.post("/api/user/upload-note-file", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const { subjectId, chapterId, title = "", type = "notes", content = "" } = req.body;
    const file = req.file;

    if (!file && !title) {
      return res.status(400).json({ error: "Title or file required" });
    }

    const user = await UserModel.findOne({ uuid: req.session.userUUID });
    if (!user) return res.status(404).json({ error: "User not found" });

    const subject = user.subjects.id(subjectId);
    if (!subject) return res.status(404).json({ error: "Subject not found" });

    const chapter = subject.chapters.id(chapterId);
    if (!chapter) return res.status(404).json({ error: "Chapter not found" });

    if (!file) {
      chapter.notes.push({ title: title.trim(), type, content, fileUrl: "", mimeType: "" });
      await user.save();
      return res.status(201).json({ message: "Note saved" });
    }

    if (!gcpConfigured || !storage || !bucket) {
      return res.status(500).json({ error: "Cloud storage not configured" });
    }

    const gcsFileName = `${req.session.userUUID}/${subjectId}/${chapterId}/${Date.now()}_${file.originalname}`;
    const blob = bucket.file(gcsFileName);

    await blob.save(file.buffer, { contentType: file.mimetype, resumable: false });
    
    try { await blob.makePublic(); } catch (e) {}

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

    chapter.notes.push({ title: title || file.originalname, type, content, fileUrl: publicUrl, mimeType: file.mimetype });
    await user.save();

    return res.status(201).json({ message: "File uploaded", fileUrl: publicUrl });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Upload failed", details: err.message });
  }
});

// ===== Test Endpoints =====
app.get("/api/test-gemini", async (req, res) => {
  try {
    if (!geminiReady || !model) {
      return res.json({ configured: false, message: "Gemini not configured" });
    }
    const testResult = await model.generateContent("Hello");
    const text = (await testResult.response).text();
    res.json({ configured: true, working: true, testResponse: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    mongodb: mongoose.connection.readyState === 1,
    gcp: gcpConfigured,
    gemini: geminiReady,
    timestamp: new Date().toISOString()
  });
});

app.get("/", (req, res) => {
  res.send("🚀 AI Study Buddy Server - Ready!");
});

// ===== Start Server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log("✅ System Status:");
  console.log("   MongoDB:", mongoose.connection.readyState === 1 ? "Connected" : "Disconnected");
  console.log("   GCP Storage:", gcpConfigured ? "Configured" : "Not configured");
  console.log("   Gemini AI:", geminiReady ? "✅ READY" : "⚠️ FALLBACK MODE");
  console.log("");
});