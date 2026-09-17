// media-library.js
import { requireAdmin } from "./admin-auth.js";
import { renderAdminShell, showToast } from "./admin-shell.js";
import { uploadFile } from "./media-picker.js";
import { db } from "../../js/firebase-init.js";
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let allMedia = [];

async function boot() {
  const admin = await requireAdmin();
  renderAdminShell("media", admin);

  document.getElementById("upload-btn").addEventListener("click", () => document.getElementById("upload-input").click());
  document.getElementById("upload-input").addEventListener("change", handleUpload);
  document.getElementById("media-search").addEventListener("input", (e) => renderGrid(e.target.value));

  await loadMedia();
}

async function loadMedia() {
  const grid = document.getElementById("media-library-grid");
  grid.innerHTML = "<p>Bibliotheek wordt geladen…</p>";
  try {
    const q = query(collection(db, "media"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    allMedia = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderGrid("");
  } catch (err) {
    console.error(err);
    grid.innerHTML = "<p>Kon de mediabibliotheek niet laden.</p>";
  }
}

function renderGrid(filterText) {
  const grid = document.getElementById("media-library-grid");
  const term = filterText.trim().toLowerCase();
  const items = term ? allMedia.filter((m) => m.name.toLowerCase().includes(term)) : allMedia;
  grid.innerHTML = items.length ? "" : "<p>Geen bestanden gevonden.</p>";

  items.forEach((media) => {
    const cell = document.createElement("div");
    cell.className = "media-grid__item";
    const isImage = media.contentType?.startsWith("image/");
    cell.innerHTML = isImage
      ? `<img src="${media.url}" alt="${media.alt || ""}">`
      : `<div style="padding:24px;font-size:2rem;">📄</div>`;
    const nameLabel = document.createElement("span");
    nameLabel.textContent = media.name;
    cell.appendChild(nameLabel);
    cell.style.cursor = "default";
    cell.addEventListener("click", (e) => { e.stopPropagation(); openDetail(media); });
    grid.appendChild(cell);
  });
}

function openDetail(media) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const isImage = media.contentType?.startsWith("image/");
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:480px;">
      <div class="modal-box__header">
        <h2>Bestand bewerken</h2>
        <button type="button" class="btn-admin" data-close>Sluiten</button>
      </div>
      ${isImage ? `<img src="${media.url}" style="max-width:100%;border-radius:8px;margin-bottom:12px;">` : `<p>📄 ${media.name}</p>`}
      <div class="admin-field">
        <label>Bestandsnaam</label>
        <input type="text" id="detail-name" value="${media.name}">
      </div>
      ${isImage ? `
      <div class="admin-field">
        <label>Alt-tekst</label>
        <input type="text" id="detail-alt" value="${media.alt || ""}">
      </div>` : ""}
      <div class="admin-field">
        <label>Bestandsgrootte</label>
        <input type="text" readonly value="${((media.size || 0) / 1024).toFixed(0)} KB">
        <small>Dit bestand staat rechtstreeks in de database opgeslagen (geen los te delen webadres) — gebruik het via de pagina-editor.</small>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <button type="button" class="btn-admin btn-admin--danger" data-delete>Verwijderen</button>
        <button type="button" class="btn-admin btn-admin--primary" data-save>Opslaan</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector("[data-close]").addEventListener("click", () => overlay.remove());

  overlay.querySelector("[data-save]").addEventListener("click", async () => {
    const name = overlay.querySelector("#detail-name").value.trim();
    const alt = overlay.querySelector("#detail-alt")?.value.trim() || "";
    try {
      await updateDoc(doc(db, "media", media.id), { name, alt });
      showToast("Wijzigingen opgeslagen.");
      overlay.remove();
      loadMedia();
    } catch (err) {
      console.error(err);
      showToast("Opslaan mislukt.", true);
    }
  });

  overlay.querySelector("[data-delete]").addEventListener("click", async () => {
    if (!confirm(`"${media.name}" verwijderen? Let op: als dit bestand nog op een pagina gebruikt wordt, verdwijnt het daar ook.`)) return;
    try {
      await deleteDoc(doc(db, "media", media.id));
      showToast("Bestand verwijderd.");
      overlay.remove();
      loadMedia();
    } catch (err) {
      console.error(err);
      showToast("Verwijderen mislukt.", true);
    }
  });
}

async function handleUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const status = document.getElementById("upload-status");
  try {
    await uploadFile(file, (pct) => { status.textContent = `Uploaden… ${pct}%`; });
    status.textContent = "Geüpload!";
    setTimeout(() => { status.textContent = ""; }, 2000);
    loadMedia();
  } catch (err) {
    status.textContent = err.message || "Uploaden mislukt.";
  }
  e.target.value = "";
}

boot();
