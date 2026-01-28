import { supabase } from "./supabase.js";

const form = document.getElementById("resetForm");
const message = document.getElementById("message");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://firecamp-official.github.io/Node/reset-password.html"
  });

  if (error) {
    message.textContent = error.message;
    message.style.color = "red";
  } else {
    message.textContent = "Si un compte existe, un email a été envoyé 🔥";
    message.style.color = "lightgreen";
  }
});
