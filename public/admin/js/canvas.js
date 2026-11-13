// canvas.js
// Draait BINNEN de iframe van de editor (admin/canvas.html). Dit is de
// "kloon van de pagina": dezelfde header, footer, CSS en render.js als de
// echte website, maar dan met selecteren, direct typen en slepen.
//
// De editor (editor-core.js) praat met dit bestand via twee kanten:
//   editor → canvas :  window.CanvasAPI   (setContent, updateBlock, select, ...)
//   canvas → editor :  window.parent.EditorBridge   (select, drop, inline, ...)
// Beide pagina's staan op hetzelfde domein, dus dit kan rechtstreeks.

import { initLayout } from "../../js/layout.js";
import { renderBlocks, renderBlockNode, applyPageTheme, collectMediaIds } from "../../js/render.js";
import { fetchMediaMap } from "./media-picker.js";
import { blockLabel } from "./block-registry.js";

const bridge = () => (window.parent !== window ? window.parent.EditorBridge : null);
const root = document.getElementById("page-content");
const ui = document.getElementById("cv-ui");
const dropLine = document.getElementById("cv-drop");

let blocks = [];
let theme = null;
let mediaMap = {};
let selectedId = null;
let editingNode = null;
const OPTS = { editor: true };

document.execCommand("defaultParagraphSeparator", false, "p");

// ---------------------------------------------------------------
// Media + renderen
// ---------------------------------------------------------------
async function ensureMedia(ids) {
  const missing = [...ids].filter((id) => id && !mediaMap[id]);
  if (missing.length) Object.assign(mediaMap, await fetchMediaMap(missing));
}

function decorate() {
  root.querySelectorAll(".blk").forEach((w) => {
    const b = findBlock(blocks, w.dataset.bid);
    w.dataset.label = b ? blockLabel(b.type) : "";
  });
  // "+ Component toevoegen" onderaan de pagina
  root.querySelectorAll(":scope > .cv-end").forEach((n) => n.remove());
  const end = document.createElement("div");
  end.className = "cv-end";
  end.innerHTML = blocks.length
    ? `<button type="button">＋ Component toevoegen</button>`
    : `<div class="cv-empty"><strong>Deze pagina is nog leeg</strong><span>Sleep een component uit de catalogus hierheen, of klik op de knop.</span><button type="button">＋ Eerste component toevoegen</button></div>`;
  end.querySelector("button").addEventListener("click", () => bridge()?.requestInsert({ parentId: "root", slot: 0, index: blocks.length }));
  root.appendChild(end);
}

function findBlock(list, id) {
  for (const b of list || []) {
    if (b.id === id) return b;
    const kids = b.type === "columns" ? (b.items || []).flatMap((c) => c?.blocks || []) : b.type === "group" ? b.blocks || [] : [];
    const hit = findBlock(kids, id);
    if (hit) return hit;
  }
  return null;
}

async function setContent(data) {
  blocks = data.blocks || [];
  theme = data.theme || null;
  const ids = collectMediaIds(blocks);
  if (theme?.bgImage) ids.add(theme.bgImage);
  await ensureMedia(ids);
  applyPageTheme(theme, mediaMap);
  renderBlocks(blocks, root, mediaMap, OPTS);
  decorate();
  restoreSelection();
}

async function updateBlock(block) {
  const idx = blocks.findIndex((b) => b.id === block.id);
  if (idx >= 0) blocks[idx] = block;
  await ensureMedia(collectMediaIds([block]));
  const old = root.querySelector(`:scope > [data-bid="${block.id}"]`);
  if (!old) return setContent({ blocks, theme });
  const fresh = renderBlockNode(block, mediaMap, OPTS, false);
  old.replaceWith(fresh);
  decorate();
  restoreSelection();
}

async function setTheme(next) {
  theme = next || null;
  if (theme?.bgImage) await ensureMedia([theme.bgImage]);
  applyPageTheme(theme, mediaMap);
  positionUI();
}

// ---------------------------------------------------------------
// Selecteren + gereedschapsbalk
// ---------------------------------------------------------------
const selectedEl = () => (selectedId ? root.querySelector(`[data-bid="${selectedId}"]`) : null);

function select(id, { scroll = false } = {}) {
  selectedId = id || null;
  restoreSelection();
  if (scroll) selectedEl()?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function restoreSelection() {
  root.querySelectorAll(".is-selected").forEach((n) => n.classList.remove("is-selected"));
  const el = selectedEl();
  if (el) el.classList.add("is-selected");
  else selectedId = null;
  buildUI();
}

function buildUI() {
  const el = selectedEl();
  if (!el) { ui.hidden = true; ui.innerHTML = ""; return; }
  const b = findBlock(blocks, selectedId);
  const hasParent = !!el.parentElement?.closest(".blk");
  ui.hidden = false;
  ui.innerHTML = `
    <div class="cv-chip">${blockLabel(b?.type)}</div>
    <div class="cv-tools">
      <button type="button" class="cv-drag" draggable="true" title="Slepen om te verplaatsen">⠿</button>
      ${hasParent ? `<button type="button" data-act="parent" title="Bovenliggend blok selecteren">⬉</button>` : ""}
      <button type="button" data-act="up" title="Omhoog">↑</button>
      <button type="button" data-act="down" title="Omlaag">↓</button>
      <button type="button" data-act="dup" title="Dupliceren">⎘</button>
      <button type="button" data-act="del" title="Verwijderen" class="cv-danger">🗑</button>
    </div>
    <button type="button" class="cv-add cv-add--top" data-act="add-before" title="Component hierboven invoegen">＋</button>
    <button type="button" class="cv-add cv-add--bottom" data-act="add-after" title="Component hieronder invoegen">＋</button>`;
  ui.querySelectorAll("[data-act]").forEach((btn) => btn.addEventListener("click", (e) => { e.stopPropagation(); bridge()?.action(btn.dataset.act, selectedId); }));
  const handle = ui.querySelector(".cv-drag");
  handle.addEventListener("dragstart", (e) => {
    const br = bridge();
    if (!br) return;
    br.drag = { kind: "move", id: selectedId };
    e.dataTransfer.setData("text/plain", "move");
    e.dataTransfer.effectAllowed = "move";
    if (el.offsetHeight < 500) e.dataTransfer.setDragImage(el, 24, 24);
    el.classList.add("is-dragging");
  });
  handle.addEventListener("dragend", endDrag);
  positionUI();
}

function positionUI() {
  const el = selectedEl();
  if (!el || ui.hidden) return;
  const r = el.getBoundingClientRect();
  Object.assign(ui.style, { top: `${r.top + window.scrollY}px`, left: `${r.left + window.scrollX}px`, width: `${r.width}px`, height: `${r.height}px` });
  ui.classList.toggle("is-inside", r.top + window.scrollY < 40);
}

new ResizeObserver(positionUI).observe(document.body);
window.addEventListener("resize", positionUI);

// Hover-markering van het diepste blok onder de muis
document.addEventListener("mouseover", (e) => {
  const blk = e.target.closest?.(".blk");
  root.querySelectorAll(".is-hover").forEach((n) => { if (n !== blk) n.classList.remove("is-hover"); });
  if (blk && !blk.classList.contains("is-selected")) blk.classList.add("is-hover");
});
document.addEventListener("mouseleave", () => root.querySelectorAll(".is-hover").forEach((n) => n.classList.remove("is-hover")));

// Klikken: selecteren (links, knoppen en formulieren doen op het canvas niets)
document.addEventListener("click", (e) => {
  if (e.target.closest("#cv-ui") || e.target.closest(".cv-end")) return;
  if (editingNode && editingNode.contains(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
  const blk = e.target.closest?.(".blk");
  bridge()?.select(blk ? blk.dataset.bid : null);
}, true);
document.addEventListener("submit", (e) => e.preventDefault(), true);

// ---------------------------------------------------------------
// Direct typen op het canvas (dubbelklik)
// ---------------------------------------------------------------
function placeCaretAtEnd(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function startEdit(node) {
  if (editingNode === node) return;
  const blk = node.closest(".blk");
  if (!blk) return;
  const id = blk.dataset.bid;
  bridge()?.select(id);
  const field = node.dataset.field || node.dataset.richField;
  const rich = !!node.dataset.richField;
  editingNode = node;
  try { node.contentEditable = rich ? "true" : "plaintext-only"; } catch { node.contentEditable = "true"; }
  if (node.contentEditable !== "true" && node.contentEditable !== "plaintext-only") node.contentEditable = "true";
  node.classList.add("is-editing");
  node.focus();
  placeCaretAtEnd(node);

  const onInput = () => {
    const value = rich ? node.innerHTML : node.innerText.replace(/\n$/, "");
    bridge()?.inline(id, field, value);
  };
  const onKey = (e) => {
    if (e.key === "Escape" || (!rich && e.key === "Enter" && !e.shiftKey && node.tagName !== "P")) { e.preventDefault(); node.blur(); }
    e.stopPropagation();
  };
  const onPaste = (e) => {
    if (rich) return;
    e.preventDefault();
    document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
  };
  const end = () => {
    node.removeEventListener("input", onInput);
    node.removeEventListener("keydown", onKey);
    node.removeEventListener("paste", onPaste);
    node.contentEditable = "false";
    node.classList.remove("is-editing");
    editingNode = null;
    bridge()?.inlineDone(id);
  };
  node.addEventListener("input", onInput);
  node.addEventListener("keydown", onKey);
  node.addEventListener("paste", onPaste);
  node.addEventListener("blur", end, { once: true });
}

document.addEventListener("dblclick", (e) => {
  const node = e.target.closest?.("[data-field],[data-rich-field]");
  if (node) { e.preventDefault(); startEdit(node); }
});

// Sneltoetsen (niet tijdens typen)
document.addEventListener("keydown", (e) => {
  if (editingNode) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? bridge()?.redo() : bridge()?.undo(); }
  else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); bridge()?.redo(); }
  else if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); bridge()?.save(); }
  else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) { e.preventDefault(); bridge()?.action("del", selectedId); }
  else if (e.key === "Escape") bridge()?.select(null);
});

// ---------------------------------------------------------------
// Slepen & neerzetten (nieuwe componenten uit de catalogus én verplaatsen)
// ---------------------------------------------------------------
let lastTarget = null;

function computeTarget(e) {
  const br = bridge();
  const drag = br?.drag;
  if (!drag) return null;
  let container = e.target.closest?.("[data-container]") || root;
  if (drag.kind === "move") {
    const moving = root.querySelector(`[data-bid="${drag.id}"]`);
    // niet in zichzelf (of een eigen kind) neerzetten
    if (moving && moving.contains(container)) container = moving.parentElement.closest("[data-container]") || root;
  }
  const kids = [...container.children].filter((c) => c.classList.contains("blk") && !(drag.kind === "move" && c.dataset.bid === drag.id));
  let index = kids.length;
  let y;
  for (let i = 0; i < kids.length; i++) {
    const r = kids[i].getBoundingClientRect();
    if (e.clientY < r.top + r.height / 2) { index = i; y = r.top; break; }
  }
  let rect;
  if (index === kids.length && kids.length) { rect = kids[kids.length - 1].getBoundingClientRect(); y = rect.bottom; }
  const cr = container.getBoundingClientRect();
  if (!kids.length) y = cr.top + 4;
  const left = kids.length ? (index < kids.length ? kids[index] : kids[kids.length - 1]).getBoundingClientRect().left : cr.left;
  const width = kids.length ? (index < kids.length ? kids[index] : kids[kids.length - 1]).getBoundingClientRect().width : cr.width;
  return { parentId: container.dataset.container || "root", slot: Number(container.dataset.slot || 0), index, y, left, width };
}

document.addEventListener("dragover", (e) => {
  if (!bridge()?.drag) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = bridge().drag.kind === "move" ? "move" : "copy";
  const t = computeTarget(e);
  lastTarget = t;
  if (t) {
    dropLine.hidden = false;
    Object.assign(dropLine.style, { top: `${t.y + window.scrollY - 2}px`, left: `${t.left + window.scrollX}px`, width: `${t.width}px` });
  }
  if (e.clientY < 90) window.scrollBy(0, -18);
  else if (e.clientY > window.innerHeight - 90) window.scrollBy(0, 18);
});

document.addEventListener("drop", (e) => {
  const br = bridge();
  if (!br?.drag) return;
  e.preventDefault();
  const drag = br.drag;
  const target = computeTarget(e) || lastTarget;
  endDrag();
  if (target) br.drop(drag, { parentId: target.parentId, slot: target.slot, index: target.index });
});

document.addEventListener("dragleave", (e) => { if (!e.relatedTarget) dropLine.hidden = true; });

function endDrag() {
  dropLine.hidden = true;
  lastTarget = null;
  root.querySelectorAll(".is-dragging").forEach((n) => n.classList.remove("is-dragging"));
  if (bridge()) bridge().drag = null;
}

// ---------------------------------------------------------------
// Start: echte header/footer opbouwen, dan de editor laten weten dat we klaar zijn
// ---------------------------------------------------------------
window.CanvasAPI = { setContent, updateBlock, setTheme, select, positionUI };

(async () => {
  try { await initLayout(); } catch (err) { console.error("Header/footer niet geladen in canvas:", err); }
  bridge()?.canvasReady();
})();
