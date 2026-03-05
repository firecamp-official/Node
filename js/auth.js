import { supabase } from "./supabase.js";

/* ==============================
   ÉLÉMENTS DU FORMULAIRE
============================== */
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const googleBtn = document.getElementById("googleBtn");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const resetPasswordBtn = document.getElementById("resetPasswordBtn");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const usernameInput = document.getElementById("username");
const newPasswordInput = document.getElementById("newPassword");
const termsCheckbox = document.getElementById("terms");

const honeypotInput = document.querySelector('input[name="website"]');

/* ==============================
   ANTI-BOT MAISON
============================== */
let humanScore = 0;
let startTime = Date.now();

document.addEventListener("mousemove", () => humanScore++);
document.addEventListener("scroll", () => humanScore++);
document.addEventListener("keydown", () => humanScore++);

/* ==============================
   UTILITAIRES
============================== */
function validateFields(fields) {
  return fields.every(f => f && f.value.trim());
}

function checkHoneypot() {
  return honeypotInput && honeypotInput.value !== "";
}

function checkHumanScore(minScore = 5, minTimeMs = 800) {
  return humanScore >= minScore && (Date.now() - startTime) >= minTimeMs;
}

/* ======================================================
   🔑 RECOVERY / RESET PASSWORD
   — handled via onAuthStateChange (PASSWORD_RECOVERY event)
     instead of a manual setSession() on load to avoid
     the Web Locks race condition.
====================================================== */
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    // Clean the hash from the URL
    history.replaceState(null, "", window.location.pathname);

    const recoveryBox = document.getElementById("recoveryBox");
    const recoveryMessage = document.getElementById("recoveryMessage");
    if (recoveryBox) recoveryBox.style.display = "block";
    if (recoveryMessage) {
      recoveryMessage.textContent = "🔐 Choisis ton nouveau mot de passe";
      recoveryMessage.style.color = "#9be7ff";
    }
    return;
  }

  if (event === "SIGNED_IN" && session?.user) {
    const user = session.user;

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!existing) {
      const username =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email.split("@")[0];

      await supabase.from("profiles").insert({
        id: user.id,
        username
      });
    }
  }
});

/* ==============================
   🔁 MOT DE PASSE OUBLIÉ
============================== */
forgotPasswordLink?.addEventListener("click", async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  if (!email) {
    alert("Entre ton email pour recevoir le lien.");
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://firecamp-official.github.io/Node/index.html"
  });

  if (error) {
    alert(error.message);
    return;
  }

  alert("📩 Email de réinitialisation envoyé !");
});

/* ==============================
   CONNEXION
============================== */
loginBtn?.addEventListener("click", async () => {
  if (!validateFields([emailInput, passwordInput])) {
    alert("Veuillez remplir tous les champs.");
    return;
  }

  if (checkHoneypot() || !checkHumanScore()) {
    alert("Action suspecte détectée.");
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value
  });

  if (error) {
    alert(error.message);
    return;
  }

  const userId = data.user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("restricted")
    .eq("id", userId)
    .single();

  if (profile?.restricted) {
    alert("Compte restreint.");
    await supabase.auth.signOut();
    return;
  }

  window.location.href = "dashboard.html";
});

/* ==============================
   INSCRIPTION
============================== */
registerBtn?.addEventListener("click", async () => {
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

  const { data, error } = await supabase.auth.signUp({
    email: emailInput.value,
    password: passwordInput.value
  });

  if (error) {
    alert(error.message);
    return;
  }

  await supabase.from("profiles").insert({
    id: data.user.id,
    username: usernameInput.value
  });

  window.location.href = "dashboard.html";
});

/* ==============================
   🔐 VALIDATION NOUVEAU MOT DE PASSE
============================== */
resetPasswordBtn?.addEventListener("click", async () => {
  const newPassword = newPasswordInput?.value;

  if (!newPassword || newPassword.length < 6) {
    alert("Mot de passe trop court (6 caractères min).");
    return;
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    alert(error.message);
    return;
  }

  alert("✅ Mot de passe changé avec succès !");
  window.location.href = "dashboard.html";
});

/* ==============================
   🔵 CONNEXION GOOGLE
============================== */
googleBtn?.addEventListener("click", async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "https://firecamp-official.github.io/Node/dashboard.html"
    }
  });

  if (error) {
    alert("Erreur Google : " + error.message);
  }
});

/* ==============================
   USER COUNT
============================== */
async function loadUserCount() {
  const el = document.getElementById("userCount");
  if (!el) return;

  try {
    const { data, error } = await supabase.rpc("get_total_members_count");
    if (error) throw error;
    el.textContent = `${data} membres inscrits`;
  } catch (err) {
    console.error("loadUserCount", err);
    el.textContent = "Membres : —";
  }
}

loadUserCount();
