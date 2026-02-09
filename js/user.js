import { supabase } from "./supabase.js";
import { requireUser } from "./uxGuard.js";

/* ==========================
   UTILITIES
========================== */

function escapeHTML(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTimeHMS(sec) {
  const s = Number(sec) || 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/* ==========================
   LOADER MANAGEMENT
========================== */

const loader = document.getElementById("loader");

function showLoader() {
  if (loader) loader.classList.add("active");
}

function hideLoader() {
  if (loader) loader.classList.remove("active");
}

/* ==========================
   SESSION & PROFILE
========================== */

const { user, profile } = await requireUser();

/* ==========================
   PROFILE BUBBLE & DROPDOWN
========================== */

const profileBubble = document.getElementById("profileBubble");
const profileLetter = document.getElementById("profileLetter");

if (profileLetter && profile.username) {
  profileLetter.textContent = profile.username.charAt(0).toUpperCase();
}

// Create dropdown dynamically
const dropdown = document.createElement("div");
dropdown.classList.add("profile-dropdown");

const safeUsername = escapeHTML(profile.username ?? "Utilisateur");
const safeEmail = escapeHTML(user.email ?? "—");
const avatarLetter = (profile.username?.charAt(0) ?? "?").toUpperCase();

dropdown.innerHTML = `
  <div class="dropdown-header">
    <div class="avatar">${avatarLetter}</div>
    <div class="user-info">
      <div class="username">${safeUsername}</div>
      <div class="email">${safeEmail}</div>
      <div id="finishedCount" class="finished-counter">0 cours terminés</div>
    </div>
  </div>

  <div class="dropdown-body">
    <label class="field">
      Nom de profil :
      <input id="usernameInput" type="text" value="${safeUsername}" placeholder="Votre nom">
    </label>

    <div class="actions">
      <button id="renameBtn" class="primary">Renommer</button>
      <button id="logoutBtn" class="secondary">Se déconnecter</button>
      <button id="deleteBtn" class="danger">Supprimer le compte</button>
    </div>

    <label class="field" style="margin-top: 12px;">
      Thème :
      <select id="themeSelect">
        <option value="">Système / Dark (défaut)</option>
        <option value="light">Light</option>
        <option value="ocean">Ocean</option>
        <option value="sunset">Sunset</option>
        <option value="midnight">Midnight</option>
      </select>
    </label>

    <div class="messages-section">
      <h3>Messagerie</h3>
      <div id="userMessagesList">
        <p style="color: var(--text-muted); font-size: 0.85rem;">Chargement des messages...</p>
      </div>
    </div>
  </div>
`;

if (profileBubble && profileBubble.parentNode) {
  profileBubble.parentNode.appendChild(dropdown);
}

// Notification dot
const profileBubbleDot = document.createElement("span");
profileBubbleDot.classList.add("message-dot");
if (profileBubble) {
  profileBubble.appendChild(profileBubbleDot);
}

/* ==========================
   LOAD USER MESSAGES
========================== */

const userMessagesList = dropdown.querySelector("#userMessagesList");

async function loadUserMessages() {
  if (!userMessagesList) return;

  const { data: messages, error } = await supabase
    .from("course_messages")
    .select("id, message, answer, status, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    userMessagesList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">Erreur de chargement.</p>';
    return;
  }

  if (!messages.length) {
    userMessagesList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem;">Aucun message pour l\'instant.</p>';
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

    // Message
    const pMsg = document.createElement("p");
    const strongMsg = document.createElement("strong");
    strongMsg.textContent = "Message : ";
    pMsg.appendChild(strongMsg);
    pMsg.appendChild(document.createTextNode(msg.message));
    div.appendChild(pMsg);

    // Answer
    const pAnswer = document.createElement("p");
    pAnswer.className = "answer";

    if (msg.status === "answered") {
      const strongAns = document.createElement("strong");
      strongAns.textContent = "Réponse : ";
      pAnswer.appendChild(strongAns);
      pAnswer.appendChild(document.createTextNode(msg.answer ?? ""));
    } else {
      pAnswer.textContent = "En attente de réponse…";
    }

    div.appendChild(pAnswer);

    // Date
    const dateP = document.createElement("p");
    dateP.className = "date";
    dateP.textContent = "Envoyé le : " + new Date(msg.created_at).toLocaleString("fr-FR");
    div.appendChild(dateP);

    userMessagesList.appendChild(div);
  });

  profileBubbleDot.style.display = unread ? "block" : "none";
}

// Load messages on startup and auto-refresh every 15s
await loadUserMessages();
setInterval(loadUserMessages, 15000);

/* ==========================
   THEME SELECTOR
========================== */

const themeSelect = dropdown.querySelector("#themeSelect");
const savedTheme = localStorage.getItem("theme") || "";

if (savedTheme && document.documentElement) {
  document.documentElement.setAttribute("data-theme", savedTheme);
  if (themeSelect) themeSelect.value = savedTheme;
}

if (themeSelect) {
  themeSelect.addEventListener("change", (e) => {
    const value = e.target.value;
    if (value) {
      document.documentElement.setAttribute("data-theme", value);
      localStorage.setItem("theme", value);
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("theme");
    }
  });
}

/* ==========================
   DROPDOWN TOGGLE
========================== */

if (profileBubble) {
  profileBubble.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("active");
  });
}

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (!dropdown.contains(e.target) && profileBubble && !profileBubble.contains(e.target)) {
    dropdown.classList.remove("active");
  }
});

// Close dropdown with ESC key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    dropdown.classList.remove("active");
  }
});

/* ==========================
   DROPDOWN ACTIONS
========================== */

const usernameInput = dropdown.querySelector("#usernameInput");
const renameBtn = dropdown.querySelector("#renameBtn");
const logoutBtn = dropdown.querySelector("#logoutBtn");
const deleteBtn = dropdown.querySelector("#deleteBtn");

// Rename profile
if (renameBtn) {
  renameBtn.onclick = async () => {
    const newName = usernameInput?.value.trim();
    if (!newName) {
      alert("Nom invalide");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ username: newName })
      .eq("id", user.id);

    if (error) {
      alert("Erreur : " + error.message);
    } else {
      alert("Nom mis à jour !");
      if (profileLetter) {
        profileLetter.textContent = newName.charAt(0).toUpperCase();
      }
      // Refresh dropdown
      dropdown.querySelector(".username").textContent = newName;
      dropdown.querySelector(".avatar").textContent = newName.charAt(0).toUpperCase();
    }
  };
}

// Logout
if (logoutBtn) {
  logoutBtn.onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "index.html";
  };
}

// Delete account (soft delete)
if (deleteBtn) {
  deleteBtn.onclick = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer définitivement votre compte ?")) {
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        username: `deleted_${crypto.randomUUID().slice(0, 8)}`,
        deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq("id", user.id);

    if (error) {
      alert("Erreur : " + error.message);
    } else {
      await supabase.auth.signOut();
      alert("Compte supprimé. Vous allez être redirigé.");
      window.location.href = "index.html";
    }
  };
}

/* ==========================
   FILTERS
========================== */

const classFilter = document.getElementById("classFilter");
const subjectFilter = document.getElementById("subjectFilter");
const courseList = document.getElementById("courseList");
const latestContainer = document.getElementById("latestCourses");
const filterAllBtn = document.getElementById("filterAllBtn");
const filterSavedBtn = document.getElementById("filterSavedBtn");
const finishedCountEl = document.getElementById("finishedCount");

let savedOnly = false;

/* ==========================
   SAVED COURSES (LocalStorage)
========================== */

function getSavedCourses() {
  const raw = localStorage.getItem("saved_courses");
  return raw ? JSON.parse(raw) : [];
}

function isCourseSaved(id) {
  return getSavedCourses().includes(String(id));
}

function toggleSavedCourse(id) {
  const list = getSavedCourses();
  const exists = list.includes(id);
  const updated = exists ? list.filter(x => x !== id) : [...list, id];

  localStorage.setItem("saved_courses", JSON.stringify(updated));

  // Update UI
  document.querySelectorAll(`.save-course-btn[data-course-id="${id}"]`).forEach(btn => {
    btn.classList.toggle("active", !exists);
    const card = btn.closest(".card, .latest-card");
    if (card) card.classList.toggle("saved", !exists);
  });

  // Remove from view if in saved-only mode
  if (savedOnly && !isCourseSaved(id)) {
    const btn = document.querySelector(`.save-course-btn[data-course-id="${id}"]`);
    if (btn) {
      const card = btn.closest(".card");
      if (card && card.parentNode) {
        card.remove();
      }
    }
  }
}

/* ==========================
   UPDATE FINISHED COUNT
========================== */

function updateFinishedCount() {
  const state = JSON.parse(localStorage.getItem("learning_progress")) || { courses: {} };
  const finished = Object.values(state.courses).filter(c => (c.percent ?? 0) >= 90).length;
  
  if (finishedCountEl) {
    finishedCountEl.textContent = `${finished} cours terminé${finished > 1 ? "s" : ""}`;
  }
}

/* ==========================
   LOAD FILTERS
========================== */

async function loadFilters() {
  if (!classFilter || !subjectFilter) return;

  const { data: classes } = await supabase.from("classes").select("*").order("name");
  
  classFilter.innerHTML = `<option value="">Toutes les classes</option>`;
  classes?.forEach(c => {
    classFilter.innerHTML += `<option value="${c.id}">${escapeHTML(c.name)}</option>`;
  });

  const { data: subjects } = await supabase.from("subjects").select("*").order("name");
  
  subjectFilter.innerHTML = `<option value="">Toutes les matières</option>`;
  subjects?.forEach(s => {
    subjectFilter.innerHTML += `<option value="${s.id}">${escapeHTML(s.name)}</option>`;
  });
}

/* ==========================
   LOAD COURSES
========================== */

async function loadCourses() {
  if (!courseList) return;

  showLoader();
  
  try {
    const state = JSON.parse(localStorage.getItem("learning_progress")) || { courses: {} };

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
      .eq("validated", true)
      .order("title");

    if (classFilter?.value) query = query.eq("class_id", classFilter.value);
    if (subjectFilter?.value) query = query.eq("subject_id", subjectFilter.value);

    const { data: courses, error } = await query;
    if (error) throw error;

    // Filter by saved if needed
    const saved = getSavedCourses();
    const filtered = savedOnly ? courses.filter(c => saved.includes(String(c.id))) : courses;

    if (savedOnly && filtered.length === 0) {
      courseList.innerHTML = `
        <div class="card" style="padding: 32px; text-align: center; grid-column: 1 / -1;">
          <h3 style="margin-bottom: 12px;">Aucun cours enregistré</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Cliquez sur l'icône de marque-page pour sauvegarder des cours.</p>
        </div>
      `;
      hideLoader();
      return;
    }

    courseList.innerHTML = filtered.map(c => {
      const courseIdStr = String(c.id);
      const percent = state.courses[courseIdStr]?.percent ?? 0;
      const progressLabel = percent >= 90 ? "✓ Terminé" : percent + "%";
      const timeSec = state.courses[courseIdStr]?.timeSeconds || 0;
      const timeLabel = timeSec ? formatTimeHMS(timeSec) : "—";
      const isSaved = isCourseSaved(c.id);

      return `
        <div class="card course-card ${isSaved ? 'saved' : ''}" onclick="location.href='course.html?id=${c.id}'">
          <button class="save-course-btn ${isSaved ? 'active' : ''}" 
                  data-course-id="${c.id}" 
                  title="Enregistrer pour réviser plus tard" 
                  aria-label="Enregistrer pour réviser plus tard">
            <svg class="icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6 3h12v16l-6-3-6 3V3z"/>
            </svg>
            <svg class="icon-filled" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 3h12v16l-6-3-6 3V3z"/>
            </svg>
          </button>
          <h3>${escapeHTML(c.title)}</h3>
          <small>${escapeHTML(c.classes?.name ?? "—")} – ${escapeHTML(c.subjects?.name ?? "—")}</small>
          <p class="editor">Temps passé : ${timeLabel}</p>
          <div class="course-progress">
            <div class="track">
              <div class="fill" style="width: ${percent}%"></div>
            </div>
            <small class="label">${progressLabel}</small>
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("Error loading courses:", err);
    courseList.innerHTML = `
      <div class="card" style="padding: 32px; text-align: center; grid-column: 1 / -1;">
        <h3 style="color: #ef4444; margin-bottom: 12px;">Erreur de chargement</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem;">Impossible de charger les cours. Veuillez réessayer.</p>
      </div>
    `;
  } finally {
    hideLoader();
  }
}

/* ==========================
   LOAD LATEST COURSES
========================== */

async function loadLatestCourses() {
  if (!latestContainer) return;

  showLoader();

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
          <button class="save-course-btn ${isSaved ? 'active' : ''}" 
                  data-course-id="${course.id}" 
                  title="Enregistrer pour réviser plus tard" 
                  aria-label="Enregistrer pour réviser plus tard">
            <svg class="icon-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M6 3h12v16l-6-3-6 3V3z"/>
            </svg>
            <svg class="icon-filled" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 3h12v16l-6-3-6 3V3z"/>
            </svg>
          </button>
          <span class="badge subject">${escapeHTML(course.subjects?.name ?? "—")}</span>
          <span class="badge class">${escapeHTML(course.classes?.name ?? "—")}</span>
          <h3>${escapeHTML(course.title)}</h3>
          <p class="editor">Édité par : ${escapeHTML(editorName)}</p>
          <div class="course-progress">
            <div class="track">
              <div class="fill" style="width: ${percent}%"></div>
            </div>
            <small class="label">${progressLabel}</small>
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("Error loading latest courses:", err);
    latestContainer.innerHTML = `
      <div class="card" style="padding: 32px; text-align: center;">
        <p style="color: var(--text-muted);">Impossible de charger les derniers cours.</p>
      </div>
    `;
  } finally {
    hideLoader();
  }
}

/* ==========================
   INITIALIZATION
========================== */

await loadFilters();
await loadCourses();
await loadLatestCourses();
updateFinishedCount();

if (classFilter) classFilter.onchange = loadCourses;
if (subjectFilter) subjectFilter.onchange = loadCourses;

// Event delegation for save buttons
document.addEventListener("click", (e) => {
  const btn = e.target.closest && e.target.closest(".save-course-btn");
  if (!btn) return;
  
  e.stopPropagation();
  e.preventDefault();
  
  const id = String(btn.dataset.courseId);
  toggleSavedCourse(id);
}, true);

// List controls: All / Saved
if (filterAllBtn && filterSavedBtn) {
  filterAllBtn.addEventListener("click", () => {
    savedOnly = false;
    filterAllBtn.classList.add("active");
    filterSavedBtn.classList.remove("active");
    loadCourses();
  });

  filterSavedBtn.addEventListener("click", () => {
    savedOnly = true;
    filterSavedBtn.classList.add("active");
    filterAllBtn.classList.remove("active");
    loadCourses();
  });
}

/* ==========================
   BACK TO TOP BUTTON
========================== */

// Create back to top button if it doesn't exist
let backToTop = document.querySelector(".back-to-top");
if (!backToTop) {
  backToTop = document.createElement("button");
  backToTop.className = "back-to-top";
  backToTop.innerHTML = "↑";
  backToTop.setAttribute("aria-label", "Retour en haut");
  document.body.appendChild(backToTop);

  backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// Show/hide on scroll
window.addEventListener("scroll", () => {
  if (window.scrollY > 400) {
    backToTop.classList.add("show");
  } else {
    backToTop.classList.remove("show");
  }
});
