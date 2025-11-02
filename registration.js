document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();
    if (response.ok) {
      alert("Registration successful! Redirecting to login...");
      window.location.href = "login.html";
    } else {
      alert(data.error || "Registration failed");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("Something went wrong. Try again.");
  }
});
