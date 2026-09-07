// editor-core.js
import { requireAdmin, getCurrentAdmin } from "./admin-auth.js";
import { renderAdminShell, showToast } from "./admin-shell.js";
import { slugify, ensureUniqueSlug } from "./slugify.js";
import { BLOCK_LIBRARY, HOME_ONLY_BLOCKS, buildBlockEditorUI } from "./editor-blocks.js";
import { db } from "../../js/firebase-init.js";
import { renderBlocks, collectMediaIds } from "../../js/render.js";
import { fetchMediaMap } from "./media-picker.js";
import {
  doc, getDoc, updateDoc, collection, addDoc, getDocs, query, orderBy, limit,
  serverTimestamp, deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const params = new URLSearchParams(location.search);
const pageId = params.get("id");

let pageData = null;
let dirty = false;
let autosaveTimer = null;
let currentTab = "edit";

async function boot() {
  if (!pageId) { alert("Geen pagina-id opgegeven."); location.href = "/admin/index.html"; return; }
  const admin = await requireAdmin();
  const main = renderAdminShell("dashboard", admin, { collapsedByDefault: true });
  main.classList.add("admin-main--wide");

  const snap = await getDoc(doc(db, "pages", pageId));
  if (!snap.exists()) { alert("Pagina niet gevonden."); location.href = "/admin/index.html"; return; }
  pageData = { id: snap.id, ...snap.data() };
  pageData.blocks = pageData.blocks || [];
  pageData.seo = pageData.seo || { title: "", description: "", ogImage: "" };

  renderShell(main);
  window.addEventListener("beforeunload", (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });
}

function renderShell(main) {
  main.innerHTML = `
    <div class="editor-topbar">
      <div class="admin-header" style="margin-bottom:var(--space-3);">
        <div style="flex:1;">
          <input id="page-title-input" type="text" value="${escapeAttr(pageData.title)}"
            style="font-family:var(--font-display);font-size:var(--fs-xl);border:none;background:none;width:100%;color:var(--color-primary);">
          <div style="display:flex;align-items:center;gap:6px;color:var(--color-ink-soft);font-size:var(--fs-sm);">
            <span>${new URL(location.origin).hostname}/</span>
            <input id="page-slug-input" type="text" value="${escapeAttr(pageData.slug)}" style="border:1px solid var(--color-line);border-radius:4px;padding:2px 6px;">
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <span id="autosave-indicator" style="font-size:var(--fs-sm);color:var(--color-ink-soft);"></span>
          <span class="status-pill status-pill--${pageData.status}" id="status-pill">${pageData.status === "published" ? "Gepubliceerd" : "Concept"}</span>
          <button class="btn-admin" id="open-settings-btn" title="SEO en versiegeschiedenis" aria-label="Pagina-instellingen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Instellingen
          </button>
          <button class="btn-admin" id="save-draft-btn">Concept opslaan</button>
          <button class="btn-admin btn-admin--primary" id="publish-btn">Publiceren</button>
        </div>
      </div>

      <div class="editor-tabs">
        <button type="button" class="is-active" data-tab="edit">Bewerken</button>
        <button type="button" data-tab="preview">Voorbeeld</button>
      </div>
    </div>

    <div class="editor-shell">
      <div class="editor-canvas" id="editor-canvas"></div>
    </div>

    <div class="settings-drawer" id="settings-drawer">
      <div class="settings-drawer__backdrop" id="settings-drawer-backdrop"></div>
      <div class="settings-drawer__panel">
        <div class="settings-drawer__header">
          <h2>Pagina-instellingen</h2>
          <button type="button" class="btn-admin" id="close-settings-btn">Sluiten</button>
        </div>
        ${collapsiblePanel("seo-panel", "SEO", true, `
          <div class="admin-field">
            <label>SEO-titel</label>
            <input id="seo-title" type="text" value="${escapeAttr(pageData.seo.title)}">
          </div>
          <div class="admin-field">
            <label>Meta-omschrijving</label>
            <textarea id="seo-description" rows="3">${pageData.seo.description || ""}</textarea>
          </div>
        `)}
        ${collapsiblePanel("versions-panel", "Versiegeschiedenis", true, `
          <div id="version-list"><p style="font-size:var(--fs-sm);color:var(--color-ink-soft);">Wordt geladen…</p></div>
          <button class="btn-admin" id="save-version-btn" style="margin-top:8px;">Huidige versie bewaren</button>
        `)}
      </div>
    </div>
  `;

  const drawer = document.getElementById("settings-drawer");
  document.getElementById("open-settings-btn").addEventListener("click", () => drawer.classList.add("is-open"));
  document.getElementById("close-settings-btn").addEventListener("click", () => drawer.classList.remove("is-open"));
  document.getElementById("settings-drawer-backdrop").addEventListener("click", () => drawer.classList.remove("is-open"));

  document.querySelectorAll(".panel-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.closest(".collapsible-panel");
      panel.classList.toggle("is-open");
    });
  });

  document.getElementById("page-title-input").addEventListener("input", (e) => { pageData.title = e.target.value; markDirty(); });
  document.getElementById("page-slug-input").addEventListener("change", onSlugChange);
  document.getElementById("seo-title").addEventListener("input", (e) => { pageData.seo.title = e.target.value; markDirty(); });
  document.getElementById("seo-description").addEventListener("input", (e) => { pageData.seo.description = e.target.value; markDirty(); });
  document.getElementById("save-draft-btn").addEventListener("click", () => saveNow(false));
  document.getElementById("publish-btn").addEventListener("click", onPublish);
  document.getElementById("save-version-btn").addEventListener("click", () => saveVersion(true));

  document.querySelectorAll(".editor-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".editor-tabs button").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      currentTab = btn.dataset.tab;
      renderCanvas();
    });
  });

  renderCanvas();
  loadVersions();
}

function escapeAttr(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Bouwt een uitklapbaar paneel (bijv. SEO, Versiegeschiedenis) met een pijltje. */
function collapsiblePanel(id, title, openByDefault, innerHtml) {
  return `
    <div class="admin-card collapsible-panel${openByDefault ? " is-open" : ""}" id="${id}">
      <button type="button" class="panel-toggle">
        <h3>${title}</h3>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="panel-body">${innerHtml}</div>
    </div>
  `;
}

async function onSlugChange(e) {
  const base = slugify(e.target.value);
  const unique = await ensureUniqueSlug(base, pageData.id);
  pageData.slug = unique;
  e.target.value = unique;
  markDirty();
}

function markDirty() {
  dirty = true;
  const indicator = document.getElementById("autosave-indicator");
  if (indicator) indicator.textContent = "Niet-opgeslagen wijzigingen…";
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveNow(false), 2500);
}

async function saveNow(isPublishAction) {
  clearTimeout(autosaveTimer);
  const admin = getCurrentAdmin();
  try {
    await updateDoc(doc(db, "pages", pageData.id), {
      title: pageData.title,
      slug: pageData.slug,
      blocks: pageData.blocks,
      seo: pageData.seo,
      status: pageData.status,
      updatedAt: serverTimestamp(),
      updatedBy: admin?.email || null,
    });
    dirty = false;
    const indicator = document.getElementById("autosave-indicator");
    if (indicator) indicator.textContent = `Opgeslagen om ${new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`;
    if (!isPublishAction) showToast("Concept opgeslagen.");
  } catch (err) {
    console.error(err);
    showToast("Opslaan mislukt. Controleer je internetverbinding.", true);
  }
}

async function onPublish() {
  await saveVersion(false);
  pageData.status = "published";
  await saveNow(true);
  document.getElementById("status-pill").textContent = "Gepubliceerd";
  document.getElementById("status-pill").className = "status-pill status-pill--published";
  showToast("Pagina gepubliceerd!");
}

async function saveVersion(showConfirmToast) {
  const admin = getCurrentAdmin();
  try {
    await addDoc(collection(db, "pages", pageData.id, "versions"), {
      title: pageData.title,
      blocks: pageData.blocks,
      seo: pageData.seo,
      createdAt: serverTimestamp(),
      createdBy: admin?.email || null,
    });
    await pruneOldVersions();
    if (showConfirmToast) showToast("Versie bewaard.");
    loadVersions();
  } catch (err) {
    console.error(err);
    if (showConfirmToast) showToast("Kon versie niet opslaan.", true);
  }
}

const MAX_VERSIONS = 20;
async function pruneOldVersions() {
  const q = query(collection(db, "pages", pageData.id, "versions"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  const excess = snap.docs.length - MAX_VERSIONS;
  if (excess > 0) {
    for (let i = 0; i < excess; i++) await deleteDoc(snap.docs[i].ref);
  }
}

async function loadVersions() {
  const listEl = document.getElementById("version-list");
  try {
    const q = query(collection(db, "pages", pageData.id, "versions"), orderBy("createdAt", "desc"), limit(20));
    const snap = await getDocs(q);
    if (snap.empty) { listEl.innerHTML = `<p style="font-size:var(--fs-sm);color:var(--color-ink-soft);">Nog geen eerdere versies.</p>`; return; }
    listEl.innerHTML = "";
    snap.docs.forEach((d) => {
      const v = d.data();
      const row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:space-between;align-items:center;font-size:var(--fs-sm);padding:4px 0;border-bottom:1px solid var(--color-line);";
      const date = v.createdAt?.toDate ? v.createdAt.toDate().toLocaleString("nl-NL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "…";
      row.innerHTML = `<span>${date}</span>`;
      const restoreBtn = document.createElement("button");
      restoreBtn.className = "btn-admin";
      restoreBtn.textContent = "Herstellen";
      restoreBtn.addEventListener("click", () => restoreVersion(v));
      row.appendChild(restoreBtn);
      listEl.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<p style="font-size:var(--fs-sm);">Kon versies niet laden.</p>`;
  }
}

async function restoreVersion(version) {
  if (!confirm("Deze versie herstellen? De huidige inhoud wordt overschreven (maar blijft ook zelf bewaard als versie).")) return;
  await saveVersion(false);
  pageData.title = version.title;
  pageData.blocks = version.blocks;
  pageData.seo = version.seo;
  document.getElementById("page-title-input").value = pageData.title;
  document.getElementById("seo-title").value = pageData.seo.title || "";
  document.getElementById("seo-description").value = pageData.seo.description || "";
  await saveNow(false);
  renderCanvas();
  showToast("Versie hersteld.");
}

// ---------- Canvas: block list rendering, drag & drop, add-block menu ----------

function renderCanvas() {
  const canvas = document.getElementById("editor-canvas");
  canvas.innerHTML = "";

  if (currentTab === "preview") {
    const previewWrap = document.createElement("div");
    previewWrap.className = "content-blocks";
    previewWrap.innerHTML = `<p class="state-message">Voorbeeld wordt geladen…</p>`;
    canvas.appendChild(previewWrap);
    fetchMediaMap(collectMediaIds(pageData.blocks)).then((mediaMap) => {
      renderBlocks(pageData.blocks, previewWrap, mediaMap);
    });
    return;
  }

  renderBlockList(canvas, pageData.blocks, (updated) => { pageData.blocks = updated; markDirty(); }, true);
}

/**
 * Rendert een lijst blokken (top-level óf binnen een kolom) met drag & drop,
 * en een "+ Blok toevoegen"-knop eronder.
 */
function renderBlockList(container, blocks, onChange, isTopLevel) {
  const list = document.createElement("div");
  container.appendChild(list);

  function draw() {
    list.innerHTML = "";
    blocks.forEach((block, index) => {
      list.appendChild(renderBlockItem(block, index));
    });
  }

  function renderBlockItem(block, index) {
    const item = document.createElement("div");
    item.className = "block-item";
    item.draggable = true;
    item.dataset.index = String(index);

    const header = document.createElement("div");
    header.className = "block-item__header";
    header.innerHTML = `<span class="block-item__label"><span class="block-item__drag">⠿</span> ${BLOCK_LIBRARY[block.type]?.label || HOME_ONLY_BLOCKS[block.type]?.label || block.type}</span>`;
    const actions = document.createElement("span");
    actions.className = "block-item__actions";
    actions.innerHTML = `
      <button type="button" title="Naar boven" data-act="up">↑</button>
      <button type="button" title="Naar beneden" data-act="down">↓</button>
      <button type="button" title="Dupliceren" data-act="dup">⎘</button>
      <button type="button" title="Verwijderen" data-act="del">🗑</button>
    `;
    header.appendChild(actions);
    item.appendChild(header);

    const body = document.createElement("div");
    body.className = "block-item__body";
    body.appendChild(buildBlockEditorUI(block, (patch) => {
      Object.assign(block, patch);
      onChange(blocks);
    }, (nestedContainer, nestedBlocks, onNestedChange) => {
      renderBlockList(nestedContainer, nestedBlocks, onNestedChange, false);
    }));
    item.appendChild(body);

    actions.querySelector('[data-act="up"]').addEventListener("click", () => { if (index > 0) { swap(index, index - 1); } });
    actions.querySelector('[data-act="down"]').addEventListener("click", () => { if (index < blocks.length - 1) { swap(index, index + 1); } });
    actions.querySelector('[data-act="dup"]').addEventListener("click", () => {
      const copy = JSON.parse(JSON.stringify(block));
      copy.id = `${copy.id}-copy-${Date.now()}`;
      blocks.splice(index + 1, 0, copy);
      onChange(blocks);
      draw();
    });
    actions.querySelector('[data-act="del"]').addEventListener("click", () => {
      if (!confirm("Dit blok verwijderen?")) return;
      blocks.splice(index, 1);
      onChange(blocks);
      draw();
    });

    item.addEventListener("dragstart", (e) => {
      item.classList.add("is-dragging");
      e.dataTransfer.setData("text/plain", String(index));
      e.dataTransfer.effectAllowed = "move";
    });
    item.addEventListener("dragend", () => item.classList.remove("is-dragging"));
    item.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; });
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      const fromIndex = Number(e.dataTransfer.getData("text/plain"));
      const toIndex = Number(item.dataset.index);
      if (Number.isNaN(fromIndex) || fromIndex === toIndex) return;
      const [moved] = blocks.splice(fromIndex, 1);
      blocks.splice(toIndex, 0, moved);
      onChange(blocks);
      draw();
    });

    return item;
  }

  function swap(i, j) {
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    onChange(blocks);
    draw();
  }

  draw();

  const addWrap = document.createElement("div");
  addWrap.className = "add-block-menu";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "btn-admin btn-admin--primary";
  addBtn.textContent = "+ Blok toevoegen";
  const menu = document.createElement("div");
  menu.className = "add-block-menu__list";
  menu.style.display = "none";

  const library = { ...BLOCK_LIBRARY, ...(isTopLevel && pageData.slug === "home" ? HOME_ONLY_BLOCKS : {}) };
  Object.entries(library).forEach(([type, def]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = def.label;
    btn.addEventListener("click", () => {
      blocks.push(def.factory());
      onChange(blocks);
      draw();
      menu.style.display = "none";
    });
    menu.appendChild(btn);
  });

  addBtn.addEventListener("click", () => { menu.style.display = menu.style.display === "none" ? "grid" : "none"; });
  document.addEventListener("click", (e) => { if (!addWrap.contains(e.target)) menu.style.display = "none"; });

  addWrap.appendChild(addBtn);
  addWrap.appendChild(menu);
  container.appendChild(addWrap);
}

boot();
