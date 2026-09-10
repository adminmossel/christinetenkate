// layout.js
// Bouwt de header (logo + navigatiemenu) en footer op, met gegevens uit
// Firestore ("menu/main" en "settings/site"). Wordt op elke publieke pagina
// aangeroepen zodat het menu overal identiek en actueel is.

import { db } from "./firebase-init.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { initSearch } from "./search.js";

function buildMenuItem(item, index = 0) {
  const li = document.createElement("li");
  li.className = "main-nav__item";
  li.style.setProperty("--stagger", index);
  const a = document.createElement("a");
  a.href = item.type === "external" ? item.url : `/${(item.slug || "").replace(/^\//, "")}`;
  if (item.type === "external") {
    a.target = "_blank";
    a.rel = "noopener";
  }
  const currentSlug = location.pathname.replace(/^\/|\/$/g, "") || "home";
  if (item.slug && currentSlug === item.slug) {
    a.setAttribute("aria-current", "page");
  }
  a.innerHTML = `
    <span class="main-nav__item-label">${item.label}</span>
    <svg class="main-nav__item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
  `;
  li.appendChild(a);

  if (Array.isArray(item.children) && item.children.length) {
    const sub = document.createElement("ul");
    sub.className = "main-nav__submenu";
    item.children.filter((c) => !c.hidden).forEach((child, i) => sub.appendChild(buildMenuItem(child, i)));
    li.appendChild(sub);
  }
  return li;
}

async function renderHeader(settings) {
  const header = document.getElementById("site-header");
  if (!header) return;

  header.innerHTML = `
    <div class="site-header__island">
      <a class="site-logo" href="/">
        ${settings.logoUrl
          ? `<img src="${settings.logoUrl}" alt="${settings.siteName || "Christine ten Kate"}" class="site-logo__img">`
          : (settings.logoText || "Christine <span>ten Kate</span>")}
      </a>
      <div class="site-search" data-search-root></div>
      <button class="nav-toggle" aria-expanded="false" aria-controls="main-nav-more" aria-label="Menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        <span>Menu</span>
      </button>
    </div>
    <div class="main-nav__more" id="main-nav-more"></div>
  `;

  const toggle = header.querySelector(".nav-toggle");
  const more = header.querySelector("#main-nav-more");
  function closeMenu() {
    more.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.classList.remove("is-open");
  }
  toggle.addEventListener("click", () => {
    const isOpen = more.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.classList.toggle("is-open", isOpen);
  });
  // Klikken op de donkere achtergrond zelf (niet op het menupaneel erin)
  // sluit het uitklapmenu.
  more.addEventListener("click", (e) => { if (e.target === more) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  try {
    const menuSnap = await getDoc(doc(db, "menu", "main"));
    const items = menuSnap.exists() ? (menuSnap.data().items || []) : [];
    const visible = items.filter((item) => !item.hidden);

    const moreEl = document.getElementById("main-nav-more");
    const ul = document.createElement("ul");
    ul.className = "main-nav__list main-nav__list--more";
    let i = 0;
    if (!visible.some((it) => it.type === "page" && it.slug === "home")) {
      ul.appendChild(buildMenuItem({ label: "Home", type: "page", slug: "home" }, i++));
    }
    visible.forEach((item) => ul.appendChild(buildMenuItem(item, i++)));
    moreEl.appendChild(ul);
  } catch (err) {
    console.error("Menu kon niet geladen worden:", err);
  }

  initSearch(header.querySelector("[data-search-root]"));
}

function renderFooter(settings) {
  const footer = document.getElementById("site-footer");
  if (!footer) return;

  const social = (settings.socialLinks || [])
    .map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${s.label}</a>`)
    .join(" · ");

  footer.innerHTML = `
    <div class="site-footer__inner">
      <div>
        <h2>${settings.siteName || "Christine ten Kate"}</h2>
        <p>${settings.footerText || ""}</p>
        ${settings.trustBadgeUrl ? `<img src="${settings.trustBadgeUrl}" alt="${settings.trustBadgeAlt || "Keurmerk"}" class="site-footer__badge">` : ""}
      </div>
      <div>
        <h3>Contact</h3>
        <address>
          ${settings.address ? settings.address.replace(/\n/g, "<br>") + "<br>" : ""}
          ${settings.phone ? `T <a href="tel:${settings.phone.replace(/[^\d+]/g, "")}">${settings.phone}</a><br>` : ""}
          ${settings.mobilePhone ? `M <a href="tel:${settings.mobilePhone.replace(/[^\d+]/g, "")}">${settings.mobilePhone}</a><br>` : ""}
          ${settings.email ? `E <a href="mailto:${settings.email}">${settings.email}</a>` : ""}
        </address>
        ${settings.kvk ? `<p>KvK: ${settings.kvk}</p>` : ""}
      </div>
      <div>
        <h3>Volg</h3>
        <p>${social}</p>
      </div>
    </div>
    <div class="site-footer__bottom">
      © ${new Date().getFullYear()} ${settings.siteName || "Christine ten Kate"} —
      <a href="/privacy-policy">Privacybeleid</a> ·
      <a href="/algemene-voorwaarden">Algemene voorwaarden</a>
    </div>
  `;
}

export async function initLayout() {
  let settings = {};
  try {
    const snap = await getDoc(doc(db, "settings", "site"));
    if (snap.exists()) settings = snap.data();
  } catch (err) {
    console.error("Site-instellingen konden niet geladen worden:", err);
  }
  applyColors(settings.colors);
  await renderHeader(settings);
  renderFooter(settings);
  return settings;
}

/** Overschrijft de standaardkleuren uit tokens.css met de kleuren die oma in Instellingen heeft gekozen. */
function applyColors(colors) {
  if (!colors) return;
  const root = document.documentElement.style;
  if (colors.primary) { root.setProperty("--color-primary", colors.primary); root.setProperty("--color-primary-dark", shade(colors.primary, -18)); }
  if (colors.accent) { root.setProperty("--color-accent", colors.accent); root.setProperty("--color-accent-soft", shade(colors.accent, 55)); }
  if (colors.bg) root.setProperty("--color-bg", colors.bg);
}

/** Maakt een hexkleur lichter (positief percentage) of donkerder (negatief), voor afgeleide tinten. */
function shade(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp(((num >> 16) & 0xff) + Math.round(2.55 * percent));
  const g = clamp(((num >> 8) & 0xff) + Math.round(2.55 * percent));
  const b = clamp((num & 0xff) + Math.round(2.55 * percent));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
