// menu-editor.js
import { requireAdmin } from "./admin-auth.js";
import { renderAdminShell, showToast } from "./admin-shell.js";
import { db } from "../../js/firebase-init.js";
import { doc, getDoc, setDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { MENU_ICON_LIBRARY, menuIconSvg } from "../../js/menu-icons.js";
import { normalizeExternalUrl } from "../../js/render.js";

let items = [];
let pages = [];

async function boot() {
  const admin = await requireAdmin();
  renderAdminShell("menu", admin);

  const pagesSnap = await getDocs(query(collection(db, "pages"), where("trashed", "==", false)));
  pages = pagesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const menuSnap = await getDoc(doc(db, "menu", "main"));
  items = menuSnap.exists() ? (menuSnap.data().items || []) : [];

  render();
  document.getElementById("add-item-btn").addEventListener("click", () => { items.push(newItem()); render(); });
  document.getElementById("save-menu-btn").addEventListener("click", saveMenu);
}

function newItem() { return { label: "Nieuw item", type: "page", slug: "", url: "", hidden: false, pinned: false, children: [] }; }

function pinnedCount() { return items.filter((i) => i.pinned).length; }

function pageOptions(selectedSlug) {
  return `<option value="">— Kies pagina —</option>` + pages.map((p) => `<option value="${p.slug}" ${p.slug === selectedSlug ? "selected" : ""}>${p.title}</option>`).join("");
}

function iconOptions(selected) {
  const items = Object.entries(MENU_ICON_LIBRARY)
    .map(([key, def]) => `<option value="${key}" ${selected === key ? "selected" : ""}>${def.label}</option>`)
    .join("");
  return `
    <option value="">Icoon: automatisch</option>
    <option value="none" ${selected === "none" ? "selected" : ""}>Icoon: geen</option>
    ${items}
  `;
}

function render() {
  const list = document.getElementById("menu-list");
  list.innerHTML = "";
  items.forEach((item, index) => list.appendChild(renderItem(item, index, items)));
}

function renderItem(item, index, parentArray, isChild = false) {
  const row = document.createElement("div");
  row.className = "column-editor";
  row.style.marginBottom = "10px";
  row.style.marginLeft = isChild ? "24px" : "0";
  row.draggable = true;

  row.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <span style="cursor:grab;">⠿</span>
      <input type="text" class="menu-label" value="${item.label}" style="flex:1;min-width:120px;padding:6px;border:1px solid var(--color-line);border-radius:4px;">
      <select class="menu-type" style="padding:6px;">
        <option value="page" ${item.type === "page" ? "selected" : ""}>Pagina</option>
        <option value="external" ${item.type === "external" ? "selected" : ""}>Externe link</option>
      </select>
      <span class="menu-target-slot"></span>
      <span class="menu-icon-preview" title="Icoon bij dit menu-item"></span>
      <select class="menu-icon" style="padding:6px;">${iconOptions(item.icon)}</select>
      <label style="display:flex;align-items:center;gap:4px;font-size:var(--fs-sm);">
        <input type="checkbox" class="menu-hidden" ${item.hidden ? "checked" : ""}> Verbergen
      </label>
      ${!isChild ? `
      <label style="display:flex;align-items:center;gap:4px;font-size:var(--fs-sm);" title="Toon dit item altijd direct in de balk bovenaan (max. 3)">
        <input type="checkbox" class="menu-pinned" ${item.pinned ? "checked" : ""} ${!item.pinned && pinnedCount() >= 3 ? "disabled" : ""}> Vast in balk (max. 3)
      </label>` : ""}
      ${!isChild ? `<button type="button" class="btn-admin" data-add-child">+ Submenu-item</button>` : ""}
      <button type="button" class="btn-admin btn-admin--danger" data-remove>Verwijderen</button>
    </div>
    <div class="menu-children" style="margin-top:8px;"></div>
  `;

  const targetSlot = row.querySelector(".menu-target-slot");
  function renderTarget() {
    targetSlot.innerHTML = item.type === "page"
      ? `<select class="menu-target-page" style="padding:6px;">${pageOptions(item.slug)}</select>`
      : `<input type="text" class="menu-target-url" placeholder="https://…" value="${item.url || ""}" style="padding:6px;border:1px solid var(--color-line);border-radius:4px;">`;
    if (item.type === "page") {
      targetSlot.querySelector(".menu-target-page").addEventListener("change", (e) => { item.slug = e.target.value; renderIconPreview(); });
    } else {
      targetSlot.querySelector(".menu-target-url").addEventListener("input", (e) => { item.url = e.target.value; });
      targetSlot.querySelector(".menu-target-url").addEventListener("blur", (e) => {
        item.url = normalizeExternalUrl(e.target.value);
        e.target.value = item.url;
      });
    }
  }
  renderTarget();

  const iconPreview = row.querySelector(".menu-icon-preview");
  function renderIconPreview() {
    const key = item.icon === "none" ? null : (item.icon || item.slug);
    iconPreview.innerHTML = key ? menuIconSvg(key, "menu-icon-preview__svg") : "";
  }
  renderIconPreview();
  row.querySelector(".menu-icon").addEventListener("change", (e) => {
    item.icon = e.target.value || undefined;
    renderIconPreview();
  });

  row.querySelector(".menu-label").addEventListener("input", (e) => { item.label = e.target.value; });
  row.querySelector(".menu-type").addEventListener("change", (e) => { item.type = e.target.value; renderTarget(); });
  row.querySelector(".menu-hidden").addEventListener("change", (e) => { item.hidden = e.target.checked; });
  row.querySelector(".menu-pinned")?.addEventListener("change", (e) => {
    item.pinned = e.target.checked;
    render(); // her-render zodat overige vakjes op slot gaan als 3 bereikt is
  });
  row.querySelector("[data-remove]").addEventListener("click", () => {
    parentArray.splice(index, 1);
    render();
  });
  row.querySelector("[data-add-child]")?.addEventListener("click", () => {
    item.children = item.children || [];
    item.children.push(newItem());
    render();
  });

  const childrenWrap = row.querySelector(".menu-children");
  (item.children || []).forEach((child, ci) => childrenWrap.appendChild(renderItem(child, ci, item.children, true)));

  row.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", String(index)); });
  row.addEventListener("dragover", (e) => e.preventDefault());
  row.addEventListener("drop", (e) => {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isNaN(from) || from === index) return;
    const [moved] = parentArray.splice(from, 1);
    parentArray.splice(index, 0, moved);
    render();
  });

  return row;
}

function fixExternalUrls(list) {
  (list || []).forEach((item) => {
    if (item.type === "external" && item.url) item.url = normalizeExternalUrl(item.url);
    if (item.children?.length) fixExternalUrls(item.children);
  });
}

async function saveMenu() {
  try {
    fixExternalUrls(items);
    await setDoc(doc(db, "menu", "main"), { items });
    showToast("Menu opgeslagen.");
  } catch (err) {
    console.error(err);
    showToast("Opslaan mislukt.", true);
  }
}

boot();
