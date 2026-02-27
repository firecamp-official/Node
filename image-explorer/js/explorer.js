import { supabase } from "../../js/supabase.js";

// ─── Cloudinary config ───────────────────────────────────────────────
const cloudName    = "dwfws7ydj";
const uploadPreset = "stockageImage";

// ─── DOM refs ────────────────────────────────────────────────────────
const preview        = document.getElementById("preview");
const imageUrlInput  = document.getElementById("imageUrl");
const resultCard     = document.getElementById("result");
const imageContainer = document.getElementById("imageContainer");
const imageCount     = document.getElementById("imageCount");

// ─── Toast helper (defined in HTML, but fallback here) ───────────────
function toast(msg, icon = "✅") {
  if (window.showToast) { window.showToast(msg, icon); return; }
  console.log(icon, msg);
}

// ─── Load images from Supabase ───────────────────────────────────────
async function loadImages() {
  // Show skeletons while loading
  imageContainer.innerHTML = Array(8).fill(0)
    .map(() => `<div class="skeleton"></div>`).join("");

  const { data, error } = await supabase
    .from("images")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    imageContainer.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">⚠️</div>
        <span>Impossible de charger les images.</span>
      </div>`;
    return;
  }

  // Update count
  if (imageCount) {
    imageCount.textContent = data.length
      ? `${data.length} image${data.length > 1 ? "s" : ""}`
      : "";
  }

  if (!data.length) {
    imageContainer.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🖼️</div>
        <span>Aucune image uploadée pour l'instant.</span>
      </div>`;
    return;
  }

  imageContainer.innerHTML = "";

  data.forEach((img, idx) => {
    const tile = document.createElement("div");
    tile.className = "img-tile";
    tile.style.animationDelay = `${idx * 40}ms`;

    tile.innerHTML = `
      <img src="${img.url}" alt="Image" loading="lazy">
      <div class="img-tile-overlay">
        <button class="tile-btn copy-tile" data-url="${img.url}">
          📋 Copier l'URL
        </button>
        <button class="tile-btn delete-tile" data-id="${img.id}" data-url="${img.url}">
          🗑️ Supprimer
        </button>
      </div>
    `;

    // Click on image → open lightbox
    tile.querySelector("img").addEventListener("click", () => {
      if (window.openLightbox) window.openLightbox(img.url);
    });

    // Copy URL
    tile.querySelector(".copy-tile").addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(img.url);
      toast("URL copiée !");
    });

    // Delete
    tile.querySelector(".delete-tile").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Supprimer cette image ?")) return;

      const { error } = await supabase
        .from("images")
        .delete()
        .eq("id", img.id);

      if (error) {
        toast("Erreur lors de la suppression.", "❌");
        console.error(error);
      } else {
        toast("Image supprimée.");
        tile.style.transition = "opacity 0.3s, transform 0.3s";
        tile.style.opacity = "0";
        tile.style.transform = "scale(0.9)";
        setTimeout(() => loadImages(), 350);
      }
    });

    imageContainer.appendChild(tile);
  });
}

// ─── Cloudinary upload widget ────────────────────────────────────────
const widget = cloudinary.createUploadWidget(
  {
    cloudName,
    uploadPreset,
    multiple: false,
    folder: "courses"
  },
  async (error, result) => {
    if (error) {
      toast("Erreur d'upload.", "❌");
      console.error(error);
      return;
    }

    if (result?.event === "success") {
      const url = result.info.secure_url;

      // Show preview card
      preview.src = url;
      imageUrlInput.value = url;
      resultCard.classList.add("visible");
      resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });

      // Save to Supabase
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) { console.error(userError); return; }

      const { error: insertError } = await supabase
        .from("images")
        .insert([{ url, uploaded_by: user.id }]);

      if (insertError) {
        toast("Upload OK mais erreur de sauvegarde.", "⚠️");
        console.error(insertError);
      } else {
        toast("Image uploadée avec succès !");
        loadImages();
      }
    }
  }
);

// ─── Open widget on click or keyboard ────────────────────────────────
const openBtn = document.getElementById("openExplorer");
openBtn.addEventListener("click", () => widget.open());
openBtn.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); widget.open(); }
});

// ─── Init ─────────────────────────────────────────────────────────────
loadImages();
