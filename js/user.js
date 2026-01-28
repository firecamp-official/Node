import { supabase } from "./supabase.js";
import { requireUser } from "./uxGuard.js";

// ⚡ Vérifie session + profil
const { user, profile } = await requireUser();
// ⚡ Bulle profil
const profileBubble = document.getElementById("profileBubble");
const profileLetter = document.getElementById("profileLetter");
profileLetter.textContent = profile.username?.charAt(0).toUpperCase() ?? "?";

// ⚡ Création dropdown dynamique
const dropdown = document.createElement("div");
dropdown.classList.add("profile-dropdown");
dropdown.innerHTML = `
    <div class="dropdown-header">
      <div class="avatar">${(profile.username?.charAt(0) ?? "?").toUpperCase()}</div>
      <div class="user-info">
        <div class="username">${profile.username ?? "Utilisateur"}</div>
        <div class="email">${user.email ?? "—"}</div>
        <div id="finishedCount" class="finished-counter">0 cours terminés</div>
      </div>
    </div>

    <div class="dropdown-body">
      <label class="field">Nom de profil : <input id="usernameInput" type="text" value="${profile.username}"></label>
      <div class="actions">
        <button id="renameBtn" class="primary">Renommer</button>
        <button id="logoutBtn" class="secondary">Se déconnecter</button>
        <button id="deleteBtn" class="danger">Supprimer le compte</button>
      </div>
      <div style="margin-top:10px;">
        <label class="field">Thème :
          <select id="themeSelect" style="margin-top:6px; width:100%; padding:8px; border-radius:8px;">
            <option value="">Système / Dark (par défaut)</option>
            <option value="light">Light</option>
            <option value="ocean">Ocean</option>
            <option value="sunset">Sunset</option>
            <option value="midnight">Midnight</option>
          </select>
        </label>
      </div>
      <div class="messages-section" style="margin-top: 15px;">
  <h3>Messagerie</h3>
  <div id="userMessagesList">
    <p>Chargement des messages...</p>
  </div>
</div>

    </div>
  `;
profileBubble.parentNode.appendChild(dropdown);
// pastille notification
const profileBubbleDot = document.createElement("span");
profileBubbleDot.classList.add("message-dot");
profileBubble.appendChild(profileBubbleDot);

const userMessagesList = dropdown.querySelector("#userMessagesList");

async function loadUserMessages() {
  const { data: messages, error } = await supabase
    .from("course_messages")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    userMessagesList.innerHTML = `<p>Erreur : ${error.message}</p>`;
    return;
  }

  if (!messages.length) {
    userMessagesList.innerHTML = "<p>Aucun message pour l'instant.</p>";
    profileBubbleDot.style.display = "none";
    return;
  }

  let unread = 0;
  userMessagesList.innerHTML = "";

  messages.forEach(msg => {
    const div = document.createElement("div");
    div.className = "message-item";
    if (msg.status !== "answered") {
      div.classList.add("unread");
      unread++;
    }

    div.innerHTML = `
      <p><strong>Message :</strong> ${msg.message}</p>
      ${msg.status === "answered" ? `<p class="answer"><strong>Réponse :</strong> ${msg.answer}</p>` : `<p class="answer"><em>En attente de réponse...</em></p>`}
      <p style="font-size:0.7rem;color:#9ca3af;">Envoyé le : ${new Date(msg.created_at).toLocaleString()}</p>
    `;

    userMessagesList.appendChild(div);
  });

  // pastille visible si au moins 1 message non lu
  profileBubbleDot.style.display = unread ? "block" : "none";
}

// charger au démarrage et auto-refresh toutes les 15s
await loadUserMessages();
setInterval(loadUserMessages, 15000);

// Theme selector: initialize and persist
const themeSelect = dropdown.querySelector('#themeSelect');
const savedTheme = localStorage.getItem('theme') || '';
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (themeSelect) themeSelect.value = savedTheme;
} else {
  if (themeSelect) themeSelect.value = '';
}

if (themeSelect) themeSelect.addEventListener('change', (e) => {
  const v = e.target.value;
  if (v) {
    document.documentElement.setAttribute('data-theme', v);
    localStorage.setItem('theme', v);
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem('theme');
  }
});

// ⚡ Toggle dropdown
// ⚡ Toggle dropdown avec clic + fermeture si clic ailleurs
profileBubble.addEventListener("click", (e) => {
  e.stopPropagation(); // empêche la fermeture immédiate
  dropdown.classList.toggle("active");
});

// ⚡ Fermer dropdown si clic en dehors
document.addEventListener("click", (e) => {
  if (!dropdown.contains(e.target) && !profileBubble.contains(e.target)) {
    dropdown.classList.remove("active");
  }
});

// ⚡ Fermer dropdown avec touche ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") dropdown.classList.remove("active");
});


// ⚡ Elements du dropdown
const usernameInput = dropdown.querySelector("#usernameInput");
const renameBtn = dropdown.querySelector("#renameBtn");
const logoutBtn = dropdown.querySelector("#logoutBtn");
const deleteBtn = dropdown.querySelector("#deleteBtn");



/* ==========================
  Renommer le profil
========================== */
renameBtn.onclick = async () => {
  const newName = usernameInput.value.trim();
  if (!newName) return alert("Nom invalide");

  const { error } = await supabase
    .from("profiles")
    .update({ username: newName })
    .eq("id", user.id);

  if (error) alert(error.message);
  else {
    alert("Nom mis à jour !");
    profileLetter.textContent = newName.charAt(0).toUpperCase();
  }
};

/* ==========================
  Déconnexion
========================== */
logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = "index.html";
};

/* ==========================
  Suppression soft delete RGPD
========================== */
deleteBtn.onclick = async () => {
  if (!confirm("Supprimer définitivement ton compte ?")) return;

  const { error } = await supabase
    .from("profiles")
    .update({
      username: `deleted_${crypto.randomUUID().slice(0, 8)}`,
      deleted: true,
      deleted_at: new Date().toISOString()
    })
    .eq("id", user.id);

  if (error) {
    console.error(error);
    alert("Impossible de supprimer le compte : " + error.message);
    return;
  }

  await supabase.auth.signOut();
  alert("Ton compte a été supprimé.");
  window.location.href = "index.html";
};

/* ==========================
  DASHBOARD CLASS & SUBJECT FILTERS
========================== */
const classFilter = document.getElementById("classFilter");
const subjectFilter = document.getElementById("subjectFilter");
const courseList = document.getElementById("courseList");
const latestContainer = document.getElementById("latestCourses");
// main list controls
const filterAllBtn = document.getElementById('filterAllBtn');
const filterSavedBtn = document.getElementById('filterSavedBtn');

// Saved-only filter flag
let savedOnly = false;

// Loader helpers
function showLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "flex";
}

function hideLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "none";
}

// Finished courses counter (100% complete)
function updateFinishedCount() {
  const el = document.getElementById("finishedCount");
  if (!el) return;
  const state = JSON.parse(localStorage.getItem("learning_progress")) || { courses: {} };
  const count = Object.values(state.courses).filter(c => Number(c.percent) === 100).length;
  el.textContent = `${count} cours terminés`;
}

// Update on storage events (other tabs) — also safe to call anytime
window.addEventListener("storage", (e) => {
  if (e.key === "learning_progress") updateFinishedCount();
});

/* ==========================
  SAVED (TO REVIEW) - LocalStorage helpers
  Key: `saved_courses` — Array of numeric course IDs
========================== */
function getSavedCourses() {
  try {
    const raw = localStorage.getItem("saved_courses");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("invalid");
    // Normalize to string IDs to support numeric or uuid ids from DB
    return parsed.map(n => String(n));
  } catch (err) {
    // Corrupted data — reset silently
    localStorage.removeItem("saved_courses");
    return [];
  }
}

function isCourseSaved(courseId) {
  return getSavedCourses().includes(String(courseId));
}

function toggleSavedCourse(courseId) {
  const id = String(courseId);
  const list = getSavedCourses();
  const exists = list.includes(id);
  const updated = exists ? list.filter(x => x !== id) : [...list, id];

  // Persist
  localStorage.setItem("saved_courses", JSON.stringify(updated));

  // Update any visible buttons immediately (silent, no toasts)
  document.querySelectorAll(`.save-course-btn[data-course-id="${id}"]`).forEach(btn => {
    btn.classList.toggle('active', !exists);
    // toggle saved class on containing card for subtle visual proof
    const card = btn.closest('.card');
    if (card) card.classList.toggle('saved', !exists);
  });

  // If we're in saved-only mode and user unsaved the course, remove the card
  if (savedOnly && !isCourseSaved(id)) {
    // Remove from main list
    const btn = document.querySelector(`.save-course-btn[data-course-id="${id}"]`);
    if (btn) {
      const card = btn.closest('.card');
      if (card && card.parentNode) card.parentNode.removeChild(card);
    }
  }
}


/* ==========================
  LOAD FILTERS
========================== */
async function loadFilters() {
  const { data: classes } = await supabase.from("classes").select("*");
  classFilter.innerHTML = `<option value="">Toutes les classes</option>`;
  classes?.forEach(c => {
    classFilter.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });

  const { data: subjects } = await supabase.from("subjects").select("*");
  subjectFilter.innerHTML = `<option value="">Toutes les matières</option>`;
  subjects?.forEach(s => {
    subjectFilter.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
}

/* ==========================
  LOAD COURSES
========================== */
async function loadCourses() {
  if (!courseList) return;

  showLoader(); // Affiche le loader
  try {
    const state = JSON.parse(localStorage.getItem("learning_progress")) || { courses: {} };

    // helper to format seconds to HH:MM:SS
    function formatHMS(sec) {
      const s = Number(sec) || 0;
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const ss = s % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }

    let query = supabase
      .from("courses")
      .select(`
        id,
        title,
        class_id,
        subject_id,
        classes(name),
        subjects(name),
        last_editor(username),
        course_sections!left(
          edited_by(username),
          created_at
        )
      `)
      .eq("validated", true);

    if (classFilter.value) query = query.eq("class_id", classFilter.value);
    if (subjectFilter.value) query = query.eq("subject_id", subjectFilter.value);

    const { data: courses, error } = await query;
    if (error) throw error;

    // If saved-only filter is active, filter client-side using LocalStorage
    const saved = getSavedCourses();
    const filtered = savedOnly ? courses.filter(c => saved.includes(String(c.id))) : courses;

    if (savedOnly && filtered.length === 0) {
      courseList.innerHTML = `<div class="card" style="padding:20px;">Aucun cours enregistré.</div>`;
      return;
    }

    courseList.innerHTML = filtered.map(c => {
      const courseIdStr = String(c.id);
      const percent = state.courses[courseIdStr]?.percent ?? 0;
      const progressLabel = percent >= 90 ? "✓ Terminé" : percent + "%";
      const timeSec = state.courses[courseIdStr]?.timeSeconds || 0;
      const timeLabel = timeSec ? formatHMS(timeSec) : "—";

      const isSaved = isCourseSaved(c.id);

      return `
        <div class="card course-card ${isSaved ? 'saved' : ''}" onclick="location.href='course.html?id=${c.id}'">
          <button class="save-course-btn ${isSaved ? 'active' : ''}" data-course-id="${c.id}" title="Save to review later" aria-label="Save to review later">
            <svg class="icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><path stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6 3h12v16l-6-3-6 3V3z"/></svg>
            <svg class="icon-filled" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6 3h12v16l-6-3-6 3V3z"/></svg>
          </button>
          <h3>${c.title}</h3>
          <small>${c.classes?.name ?? "—"} – ${c.subjects?.name ?? "—"}</small>
          <p class="editor">Temps passé sur ce cours : ${timeLabel}</p>
          <div class="course-progress">
            <div class="track">
              <div class="fill" style="width:${percent}%"></div>
            </div>
            <small class="label">${progressLabel}</small>
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error(err);
  } finally {
    hideLoader(); // Cache le loader une fois chargé
  }
}

/* ==========================
  LOAD LATEST COURSES
========================== */
async function loadLatestCourses() {
  if (!latestContainer) return;

  showLoader(); // Affiche le loader
  try {
    const state = JSON.parse(localStorage.getItem("learning_progress")) || { courses: {} };

    const { data, error } = await supabase
      .from("courses")
      .select(`
        id,
        title,
        created_at,
        classes(name),
        subjects(name),
        last_editor(username),
        course_sections!left(
          edited_by(username),
          created_at
        )
      `)
      .eq("validated", true)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) throw error;

    latestContainer.innerHTML = data.map(course => {
      const editorName = course.last_editor?.username
        ?? course.course_sections?.[0]?.edited_by?.username
        ?? "—";
      const courseIdStr = String(course.id);
      const percent = state.courses[courseIdStr]?.percent ?? 0;
      const progressLabel = percent >= 90 ? "✓ Terminé" : percent + "%";
      const isSaved = isCourseSaved(course.id);

      return `
        <div class="latest-card ${isSaved ? 'saved' : ''}" onclick="location.href='course.html?id=${course.id}'">
          <button class="save-course-btn ${isSaved ? 'active' : ''}" data-course-id="${course.id}" title="Save to review later" aria-label="Save to review later">
            <svg class="icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg"><path stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6 3h12v16l-6-3-6 3V3z"/></svg>
            <svg class="icon-filled" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6 3h12v16l-6-3-6 3V3z"/></svg>
          </button>
          <span class="badge subject">${course.subjects?.name ?? "—"}</span>
          <span class="badge class">${course.classes?.name ?? "—"}</span>
          <h3>${course.title}</h3>
          <p class="editor">Dernière édition par : ${editorName}</p>
          <div class="course-progress">
            <div class="track">
              <div class="fill" style="width:${percent}%"></div>
            </div>
            <small class="label">${progressLabel}</small>
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error(err);
  } finally {
    hideLoader(); // Cache le loader une fois chargé
  }
}


/* ==========================
  INIT
========================== */
await loadFilters();
await loadCourses();
await loadLatestCourses();

// Refresh finished counter after initial load
updateFinishedCount();

classFilter.onchange = loadCourses;
subjectFilter.onchange = loadCourses;

// Event delegation for save buttons — use capture phase to prevent card click navigation
document.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('.save-course-btn');
  if (!btn) return;
  // running in capture will block the card's inline onclick from firing
  e.stopPropagation();
  e.preventDefault();
  const id = String(btn.dataset.courseId);
  toggleSavedCourse(id);
}, true);

// List controls in main content: All / Saved
if (filterAllBtn && filterSavedBtn) {
  filterAllBtn.addEventListener('click', () => {
    savedOnly = false;
    filterAllBtn.classList.add('active');
    filterSavedBtn.classList.remove('active');
    loadCourses();
  });
  filterSavedBtn.addEventListener('click', () => {
    savedOnly = true;
    filterSavedBtn.classList.add('active');
    filterAllBtn.classList.remove('active');
    loadCourses();
  });
}

