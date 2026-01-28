import { supabase } from "./supabase.js";

const form = document.getElementById("newPasswordForm");
const message = document.getElementById("message");

// Récupère le token dans l'URL
const urlParams = new URLSearchParams(window.location.hash.replace("#", "?"));
const access_token = urlParams.get("access_token");

if (!access_token) {
    message.textContent = "Lien invalide ou expiré.";
    message.style.color = "red";
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.getElementById("password").value;

    // On utilise le token pour auth
    // Au lieu de setAuth
    const { error: sessionError } = await supabase.auth.setSession({
        access_token
    });

    if (sessionError) {
        message.textContent = "Lien invalide ou expiré.";
        message.style.color = "red";
        return;
    }


    const { error } = await supabase.auth.updateUser({ password });


    if (error) {
        message.textContent = error.message;
        message.style.color = "red";
    } else {
        message.textContent = "Mot de passe changé avec succès 🎉";
        message.style.color = "lightgreen";
        setTimeout(() => {
            window.location.href = "../index.html";
        }, 2000);
    }
});
