// ai-buddy.js - Voice assistant with proper error handling
const buddyCircle = document.getElementById("buddyCircle");
const statusText = document.getElementById("statusText");
const voiceBtn = document.getElementById("voiceBtn");
const loadNotesBtn = document.getElementById("loadNotesBtn");
const conversation = document.getElementById("conversation");
const notesStatus = document.getElementById("notesStatus");
const backBtn = document.getElementById("backBtn");

let recognition;
let synthesis = window.speechSynthesis;
let isListening = false;
let isSpeaking = false;
let notesContext = null;
let animationId;

// Initialize Speech Recognition
function initSpeechRecognition() {
  if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
  } else if ('SpeechRecognition' in window) {
    recognition = new SpeechRecognition();
  } else {
    alert("Speech recognition not supported in this browser. Please use Chrome or Edge.");
    return false;
  }

  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isListening = true;
    buddyCircle.classList.add("listening");
    statusText.textContent = "Listening...";
    statusText.classList.add("active");
    console.log("🎤 Speech recognition started");
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    console.log("✅ Recognized:", transcript);
    addMessage("user", transcript);
    processUserInput(transcript);
  };

  recognition.onerror = (event) => {
    console.error("❌ Speech recognition error:", event.error);
    
    let errorMessage = "Could not understand. Please try again.";
    if (event.error === 'no-speech') {
      errorMessage = "No speech detected. Please speak clearly.";
    } else if (event.error === 'audio-capture') {
      errorMessage = "Microphone not accessible. Please check permissions.";
    } else if (event.error === 'not-allowed') {
      errorMessage = "Microphone access denied. Please enable it in browser settings.";
    }
    
    statusText.textContent = errorMessage;
    stopListening();
  };

  recognition.onend = () => {
    console.log("🎤 Speech recognition ended");
    stopListening();
  };

  return true;
}

// Start listening
function startListening() {
  if (!recognition) {
    if (!initSpeechRecognition()) return;
  }

  try {
    recognition.start();
    voiceBtn.disabled = true;
  } catch (error) {
    console.error("Error starting recognition:", error);
    statusText.textContent = "Could not start listening";
  }
}

// Stop listening
function stopListening() {
  isListening = false;
  buddyCircle.classList.remove("listening");
  statusText.textContent = "Click to talk again";
  statusText.classList.remove("active");
  voiceBtn.disabled = false;
}

// Process user input and get AI response
async function processUserInput(userText) {
  console.log("📤 Sending message to AI:", userText);
  statusText.textContent = "Thinking...";
  
  try {
    const requestBody = {
      message: userText,
      notesContext: notesContext || ""
    };
    
    console.log("Request body:", requestBody);
    
    const response = await fetch("/api/ai-buddy/chat", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify(requestBody)
    });

    console.log("Response status:", response.status);
    
    const responseText = await response.text();
    console.log("Response text:", responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      throw new Error("Invalid response from server");
    }
    
    if (!response.ok) {
      console.error("❌ Server error:", data);
      throw new Error(data.error || data.details || "Failed to get response");
    }

    const aiResponse = data.response;
    console.log("✅ AI Response:", aiResponse);
    
    addMessage("buddy", aiResponse);
    speakText(aiResponse);
    
  } catch (error) {
    console.error("❌ Error getting AI response:", error);
    console.error("Error details:", error.message);
    
    let errorMsg = "Sorry, I couldn't process that. ";
    
    if (error.message.includes("Not authenticated")) {
      errorMsg += "Please log in again.";
      setTimeout(() => {
        window.location.href = "/login.html";
      }, 2000);
    } else if (error.message.includes("AI service not configured")) {
      errorMsg += "The AI service is not set up. Please contact support.";
    } else if (error.message.includes("quota")) {
      errorMsg += "AI service quota exceeded. Please try again later.";
    } else {
      errorMsg += "Please try again. " + error.message;
    }
    
    addMessage("buddy", errorMsg);
    speakText(errorMsg);
  }
}

// Text-to-speech with animation
function speakText(text) {
  if (synthesis.speaking) {
    synthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onstart = () => {
    isSpeaking = true;
    buddyCircle.classList.add("speaking");
    statusText.textContent = "Speaking...";
    statusText.classList.add("active");
    startPitchAnimation();
  };

  utterance.onend = () => {
    stopSpeaking();
  };

  utterance.onerror = (event) => {
    console.error("Speech synthesis error:", event);
    stopSpeaking();
  };

  synthesis.speak(utterance);
}

// Pitch-based animation
function startPitchAnimation() {
  let scale = 1;
  let growing = true;

  function animate() {
    if (!isSpeaking) return;

    if (growing) {
      scale += 0.02;
      if (scale >= 1.15) growing = false;
    } else {
      scale -= 0.02;
      if (scale <= 0.95) growing = true;
    }

    buddyCircle.style.transform = `scale(${scale})`;
    animationId = requestAnimationFrame(animate);
  }

  animate();
}

// Stop speaking
function stopSpeaking() {
  isSpeaking = false;
  buddyCircle.classList.remove("speaking");
  buddyCircle.style.transform = "scale(1)";
  statusText.textContent = "Click to talk again";
  statusText.classList.remove("active");
  
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
}

// Add message to conversation
function addMessage(sender, text) {
  const welcomeMsg = conversation.querySelector(".welcome-message");
  if (welcomeMsg) {
    welcomeMsg.remove();
  }

  const messageEl = document.createElement("div");
  messageEl.className = `message ${sender}`;
  
  const senderEl = document.createElement("div");
  senderEl.className = "sender";
  senderEl.textContent = sender === "user" ? "You" : "AI Buddy";
  
  const textEl = document.createElement("div");
  textEl.textContent = text;
  
  messageEl.appendChild(senderEl);
  messageEl.appendChild(textEl);
  conversation.appendChild(messageEl);
  
  conversation.scrollTop = conversation.scrollHeight;
}

// Load user notes
async function loadUserNotes() {
  loadNotesBtn.disabled = true;
  notesStatus.innerHTML = 'Loading notes...<span class="loading"></span>';
  
  try {
    console.log("📚 Loading user notes...");
    
    const response = await fetch("/api/user/subjects", {
      credentials: "include"
    });
    
    console.log("Notes response status:", response.status);
    
    const data = await response.json();
    console.log("Notes data:", data);
    
    if (!response.ok) {
      throw new Error(data.error || "Failed to load notes");
    }

    if (!data.hasSubjects || !data.subjects || data.subjects.length === 0) {
      notesStatus.textContent = "No notes found. Add some notes first!";
      notesStatus.classList.remove("loaded");
      notesContext = null;
      return;
    }

    notesContext = formatNotesForAI(data.subjects);
    console.log("✅ Notes context created, length:", notesContext.length);
    
    const totalNotes = countTotalNotes(data.subjects);
    notesStatus.textContent = `✓ Loaded ${data.subjects.length} subjects with ${totalNotes} notes`;
    notesStatus.classList.add("loaded");
    
    addMessage("buddy", `Great! I've loaded your notes from ${data.subjects.length} subjects. I can now help you study and answer questions about your materials. What would you like to know?`);
    
  } catch (error) {
    console.error("❌ Error loading notes:", error);
    notesStatus.textContent = "Failed to load notes: " + error.message;
    notesStatus.classList.remove("loaded");
    notesContext = null;
  } finally {
    loadNotesBtn.disabled = false;
  }
}

// Format notes for AI context
function formatNotesForAI(subjects) {
  let context = "User's Study Materials:\n\n";
  
  subjects.forEach(subject => {
    context += `Subject: ${subject.name}\n`;
    
    if (subject.chapters && subject.chapters.length > 0) {
      subject.chapters.forEach(chapter => {
        context += `  Chapter: ${chapter.name}\n`;
        
        if (chapter.notes && chapter.notes.length > 0) {
          chapter.notes.forEach(note => {
            context += `    - ${note.title} (${note.type})\n`;
            if (note.content) {
              context += `      Content: ${note.content}\n`;
            }
          });
        }
      });
    }
    context += "\n";
  });
  
  return context;
}

// Count total notes
function countTotalNotes(subjects) {
  let total = 0;
  subjects.forEach(subject => {
    if (subject.chapters) {
      subject.chapters.forEach(chapter => {
        if (chapter.notes) {
          total += chapter.notes.length;
        }
      });
    }
  });
  return total;
}

// Event Listeners
voiceBtn.addEventListener("click", () => {
  if (!isListening) {
    startListening();
  }
});

buddyCircle.addEventListener("click", () => {
  if (!isListening && !isSpeaking) {
    startListening();
  }
});

loadNotesBtn.addEventListener("click", loadUserNotes);

backBtn.addEventListener("click", () => {
  window.location.href = "/dashboard.html";
});

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
  console.log("🤖 AI Buddy initialized");
  console.log("Browser:", navigator.userAgent);
  
  if (!('speechSynthesis' in window)) {
    console.warn("⚠️ Text-to-speech not supported");
    statusText.textContent = "Text-to-speech not supported";
    addMessage("buddy", "Sorry, text-to-speech is not supported in your browser.");
  }
  
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.warn("⚠️ Speech recognition not supported");
    statusText.textContent = "Speech recognition not supported. Use Chrome or Edge.";
    addMessage("buddy", "Sorry, speech recognition is not supported in your browser. Please use Chrome or Edge.");
  }
  
  console.log("🔄 Auto-loading notes...");
  loadUserNotes();
});