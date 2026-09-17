// link-picker.js
// Modaal venster om een link te kiezen: naar een pagina op de site, een
// externe website, een e-mailadres, een telefoonnummer, een anker op de
// pagina, of een bestand uit de mediabibliotheek.

import { db } from "../../js/firebase-init.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { openMediaPicker, fetchMediaMap } from "./media-picker.js";

const TYPE_LABELS = {
  page: "Pagina op de website",
  external: "Externe website",
  email: "E-mailadres",
  phone: "Telefoonnummer",
  anchor: "Plek op deze pagina",
  file: "Bestand",
};

async function fetchPages() {
  const q = query(collection(db, "pages"), where("trashed", "==", false));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * @param {Object|null} initialLink - { type, value, newTab }
 * @returns {Promise<Object|null>}
 */
export function openLinkPicker(initialLink = null) {
  return new Promise(async (resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box" style="max-width:480px;">
        <div class="modal-box__header">
          <h2>Link instellen</h2>
          <button type="button" class="btn-admin" data-close>Sluiten</button>
        </div>
        <div class="admin-field">
          <label>Type link</label>
          <select id="link-type">
            ${Object.entries(TYPE_LABELS).map(([val, label]) => `<option value="${val}">${label}</option>`).join("")}
          </select>
        </div>
        <div id="link-target-field"></div>
        <div class="admin-field" style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="link-newtab" style="width:auto;">
          <label for="link-newtab" style="margin:0;">Open in nieuw tabblad</label>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          ${initialLink ? '<button type="button" class="btn-admin btn-admin--danger" data-remove>Link verwijderen</button>' : ""}
          <button type="button" class="btn-admin btn-admin--primary" data-save>Opslaan</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = (result) => { overlay.remove(); resolve(result); };
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(undefined); });
    overlay.querySelector("[data-close]").addEventListener("click", () => close(undefined));
    overlay.querySelector("[data-remove]")?.addEventListener("click", () => close(null));

    const typeSelect = overlay.querySelector("#link-type");
    const targetField = overlay.querySelector("#link-target-field");
    const newTabCheckbox = overlay.querySelector("#link-newtab");
    let currentValue = initialLink?.value || "";
    let pages = [];

    async function renderTargetField() {
      const type = typeSelect.value;
      if (type === "page") {
        if (!pages.length) pages = await fetchPages();
        targetField.innerHTML = `
          <div class="admin-field">
            <label>Kies pagina</label>
            <select id="link-page-select">
              <option value="">— Kies een pagina —</option>
              ${pages.map((p) => `<option value="${p.slug}" ${currentValue === p.slug ? "selected" : ""}>${p.title}</option>`).join("")}
            </select>
          </div>
        `;
      } else if (type === "file") {
        const existingName = currentValue && currentTypeOf(initialLink) === "file" ? "Bestand geladen…" : "";
        targetField.innerHTML = `
          <div class="admin-field">
            <label>Bestand</label>
            <button type="button" class="btn-admin" id="link-pick-file">${currentValue ? "Ander bestand kiezen" : "Kies bestand uit mediabibliotheek"}</button>
            <div id="link-file-name" style="font-size:var(--fs-sm);margin-top:6px;">${existingName}</div>
          </div>
        `;
        if (existingName) {
          fetchMediaMap([currentValue]).then((map) => {
            const nameEl = targetField.querySelector("#link-file-name");
            if (nameEl) nameEl.textContent = map[currentValue]?.name || "Bestand niet gevonden";
          });
        }
        targetField.querySelector("#link-pick-file").addEventListener("click", async () => {
          const media = await openMediaPicker({ accept: "any" });
          if (media) {
            currentValue = media.id;
            targetField.querySelector("#link-file-name").textContent = media.name;
          }
        });
      } else {
        const placeholder = {
          external: "https://voorbeeld.nl",
          email: "naam@voorbeeld.nl",
          phone: "06 12345678",
          anchor: "sectie-id",
        }[type];
        targetField.innerHTML = `
          <div class="admin-field">
            <label>${TYPE_LABELS[type]}</label>
            <input type="text" id="link-value-input" placeholder="${placeholder}" value="${type === currentTypeOf(initialLink) ? currentValue : ""}">
          </div>
        `;
      }
    }

    function currentTypeOf(link) { return link?.type; }

    typeSelect.value = initialLink?.type || "page";
    newTabCheckbox.checked = !!initialLink?.newTab;
    await renderTargetField();
    typeSelect.addEventListener("change", renderTargetField);

    overlay.querySelector("[data-save]").addEventListener("click", () => {
      const type = typeSelect.value;
      let value = currentValue;
      if (type === "page") {
        value = targetField.querySelector("#link-page-select").value;
      } else if (type !== "file") {
        value = targetField.querySelector("#link-value-input").value.trim();
      }
      if (!value) { alert("Vul een geldige bestemming in."); return; }
      close({ type, value, newTab: newTabCheckbox.checked });
    });
  });
}
