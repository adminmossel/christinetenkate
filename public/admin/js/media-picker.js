// media-picker.js
//
// Slaat geüploade bestanden rechtstreeks op in Firestore (collectie
// "media") in plaats van in Firebase Storage. Dat is een bewuste keuze:
// Firebase Storage vereist sinds 2026 het betaalde Blaze-plan (met
// creditcard), óók als je binnen de gratis grenzen blijft. Firestore
// vereist dat nooit. De prijs die we daarvoor betalen: Firestore-
// documenten mogen max. ~1 MB zijn, dus foto's worden bij het uploaden
// automatisch verkleind/gecomprimeerd (in de browser, met een canvas) tot
// ze ruim onder die grens passen. Voor foto's op een website is dat geen
// merkbaar kwaliteitsverlies — zie de toelichting in het gesprek.
//
// BELANGRIJK — eenmalige Firestore-instelling vereist:
// het veld "url" van de collectie "media" moet uitgezonderd worden van
// automatische indexering (anders weigert Firestore te schrijven zodra een
// foto groter is dan 1500 bytes). Zie INSTALLATIE.md, stap 2.7.

import { db, auth } from "../../js/firebase-init.js";
import { collection, addDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Ruimte voor de andere velden (naam, type, enz.) en de 33% overhead van
// base64-codering: een gecomprimeerde foto mag netto max. ~700 KB wegen.
export const IMAGE_TARGET_BYTES = 700 * 1024;
// Documenten die geen foto zijn (PDF, Word, Excel...) kunnen niet
// gecomprimeerd worden, dus daar geldt een hardere, kleinere limiet.
export const MAX_NON_IMAGE_BYTES = 650 * 1024;
// Absolute veiligheidsgrens (Firestore-documentlimiet is ~1 MiB).
const HARD_LIMIT_BYTES = 900 * 1024;

const COMPRESSIBLE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

function approxBytesOfDataUrl(dataUrl) {
  const commaIndex = dataUrl.indexOf(",");
  const base64Length = dataUrl.length - commaIndex - 1;
  return Math.ceil(base64Length * 3 / 4);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Kon het bestand niet lezen."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Kon de afbeelding niet lezen.")); };
    img.src = url;
  });
}

/** Comprimeert een foto (in de browser, via canvas) tot 'ie onder targetBytes past. */
async function compressImage(file, targetBytes) {
  const img = await loadImageElement(file);
  const maxDims = [1600, 1200, 900, 700, 500, 360];
  const qualities = [0.82, 0.7, 0.6, 0.5, 0.4];
  let best = null;

  for (const maxDim of maxDims) {
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    // PNG's met transparantie krijgen een witte achtergrond, want we slaan
    // op als JPEG (aanzienlijk kleiner dan PNG voor foto's).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const bytes = approxBytesOfDataUrl(dataUrl);
      best = { dataUrl, width, height, bytes };
      if (bytes <= targetBytes) return best;
    }
  }
  return best; // kleinste/laagste kwaliteit die haalbaar was, ook al zit die nog boven target
}

/**
 * @param {File} file
 * @param {(pct:number)=>void} [onProgress]
 * @returns {Promise<{id,url,name,contentType,size,alt,width,height}>}
 */
export async function uploadFile(file, onProgress) {
  onProgress?.(5);
  if (ALLOWED_TYPES.length && !ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Dit bestandstype wordt niet ondersteund.");
  }

  let dataUrl, width = null, height = null;

  if (COMPRESSIBLE_TYPES.includes(file.type)) {
    onProgress?.(20);
    const result = await compressImage(file, IMAGE_TARGET_BYTES);
    dataUrl = result.dataUrl; width = result.width; height = result.height;
    onProgress?.(70);
  } else {
    if (file.size > MAX_NON_IMAGE_BYTES) {
      const limitKb = Math.round(MAX_NON_IMAGE_BYTES / 1024);
      throw new Error(`Dit bestand is te groot (max. ${limitKb} KB voor bestanden die niet gecomprimeerd kunnen worden, zoals PDF's). Verklein het bestand eerst, bijvoorbeeld met een gratis online PDF-compressietool.`);
    }
    dataUrl = await readFileAsDataUrl(file);
    onProgress?.(70);
  }

  const finalBytes = approxBytesOfDataUrl(dataUrl);
  if (finalBytes > HARD_LIMIT_BYTES) {
    throw new Error("Dit bestand is ook na comprimeren nog te groot. Kies een kleinere foto, of verklein 'm eerst zelf (bijv. via een foto-app) voordat je 'm opnieuw uploadt.");
  }

  const mediaDoc = await addDoc(collection(db, "media"), {
    url: dataUrl,
    name: file.name,
    contentType: COMPRESSIBLE_TYPES.includes(file.type) ? "image/jpeg" : file.type,
    size: finalBytes,
    alt: "",
    width, height,
    uploadedBy: auth.currentUser?.email || null,
    createdAt: serverTimestamp(),
  });
  onProgress?.(100);

  return { id: mediaDoc.id, url: dataUrl, name: file.name, contentType: file.type, size: finalBytes, alt: "", width, height };
}

async function fetchMediaList() {
  const q = query(collection(db, "media"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Haalt meerdere media-documenten tegelijk op (voor renderBlocks). Geeft { [id]: mediaData } terug. */
export async function fetchMediaMap(ids) {
  const uniqueIds = [...new Set((ids instanceof Set ? [...ids] : ids).filter(Boolean))];
  const map = {};
  await Promise.all(uniqueIds.map(async (id) => {
    try {
      const snap = await getDoc(doc(db, "media", id));
      if (snap.exists()) map[id] = { id: snap.id, ...snap.data() };
    } catch (err) {
      console.error(`Kon media ${id} niet laden:`, err);
    }
  }));
  return map;
}

/**
 * @param {Object} options
 * @param {'image'|'file'|'any'} options.accept
 * @returns {Promise<Object|null>} het gekozen media-object, of null bij annuleren
 */
export function openMediaPicker({ accept = "any" } = {}) {
  return new Promise((resolve) => {
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
        const media = await uploadFile(file, (pct) => { progressEl.textContent = `Bezig… ${pct}%`; });
        progressEl.textContent = "Klaar!";
        close(media);
      } catch (err) {
        progressEl.textContent = err.message || "Uploaden mislukt.";
      }
    });
  });
}
