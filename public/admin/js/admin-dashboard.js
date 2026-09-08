// admin-dashboard.js
import { requireAdmin, getCurrentAdmin } from "./admin-auth.js";
import { renderAdminShell, showToast, forceRepaint } from "./admin-shell.js";
import { slugify, ensureUniqueSlug } from "./slugify.js";
import { db } from "../../js/firebase-init.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let currentView = "active";

async function boot() {
  const admin = await requireAdmin();
  renderAdminShell("dashboard", admin);
  document.getElementById("new-page-btn").addEventListener("click", createNewPage);
  document.querySelectorAll(".editor-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".editor-tabs button").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      currentView = btn.dataset.view;
      loadPages();
    });
  });
  loadPages();
}

function formatDate(timestamp) {
  if (!timestamp?.toDate) return "—";
  return timestamp.toDate().toLocaleString("nl-NL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function loadPages() {
  const tbody = document.getElementById("pages-table-body");
  tbody.innerHTML = `<tr><td colspan="5">Pagina's worden geladen…</td></tr>`;

  try {
    // Bewust GEEN orderBy() in de query zelf: een filter (where) combineren
    // met een sortering op een ander veld vereist in Firestore een
    // handmatig aangemaakte "composite index" — dat was precies de oorzaak
    // van de foutmelding "Er ging iets mis". In plaats daarvan sorteren we
    // hier gewoon zelf, na het ophalen; voor een site met een handvol
    // pagina's maakt dat geen merkbaar verschil, en het scheelt weer een
    // handmatige Firebase-instelling.
    const q = query(collection(db, "pages"), where("trashed", "==", currentView === "trash"));
    const snap = await getDocs(q);
    const docs = [...snap.docs].sort((a, b) => {
      const aTime = a.data().updatedAt?.toMillis?.() || 0;
      const bTime = b.data().updatedAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    document.getElementById("seed-banner")?.remove();
    if (docs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">${currentView === "trash" ? "De prullenbak is leeg." : "Nog geen pagina's."}</td></tr>`;
      if (currentView === "active") {
        const banner = document.createElement("div");
        banner.id = "seed-banner";
        banner.className = "admin-card";
        banner.style.cssText = "border-color:var(--color-accent);margin-top:12px;";
        banner.innerHTML = `<p>Eerste keer hier? <a href="/admin/seed.html">Vul de website met startinhoud</a> (echte contactgegevens, logo, menu en de Privacy Policy-tekst, plus een paar pagina's die je zelf verder invult).</p>`;
        document.getElementById("pages-table").insertAdjacentElement("afterend", banner);
      }
      return;
    }

    tbody.innerHTML = "";
    docs.forEach((docSnap) => {
      const page = docSnap.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${page.title || "(zonder titel)"}</td>
        <td><span class="status-pill status-pill--${currentView === "trash" ? "trashed" : page.status}">${currentView === "trash" ? "Verwijderd" : (page.status === "published" ? "Gepubliceerd" : "Concept")}</span></td>
        <td><code>/${page.slug}</code></td>
        <td>${formatDate(page.updatedAt)}</td>
        <td class="actions"></td>
      `;
      const actionsCell = row.querySelector(".actions");
      actionsCell.appendChild(actionsFor(docSnap.id, page));
      tbody.appendChild(row);
    });
    forceRepaint(tbody);
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="5">Er ging iets mis bij het laden van de pagina's.</td></tr>`;
  }
}

function makeBtn(label, cls, onClick) {
  const btn = document.createElement("button");
  btn.className = `btn-admin ${cls || ""}`.trim();
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function actionsFor(id, page) {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.gap = "6px";
  wrap.style.flexWrap = "wrap";

  if (currentView === "trash") {
    wrap.appendChild(makeBtn("Herstellen", "", () => restorePage(id)));
    wrap.appendChild(makeBtn("Definitief verwijderen", "btn-admin--danger", () => permanentlyDelete(id, page.title)));
    return wrap;
  }

  const editLink = document.createElement("a");
  editLink.href = `/admin/editor.html?id=${id}`;
  editLink.className = "btn-admin";
  editLink.textContent = "Bewerken";
  wrap.appendChild(editLink);

  if (page.status === "published") {
    const view = document.createElement("a");
    view.href = `/${page.slug}`;
    view.target = "_blank";
    view.rel = "noopener";
    view.className = "btn-admin";
    view.textContent = "Bekijk live ↗";
    wrap.appendChild(view);
    wrap.appendChild(makeBtn("Depubliceren", "", () => setStatus(id, "draft")));
  } else {
    wrap.appendChild(makeBtn("Publiceren", "btn-admin--primary", () => setStatus(id, "published")));
  }

  wrap.appendChild(makeBtn("Dupliceren", "", () => duplicatePage(id, page)));
  wrap.appendChild(makeBtn("Verwijderen", "btn-admin--danger", () => trashPage(id)));
  return wrap;
}

async function createNewPage() {
  const title = prompt("Titel van de nieuwe pagina:");
  if (!title || !title.trim()) return;
  const admin = getCurrentAdmin();
  const baseSlug = slugify(title);
  const slug = await ensureUniqueSlug(baseSlug || "nieuwe-pagina");

  try {
    const newDoc = await addDoc(collection(db, "pages"), {
      title: title.trim(),
      slug,
      status: "draft",
      trashed: false,
      blocks: [],
      seo: { title: "", description: "", ogImage: "" },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: admin?.email || null,
      updatedBy: admin?.email || null,
    });
    location.href = `/admin/editor.html?id=${newDoc.id}`;
  } catch (err) {
    console.error(err);
    showToast("Kon geen nieuwe pagina aanmaken.", true);
  }
}

async function duplicatePage(id, page) {
  const admin = getCurrentAdmin();
  const baseSlug = slugify(`${page.title}-kopie`);
  const slug = await ensureUniqueSlug(baseSlug);
  try {
    await addDoc(collection(db, "pages"), {
      ...page,
      title: `${page.title} (kopie)`,
      slug,
      status: "draft",
      trashed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: admin?.email || null,
      updatedBy: admin?.email || null,
    });
    showToast("Pagina gedupliceerd.");
    loadPages();
  } catch (err) {
    console.error(err);
    showToast("Dupliceren mislukt.", true);
  }
}

async function setStatus(id, status) {
  try {
    await updateDoc(doc(db, "pages", id), { status, updatedAt: serverTimestamp() });
    showToast(status === "published" ? "Pagina gepubliceerd." : "Pagina gedepubliceerd.");
    loadPages();
  } catch (err) {
    console.error(err);
    showToast("Actie mislukt.", true);
  }
}

async function trashPage(id) {
  if (!confirm("Deze pagina naar de prullenbak verplaatsen? Je kunt hem daarna nog herstellen.")) return;
  try {
    await updateDoc(doc(db, "pages", id), { trashed: true, status: "draft", trashedAt: serverTimestamp() });
    showToast("Pagina verplaatst naar de prullenbak.");
    loadPages();
  } catch (err) {
    console.error(err);
    showToast("Verwijderen mislukt.", true);
  }
}

async function restorePage(id) {
  try {
    await updateDoc(doc(db, "pages", id), { trashed: false });
    showToast("Pagina hersteld.");
    loadPages();
  } catch (err) {
    console.error(err);
    showToast("Herstellen mislukt.", true);
  }
}

async function permanentlyDelete(id, title) {
  if (!confirm(`"${title}" definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
  try {
    await deleteDoc(doc(db, "pages", id));
    showToast("Pagina definitief verwijderd.");
    loadPages();
  } catch (err) {
    console.error(err);
    showToast("Verwijderen mislukt.", true);
  }
}

boot();
