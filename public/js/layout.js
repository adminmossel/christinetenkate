// layout.js
// Bouwt de header (logo + navigatiemenu) en footer op, met gegevens uit
// Firestore ("menu/main" en "settings/site"). Wordt op elke publieke pagina
// aangeroepen zodat het menu overal identiek en actueel is.

import { db } from "./firebase-init.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { initSearch } from "./search.js";
import { resolveLink } from "./render.js";
import { menuIconSvg } from "./menu-icons.js";

// Zoekt eerst naar een handmatig gekozen icoon op het menu-item zelf
// (`item.icon`, in te stellen bij Menu in de admin), en valt anders terug
// op de paginaslug — zo staat er standaard al een icoontje bij "Contact",
// zonder dat daar iets voor ingesteld hoeft te worden. Kiest oma expliciet
// "Geen icoon" in de admin, dan staat `item.icon` op "none" en wordt er
// niets getoond (ook niet de standaard op basis van de slug).
function menuIcon(item) {
  const key = item.icon === "none" ? null : (item.icon || item.slug);
  return key ? menuIconSvg(key, "main-nav__item-icon") : "";
}

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
    ${menuIcon(item)}
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
      <div class="site-header__start">
        <a class="site-logo" href="/">
          ${settings.logoUrl
            ? `<img src="${settings.logoUrl}" alt="${settings.siteName || "Christine ten Kate"}" class="site-logo__img">`
            : (settings.logoText || "Christine <span>ten Kate</span>")}
        </a>
        <ul class="site-header__pinned" id="site-header-pinned"></ul>
      </div>
      <div class="site-search" data-search-root></div>
      <button class="nav-toggle" aria-expanded="false" aria-controls="main-nav-more" aria-label="Menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        <span>Menu</span>
      </button>
    </div>
    <div class="main-nav__more" id="main-nav-more">
      <div class="main-nav__panel">
        <div class="main-nav__panel-head">
          <span class="main-nav__panel-title">${settings.logoText ? settings.logoText.replace(/<[^>]*>/g, "") : "Menu"}</span>
          <button type="button" class="main-nav__close" aria-label="Menu sluiten">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>
          </button>
        </div>
        <div class="main-nav__panel-body" id="main-nav-more-body"></div>
      </div>
    </div>
  `;

  const toggle = header.querySelector(".nav-toggle");
  const more = header.querySelector("#main-nav-more");
  const closeBtn = header.querySelector(".main-nav__close");
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
  closeBtn.addEventListener("click", closeMenu);
  // Klikken op de donkere achtergrond zelf (niet op het menupaneel erin)
  // sluit het uitklapmenu.
  more.addEventListener("click", (e) => { if (e.target === more) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  try {
    const menuSnap = await getDoc(doc(db, "menu", "main"));
    const items = menuSnap.exists() ? (menuSnap.data().items || []) : [];
    const visible = items.filter((item) => !item.hidden);

    // De maximaal 3 "vastgezette" items, rechtstreeks zichtbaar in de balk.
    const pinnedEl = document.getElementById("site-header-pinned");
    const pinnedItems = visible.filter((item) => item.pinned).slice(0, 3);
    pinnedItems.forEach((item) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = item.type === "external" ? item.url : `/${(item.slug || "").replace(/^\//, "")}`;
      if (item.type === "external") { a.target = "_blank"; a.rel = "noopener"; }
      a.textContent = item.label;
      const currentSlug = location.pathname.replace(/^\/|\/$/g, "") || "home";
      if (item.slug && currentSlug === item.slug) a.setAttribute("aria-current", "page");
      li.appendChild(a);
      pinnedEl.appendChild(li);
    });

    const moreEl = document.getElementById("main-nav-more-body");
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

/** Bouwt (of verwijdert) de meeschuivende contactknop, op basis van de instelling bij Instellingen. */
function renderStickyContact(settings) {
  document.getElementById("sticky-contact")?.remove();
  const sc = settings.stickyContact;
  if (!sc || !sc.enabled || !sc.link || !sc.link.value) return;
  const a = document.createElement("a");
  a.id = "sticky-contact";
  a.className = "sticky-contact";
  a.href = resolveLink(sc.link);
  if (sc.link.newTab) { a.target = "_blank"; a.rel = "noopener"; }
  a.innerHTML = `
    ${menuIconSvg("contact")}
    <span>${sc.text || "Neem contact op"}</span>
  `;
  document.body.appendChild(a);
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
  renderStickyContact(settings);
  initHeaderScrollEffect();
  return settings;
}

/** Laat het dock groot beginnen en compact worden zodra er gescrold wordt. */
function initHeaderScrollEffect() {
  const header = document.getElementById("site-header");
  if (!header) return;
  const update = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
  update();
  window.addEventListener("scroll", update, { passive: true });
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
