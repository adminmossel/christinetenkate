// media-picker.js
// Modaal venster om een bestand uit de mediabibliotheek te kiezen, of een
// nieuw bestand te uploaden. Wordt gebruikt door de editor (afbeeldingen,
// bestanden, links) en door de aparte mediabibliotheek-pagina.

import { db, storage, auth } from "../../public/js/firebase-init.js";
import { collection, addDoc, getDocs, orderBy, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

// Maximale bestandsgrootte: 15 MB. Pas dit aan (en de bijbehorende regel in
// storage.rules) als jullie grotere bestanden willen toestaan.
export const MAX_FILE_SIZE = 15 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

export async function uploadFile(file, onProgress) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Bestand is te groot (max ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB).`);
  }
  if (ALLOWED_TYPES.length && !ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Dit bestandstype wordt niet ondersteund.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `media/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, { contentType: file.type });

  await new Promise((resolve, reject) => {
    task.on("state_changed",
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      resolve
    );
  });

  const url = await getDownloadURL(task.snapshot.ref);
  const mediaDoc = await addDoc(collection(db, "media"), {
    url,
    path,
    name: file.name,
    contentType: file.type,
    size: file.size,
    alt: "",
    uploadedBy: auth.currentUser?.email || null,
    createdAt: serverTimestamp(),
  });

  return { id: mediaDoc.id, url, path, name: file.name, contentType: file.type, size: file.size, alt: "" };
}

async function fetchMediaList() {
  const q = query(collection(db, "media"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * @param {Object} options
 * @param {'image'|'file'|'any'} options.accept
 * @returns {Promise<Object|null>} het gekozen media-object, of null bij annuleren
 */
export function openMediaPicker({ accept = "any" } = {}) {
  return new Promise(async (resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-box__header">
          <h2>Bestand kiezen</h2>
          <button type="button" class="btn-admin" data-close>Sluiten</button>
        </div>
        <div class="admin-field">
          <label>Nieuw bestand uploaden</label>
          <input type="file" id="picker-upload" ${accept === "image" ? 'accept="image/*"' : ""} />
          <div id="upload-progress" style="font-size:var(--fs-sm);color:var(--color-ink-soft);"></div>
        </div>
        <div class="media-grid" id="picker-grid">
          <p>Bibliotheek wordt geladen…</p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = (result) => { overlay.remove(); resolve(result); };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });
    overlay.querySelector("[data-close]").addEventListener("click", () => close(null));

    async function renderGrid() {
      const grid = overlay.querySelector("#picker-grid");
      let items = await fetchMediaList();
      if (accept === "image") items = items.filter((m) => m.contentType?.startsWith("image/"));
      grid.innerHTML = items.length ? "" : "<p>Nog geen bestanden geüpload.</p>";
      items.forEach((media) => {
        const item = document.createElement("div");
        item.className = "media-grid__item";
        const isImage = media.contentType?.startsWith("image/");
        item.innerHTML = isImage
          ? `<img src="${media.url}" alt="${media.alt || ""}"><span>${media.name}</span>`
          : `<div style="padding:20px;font-size:2rem;">📄</div><span>${media.name}</span>`;
        item.addEventListener("click", () => close(media));
        grid.appendChild(item);
      });
    }
    renderGrid();

    overlay.querySelector("#picker-upload").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const progressEl = overlay.querySelector("#upload-progress");
      try {
        const media = await uploadFile(file, (pct) => { progressEl.textContent = `Uploaden… ${pct}%`; });
        progressEl.textContent = "Klaar!";
        close(media);
      } catch (err) {
        progressEl.textContent = err.message || "Uploaden mislukt.";
      }
    });
  });
}
