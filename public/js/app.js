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
  setMeta("og:type", "website", true);
  setMeta("og:url", location.href, true);
  if (page.seo?.ogImage) setMeta("og:image", page.seo.ogImage, true);
}

/** Toont/verbergt de "terug naar boven"-knop; oma kan 'm per pagina uitzetten bij Instellingen in de editor. */
function initBackToTop(enabled) {
  const btn = document.getElementById("back-to-top");
  if (!btn) return;
  if (btn._scrollHandler) { window.removeEventListener("scroll", btn._scrollHandler); btn._scrollHandler = null; }
  if (!enabled) { btn.hidden = true; btn.classList.remove("is-visible"); return; }
  btn.hidden = false;
  const onScroll = () => btn.classList.toggle("is-visible", window.scrollY > 480);
  btn._scrollHandler = onScroll;
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (!btn._clickBound) {
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    btn._clickBound = true;
  }
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
    <div class="notfound">
      <p class="notfound__code" aria-hidden="true">404</p>
      <svg class="notfound__trail" viewBox="0 0 260 60" fill="none" aria-hidden="true">
        <path d="M4 46 C 40 10, 90 66, 130 30 S 210 -4, 250 26" stroke="var(--color-accent)" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="0.5 13"/>
        <circle cx="250" cy="26" r="4.5" fill="var(--color-primary)"/>
        <circle cx="250" cy="26" r="9" stroke="var(--color-primary)" stroke-width="1.6" opacity="0.35"/>
      </svg>
      <h1 class="notfound__title">Deze pagina is zoek</h1>
      <p class="notfound__text">Kinderen raken weleens een want kwijt, een schoen, af en toe een hele knuffel. Deze pagina blijkt hetzelfde te hebben gedaan — waarschijnlijk verplaatst, misschien nooit gemaakt.</p>
      <a href="/" class="btn">Terug naar de homepage</a>
      <p class="notfound__hint">Zoek je iets specifieks? Probeer de zoekbalk hierboven.</p>
    </div>
  `;
}

function hideLoader() {
  const loader = document.getElementById("site-loader");
  if (loader) loader.classList.add("is-hidden");
}

async function loadPage() {
  const slug = currentSlug();
  const content = document.getElementById("page-content");

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
        initBackToTop(false);
        hideLoader();
        return;
      }
      showNotFound();
      initBackToTop(false);
      hideLoader();
      return;
    }

    const page = snap.docs[0].data();
    applySeo(page);
    renderBreadcrumb(page, slug);
    const mediaMap = await fetchMediaMap(collectMediaIds(page.blocks || []));
    renderBlocks(page.blocks || [], content, mediaMap);
    initContactForms();
    initBackToTop(page.showBackToTop !== false);
    hideLoader();
  } catch (err) {
    console.error("Pagina kon niet geladen worden:", err);
    content.innerHTML = `<p class="state-message">Er ging iets mis bij het laden van deze pagina. Probeer de pagina te verversen.</p>`;
    initBackToTop(false);
    hideLoader();
  }
}

// initLayout() eerst (en gewacht) zodat de eigen kleuren van oma al
// toegepast zijn vóórdat de pagina-inhoud verschijnt — anders flitst de
// pagina heel even in de standaardkleuren.
await initLayout();
initCookieBanner();
trackVisit();
loadPage();

// Noodstop: als er ooit iets vastloopt, verdwijnt het laadscherm sowieso
// na een paar seconden — nooit een eindeloos "laden"-scherm.
setTimeout(hideLoader, 6000);

// Registreert de service worker zodat Chrome de site als installeerbare
// app herkent (zie public/sw.js — cachet bewust niets).
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch((err) => console.error("Service worker registratie mislukt:", err));
}

