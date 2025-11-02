// login.js - Fixed login with session-based authentication
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const submitBtn = e.target.querySelector('button[type="submit"]');

  // Disable button during login
  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in...";

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // IMPORTANT: Include cookies for session
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log("✅ Login successful:", data);
      alert(`Welcome back, ${data.username}!`);
      
      // Simple redirect - session is already set by server
      window.location.href = data.redirect || "/dashboard.html";
    } else {
      console.error("❌ Login failed:", data);
      alert(data.error || "Login failed. Please check your credentials.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Login";
    }
  } catch (error) {
    console.error("❌ Network error:", error);
    alert("Connection error. Please check your internet and try again.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Login";
  }
});