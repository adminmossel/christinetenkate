// editor-core.js  (versie 2 — visuele pagina-editor)
//
// Opbouw van het scherm:
//   ┌ topbalk: terug · titel · apparaat · undo/redo · voorbeeld · ⚙ · opslaan · publiceren
//   ├ links : Componenten (catalogus met zoeken, slepen) | Lagen (boomstructuur)
//   ├ midden: CANVAS = de echte pagina in een iframe (admin/canvas.html)
//   └ rechts: eigenschappen van het geselecteerde component (Inhoud · Stijl · Meer)
//             of — als niets is geselecteerd — het ontwerp van de hele pagina
// Het ⚙-tandwieltje opent de pagina-instellingen: SEO, adres, status, versies.

import { requireAdmin, getCurrentAdmin } from "./admin-auth.js";
import { showToast } from "./admin-shell.js";
import { slugify, ensureUniqueSlug } from "./slugify.js";
import { db } from "../../js/firebase-init.js";
import { fetchMediaMap, openMediaPicker, openCropTool } from "./media-picker.js";
import { openLinkPicker } from "./link-picker.js";
import { BLOCKS, GROUPS, createBlock, cloneBlock, childLists, blockLabel, typeIconSvg } from "./block-registry.js";
import { buildFields, buildSections, BLOCK_STYLE_SECTIONS, PAGE_STYLE_SECTIONS } from "./editor-fields.js";
import {
  doc, getDoc, updateDoc, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const pageId = new URLSearchParams(location.search).get("id");
const clone = (v) => JSON.parse(JSON.stringify(v));
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

let page = null;
let selectedId = null;
let device = "desktop";
let panelTab = "content";
let leftTab = "catalog";
let insertTarget = null;
let styleClipboard = null;
let dirty = false;
let autosaveTimer = null;
let canvasReady = false;
let panelControls = {};
let previewMode = false;
const undoStack = [];
const redoStack = [];
let lastSnap = "";
let lastCoalesce = { key: null, at: 0 };

const $ = (sel, root = document) => root.querySelector(sel);
const canvasWin = () => $("#ed-canvas")?.contentWindow;
const canvasAPI = () => canvasWin()?.CanvasAPI;

// ============================================================
// Boom-hulpfuncties
// ============================================================
function findInfo(id, list = page.blocks, parent = null) {
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.id === id) return { block: b, list, index: i, parent };
    for (const { list: l } of childLists(b)) {
      const hit = findInfo(id, l, b);
      if (hit) return hit;
    }
  }
  return null;
}
function topOf(id) {
  return page.blocks.find((b) => b.id === id || findInfo(id, [b])) || null;
}
function getList(parentId, slot) {
  if (parentId === "root") return page.blocks;
  const info = findInfo(parentId);
  return info ? childLists(info.block)[slot]?.list : null;
}
function contains(block, id) { return !!findInfo(id, [block]); }

// ============================================================
// Geschiedenis (undo / redo) en opslaan-status
// ============================================================
const snapshot = () => JSON.stringify({ title: page.title, blocks: page.blocks, theme: page.theme });

function commit({ render = "all", coalesce = null } = {}) {
  const now = Date.now();
  const merge = coalesce && lastCoalesce.key === coalesce && now - lastCoalesce.at < 900;
  if (!merge) { undoStack.push(lastSnap); if (undoStack.length > 80) undoStack.shift(); redoStack.length = 0; }
  lastCoalesce = { key: coalesce, at: now };
  lastSnap = snapshot();
  markDirty();
  if (render === "all") sendAll();
  else if (render === "theme") canvasAPI()?.setTheme(clone(page.theme));
  else if (render && render.block) scheduleBlockRender(render.block);
  renderLayers();
  updateHistoryButtons();
}

function applySnapshot(str) {
  const s = JSON.parse(str);
  page.title = s.title; page.blocks = s.blocks; page.theme = s.theme || {};
  $("#ed-title").value = page.title || "";
  lastSnap = str;
  if (selectedId && !findInfo(selectedId)) selectedId = null;
  sendAll(); renderLayers(); renderRightPanel(); markDirty(); updateHistoryButtons();
}
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); applySnapshot(undoStack.pop()); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); applySnapshot(redoStack.pop()); }
function updateHistoryButtons() {
  $("#ed-undo").disabled = !undoStack.length;
  $("#ed-redo").disabled = !redoStack.length;
}

let renderTimer = null;
const pendingRoots = new Set();
function scheduleBlockRender(rootId) {
  pendingRoots.add(rootId);
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    pendingRoots.forEach((id) => { const b = page.blocks.find((x) => x.id === id); if (b) canvasAPI()?.updateBlock(clone(b)); });
    pendingRoots.clear();
  }, 70);
}
function sendAll() { if (canvasReady) canvasAPI()?.setContent(clone({ blocks: page.blocks, theme: page.theme })); }

function setSaveStatus(state, text) {
  const i = $("#ed-save-status");
  if (!i) return;
  i.className = `save-status save-status--${state}`;
  i.innerHTML = `<span class="save-status__dot"></span>${text}`;
}
function markDirty() {
  dirty = true;
  setSaveStatus("dirty", "Niet opgeslagen");
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveNow(false), 2500);
}

async function saveNow(isPublish) {
  clearTimeout(autosaveTimer);
  setSaveStatus("saving", "Opslaan…");
  try {
    const data = clone({
      title: page.title, slug: page.slug, blocks: page.blocks, seo: page.seo, theme: page.theme,
      showBackToTop: page.showBackToTop, status: page.status, updatedBy: getCurrentAdmin()?.email || null,
    });
    data.updatedAt = serverTimestamp();
    await updateDoc(doc(db, "pages", page.id), data);
    dirty = false;
    setSaveStatus("saved", `Opgeslagen ${new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`);
    if (!isPublish) showToast("Concept opgeslagen.");
  } catch (err) {
    console.error(err);
    setSaveStatus("error", "Opslaan mislukt");
    showToast("Opslaan mislukt. Controleer je internetverbinding.", true);
  }
}

async function onPublish() {
  await saveVersion(false);
  page.status = "published";
  await saveNow(true);
  refreshStatusPill();
  showToast("Pagina gepubliceerd!");
}

function refreshStatusPill() {
  const p = $("#ed-status");
  p.textContent = page.status === "published" ? "Gepubliceerd" : "Concept";
  p.className = `status-pill status-pill--${page.status}`;
  const live = $("#ed-live");
  live.hidden = page.status !== "published";
  live.href = page.slug === "home" ? "/" : `/${page.slug}`;
}

// ---- versies ----
const MAX_VERSIONS = 20;
async function saveVersion(toast) {
  try {
    const v = clone({ title: page.title, blocks: page.blocks, seo: page.seo, theme: page.theme, createdBy: getCurrentAdmin()?.email || null });
    v.createdAt = serverTimestamp();
    await addDoc(collection(db, "pages", page.id, "versions"), v);
    const snap = await getDocs(query(collection(db, "pages", page.id, "versions"), orderBy("createdAt", "asc")));
    for (let i = 0; i < snap.docs.length - MAX_VERSIONS; i++) await deleteDoc(snap.docs[i].ref);
    if (toast) showToast("Versie bewaard.");
    loadVersions();
  } catch (err) { console.error(err); if (toast) showToast("Kon versie niet opslaan.", true); }
}

async function loadVersions() {
  const listEl = $("#version-list");
  if (!listEl) return;
  try {
    const snap = await getDocs(query(collection(db, "pages", page.id, "versions"), orderBy("createdAt", "desc"), limit(20)));
    if (snap.empty) { listEl.innerHTML = `<p class="muted">Nog geen eerdere versies.</p>`; return; }
    listEl.innerHTML = "";
    snap.docs.forEach((d) => {
      const v = d.data();
      const row = document.createElement("div");
      row.className = "ver-row";
      const date = v.createdAt?.toDate ? v.createdAt.toDate().toLocaleString("nl-NL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "…";
      row.innerHTML = `<span>${date}</span>`;
      const b = document.createElement("button");
      b.className = "btn-admin"; b.textContent = "Herstellen";
      b.addEventListener("click", async () => {
        if (!confirm("Deze versie herstellen? De huidige inhoud wordt overschreven (maar eerst bewaard als versie).")) return;
        await saveVersion(false);
        undoStack.push(lastSnap);
        page.title = v.title; page.blocks = v.blocks || []; page.seo = v.seo || page.seo; page.theme = v.theme || {};
        lastSnap = snapshot();
        $("#ed-title").value = page.title;
        selectedId = null; sendAll(); renderLayers(); renderRightPanel(); fillSettings(); markDirty(); updateHistoryButtons();
        showToast("Versie hersteld.");
      });
      row.appendChild(b);
      listEl.appendChild(row);
    });
  } catch (err) { console.error(err); listEl.innerHTML = `<p class="muted">Kon versies niet laden.</p>`; }
}

// ============================================================
// Acties op blokken (ook aangeroepen vanuit het canvas)
// ============================================================
function selectBlock(id) {
  selectedId = id || null;
  canvasAPI()?.select(selectedId);
  renderRightPanel();
  renderLayers();
}

function insertBlock(block, list, index) {
  list.splice(Math.max(0, Math.min(index, list.length)), 0, block);
  selectedId = block.id;
  commit({ render: "all" });
  canvasAPI()?.select(block.id, { scroll: true });
  renderRightPanel();
}

function addFromCatalog(type) {
  const block = createBlock(type);
  let target = insertTarget;
  insertTarget = null;
  updateInsertHint();
  if (!target) {
    const info = selectedId ? findInfo(selectedId) : null;
    target = info ? { list: info.list, index: info.index + 1 } : { list: page.blocks, index: page.blocks.length };
  } else {
    target = { list: getList(target.parentId, target.slot) || page.blocks, index: target.index };
  }
  insertBlock(block, target.list, target.index);
}

function blockAction(act, id) {
  const info = findInfo(id);
  if (!info) return;
  const { list, index } = info;
  if (act === "up" && index > 0) { [list[index - 1], list[index]] = [list[index], list[index - 1]]; commit({ render: "all" }); }
  else if (act === "down" && index < list.length - 1) { [list[index + 1], list[index]] = [list[index], list[index + 1]]; commit({ render: "all" }); }
  else if (act === "dup") { const c = cloneBlock(info.block); list.splice(index + 1, 0, c); selectedId = c.id; commit({ render: "all" }); canvasAPI()?.select(c.id); renderRightPanel(); }
  else if (act === "del") {
    list.splice(index, 1);
    selectedId = null;
    commit({ render: "all" }); renderRightPanel();
    showToast("Component verwijderd — Ctrl+Z maakt het ongedaan.");
  }
  else if (act === "parent") { if (info.parent) selectBlock(info.parent.id); }
  else if (act === "add-before" || act === "add-after") {
    const parentId = info.parent ? info.parent.id : "root";
    const slot = info.parent ? Math.max(0, childLists(info.parent).findIndex((c) => c.list === list)) : 0;
    requestInsert({ parentId, slot, index: act === "add-before" ? index : index + 1 });
  }
  if (act === "up" || act === "down") { canvasAPI()?.select(id); renderRightPanel(); }
}

function dropBlock(drag, target) {
  const list0 = getList(target.parentId, target.slot);
  if (!list0) return;
  if (drag.kind === "new") {
    insertBlock(createBlock(drag.type), list0, target.index);
    return;
  }
  const info = findInfo(drag.id);
  if (!info) return;
  if (target.parentId !== "root" && contains(info.block, target.parentId)) return; // niet in zichzelf
  info.list.splice(info.index, 1);
  const list = getList(target.parentId, target.slot) || page.blocks;
  list.splice(Math.max(0, Math.min(target.index, list.length)), 0, info.block);
  selectedId = info.block.id;
  commit({ render: "all" });
  canvasAPI()?.select(selectedId);
  renderRightPanel();
}

function requestInsert(target) {
  insertTarget = target;
  setLeftTab("catalog");
  updateInsertHint();
  $("#cat-search").focus();
}

window.EditorBridge = {
  drag: null,
  canvasReady() { canvasReady = true; sendAll(); setTimeout(() => canvasAPI()?.select(selectedId), 400); },
  select: selectBlock,
  action: blockAction,
  drop: dropBlock,
  requestInsert,
  undo, redo, save: () => saveNow(false),
  inline(id, field, value) {
    const info = findInfo(id);
    if (!info) return;
    info.block[field] = value;
    commit({ render: "none", coalesce: `inline-${id}-${field}` });
    if (id === selectedId) panelControls[field]?.set(value);
  },
  inlineDone(id) { const t = topOf(id); if (t) canvasAPI()?.updateBlock(clone(t)); },
};

// ============================================================
// Linker paneel: catalogus + lagen
// ============================================================
function setLeftTab(tab) {
  leftTab = tab;
  document.querySelectorAll(".ed-left__tabs button").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
  $("#ed-catalog").hidden = tab !== "catalog";
  $("#ed-layers").hidden = tab !== "layers";
  if (tab === "layers") renderLayers();
}

function updateInsertHint() {
  const h = $("#cat-hint");
  h.hidden = !insertTarget;
}

function renderCatalog() {
  const q = $("#cat-search").value.trim().toLowerCase();
  const wrap = $("#cat-groups");
  wrap.innerHTML = "";
  let shown = 0;
  GROUPS.forEach((group) => {
    const entries = Object.entries(BLOCKS).filter(([type, def]) => def.group === group && (!q || `${def.label} ${(def.keywords || []).join(" ")} ${type}`.toLowerCase().includes(q)));
    if (!entries.length) return;
    shown += entries.length;
    const sec = document.createElement("section");
    sec.className = "cat-group";
    sec.innerHTML = `<h4>${group}</h4>`;
    const grid = document.createElement("div");
    grid.className = "cat-grid";
    entries.forEach(([type, def]) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "cat-card";
      card.draggable = true;
      card.title = `${def.label} — sleep naar de pagina of klik om toe te voegen`;
      card.innerHTML = `<span class="cat-card__icon">${typeIconSvg(type, 22)}</span><span class="cat-card__label">${def.label}</span>`;
      card.addEventListener("click", () => addFromCatalog(type));
      card.addEventListener("dragstart", (e) => {
        window.EditorBridge.drag = { kind: "new", type };
        e.dataTransfer.setData("text/plain", type);
        e.dataTransfer.effectAllowed = "copy";
        card.classList.add("is-dragging");
      });
      card.addEventListener("dragend", () => { card.classList.remove("is-dragging"); setTimeout(() => { window.EditorBridge.drag = null; }, 50); });
      grid.appendChild(card);
    });
    sec.appendChild(grid);
    wrap.appendChild(sec);
  });
  if (!shown) wrap.innerHTML = `<p class="muted" style="padding:16px">Geen component gevonden voor “${esc(q)}”.</p>`;
}

function previewText(b) {
  const t = b.text || b.title || b.name || b.label || b.question || b.address || (b.html || "").replace(/<[^>]*>/g, "") || "";
  return String(t).trim().slice(0, 30);
}

function renderLayers() {
  const root = $("#ed-layers");
  if (!root || root.hidden) return;
  root.innerHTML = "";
  if (!page.blocks.length) { root.innerHTML = `<p class="muted" style="padding:16px">Nog geen componenten.</p>`; return; }
  const walk = (list, depth, into) => {
    list.forEach((b) => {
      const row = document.createElement("div");
      row.className = `lay-row${b.id === selectedId ? " is-selected" : ""}${b.hidden ? " is-hidden" : ""}`;
      row.style.paddingLeft = `${10 + depth * 16}px`;
      row.innerHTML = `<span class="lay-row__icon">${typeIconSvg(b.type, 16)}</span><span class="lay-row__label">${blockLabel(b.type)}<small>${esc(previewText(b))}</small></span>`;
      const eye = document.createElement("button");
      eye.type = "button"; eye.className = "lay-row__eye"; eye.title = b.hidden ? "Tonen op de website" : "Verbergen op de website";
      eye.textContent = b.hidden ? "◌" : "●";
      eye.addEventListener("click", (e) => { e.stopPropagation(); b.hidden = !b.hidden; if (!b.hidden) delete b.hidden; commit({ render: "all" }); if (b.id === selectedId) renderRightPanel(); });
      row.appendChild(eye);
      row.addEventListener("click", () => { selectBlock(b.id); canvasAPI()?.select(b.id, { scroll: true }); });
      into.appendChild(row);
      childLists(b).forEach(({ slot, list: l }) => {
        if (b.type === "columns") {
          const lab = document.createElement("div");
          lab.className = "lay-col"; lab.style.paddingLeft = `${10 + (depth + 1) * 16}px`; lab.textContent = `Kolom ${slot + 1}`;
          into.appendChild(lab);
          walk(l, depth + 2, into);
        } else walk(l, depth + 1, into);
      });
    });
  };
  walk(page.blocks, 0, root);
}

// ============================================================
// Rechter paneel: eigenschappen
// ============================================================
let ctx = { palette: [], fetchMediaMap, openMediaPicker, openLinkPicker, openCropTool };

function renderRightPanel() {
  const panel = $("#ed-right-body");
  const head = $("#ed-right-head");
  panel.innerHTML = "";
  panelControls = {};
  const info = selectedId ? findInfo(selectedId) : null;

  if (!info) {
    head.innerHTML = `<div class="rp-title"><span class="rp-title__icon">🎨</span><div><strong>Pagina-ontwerp</strong><small>Geldt voor de hele pagina. Klik op een component om dat te bewerken.</small></div></div>`;
    page.theme = page.theme || {};
    panel.appendChild(buildSections(PAGE_STYLE_SECTIONS, page.theme, () => commit({ render: "theme", coalesce: "theme" }), ctx));
    return;
  }

  const block = info.block;
  const def = BLOCKS[block.type];
  head.innerHTML = `<div class="rp-title"><span class="rp-title__icon">${typeIconSvg(block.type, 20)}</span><div><strong>${blockLabel(block.type)}</strong><small>${info.parent ? "In " + blockLabel(info.parent.type).toLowerCase() : "Op de pagina"}</small></div></div>
    <div class="rp-tabs">${[["content", "Inhoud"], ["style", "Stijl"], ["more", "Meer"]].map(([k, l]) => `<button type="button" data-tab="${k}" class="${panelTab === k ? "is-active" : ""}">${l}</button>`).join("")}</div>`;
  head.querySelectorAll(".rp-tabs button").forEach((b) => b.addEventListener("click", () => { panelTab = b.dataset.tab; renderRightPanel(); }));

  const rootId = () => topOf(block.id)?.id;
  const rerender = (coalesce) => commit({ render: { block: rootId() }, coalesce });

  if (panelTab === "content") {
    const flds = buildFields(def?.fields || [], block, (key) => { def?.normalize?.(block); rerender(`f-${block.id}-${key}`); if (def?.normalize) renderLayers(); }, ctx);
    panelControls = flds.__controls || {};
    panel.appendChild(flds);
  } else if (panelTab === "style") {
    block.style = block.style || {};
    panel.appendChild(buildSections(BLOCK_STYLE_SECTIONS, block.style, (key) => { if (!Object.keys(block.style).length) delete block.style; rerender(`s-${block.id}-${key}`); }, ctx));
  } else {
    panel.appendChild(buildMorePanel(block, rerender));
  }
}

function buildMorePanel(block, rerender) {
  const wrap = document.createElement("div");
  wrap.className = "more";
  wrap.innerHTML = `
    <label class="tgl"><input type="checkbox" id="m-hidden" ${block.hidden ? "checked" : ""}><span class="tgl__track"></span><span class="tgl__text">Tijdelijk verbergen op de website</span></label>
    <div class="more__row">
      <button type="button" class="btn-admin" id="m-copy">Stijl kopiëren</button>
      <button type="button" class="btn-admin" id="m-paste">Stijl plakken</button>
      <button type="button" class="btn-admin" id="m-reset">Stijl wissen</button>
    </div>
    <div class="more__row">
      <button type="button" class="btn-admin" id="m-dup">⎘ Dupliceren</button>
      <button type="button" class="btn-admin btn-admin--danger" id="m-del">🗑 Verwijderen</button>
    </div>
    <p class="muted">Tip: dubbelklik op een titel of tekst op het canvas om direct te typen. Sleep met het ⠿-handvat om te verplaatsen.</p>`;
  $("#m-hidden", wrap).addEventListener("change", (e) => { if (e.target.checked) block.hidden = true; else delete block.hidden; commit({ render: "all" }); });
  $("#m-copy", wrap).addEventListener("click", () => { styleClipboard = clone(block.style || {}); showToast("Stijl gekopieerd."); });
  $("#m-paste", wrap).addEventListener("click", () => { if (!styleClipboard) return showToast("Kopieer eerst de stijl van een ander component.", true); block.style = clone(styleClipboard); commit({ render: "all" }); showToast("Stijl geplakt."); });
  $("#m-reset", wrap).addEventListener("click", () => { delete block.style; commit({ render: "all" }); showToast("Stijl gewist."); });
  $("#m-dup", wrap).addEventListener("click", () => blockAction("dup", block.id));
  $("#m-del", wrap).addEventListener("click", () => blockAction("del", block.id));
  return wrap;
}

// ============================================================
// Instellingen (⚙): SEO, adres, status, versies
// ============================================================
function fillSettings() {
  $("#set-slug").value = page.slug || "";
  $("#set-slug").disabled = page.slug === "home";
  $("#seo-title").value = page.seo.title || "";
  $("#seo-description").value = page.seo.description || "";
  $("#set-backtotop").checked = page.showBackToTop;
  $("#set-status").value = page.status === "published" ? "published" : "draft";
  renderOg(); updateSeoPreview();
}

function renderOg() {
  const wrap = $("#og-preview");
  wrap.innerHTML = page.seo.ogImage ? `<img src="${esc(page.seo.ogImage)}" alt="">` : `<p class="muted">Nog geen deelafbeelding — sociale media tonen dan hun eigen standaardvoorbeeld.</p>`;
  $("#og-remove").hidden = !page.seo.ogImage;
}

function updateSeoPreview() {
  const t = page.seo.title || page.title || "Titel van de pagina";
  const d = page.seo.description || "Hier komt de omschrijving te staan die zoekmachines tonen.";
  $("#serp-title").textContent = t;
  $("#serp-url").textContent = `${location.hostname}/${page.slug === "home" ? "" : page.slug}`;
  $("#serp-desc").textContent = d;
  $("#cnt-title").textContent = `${(page.seo.title || "").length}/60`;
  $("#cnt-desc").textContent = `${(page.seo.description || "").length}/160`;
  $("#cnt-title").classList.toggle("is-over", (page.seo.title || "").length > 60);
  $("#cnt-desc").classList.toggle("is-over", (page.seo.description || "").length > 160);
}

function openSettings(open) { $("#ed-settings").classList.toggle("is-open", open); if (open) loadVersions(); }

// ============================================================
// Opbouw van het scherm
// ============================================================
function buildShell() {
  document.body.className = "admin ed-body";
  document.title = `${page.title || "Naamloos"} — Bewerken — Beheer`;
  document.body.innerHTML = `
  <div class="ed">
    <header class="ed-top">
      <a class="ed-back" id="ed-back" href="/admin/index.html" title="Terug naar alle pagina’s">←</a>
      <div class="ed-top__title">
        <input id="ed-title" type="text" value="${esc(page.title)}" aria-label="Paginatitel">
        <span class="status-pill status-pill--${page.status}" id="ed-status"></span>
      </div>
      <div class="ed-top__center">
        <div class="ed-devices">
          <button type="button" data-dev="desktop" class="is-active" title="Computer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg></button>
          <button type="button" data-dev="tablet" title="Tablet"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M11 18h2"/></svg></button>
          <button type="button" data-dev="mobile" title="Mobiel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg></button>
        </div>
        <div class="ed-hist">
          <button type="button" id="ed-undo" title="Ongedaan maken (Ctrl+Z)" disabled>↶</button>
          <button type="button" id="ed-redo" title="Opnieuw (Ctrl+Shift+Z)" disabled>↷</button>
        </div>
      </div>
      <div class="ed-top__right">
        <span id="ed-save-status" class="save-status"></span>
        <button type="button" class="btn-admin" id="ed-preview" title="Voorbeeld zonder bewerkhulpmiddelen">Voorbeeld</button>
        <a class="btn-admin" id="ed-live" target="_blank" rel="noopener" hidden>Bekijk live ↗</a>
        <button type="button" class="btn-admin ed-gear" id="ed-gear" title="Pagina-instellingen (SEO, adres, versies)" aria-label="Pagina-instellingen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
        <button type="button" class="btn-admin" id="ed-save">Opslaan</button>
        <button type="button" class="btn-admin btn-admin--primary" id="ed-publish">Publiceren</button>
      </div>
    </header>

    <div class="ed-main">
      <aside class="ed-left">
        <div class="ed-left__tabs"><button type="button" data-tab="catalog" class="is-active">Componenten</button><button type="button" data-tab="layers">Lagen</button></div>
        <div id="ed-catalog">
          <div class="cat-search"><input id="cat-search" type="search" placeholder="Zoek een component…" autocomplete="off"></div>
          <div id="cat-hint" class="cat-hint" hidden>Kies een component — die komt op de gekozen plek. <button type="button" id="cat-hint-cancel">Annuleren</button></div>
          <div id="cat-groups"></div>
        </div>
        <div id="ed-layers" hidden></div>
      </aside>

      <section class="ed-stage" id="ed-stage">
        <div class="ed-frame" id="ed-frame" data-device="desktop">
          <iframe id="ed-canvas" src="/admin/canvas.html" title="Pagina-canvas"></iframe>
        </div>
      </section>

      <aside class="ed-right">
        <div id="ed-right-head" class="ed-right__head"></div>
        <div id="ed-right-body" class="ed-right__body"></div>
      </aside>
    </div>

    <div class="ed-settings" id="ed-settings">
      <div class="ed-settings__backdrop" id="ed-settings-backdrop"></div>
      <div class="ed-settings__panel">
        <div class="ed-settings__head"><h2>Pagina-instellingen</h2><button type="button" class="btn-admin" id="ed-settings-close">Sluiten</button></div>
        <section class="set-sec">
          <h3>Adres & status</h3>
          <div class="fld"><label class="fld__label">Adres van de pagina</label><div class="slug-row"><span>${location.hostname}/</span><input id="set-slug" type="text"></div></div>
          <div class="fld"><label class="fld__label">Status</label><select id="set-status"><option value="draft">Concept (niet zichtbaar voor bezoekers)</option><option value="published">Gepubliceerd</option></select></div>
          <label class="tgl"><input type="checkbox" id="set-backtotop"><span class="tgl__track"></span><span class="tgl__text">“Terug naar boven”-knop tonen op deze pagina</span></label>
        </section>
        <section class="set-sec">
          <h3>SEO <small>zo verschijnt deze pagina in Google</small></h3>
          <div class="serp"><div class="serp__url" id="serp-url"></div><div class="serp__title" id="serp-title"></div><div class="serp__desc" id="serp-desc"></div></div>
          <div class="fld"><label class="fld__label">SEO-titel <span class="cnt" id="cnt-title"></span></label><input id="seo-title" type="text"></div>
          <div class="fld"><label class="fld__label">Meta-omschrijving <span class="cnt" id="cnt-desc"></span></label><textarea id="seo-description" rows="3"></textarea></div>
          <div class="fld"><label class="fld__label">Deelafbeelding (Open Graph) — verschijnt bij delen via WhatsApp, Facebook, LinkedIn</label>
            <div id="og-preview"></div>
            <div class="more__row"><button type="button" class="btn-admin" id="og-pick">Afbeelding kiezen</button><button type="button" class="btn-admin btn-admin--danger" id="og-remove">Verwijderen</button></div></div>
        </section>
        <section class="set-sec">
          <h3>Versiegeschiedenis</h3>
          <div id="version-list"><p class="muted">Wordt geladen…</p></div>
          <button type="button" class="btn-admin" id="save-version-btn" style="margin-top:8px">Huidige versie bewaren</button>
        </section>
      </div>
    </div>
  </div>`;

  refreshStatusPill();
  fillSettings();
  renderCatalog();
  renderRightPanel();
  updateHistoryButtons();

  // topbalk
  $("#ed-title").addEventListener("input", (e) => { page.title = e.target.value; document.title = `${page.title || "Naamloos"} — Bewerken — Beheer`; commit({ render: "none", coalesce: "title" }); updateSeoPreview(); });
  $("#ed-undo").addEventListener("click", undo);
  $("#ed-redo").addEventListener("click", redo);
  $("#ed-save").addEventListener("click", () => saveNow(false));
  $("#ed-publish").addEventListener("click", onPublish);
  $("#ed-gear").addEventListener("click", () => openSettings(true));
  $("#ed-back").addEventListener("click", (e) => { if (dirty && !confirm("Er zijn niet-opgeslagen wijzigingen. Toch verlaten?")) e.preventDefault(); });
  $("#ed-preview").addEventListener("click", () => {
    previewMode = !previewMode;
    document.body.classList.toggle("ed-preview", previewMode);
    $("#ed-preview").textContent = previewMode ? "Terug naar bewerken" : "Voorbeeld";
    canvasWin()?.document.body.classList.toggle("cv-preview", previewMode);
    if (previewMode) selectBlock(null);
  });
  document.querySelectorAll(".ed-devices button").forEach((b) => b.addEventListener("click", () => {
    device = b.dataset.dev;
    document.querySelectorAll(".ed-devices button").forEach((x) => x.classList.toggle("is-active", x === b));
    $("#ed-frame").dataset.device = device;
    setTimeout(() => canvasAPI()?.positionUI(), 320);
  }));

  // linker paneel
  document.querySelectorAll(".ed-left__tabs button").forEach((b) => b.addEventListener("click", () => setLeftTab(b.dataset.tab)));
  $("#cat-search").addEventListener("input", renderCatalog);
  $("#cat-hint-cancel").addEventListener("click", () => { insertTarget = null; updateInsertHint(); });

  // instellingen
  $("#ed-settings-close").addEventListener("click", () => openSettings(false));
  $("#ed-settings-backdrop").addEventListener("click", () => openSettings(false));
  $("#set-slug").addEventListener("change", async (e) => {
    const unique = await ensureUniqueSlug(slugify(e.target.value), page.id);
    page.slug = unique; e.target.value = unique; markDirty(); updateSeoPreview(); refreshStatusPill();
  });
  $("#set-status").addEventListener("change", (e) => { page.status = e.target.value; markDirty(); refreshStatusPill(); });
  $("#set-backtotop").addEventListener("change", (e) => { page.showBackToTop = e.target.checked; markDirty(); });
  $("#seo-title").addEventListener("input", (e) => { page.seo.title = e.target.value; markDirty(); updateSeoPreview(); });
  $("#seo-description").addEventListener("input", (e) => { page.seo.description = e.target.value; markDirty(); updateSeoPreview(); });
  $("#og-pick").addEventListener("click", async () => { const m = await openMediaPicker({ accept: "image" }); if (m) { page.seo.ogImage = m.url; renderOg(); markDirty(); } });
  $("#og-remove").addEventListener("click", () => { page.seo.ogImage = ""; renderOg(); markDirty(); });
  $("#save-version-btn").addEventListener("click", () => saveVersion(true));

  // sneltoetsen op de editor zelf
  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); saveNow(false); }
    else if (!typing && mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (!typing && mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    else if (e.key === "Escape") { openSettings(false); if (insertTarget) { insertTarget = null; updateInsertHint(); } }
  });
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
}

// ============================================================
// Start
// ============================================================
async function loadPalette() {
  const base = [
    { name: "Hoofdkleur", value: "#2F4A3E" }, { name: "Accent", value: "#E2963F" }, { name: "Teal", value: "#4A7A72" },
    { name: "Papierwit", value: "#FBF9F4" }, { name: "Zacht beige", value: "#F1ECDF" }, { name: "Inkt", value: "#1F2E27" },
    { name: "Wit", value: "#FFFFFF" }, { name: "Zwart", value: "#000000" },
  ];
  try {
    const snap = await getDoc(doc(db, "settings", "site"));
    const c = snap.exists() ? snap.data().colors : null;
    if (c?.primary) base[0].value = c.primary;
    if (c?.accent) base[1].value = c.accent;
    if (c?.bg) base[3].value = c.bg;
  } catch { /* standaardpalet is prima */ }
  ctx.palette = base;
}

async function boot() {
  if (!pageId) { alert("Geen pagina-id opgegeven."); location.href = "/admin/index.html"; return; }
  await requireAdmin();
  const snap = await getDoc(doc(db, "pages", pageId));
  if (!snap.exists()) { alert("Pagina niet gevonden."); location.href = "/admin/index.html"; return; }
  page = { id: snap.id, ...snap.data() };
  page.blocks = page.blocks || [];
  page.seo = page.seo || { title: "", description: "", ogImage: "" };
  page.theme = page.theme || {};
  page.showBackToTop = page.showBackToTop !== false;
  page.status = page.status === "published" ? "published" : "draft";
  lastSnap = snapshot();
  await loadPalette();
  buildShell();
}

boot();
