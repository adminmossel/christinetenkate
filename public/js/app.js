// app.js
// Universele pagina-loader. Wordt door page.html gebruikt voor élke pagina
// behalve de homepage. Leest de URL (bijv. /over-mij), zoekt de bijbehorende
// pagina in Firestore op en rendert de inhoud.

import { db } from "./firebase-init.js";
import { collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { initLayout } from "./layout.js";
import { renderBlocks } from "./render.js";
import { initContactForms } from "./contact-form.js";
import { initCookieBanner } from "./cookie-banner.js";

function applySeo(page) {
  const title = page.seo?.title || page.title;
  document.title = title ? `${title} — Christine ten Kate` : "Christine ten Kate";

  const setMeta = (name, content, property = false) => {
    if (!content) return;
    const attr = property ? "property" : "name";
    let tag = document.querySelector(`meta[${attr}="${name}"]`);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attr, name);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", content);
  };

  setMeta("description", page.seo?.description || "");
  setMeta("og:title", title, true);
  setMeta("og:description", page.seo?.description || "", true);
  if (page.seo?.ogImage) setMeta("og:image", page.seo.ogImage, true);
}

function renderBreadcrumb(page) {
  const el = document.getElementById("breadcrumb");
  if (!el) return;
  el.innerHTML = `<a href="/">Home</a> / <span aria-current="page">${page.title}</span>`;
}

function showNotFound() {
  document.title = "Pagina niet gevonden — Christine ten Kate";
  document.getElementById("breadcrumb").innerHTML = "";
  document.getElementById("page-content").innerHTML = `
    <div class="state-message">
      <h1>Pagina niet gevonden</h1>
      <p>Deze pagina bestaat niet (meer). <a href="/">Terug naar de homepage</a>.</p>
    </div>
  `;
}

async function loadPage() {
  const slug = location.pathname.replace(/^\/|\/$/g, "");
  const content = document.getElementById("page-content");
  content.innerHTML = `<p class="state-message">Pagina wordt geladen…</p>`;

  try {
    const q = query(
      collection(db, "pages"),
      where("slug", "==", slug),
      where("status", "==", "published"),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) { showNotFound(); return; }

    const page = snap.docs[0].data();
    applySeo(page);
    renderBreadcrumb(page);
    renderBlocks(page.blocks || [], content);
    initContactForms();
  } catch (err) {
    console.error("Pagina kon niet geladen worden:", err);
    content.innerHTML = `<p class="state-message">Er ging iets mis bij het laden van deze pagina. Probeer de pagina te verversen.</p>`;
  }
}

initLayout();
initCookieBanner();
loadPage();
