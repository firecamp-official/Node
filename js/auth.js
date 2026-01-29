import { supabase } from "./supabase.js";

/* ======================================================
   🔑 0️⃣ RECOVERY / RESET PASSWORD (DOIT ÊTRE TOUT EN HAUT)
====================================================== */

(async () => {
  const hash = window.location.hash;

  // Supabase envoie les tokens via le hash #
  if (hash && hash.includes("type=recovery")) {
    const params = new URLSearchParams(hash.substring(1));

    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token
      });

      if (error) {
        alert("Lien de réinitialisation invalide ou expiré.");
        return;
      }

      // Nettoie l'URL (important)
      history.replaceState(null, "", window.location.pathname);

      // 👉 Affiche ton UI de changement de mot de passe
      document.getElementById("reset-password-modal")?.classList.add("show");
    }
  }
})();

/* ==============================
   ELEMENTS DU FORMULAIRE
============================== */
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const usernameInput = document.getElementById("username");
const termsCheckbox = document.getElementById("terms");

// Honeypot invisible
const honeypotInput = document.querySelector('input[name="website"]');

// Anti-robot maison
let humanScore = 0;
let startTime = Date.now();

document.addEventListener('mousemove', () => humanScore++);
document.addEventListener('scroll', () => humanScore++);
document.addEventListener('keydown', () => humanScore++);

/* ==============================
   UTILITAIRES
============================== */
function validateFields(fields) {
  return fields.every(f => f.value.trim());
}

function checkHoneypot() {
  return honeypotInput && honeypotInput.value !== '';
}

function checkHumanScore(minScore = 5, minTimeMs = 800) {
  return humanScore >= minScore && (Date.now() - startTime) >= minTimeMs;
}

/* ==============================
   CONNEXION
============================== */
loginBtn.addEventListener("click", async () => {
  const email = emailInput.value;
  const password = passwordInput.value;

  if (!validateFields([emailInput, passwordInput])) {
    alert("Veuillez remplir tous les champs.");
    return;
  }

  if (checkHoneypot() || !checkHumanScore()) {
    alert("Action suspecte détectée.");
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    alert(error.message);
    return;
  }

  const userId = data.user.id;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("restricted")
    .eq("id", userId)
    .single();

  if (profileError || profile?.restricted) {
    alert("Compte restreint.");
    await supabase.auth.signOut();
    return;
  }

  window.location.href = "dashboard.html";
});

/* ==============================
   INSCRIPTION
============================== */
registerBtn.addEventListener("click", async () => {
  const email = emailInput.value;
  const password = passwordInput.value;
  const username = usernameInput.value;

  if (!termsCheckbox.checked) {
    alert("Vous devez accepter les conditions.");
    return;
  }

  if (!validateFields([emailInput, passwordInput, usernameInput])) {
    alert("Veuillez remplir tous les champs.");
    return;
  }

  if (checkHoneypot() || !checkHumanScore()) {
    alert("Action suspecte détectée.");
    return;
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    alert(error.message);
    return;
  }

  const userId = data.user.id;

  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: userId, username });

  if (profileError) {
    alert(profileError.message);
    return;
  }

  window.location.href = "dashboard.html";
});

/* ==============================
   🔐 VALIDATION NOUVEAU MOT DE PASSE
============================== */
document.getElementById("saveNewPassword")?.addEventListener("click", async () => {
  const newPassword = document.getElementById("newPassword")?.value;

  if (!newPassword || newPassword.length < 6) {
    alert("Mot de passe trop court.");
    return;
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    alert(error.message);
    return;
  }

  alert("Mot de passe changé avec succès 🎉");
  window.location.href = "dashboard.html";
});

/* ==============================
   USER COUNT
============================== */
async function loadUserCount() {
  const el = document.getElementById('userCount');
  if (!el) return;

  try {
    const { count } = await supabase
      .from('public_profiles_count')
      .select('created_at', { count: 'exact', head: true });

    el.textContent = `${count} membres inscrits`;
  } catch {
    el.textContent = 'Membres : —';
  }
}

loadUserCount();
