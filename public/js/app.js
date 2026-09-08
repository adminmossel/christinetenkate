// app.js
// Universele pagina-loader. Wordt door index.html gebruikt voor élke
// pagina — ook de homepage (slug "home"). Leest de URL (bijv. /over-mij),
// zoekt de bijbehorende pagina in Firestore op en rendert de inhoud.
//
// Waarom één bestand voor alle pagina's: Cloudflare Workers static assets
// (waar deze site op draait) kent geen "_redirects"-bestand zoals het
// oudere Cloudflare Pages. In plaats daarvan serveert Cloudflare voor élke
// URL die geen bestaand bestand is (dus elke door oma aangemaakte pagina)
// gewoon dit index.html terug (zie wrangler.jsonc,
// "not_found_handling": "single-page-application"), en bepaalt dít
// script — puur aan de hand van de adresbalk — welke pagina getoond moet
// worden.

import { db } from "./firebase-init.js";
import { collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { initLayout } from "./layout.js";
import { renderBlocks, collectMediaIds } from "./render.js";
import { fetchMediaMap } from "../admin/js/media-picker.js";
import { initContactForms } from "./contact-form.js";
import { initCookieBanner } from "./cookie-banner.js";
import { trackVisit } from "./analytics.js";

function currentSlug() {
  const path = location.pathname.replace(/^\/|\/$/g, "");
  return path === "" ? "home" : path;
}

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

function renderBreadcrumb(page, slug) {
  const el = document.getElementById("breadcrumb");
  if (!el) return;
  if (slug === "home") { el.innerHTML = ""; return; }
  el.innerHTML = `<a href="/">Home</a> / <span aria-current="page">${page.title}</span>`;
}

function showNotFound() {
  document.title = "Pagina niet gevonden — Christine ten Kate";
  const breadcrumb = document.getElementById("breadcrumb");
  if (breadcrumb) breadcrumb.innerHTML = "";
  document.getElementById("page-content").innerHTML = `
    <div class="state-message">
      <h1>Pagina niet gevonden</h1>
      <p>Deze pagina bestaat niet (meer). <a href="/">Terug naar de homepage</a>.</p>
    </div>
  `;
}

async function loadPage() {
  const slug = currentSlug();
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
    if (snap.empty) {
      if (slug === "home") {
        content.innerHTML = `<div class="state-message"><h1>Welkom</h1><p>De homepage is nog niet ingesteld. Ga naar het admin-paneel om de pagina met slug "home" te publiceren.</p></div>`;
        return;
      }
      showNotFound();
      return;
    }

    const page = snap.docs[0].data();
    applySeo(page);
    renderBreadcrumb(page, slug);
    const mediaMap = await fetchMediaMap(collectMediaIds(page.blocks || []));
    renderBlocks(page.blocks || [], content, mediaMap);
    initContactForms();
  } catch (err) {
    console.error("Pagina kon niet geladen worden:", err);
    content.innerHTML = `<p class="state-message">Er ging iets mis bij het laden van deze pagina. Probeer de pagina te verversen.</p>`;
  }
}

// initLayout() eerst (en gewacht) zodat de eigen kleuren van oma al
// toegepast zijn vóórdat de pagina-inhoud verschijnt — anders flitst de
// pagina heel even in de standaardkleuren.
await initLayout();
initCookieBanner();
trackVisit();
loadPage();

// Voorkomt dat het tijdelijke *.workers.dev-adres ooit door Google
// geïndexeerd wordt — dat moet straks alleen het échte domein zijn.
if (location.hostname.endsWith("workers.dev")) {
  const meta = document.createElement("meta");
  meta.name = "robots";
  meta.content = "noindex, nofollow";
  document.head.appendChild(meta);
}

