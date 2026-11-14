// restyle.js
// Het scherm "Nieuwe opmaak": bekijk per pagina een voorbeeld van de nieuwe
// opmaak, pas hem toe, en zet alles met één knop terug.
//
// Veiligheid:
//  - Niets gebeurt vanzelf; je kiest zelf.
//  - Voor elke pagina wordt gecontroleerd dat tekst, volgorde, links en
//    afbeeldingen exact gelijk blijven (zie verifyRestyle). Klopt het niet,
//    dan wordt de pagina overgeslagen.
//  - De oude opbouw wordt in het paginadocument bewaard (veld "preRestyle").
//    "Terugzetten" zet die weer terug en wist de kopie.

import { requireAdmin } from "./admin-auth.js";
import { renderAdminShell, showToast } from "./admin-shell.js";
import { db } from "../../js/firebase-init.js";
import { collection, getDocs, getDoc, doc, updateDoc, deleteField, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { buildPalette, restyleBlocks, restyleTheme, verifyRestyle } from "./restyle-rules.js";

const clone = (v) => JSON.parse(JSON.stringify(v));
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const $ = (s, r = document) => r.querySelector(s);

let pages = [];
let pal = buildPalette();
let canvasReady = false;
let pendingView = null;

// De canvas (iframe) verwacht een "bridge" op de ouderpagina; hier doet die niets.
window.EditorBridge = {
  drag: null,
  canvasReady() { canvasReady = true; const win = $("#rs-canvas").contentWindow; win.document.body.classList.add("cv-preview"); if (pendingView) showView(pendingView); },
  select() {}, action() {}, drop() {}, requestInsert() {}, inline() {}, inlineDone() {}, undo() {}, redo() {}, save() {},
};

// ---------------------------------------------------------------
// Analyse per pagina
// ---------------------------------------------------------------
function analyse(p) {
  const applied = !!p.preRestyle;
  if (applied) {
    return { applied, ok: true, oldBlocks: p.preRestyle.blocks || [], oldTheme: p.preRestyle.theme || {}, newBlocks: p.blocks || [], newTheme: p.theme || {} };
  }
  const blocks = p.blocks || [];
  if (!blocks.length) return { applied, ok: false, reason: "de pagina is leeg", oldBlocks: blocks, oldTheme: p.theme || {} };
  try {
    const newBlocks = restyleBlocks(blocks, pal);
    const check = verifyRestyle(blocks, newBlocks);
    if (!check.ok) return { applied, ok: false, reason: check.reason, oldBlocks: blocks, oldTheme: p.theme || {} };
    return { applied, ok: true, oldBlocks: blocks, oldTheme: p.theme || {}, newBlocks, newTheme: restyleTheme(p.theme, pal) };
  } catch (err) {
    console.error(err);
    return { applied, ok: false, reason: "onverwachte fout bij omzetten", oldBlocks: blocks, oldTheme: p.theme || {} };
  }
}

async function load() {
  try {
    const s = await getDoc(doc(db, "settings", "site"));
    if (s.exists()) pal = buildPalette(s.data().colors || {});
  } catch { /* standaardkleuren */ }
  const snap = await getDocs(collection(db, "pages"));
  pages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  pages.sort((a, b) => (a.slug === "home" ? -1 : b.slug === "home" ? 1 : String(a.title).localeCompare(String(b.title))));
  pages.forEach((p) => { p._a = analyse(p); });
  render();
}

// ---------------------------------------------------------------
// Schermopbouw
// ---------------------------------------------------------------
function render() {
  const applied = pages.filter((p) => p._a.applied);
  const ready = pages.filter((p) => !p._a.applied && p._a.ok);
  const skipped = pages.filter((p) => !p._a.applied && !p._a.ok);
  const banner = $("#rs-banner");
  banner.innerHTML = "";
  const box = document.createElement("div");

  if (applied.length) {
    box.className = "rs-banner rs-banner--done";
    box.innerHTML = `<div><strong>De nieuwe opmaak staat aan op ${applied.length} ${applied.length === 1 ? "pagina" : "pagina’s"}.</strong><p>Niet tevreden? Met de knop hiernaast zet je alles in één keer terug naar hoe het was. Wijzigingen die je ná het toepassen hebt gemaakt op deze pagina’s gaan dan verloren.</p></div>
      <div class="rs-banner__btns">${ready.length ? `<button class="btn-admin" id="rs-apply-all">Ook toepassen op de rest (${ready.length})</button>` : ""}<button class="btn-admin btn-admin--primary" id="rs-restore-all">↩ Alles terugzetten naar de oude opmaak</button></div>`;
  } else if (ready.length) {
    box.className = "rs-banner rs-banner--new";
    box.innerHTML = `<div><strong>Klaar om de nieuwe opmaak toe te passen?</strong><p>${ready.length} ${ready.length === 1 ? "pagina is" : "pagina’s zijn"} klaar${skipped.length ? `, ${skipped.length} overgeslagen (zie hieronder)` : ""}. Bekijk eerst gerust een voorbeeld.</p></div>
      <div class="rs-banner__btns"><button class="btn-admin btn-admin--primary" id="rs-apply-all">✨ Nieuwe opmaak toepassen op alle pagina’s</button></div>`;
  } else box.className = "";
  banner.appendChild(box);
  $("#rs-apply-all")?.addEventListener("click", applyAll);
  $("#rs-restore-all")?.addEventListener("click", restoreAll);

  const list = $("#rs-list");
  if (!pages.length) { list.textContent = "Er zijn nog geen pagina’s."; return; }
  list.innerHTML = "";
  pages.forEach((p) => {
    const a = p._a;
    const row = document.createElement("div");
    row.className = "rs-row";
    const badge = a.applied ? `<span class="rs-badge rs-badge--new">Nieuwe opmaak</span>` : a.ok ? `<span class="rs-badge rs-badge--old">Oude opmaak</span>` : `<span class="rs-badge rs-badge--skip">Overgeslagen</span>`;
    row.innerHTML = `<div><div class="rs-row__title">${esc(p.title || "Naamloos")}</div>
      <div class="rs-row__meta">/${esc(p.slug === "home" ? "" : p.slug)} · ${p.status === "published" ? "Gepubliceerd" : "Concept"}${a.ok ? "" : ` · ${esc(a.reason)}`}</div></div>
      <div>${badge}</div>
      <div class="rs-row__btns">
        <button class="btn-admin" data-preview ${a.ok || a.applied ? "" : "disabled"}>Voorbeeld</button>
        ${a.applied ? `<button class="btn-admin" data-restore>↩ Terugzetten</button>` : `<button class="btn-admin btn-admin--primary" data-apply ${a.ok ? "" : "disabled"}>Toepassen</button>`}
      </div>`;
    row.querySelector("[data-preview]").addEventListener("click", () => openPreview(p));
    row.querySelector("[data-apply]")?.addEventListener("click", async () => { await applyPages([p]); });
    row.querySelector("[data-restore]")?.addEventListener("click", async () => {
      if (confirm(`“${p.title}” terugzetten naar de oude opmaak? Wijzigingen die je ná het toepassen hebt gemaakt op deze pagina gaan verloren.`)) await restorePages([p]);
    });
    list.appendChild(row);
  });
}

// ---------------------------------------------------------------
// Toepassen / terugzetten
// ---------------------------------------------------------------
async function applyPages(targets) {
  const ok = targets.filter((p) => !p._a.applied && p._a.ok);
  let done = 0;
  for (const p of ok) {
    try {
      const data = clone({
        preRestyle: { blocks: p._a.oldBlocks, theme: p._a.oldTheme || {}, savedAt: Date.now() },
        blocks: p._a.newBlocks,
        theme: p._a.newTheme || {},
      });
      data.restyledAt = serverTimestamp();
      await updateDoc(doc(db, "pages", p.id), data);
      done++;
    } catch (err) { console.error(err); showToast(`Mislukt voor “${p.title}”.`, true); }
  }
  showToast(done ? `Nieuwe opmaak toegepast op ${done} ${done === 1 ? "pagina" : "pagina’s"}.` : "Er is niets toegepast.");
  await load();
}

async function applyAll() {
  const n = pages.filter((p) => !p._a.applied && p._a.ok).length;
  if (!n) return;
  if (!confirm(`De nieuwe opmaak toepassen op ${n} ${n === 1 ? "pagina" : "pagina’s"}?\n\nDe teksten blijven precies hetzelfde. Je kunt altijd met één knop terug.`)) return;
  await applyPages(pages);
}

async function restorePages(targets) {
  let done = 0;
  for (const p of targets.filter((x) => x._a.applied)) {
    try {
      const data = clone({ blocks: p.preRestyle.blocks || [], theme: p.preRestyle.theme || {} });
      data.preRestyle = deleteField();
      data.restyledAt = deleteField();
      await updateDoc(doc(db, "pages", p.id), data);
      done++;
    } catch (err) { console.error(err); showToast(`Terugzetten mislukt voor “${p.title}”.`, true); }
  }
  showToast(done ? "Oude opmaak teruggezet." : "Er was niets om terug te zetten.");
  await load();
}

async function restoreAll() {
  const n = pages.filter((p) => p._a.applied).length;
  if (!n) return;
  if (!confirm(`Alle ${n} ${n === 1 ? "pagina" : "pagina’s"} terugzetten naar de oude opmaak?\n\nWijzigingen die je ná het toepassen van de nieuwe opmaak op deze pagina’s hebt gemaakt, gaan verloren.`)) return;
  await restorePages(pages);
}

// ---------------------------------------------------------------
// Voorbeeld
// ---------------------------------------------------------------
function showView(view) {
  pendingView = view;
  if (!canvasReady) return;
  $("#rs-canvas").contentWindow.CanvasAPI?.setContent(clone({ blocks: view.blocks, theme: view.theme }));
}

function openPreview(p) {
  const a = p._a;
  const modal = $("#rs-modal");
  modal.hidden = false;
  $("#rs-modal-title").textContent = p.title || "Voorbeeld";
  const views = {
    old: { blocks: a.oldBlocks, theme: a.oldTheme },
    new: { blocks: a.newBlocks, theme: a.newTheme },
  };
  const seg = $("#rs-modal-version");
  seg.innerHTML = `<button type="button" data-v="old">${a.applied ? "Oude opmaak" : "Nu"}</button><button type="button" data-v="new" class="is-active">Nieuwe opmaak</button>`;
  seg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    seg.querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b));
    showView(views[b.dataset.v]);
  }));
  const iframe = $("#rs-canvas");
  pendingView = views.new;
  if (!iframe.getAttribute("src")) iframe.setAttribute("src", "/admin/canvas.html");
  else showView(views.new);
}

$("#rs-modal-close").addEventListener("click", () => { $("#rs-modal").hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#rs-modal").hidden = true; });
$("#rs-modal-device").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
  $("#rs-modal-device").querySelectorAll("button").forEach((x) => x.classList.toggle("is-active", x === b));
  $("#rs-modal-frame").dataset.device = b.dataset.dev;
}));

(async function boot() {
  const admin = await requireAdmin();
  renderAdminShell("restyle", admin);
  await load();
})();
