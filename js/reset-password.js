import { supabase } from "./supabase.js";

const form = document.getElementById("newPasswordForm");
const message = document.getElementById("message");

// 1️⃣ Récupérer directement la session depuis l'URL
async function initPasswordReset() {
  const { data, error } = await supabase.auth.getSessionFromUrl({ storeSession: false });
  // storeSession:false = ne pas stocker automatiquement, on gère manuellement

  if (error || !data.session) {
    message.textContent = "Lien invalide ou expiré.";
    message.style.color = "red";
    return null;
  }

  return data.session;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = document.getElementById("password").value;

  const session = await initPasswordReset();
  if (!session) return;

  // 2️⃣ Mettre à jour le mot de passe
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    message.textContent = error.message;
    message.style.color = "red";
  } else {
    message.textContent = "Mot de passe changé avec succès 🎉";
    message.style.color = "lightgreen";
    setTimeout(() => {
      window.location.href = "../index.html"; // redirection login
    }, 2000);
  }
});
