import { supabase } from "./supabase.js";

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
   ELEMENTS
========================== */

const classFilter = document.getElementById("classFilter");
const subjectFilter = document.getElementById("subjectFilter");
const courseDiv = document.getElementById("course");
const courseContent = document.getElementById("courseContent");
const loader = document.getElementById("loader");
const backToTopBtn = document.getElementById("backToTop");

/* ==========================
   COURSE ID
========================== */

const courseId = new URLSearchParams(location.search).get("id");

/* ==========================
   LOADER MANAGEMENT
========================== */

function showLoader() {
  if (loader) loader.style.display = "flex";
}

function hideLoader() {
  if (loader) loader.style.display = "none";
}

/* ==========================
   LOAD FILTERS
========================== */

async function loadFilters() {
  try {
    const { data: classes } = await supabase.from("classes").select("*").order("name");
    if (classFilter) {
      classFilter.innerHTML = `<option value="">Toutes les classes</option>`;
      classes?.forEach(c => {
        classFilter.innerHTML += `<option value="${c.id}">${escapeHTML(c.name)}</option>`;
      });
    }

    const { data: subjects } = await supabase.from("subjects").select("*").order("name");
    if (subjectFilter) {
      subjectFilter.innerHTML = `<option value="">Toutes les matières</option>`;
      subjects?.forEach(s => {
        subjectFilter.innerHTML += `<option value="${s.id}">${escapeHTML(s.name)}</option>`;
      });
    }
  } catch (err) {
    console.error("Error loading filters:", err);
  }
}

/* ==========================
   LOAD COURSE
========================== */

async function loadCourse() {
  if (!courseId) {
    hideLoader();
    if (courseContent) {
      courseContent.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
          <h2 style="color: #ef4444; margin-bottom: 16px;">Cours introuvable</h2>
          <p style="color: var(--text-muted); margin-bottom: 24px;">Le cours que vous recherchez n'existe pas ou a été supprimé.</p>
          <a href="dashboard.html" style="
            display: inline-block;
            padding: 12px 24px;
            background: linear-gradient(135deg, var(--violet), var(--cyan));
            color: white;
            text-decoration: none;
            border-radius: 999px;
            font-weight: 600;
            transition: transform 0.2s;
          ">Retour au dashboard</a>
        </div>
      `;
    }
    return;
  }

  showLoader();

  try {
    // Fetch course
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("title")
      .eq("id", courseId)
      .single();

    if (courseError || !course) {
      throw new Error("Course not found");
    }

    // Fetch sections
    const { data: sections, error: sectionError } = await supabase
      .from("course_sections")
      .select("*")
      .eq("course_id", courseId)
      .order("position", { ascending: true });

    if (sectionError) throw sectionError;

    // Render course content
    if (courseContent) {
      courseContent.innerHTML = `
        <h1>${escapeHTML(course.title)}</h1>
        ${sections.map(section => `
          <section>
            <h3>${escapeHTML(section.title)}</h3>
            <div class="section-content">${section.content || ''}</div>
            ${section.image_url ? `
              <img 
                src="${escapeHTML(section.image_url)}" 
                alt="${escapeHTML(section.title)}"
                loading="lazy"
              >
            ` : ""}
          </section>
        `).join("")}
      `;
    }

    // Start chronometer automatically when course is rendered
    startChrono();

  } catch (err) {
    console.error("Error loading course:", err);
    if (courseContent) {
      courseContent.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
          <h2 style="color: #ef4444; margin-bottom: 16px;">Erreur de chargement</h2>
          <p style="color: var(--text-muted); margin-bottom: 24px;">Impossible de charger le cours. Veuillez réessayer.</p>
          <button onclick="location.reload()" style="
            padding: 12px 24px;
            background: linear-gradient(135deg, var(--violet), var(--cyan));
            color: white;
            border: none;
            border-radius: 999px;
            font-weight: 600;
            cursor: pointer;
          ">Réessayer</button>
        </div>
      `;
    }
  } finally {
    hideLoader();
  }
}

/* ==========================
   CHRONOMETER / STOPWATCH
========================== */

const chronoDisplay = document.getElementById("chronoDisplay");
let chronoSeconds = 0;
let chronoInterval = null;

// Restore saved time
try {
  const saved = JSON.parse(localStorage.getItem("learning_progress")) || { courses: {} };
  const prev = saved.courses[courseId]?.timeSeconds || 0;
  chronoSeconds = Number(prev) || 0;
} catch (e) {
  chronoSeconds = 0;
}

function updateChronoDisplay() {
  if (chronoDisplay) {
    chronoDisplay.textContent = formatTimeHMS(chronoSeconds);
  }
}

function startChrono() {
  if (chronoInterval) return;
  
  chronoInterval = setInterval(() => {
    chronoSeconds++;
    updateChronoDisplay();
    
    // Persist time
    try {
      const state = JSON.parse(localStorage.getItem("learning_progress")) || { courses: {} };
      if (!state.courses[courseId]) state.courses[courseId] = {};
      state.courses[courseId].timeSeconds = chronoSeconds;
      localStorage.setItem("learning_progress", JSON.stringify(state));
    } catch (e) {
      console.warn("Could not persist chrono:", e);
    }
  }, 1000);
}

function pauseChrono() {
  if (chronoInterval) {
    clearInterval(chronoInterval);
    chronoInterval = null;
  }
}

// Initialize display
updateChronoDisplay();

// Persist on page unload
window.addEventListener("beforeunload", () => {
  try {
    const state = JSON.parse(localStorage.getItem("learning_progress")) || { courses: {} };
    if (!state.courses[courseId]) state.courses[courseId] = {};
    state.courses[courseId].timeSeconds = chronoSeconds;
    localStorage.setItem("learning_progress", JSON.stringify(state));
  } catch (e) {
    console.warn("Could not persist chrono on unload:", e);
  }
});

/* ==========================
   READING PROGRESS
========================== */

const progressBar = document.querySelector("#readingProgress .bar");
const progressLabel = document.querySelector("#readingProgress .label");

// Load saved state
const learningState = JSON.parse(localStorage.getItem("learning_progress")) || { courses: {} };

// Restore if exists
if (learningState.courses[courseId]) {
  const savedPercent = learningState.courses[courseId].percent || 0;
  if (progressBar) progressBar.style.width = savedPercent + "%";
  if (progressLabel) {
    progressLabel.textContent = savedPercent >= 90 ? "✓ Terminé" : savedPercent + "%";
  }
}

function updateReadingProgress() {
  const scrollTop = window.scrollY;
  const docHeight = document.body.scrollHeight - window.innerHeight;

  if (docHeight <= 0) return;

  const currentPercent = Math.min(100, Math.round((scrollTop / docHeight) * 100));
  const savedPercent = learningState.courses[courseId]?.percent || 0;
  const finalPercent = Math.max(currentPercent, savedPercent);

  if (progressBar) progressBar.style.width = finalPercent + "%";
  
  if (progressLabel) {
    progressLabel.textContent = finalPercent >= 90 ? "✓ Terminé" : finalPercent + "%";
  }

  learningState.courses[courseId] = {
    ...learningState.courses[courseId],
    percent: finalPercent,
    completed: finalPercent >= 90
  };

  localStorage.setItem("learning_progress", JSON.stringify(learningState));
}

window.addEventListener("scroll", updateReadingProgress);

/* ==========================
   BACK TO TOP BUTTON
========================== */

if (backToTopBtn) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) {
      backToTopBtn.classList.add("show");
    } else {
      backToTopBtn.classList.remove("show");
    }
  });

  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ==========================
   COURSE MESSAGING
========================== */

const messageInput = document.getElementById("messageInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const messageStatus = document.getElementById("messageStatus");
const charCount = document.getElementById("charCount");

// Character counter
if (messageInput && charCount) {
  messageInput.addEventListener("input", () => {
    const length = messageInput.value.length;
    charCount.textContent = `${length} / 350`;
    
    // Visual feedback when approaching limit
    if (length > 320) {
      charCount.style.color = "#ef4444";
    } else if (length > 280) {
      charCount.style.color = "#f59e0b";
    } else {
      charCount.style.color = "var(--text-dim)";
    }
  });
}

// Send message
if (sendMessageBtn) {
  sendMessageBtn.addEventListener("click", async () => {
    const msgText = messageInput?.value.trim();
    
    if (!msgText) {
      if (messageStatus) {
        messageStatus.textContent = "⚠️ Veuillez écrire un message.";
        messageStatus.style.color = "#f59e0b";
        setTimeout(() => messageStatus.textContent = "", 3000);
      }
      return;
    }

    if (msgText.length > 350) {
      if (messageStatus) {
        messageStatus.textContent = "⚠️ Message trop long (max 350 caractères).";
        messageStatus.style.color = "#f59e0b";
        setTimeout(() => messageStatus.textContent = "", 3000);
      }
      return;
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      if (messageStatus) {
        messageStatus.textContent = "⚠️ Vous devez être connecté pour envoyer un message.";
        messageStatus.style.color = "#ef4444";
        setTimeout(() => messageStatus.textContent = "", 4000);
      }
      return;
    }

    if (!courseId) {
      if (messageStatus) {
        messageStatus.textContent = "⚠️ Impossible d'envoyer le message : cours introuvable.";
        messageStatus.style.color = "#ef4444";
        setTimeout(() => messageStatus.textContent = "", 4000);
      }
      return;
    }

    // Disable button during submission
    sendMessageBtn.disabled = true;
    if (messageStatus) {
      messageStatus.textContent = "Envoi en cours...";
      messageStatus.style.color = "var(--cyan)";
    }

    try {
      // Insert into course_messages table
      const { error } = await supabase
        .from("course_messages")
        .insert([{
          course_id: courseId,
          user_id: user.id,
          message: msgText,
          status: "pending",
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      // Success feedback
      if (messageInput) messageInput.value = "";
      if (charCount) charCount.textContent = "0 / 350";
      
      if (messageStatus) {
        messageStatus.textContent = "✅ Message envoyé avec succès !";
        messageStatus.style.color = "#10b981";
        setTimeout(() => messageStatus.textContent = "", 5000);
      }

    } catch (err) {
      console.error("Error sending message:", err);
      if (messageStatus) {
        messageStatus.textContent = "❌ Erreur lors de l'envoi. Veuillez réessayer.";
        messageStatus.style.color = "#ef4444";
        setTimeout(() => messageStatus.textContent = "", 5000);
      }
    } finally {
      sendMessageBtn.disabled = false;
    }
  });
}

// Allow Enter+Shift for newline, Enter alone to send (optional UX improvement)
if (messageInput && sendMessageBtn) {
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessageBtn.click();
    }
  });
}

/* ==========================
   INITIALIZATION
========================== */

await loadFilters();
await loadCourse();
