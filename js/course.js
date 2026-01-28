import { supabase } from "./supabase.js";

/* ==========================
   ELEMENTS
========================== */
const classFilter = document.getElementById("classFilter");
const subjectFilter = document.getElementById("subjectFilter");
const courseDiv = document.getElementById("course");

/* NOTE: the loader markup is present in course.html; no dynamic creation here. */

/* ==========================
   LOAD FILTERS
========================== */
const { data: classes } = await supabase.from("classes").select("*");
classFilter.innerHTML = `<option value="">Toutes les classes</option>`;
classes.forEach(c => classFilter.innerHTML += `<option value="${c.id}">${c.name}</option>`);

const { data: subjects } = await supabase.from("subjects").select("*");
subjectFilter.innerHTML = `<option value="">Toutes les matières</option>`;
subjects.forEach(s => subjectFilter.innerHTML += `<option value="${s.id}">${s.name}</option>`);

/* ==========================
   LOAD COURSE
========================== */
async function loadCourse() {

  const id = new URLSearchParams(location.search).get("id");
  const courseDiv = document.getElementById("course");
  const loader = document.getElementById("loader");

  if (!id) {
    loader.style.display = "none";
    courseDiv.innerHTML = "<p>Cours introuvable.</p>";
    return;
  }
  await new Promise(res => setTimeout(res, 500));
  try {
    // Récupérer le cours
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("title")
      .eq("id", id)
      .single();

    if (courseError || !course) throw courseError;

    // Récupérer les sections
    const { data: sections, error: sectionError } = await supabase
      .from("course_sections")
      .select("*")
      .eq("course_id", id)
      .order("position", { ascending: true });

    if (sectionError) throw sectionError;

    // Affichage du cours into #courseContent so chronometer/loader remain
    const contentEl = document.getElementById('courseContent');
    if (contentEl) {
      contentEl.innerHTML = `
        <h1>${course.title}</h1>
        ${sections.map(s => `
          <section>
            <h3>${s.title}</h3>
            <p>${s.content}</p>
            ${s.image_url ? `<img src="${s.image_url}" alt="" style="max-width: 50%; height: auto;">` : ""}
          </section>
        `).join("")}
      `;
    }

    // start chronometer automatically when course is rendered
    if (typeof startChrono === 'function') startChrono();
  } catch (err) {
    console.error(err);
    courseDiv.innerHTML = "";
  } finally {
    // Cacher le loader
    if (loader) loader.style.display = "none";
  }
}

// Exécuter la fonction (load will be triggered later after chrono setup)


/* ==========================
   EXECUTE
========================== */
loadCourse();





/* ==========================
   PROGRESSION DE LECTURE
========================== */

const courseId = new URLSearchParams(location.search).get("id");
const progressBar = document.querySelector("#readingProgress .bar");
const progressLabel = document.querySelector("#readingProgress .label");

// Charger l'état global
const state = JSON.parse(localStorage.getItem("learning_progress")) || { courses: {} };

// Restauration si existant
if (state.courses[courseId]) {
  progressBar.style.width = state.courses[courseId].percent + "%";
  progressLabel.textContent = state.courses[courseId].percent + "%";
}
function updateReadingProgress() {
  const scrollTop = window.scrollY;
  const docHeight = document.body.scrollHeight - window.innerHeight;

  if (docHeight <= 0) return;

  const currentPercent = Math.min(
    100,
    Math.round((scrollTop / docHeight) * 100)
  );

  // progression déjà enregistrée
  const savedPercent = state.courses[courseId]?.percent || 0;

  // on garde le MAXIMUM
  const finalPercent = Math.max(currentPercent, savedPercent);

  progressBar.style.width = finalPercent + "%";
  progressLabel.textContent = finalPercent + "%";

  state.courses[courseId] = {
    percent: finalPercent,
    completed: finalPercent >= 90
  };

  localStorage.setItem("learning_progress", JSON.stringify(state));
  if (finalPercent >= 90) {
    progressLabel.textContent = "✓ Terminé";
  }

}


window.addEventListener("scroll", updateReadingProgress);

/* ==========================
   CHRONOMETER / STOPWATCH
========================== */

const chronoDisplay = document.getElementById('chronoDisplay');

let chronoSeconds = 0;
let chronoInterval = null;

// determine current course id for persistence
const _courseId_for_chrono = new URLSearchParams(location.search).get("id");

// restore saved seconds if available
try {
  const _saved = JSON.parse(localStorage.getItem('learning_progress')) || { courses: {} };
  const prev = _saved.courses[_courseId_for_chrono]?.timeSeconds || 0;
  chronoSeconds = Number(prev) || 0;
} catch (e) {
  chronoSeconds = 0;
}

function formatHMS(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function updateChrono() {
  if (chronoDisplay) chronoDisplay.textContent = formatHMS(chronoSeconds);
}

function startChrono() {
  if (chronoInterval) return;
  chronoInterval = setInterval(() => {
    chronoSeconds++;
    updateChrono();
    // persist current chrono seconds into learning_progress
    try {
      const st = JSON.parse(localStorage.getItem('learning_progress')) || { courses: {} };
      st.courses[_courseId_for_chrono] = st.courses[_courseId_for_chrono] || {};
      st.courses[_courseId_for_chrono].timeSeconds = chronoSeconds;
      localStorage.setItem('learning_progress', JSON.stringify(st));
    } catch (e) {
      console.warn('Could not persist chrono', e);
    }
  }, 1000);
}

function pauseChrono() {
  if (chronoInterval) { clearInterval(chronoInterval); chronoInterval = null; }
}

function resetChrono() {
  pauseChrono(); chronoSeconds = 0; updateChrono();
}

// ensure initial display
updateChrono();

// also persist on page unload to be safe
window.addEventListener('beforeunload', () => {
  try {
    const st = JSON.parse(localStorage.getItem('learning_progress')) || { courses: {} };
    st.courses[_courseId_for_chrono] = st.courses[_courseId_for_chrono] || {};
    st.courses[_courseId_for_chrono].timeSeconds = chronoSeconds;
    localStorage.setItem('learning_progress', JSON.stringify(st));
  } catch (e) {
    /* ignore */
  }
});


        const backToTopButton = document.getElementById('backToTop');

        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backToTopButton.classList.add('show');
            } else {
                backToTopButton.classList.remove('show');
            }
        });

        backToTopButton.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });



/* ==========================
   MESSAGERIE (USER -> ADMIN)
========================== */

const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const messageStatus = document.getElementById('messageStatus');

sendMessageBtn?.addEventListener('click', async () => {
  const msgText = messageInput.value.trim();
  if (!msgText) return alert("Veuillez écrire un message.");

  // Récupère l'utilisateur actuel
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return alert("Vous devez être connecté pour envoyer un message.");

  const courseId = new URLSearchParams(location.search).get("id");
  if (!courseId) return alert("Impossible d'envoyer le message : cours introuvable.");
sendMessageBtn.disabled = true;
  // Insert dans la table course_messages
  const { error } = await supabase
    .from('course_messages')
    .insert([{
      course_id: courseId,
      user_id: user.id,
      message: msgText,
      status: 'pending',
      created_at: new Date()
    }]);

  if (error) {
    console.error(error);
    return alert("Erreur lors de l'envoi du message.");
  }

  // Feedback utilisateur
  messageInput.value = "";
  messageStatus.textContent = "Message envoyé ✅";
  setTimeout(() => messageStatus.textContent = "", 5000);
  
  sendMessageBtn.disabled = false;
});

const charCount = document.getElementById("charCount");

messageInput.addEventListener("input", () => {
  const length = messageInput.value.length;
  charCount.textContent = `${length} / 350`;
});
