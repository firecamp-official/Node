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
   PDF EXPORT
========================== */

const exportPdfBtn = document.getElementById("exportPdfBtn");

async function exportCourseToPDF() {
  const { jsPDF } = window.jspdf;
  if (!courseContent || !courseContent.children.length) return;

  // ── Button state ─────────────────────────────────────────
  const btnText   = exportPdfBtn?.querySelector(".pdf-btn-text");
  const btnLoader = exportPdfBtn?.querySelector(".pdf-btn-loader");
  const btnIcon   = exportPdfBtn?.querySelector(".pdf-btn-icon");
  if (exportPdfBtn) exportPdfBtn.disabled = true;
  if (btnText)   btnText.style.display   = "none";
  if (btnIcon)   btnIcon.style.display   = "none";
  if (btnLoader) btnLoader.style.display = "inline-flex";

  try {
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

    // ── Layout constants ──────────────────────────────────────
    const PAGE_W    = 210;
    const PAGE_H    = 297;
    const MARGIN    = 18;
    const CW        = PAGE_W - MARGIN * 2;   // content width
    const FOOTER_H  = 18;                    // reserved at bottom
    const BODY_TOP  = 20;                    // top of content on continuation pages

    // ── Palette ───────────────────────────────────────────────
    const C_VIOLET  = [100,  60, 220];
    const C_CYAN    = [  6, 182, 212];
    const C_DARK    = [ 18,  18,  30];
    const C_TEXT    = [ 38,  38,  52];
    const C_MUTED   = [110, 110, 135];
    const C_LINK    = [ 80, 100, 210];
    const C_LIGHT   = [245, 244, 252];
    const C_QUOTE   = [235, 233, 250];
    const C_WHITE   = [255, 255, 255];
    const C_RULE    = [220, 218, 238];
    const C_BULLET  = [130,  90, 220];

    // ── State ─────────────────────────────────────────────────
    let curY    = 0;
    let pageNum = 1;

    const courseTitle = courseContent.querySelector("h1")?.textContent?.trim() || "Cours";

    // ── Font helper ───────────────────────────────────────────
    function sf(style = "normal", size = 10, color = C_TEXT) {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
    }

    // ── Gradient header (page 1) ──────────────────────────────
    function drawHeader() {
      doc.setFillColor(...C_DARK);
      doc.rect(0, 0, PAGE_W, 50, "F");

      // gradient bar
      const steps = 60;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const r = Math.round(C_VIOLET[0] + t * (C_CYAN[0] - C_VIOLET[0]));
        const g = Math.round(C_VIOLET[1] + t * (C_CYAN[1] - C_VIOLET[1]));
        const b = Math.round(C_VIOLET[2] + t * (C_CYAN[2] - C_VIOLET[2]));
        doc.setFillColor(r, g, b);
        doc.rect(MARGIN + (CW / steps) * i, 45.5, CW / steps + 0.5, 2.5, "F");
      }

      // h1 title
      sf("bold", 18, C_WHITE);
      const titleLines = doc.splitTextToSize(courseTitle, CW);
      doc.text(titleLines, MARGIN, 22);

      // date
      sf("normal", 8, [160, 155, 200]);
      const d = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      doc.text(d, MARGIN, 40);

      curY = 58;
    }

    // ── Continuation page mini-header ─────────────────────────
    function drawContHeader() {
      doc.setFillColor(...C_LIGHT);
      doc.rect(0, 0, PAGE_W, 13, "F");
      sf("bold", 7.5, C_MUTED);
      doc.text(courseTitle, MARGIN, 8.5);
      doc.setDrawColor(...C_RULE);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, 12, PAGE_W - MARGIN, 12);
      curY = BODY_TOP;
    }

    // ── Footer ────────────────────────────────────────────────
    function drawFooter(pn, total) {
      const y = PAGE_H - 8;
      doc.setDrawColor(...C_RULE);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y - 4, PAGE_W - MARGIN, y - 4);
      sf("normal", 7.5, C_MUTED);
      doc.text("Node Platform", MARGIN, y);
      doc.text(`Page ${pn} / ${total}`, PAGE_W - MARGIN, y, { align: "right" });
    }

    // ── Page break check ──────────────────────────────────────
    function needsBreak(h) {
      return curY + h > PAGE_H - FOOTER_H;
    }

    function newPage() {
      drawFooter(pageNum, "…");
      doc.addPage();
      pageNum++;
      drawContHeader();
    }

    function ensureSpace(h) {
      if (needsBreak(h)) newPage();
    }

    // ── Write wrapped text, chunking across pages ─────────────
    function writeLines(lines, lineH, xOffset = 0) {
      let i = 0;
      while (i < lines.length) {
        const avail = Math.floor((PAGE_H - FOOTER_H - curY) / lineH);
        const take  = Math.max(1, avail);
        const chunk = lines.slice(i, i + take);
        doc.text(chunk, MARGIN + xOffset, curY, { lineHeightFactor: 1.5 });
        curY += chunk.length * lineH;
        i    += take;
        if (i < lines.length) newPage();
      }
    }

    // ── Extract flat inline text from a node ─────────────────
    function inlineText(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent;
      return Array.from(node.childNodes).map(inlineText).join("");
    }

    // ── DOM WALKER ────────────────────────────────────────────
    // Converts DOM nodes to PDF drawing calls, recursively.
    async function renderNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return; // handled by block parents

      const tag = node.tagName?.toLowerCase();

      // ── H1 (course title already in header – skip) ────────
      if (tag === "h1") return;

      // ── H2 ───────────────────────────────────────────────
      if (tag === "h2") {
        const text  = node.textContent.trim();
        if (!text) return;
        const lines = doc.splitTextToSize(text, CW);
        const bh    = Math.max(10, lines.length * 7) + 8;

        ensureSpace(bh + 4);
        curY += 3;

        // Full-width dark band
        doc.setFillColor(...C_DARK);
        doc.roundedRect(MARGIN, curY, CW, bh - 2, 3, 3, "F");

        // gradient accent left
        doc.setFillColor(...C_VIOLET);
        doc.rect(MARGIN, curY, 4, bh - 2, "F");

        sf("bold", 13, C_WHITE);
        doc.text(lines, MARGIN + 8, curY + 6);
        curY += bh + 4;
        return;
      }

      // ── H3 ───────────────────────────────────────────────
      if (tag === "h3") {
        const text  = node.textContent.trim();
        if (!text) return;
        const lines = doc.splitTextToSize(text, CW - 8);
        const bh    = Math.max(8, lines.length * 6.5) + 6;

        ensureSpace(bh + 4);
        curY += 2;

        doc.setFillColor(...C_LIGHT);
        doc.roundedRect(MARGIN, curY, CW, bh, 2, 2, "F");
        doc.setFillColor(...C_VIOLET);
        doc.rect(MARGIN, curY, 3, bh, "F");

        sf("bold", 11, C_DARK);
        doc.text(lines, MARGIN + 7, curY + 5);
        curY += bh + 4;
        return;
      }

      // ── H4 / H5 / H6 ─────────────────────────────────────
      if (["h4","h5","h6"].includes(tag)) {
        const text  = node.textContent.trim();
        if (!text) return;
        const size  = tag === "h4" ? 10.5 : 10;
        const lines = doc.splitTextToSize(text, CW);
        ensureSpace(lines.length * 6 + 4);
        curY += 3;
        sf("bold", size, C_DARK);
        writeLines(lines, 6);
        curY += 3;
        return;
      }

      // ── Paragraph ─────────────────────────────────────────
      if (tag === "p") {
        const text = node.textContent.trim();
        if (!text) return;
        sf("normal", 10, C_TEXT);
        const lines = doc.splitTextToSize(text, CW);
        ensureSpace(Math.min(lines.length * 5.5, 20));
        writeLines(lines, 5.5);
        curY += 3;
        return;
      }

      // ── Unordered list ────────────────────────────────────
      if (tag === "ul") {
        const items = node.querySelectorAll(":scope > li");
        items.forEach(li => {
          const text  = li.textContent.trim();
          if (!text) return;
          const lines = doc.splitTextToSize(text, CW - 8);
          ensureSpace(lines.length * 5.5 + 2);

          // Bullet dot
          doc.setFillColor(...C_BULLET);
          doc.circle(MARGIN + 3, curY - 1.2, 1, "F");

          sf("normal", 10, C_TEXT);
          writeLines(lines, 5.5, 7);
          curY += 2;
        });
        curY += 2;
        return;
      }

      // ── Ordered list ──────────────────────────────────────
      if (tag === "ol") {
        const items = node.querySelectorAll(":scope > li");
        items.forEach((li, idx) => {
          const text  = li.textContent.trim();
          if (!text) return;
          const lines = doc.splitTextToSize(text, CW - 10);
          ensureSpace(lines.length * 5.5 + 2);

          sf("bold", 9, C_VIOLET);
          doc.text(`${idx + 1}.`, MARGIN + 1, curY);

          sf("normal", 10, C_TEXT);
          writeLines(lines, 5.5, 9);
          curY += 2;
        });
        curY += 2;
        return;
      }

      // ── Blockquote ────────────────────────────────────────
      if (tag === "blockquote") {
        const text  = node.textContent.trim();
        if (!text) return;
        const lines = doc.splitTextToSize(text, CW - 14);
        const bh    = lines.length * 5.5 + 8;

        ensureSpace(bh + 4);
        curY += 2;

        doc.setFillColor(...C_QUOTE);
        doc.roundedRect(MARGIN, curY, CW, bh, 2, 2, "F");
        doc.setFillColor(...C_VIOLET);
        doc.rect(MARGIN, curY, 3, bh, "F");

        sf("italic", 10, [70, 60, 110]);
        doc.text(lines, MARGIN + 8, curY + 5.5, { lineHeightFactor: 1.5 });
        curY += bh + 4;
        return;
      }

      // ── Horizontal rule ───────────────────────────────────
      if (tag === "hr") {
        ensureSpace(8);
        curY += 4;
        doc.setDrawColor(...C_RULE);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, curY, PAGE_W - MARGIN, curY);
        curY += 6;
        return;
      }

      // ── Image ─────────────────────────────────────────────
      if (tag === "img") {
        const src = node.src;
        if (!src) return;

        try {
          // Draw image via canvas to get base64
          const imgEl = new Image();
          imgEl.crossOrigin = "anonymous";
          await new Promise((res, rej) => {
            imgEl.onload = res;
            imgEl.onerror = rej;
            imgEl.src = src;
          });

          const canvas = document.createElement("canvas");
          const maxW   = 800;
          const scale  = imgEl.naturalWidth > maxW ? maxW / imgEl.naturalWidth : 1;
          canvas.width  = imgEl.naturalWidth  * scale;
          canvas.height = imgEl.naturalHeight * scale;
          canvas.getContext("2d").drawImage(imgEl, 0, 0, canvas.width, canvas.height);
          const b64 = canvas.toDataURL("image/jpeg", 0.85);

          // Compute display dimensions (max 80% of content width)
          const maxPdfW  = CW * 0.9;
          const ratio    = canvas.width / canvas.height;
          const pdfW     = Math.min(maxPdfW, CW);
          const pdfH     = pdfW / ratio;

          ensureSpace(pdfH + 6);
          curY += 2;

          // Centered
          const xImg = MARGIN + (CW - pdfW) / 2;
          doc.addImage(b64, "JPEG", xImg, curY, pdfW, pdfH);

          // Alt caption
          const alt = node.alt?.trim();
          if (alt) {
            curY += pdfH + 3;
            sf("italic", 8.5, C_MUTED);
            const capLines = doc.splitTextToSize(alt, CW);
            doc.text(capLines, PAGE_W / 2, curY, { align: "center" });
            curY += capLines.length * 4.5 + 3;
          } else {
            curY += pdfH + 6;
          }
        } catch (_) {
          // If image fails, show a placeholder note
          ensureSpace(8);
          sf("italic", 8.5, C_MUTED);
          doc.text("[Image non disponible]", MARGIN, curY);
          curY += 7;
        }
        return;
      }

      // ── Table ─────────────────────────────────────────────
      if (tag === "table") {
        const rows = Array.from(node.querySelectorAll("tr"));
        if (!rows.length) return;

        const colCount = Math.max(...rows.map(r => r.cells.length));
        if (!colCount) return;

        const colW    = CW / colCount;
        const rowH    = 8;
        const cellPad = 2.5;

        rows.forEach((row, rIdx) => {
          ensureSpace(rowH + 2);

          const isHeader = rIdx === 0 && (row.querySelector("th") || row.closest("thead"));

          if (isHeader) {
            doc.setFillColor(...C_DARK);
            doc.rect(MARGIN, curY, CW, rowH, "F");
          } else {
            doc.setFillColor(rIdx % 2 === 0 ? 255 : 248, rIdx % 2 === 0 ? 255 : 247, rIdx % 2 === 0 ? 255 : 255);
            doc.rect(MARGIN, curY, CW, rowH, "F");
          }

          // border
          doc.setDrawColor(...C_RULE);
          doc.setLineWidth(0.2);
          doc.rect(MARGIN, curY, CW, rowH, "S");

          Array.from(row.cells).forEach((cell, cIdx) => {
            const cellText = cell.textContent.trim();
            if (isHeader) {
              sf("bold", 8.5, C_WHITE);
            } else {
              sf("normal", 8.5, C_TEXT);
            }
            const wrapped = doc.splitTextToSize(cellText, colW - cellPad * 2);
            doc.text(wrapped[0] || "", MARGIN + colW * cIdx + cellPad, curY + 5.5);
          });

          curY += rowH;
        });
        curY += 5;
        return;
      }

      // ── Code block ────────────────────────────────────────
      if (tag === "pre" || tag === "code") {
        const text = node.textContent.trim();
        if (!text) return;

        doc.setFont("courier", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...C_TEXT);
        const lines = doc.splitTextToSize(text, CW - 10);
        const bh    = lines.length * 4.8 + 8;

        ensureSpace(bh + 4);
        curY += 2;

        doc.setFillColor(28, 28, 40);
        doc.roundedRect(MARGIN, curY, CW, bh, 2, 2, "F");

        doc.setTextColor(180, 220, 180);
        doc.text(lines, MARGIN + 5, curY + 5.5, { lineHeightFactor: 1.5 });
        curY += bh + 5;
        return;
      }

      // ── <a> link inline ───────────────────────────────────
      if (tag === "a") {
        const text = node.textContent.trim();
        const href = node.href || "";
        if (!text) return;
        sf("normal", 10, C_LINK);
        const lines = doc.splitTextToSize(`↗ ${text}`, CW);
        ensureSpace(lines.length * 5.5 + 2);
        writeLines(lines, 5.5);

        // Underline the first line
        const tw = doc.getTextWidth(lines[0]);
        doc.setDrawColor(...C_LINK);
        doc.setLineWidth(0.25);
        doc.line(MARGIN, curY - 1, MARGIN + tw, curY - 1);
        curY += 2;
        return;
      }

      // ── Strong / em – render inline via parent paragraph ──
      // (already captured by p / li textContent above)

      // ── Section wrapper – recurse into children ────────────
      if (tag === "section" || tag === "div" || tag === "article" || tag === "main" || !tag) {
        for (const child of node.childNodes) {
          await renderNode(child);
        }
        return;
      }

      // ── Fallback: any block with text – render as paragraph ─
      const fallback = node.textContent?.trim();
      if (fallback) {
        sf("normal", 10, C_TEXT);
        const lines = doc.splitTextToSize(fallback, CW);
        ensureSpace(Math.min(lines.length * 5.5, 20));
        writeLines(lines, 5.5);
        curY += 3;
      }
    }

    // ── Start rendering ───────────────────────────────────────
    drawHeader();

    for (const child of courseContent.childNodes) {
      await renderNode(child);
    }

    // ── Finalize footers ──────────────────────────────────────
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      drawFooter(p, total);
    }

    // ── Save ──────────────────────────────────────────────────
    const safeName = courseTitle
      .replace(/[^a-z0-9\u00C0-\u024F\s\-]/gi, "")
      .trim()
      .replace(/\s+/g, "_") || "cours";
    doc.save(`${safeName}.pdf`);

  } catch (err) {
    console.error("PDF export error:", err);
    alert("Une erreur est survenue lors de la génération du PDF.");
  } finally {
    if (exportPdfBtn) exportPdfBtn.disabled = false;
    if (btnText)   btnText.style.display   = "";
    if (btnIcon)   btnIcon.style.display   = "";
    if (btnLoader) btnLoader.style.display = "none";
  }
}

if (exportPdfBtn) {
  exportPdfBtn.addEventListener("click", exportCourseToPDF);
}

/* ==========================
   INITIALIZATION
========================== */

await loadFilters();
await loadCourse();
