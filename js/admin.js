import { supabase } from "./supabase.js";
import { requireAdmin } from "./adminGuard.js";
import {
  parseTextToHTML,
  deparseHTMLToText
} from "./parser.js";


const { user, profile } = await requireAdmin();

/* ==========================
   DOM
========================== */
const courseForm = document.getElementById("courseForm");
const sectionsContainer = document.getElementById("sections");
const classSelect = document.getElementById("classSelect");
const subjectSelect = document.getElementById("subjectSelect");
const addSectionBtn = document.getElementById("addSection");

const courseList = document.getElementById("courseList");
const searchInput = document.getElementById("searchCourse");
const filterClass = document.getElementById("filterClass");
const filterSubject = document.getElementById("filterSubject");

let editingCourseId = null;

/* ==========================
   SECTION FACTORY
========================== */
function createSection({ id = null, title = "", raw = "", image = "" } = {}) {
  const div = document.createElement("div");
  div.className = "section card";
  if (id) div.dataset.id = id;
  div.innerHTML = `
    <input class="section-title" placeholder="Titre section" required value="${title}">

    <div class="section-toolbar" aria-hidden="false">
      <button type="button" data-insert="h1" title="Titre 1">H1</button>
      <button type="button" data-insert="h2" title="Titre 2">H2</button>
      <button type="button" data-insert="h3" title="Titre 3">H3</button>
      <button type="button" data-insert="bold" title="Gras">B</button>
      <button type="button" data-insert="italic" title="Italique">I</button>
      <button type="button" data-insert="code" title="Bloc de code">{ }</button>
      <button type="button" data-insert="ul" title="Liste">•</button>
      <button type="button" data-insert="ol" title="Liste numérotée">1.</button>
      <button type="button" data-insert="quote" title="Citation">❝</button>
      <button type="button" data-insert="link" title="Lien">🔗</button>
      <button type="button" data-insert="image" title="Image">🖼️</button>
    </div>

    <textarea
      class="rawContent"
      placeholder="# Titre\n\nTexte\n\n[lien](https://...)"
      required
    >${raw}</textarea>

    <div class="previewContent card"></div>

    <input class="imageUrl" placeholder="Image URL (optionnel)" value="${image}">
  `;

  const textarea = div.querySelector(".rawContent");
  const preview = div.querySelector(".previewContent");
  const toolbar = div.querySelector('.section-toolbar');

  // Insert text at caret/selection in textarea and try to place caret inside placeholder
  function insertAtCaret(textarea, insertText, placeCursorTokenMatch) {
    textarea.focus();
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const value = textarea.value || "";
    const newValue = value.slice(0, start) + insertText + value.slice(end);
    textarea.value = newValue;

    // place cursor inside the inserted template if possible
    if (placeCursorTokenMatch) {
      const idx = newValue.indexOf(placeCursorTokenMatch, start);
      if (idx !== -1) {
        const pos = idx;
        textarea.setSelectionRange(pos, pos + placeCursorTokenMatch.length);
        textarea.focus();
        return;
      }
    }

    // default: place caret after inserted text
    const caret = start + insertText.length;
    textarea.setSelectionRange(caret, caret);
    textarea.focus();
  }

  const updatePreview = () => {
    preview.innerHTML = parseTextToHTML(textarea.value);
  };

  textarea.addEventListener("input", updatePreview);
  updatePreview();

  // Toolbar button behavior: insert templates
  if (toolbar) {
    toolbar.querySelectorAll('[data-insert]').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.insert;
        let tpl = '';
        let token = null;
        switch (k) {
          case 'h1': tpl = '# TITRE\n\n'; token = 'TITRE'; break;
          case 'h2': tpl = '## Sous-titre\n\n'; token = 'Sous-titre'; break;
          case 'h3': tpl = '### Titre\n\n'; token = 'Titre'; break;
          case 'bold': tpl = '**gras**'; token = 'gras'; break;
          case 'italic': tpl = '_italique_'; token = 'italique'; break;
          case 'code': tpl = '```\ncode\n```\n\n'; token = 'code'; break;
          case 'ul': tpl = '- Élément 1\n- Élément 2\n\n'; token = 'Élément 1'; break;
          case 'ol': tpl = '1. Élément 1\n2. Élément 2\n\n'; token = 'Élément 1'; break;
          case 'quote': tpl = '> Citation\n\n'; token = 'Citation'; break;
          case 'link': tpl = '[texte](https://example.com)'; token = 'texte'; break;
          case 'image': tpl = '![alt](https://example.com/image.png)'; token = 'alt'; break;
        }
        insertAtCaret(textarea, tpl, token);
        updatePreview();
      });
    });
  }

  return div;
}

/* ==========================
   LOAD CLASSES & SUBJECTS
========================== */
async function loadClassesSubjects() {
  const { data: classes } = await supabase.from("classes").select("*");
  const { data: subjects } = await supabase.from("subjects").select("*");

  classSelect.innerHTML = "";
  filterClass.innerHTML = `<option value="">Toutes les classes</option>`;
  classes.forEach(c => {
    classSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    filterClass.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });

  subjectSelect.innerHTML = "";
  filterSubject.innerHTML = `<option value="">Toutes les matières</option>`;
  subjects.forEach(s => {
    subjectSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    filterSubject.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
}

/* ==========================
   LOAD COURSES (ADMIN LIST)
========================== */
async function loadCourses() {
  if (!courseList) return;

  let query = supabase
    .from("courses")
    .select("*, course_sections(*, edited_by(username)), last_editor(username)")
    .order("created_at", { ascending: false });

  if (searchInput.value) query = query.ilike("title", `%${searchInput.value}%`);
  if (filterClass.value) query = query.eq("class_id", filterClass.value);
  if (filterSubject.value) query = query.eq("subject_id", filterSubject.value);

  const { data: courses } = await query;

  courseList.innerHTML = courses.map(c => {
    const editor =
      c.last_editor?.username ??
      c.course_sections?.slice(-1)[0]?.edited_by?.username ??
      "—";

    return `
      <div class="courseCard" data-id="${c.id}">
        <h3>${c.title}</h3>
        <p>Classe : ${c.class_id} | Matière : ${c.subject_id}</p>
        <p>Dernier éditeur : ${editor}</p>
        <button class="editCourse">Éditer</button>
        <button class="deleteCourse">Supprimer</button>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".editCourse")
    .forEach(b => b.onclick = () => editCourse(b.closest(".courseCard").dataset.id));

  document.querySelectorAll(".deleteCourse")
    .forEach(b => b.onclick = () => deleteCourse(b.closest(".courseCard").dataset.id));
}

/* ==========================
   ADD SECTION
========================== */
addSectionBtn.onclick = () => {
  sectionsContainer.appendChild(createSection());
};

/* ==========================
   SUBMIT COURSE
========================== */
courseForm.onsubmit = async e => {
  e.preventDefault();

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user.id;

  const courseData = {
    title: courseForm.title.value,
    class_id: classSelect.value,
    subject_id: subjectSelect.value,
    last_editor: userId,
    validated: true
  };

  if (editingCourseId) {
    await supabase.from("courses")
      .update(courseData)
      .eq("id", editingCourseId);
  } else {
    const { data: newCourse } = await supabase
      .from("courses")
      .insert(courseData)
      .select()
      .single();

    editingCourseId = newCourse.id;
  }

  for (const s of sectionsContainer.querySelectorAll(".section")) {
    const payload = {
      course_id: editingCourseId,
      title: s.querySelector(".section-title").value,
      content: parseTextToHTML(
        s.querySelector(".rawContent")?.value ??
        s.querySelector("textarea").value
      ),
      image_url: s.querySelector(".imageUrl")?.value || null,
      edited_by: userId
    };

    if (s.dataset.id) {
      await supabase.from("course_sections")
        .update(payload)
        .eq("id", s.dataset.id);
    } else {
      await supabase.from("course_sections").insert(payload);
    }
  }

  alert("Cours sauvegardé ✅");

  editingCourseId = null;
  courseForm.reset();
  sectionsContainer.innerHTML = "";
  loadCourses();
};

/* ==========================
   EDIT COURSE
========================== */
async function editCourse(id) {
  const { data: course } = await supabase
    .from("courses")
    .select("*, course_sections(*, edited_by(username)), last_editor(username)")
    .eq("id", id)
    .single();

  editingCourseId = id;
  courseForm.title.value = course.title;
  classSelect.value = course.class_id;
  subjectSelect.value = course.subject_id;

  const lastEditorInput = document.getElementById("lastEditor");
  if (lastEditorInput) {
    lastEditorInput.value =
      course.last_editor?.username ??
      course.course_sections?.slice(-1)[0]?.edited_by?.username ??
      "—";
  }

  sectionsContainer.innerHTML = "";
  course.course_sections.forEach(s => {
    sectionsContainer.appendChild(
      createSection({
        id: s.id,
        title: s.title,

        raw: deparseHTMLToText(s.content),

        image: s.image_url || ""
      })
    );
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ==========================
   DELETE COURSE
========================== */
async function deleteCourse(id) {
  if (!confirm("Supprimer ce cours ?")) return;
  await supabase.from("courses").delete().eq("id", id);
  loadCourses();
}

/* ==========================
   INIT
========================== */
await loadClassesSubjects();
await loadCourses();

searchInput.oninput = loadCourses;
filterClass.onchange = loadCourses;
filterSubject.onchange = loadCourses;
const messagesList = document.getElementById("messagesList");


async function loadMessages() {
  if (!messagesList) return;

  const { data: messages, error } = await supabase
    .from("course_messages")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    messagesList.innerHTML = "Erreur : " + error.message;
    return;
  }

  if (!messages.length) {
    messagesList.innerHTML = "<p>Aucun message pour l'instant.</p>";
    return;
  }

  messagesList.innerHTML = "";

  const enrichedMessages = await Promise.all(messages.map(async msg => {
    const { data: user } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", msg.user_id)
      .single();

    const { data: admin } = msg.answered_by
      ? await supabase
        .from("profiles")
        .select("username")
        .eq("id", msg.answered_by)
        .single()
      : { data: null };

    return {
      ...msg,
      username: user?.username || "Inconnu",
      answeredBy: admin?.username || "—"
    };
  }));

  enrichedMessages.forEach(msg => {
    const div = document.createElement("div");
    div.className = "message-card";

    // 🔴 Style visuel si signalé
    if (msg.flagged) div.classList.add("flagged-message");

    div.innerHTML = `
    <p><strong>${msg.username}</strong> : ${msg.message}</p>
    <p>Status : ${msg.status} | Cours : ${msg.course_id} | Envoyé le : ${new Date(msg.created_at).toLocaleString()}</p>
    <p>Répondu par : ${msg.answeredBy}</p>
    ${msg.status !== 'answered' ? `
      <textarea class="answerInput" placeholder="Votre réponse..." ${msg.flagged ? "disabled" : ""}></textarea>
      <div class="admin-actions">
        <button class="danger deleteMsg" data-id="${msg.id}" ${msg.flagged ? "disabled" : ""}>Supprimer</button>
        <button class="warning flagMsg" 
                data-id="${msg.id}"
                data-user="${msg.user_id}"
                data-course="${msg.course_id}"
                ${msg.flagged ? "disabled" : ""}>
          Signaler
        </button>
      </div>
      <button class="replyBtn" data-id="${msg.id}" ${msg.flagged ? "disabled" : ""}>Répondre</button>
    ` : `<p><strong>Réponse :</strong> ${msg.answer}</p>`}
  `;
    messagesList.appendChild(div);
  });


  attachMessageActions(); // 👈 UN SEUL ENDROIT
}
function attachMessageActions() {

  // 💬 RÉPONDRE
  document.querySelectorAll(".replyBtn").forEach(btn => {
    btn.onclick = async () => {
      const card = btn.closest(".message-card");
      const textarea = card.querySelector(".answerInput");
      const answerText = textarea?.value.trim();

      if (!answerText) return alert("Veuillez saisir une réponse");

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return alert("Vous devez être connecté");

      const { error } = await supabase
        .from("course_messages")
        .update({
          status: "answered",
          answered_by: user.id,
          answer: answerText,
          answered_at: new Date()
        })
        .eq("id", btn.dataset.id);

      if (error) alert(error.message);
      else loadMessages();
    };
  });

  document.querySelectorAll(".deleteMsg").forEach(btn => {
    btn.onclick = async () => {
      console.log("DELETE CLICK", btn.dataset.id);

      if (!confirm("Supprimer ce message ?")) return;

      const { error } = await supabase
        .from("course_messages")
        .delete()
        .eq("id", btn.dataset.id);

      if (error) {
        console.error(error);
        alert(error.message);
      } else {
        console.log("DELETED");
        loadMessages();
      }
    };
  });


  // 🚩 SIGNALER
  document.querySelectorAll(".flagMsg").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("Signaler ce message et bloquer l'utilisateur ?")) return;

      const messageId = btn.dataset.id;
      const userId = btn.dataset.user;
      const courseId = btn.dataset.course;

      const { data: msg } = await supabase
        .from("course_messages")
        .select("*")
        .eq("id", messageId)
        .single();

      await supabase.from("flagged_messages").insert({
        original_message_id: msg.id,
        user_id: userId,
        course_id: courseId,
        message: msg.message,
        flagged_by: (await supabase.auth.getUser()).data.user.id
      });

      await supabase
        .from("course_messages")
        .update({ flagged: true })
        .eq("id", messageId);

      await supabase
        .from("profiles")
        .update({ restricted: true })
        .eq("id", userId);

      alert("Message signalé et utilisateur bloqué.");
      loadMessages();
    };
  });
}


// Charger une première fois au lancement
await loadMessages();


