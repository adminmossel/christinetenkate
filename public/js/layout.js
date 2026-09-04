// layout.js
// Bouwt de header (logo + navigatiemenu) en footer op, met gegevens uit
// Firestore ("menu/main" en "settings/site"). Wordt op elke publieke pagina
// aangeroepen zodat het menu overal identiek en actueel is.

import { db } from "./firebase-init.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { initSearch } from "./search.js";

function buildMenuItem(item) {
  const li = document.createElement("li");
  li.className = "main-nav__item";
  const a = document.createElement("a");
  a.textContent = item.label;
  a.href = item.type === "external" ? item.url : `/${(item.slug || "").replace(/^\//, "")}`;
  if (item.type === "external") {
    a.target = "_blank";
    a.rel = "noopener";
  }
  if (item.slug && location.pathname.replace(/^\//, "") === item.slug) {
    a.setAttribute("aria-current", "page");
  }
  li.appendChild(a);

  if (Array.isArray(item.children) && item.children.length) {
    const sub = document.createElement("ul");
    sub.className = "main-nav__submenu";
    item.children.filter((c) => !c.hidden).forEach((child) => sub.appendChild(buildMenuItem(child)));
    li.appendChild(sub);
  }
  return li;
}

async function renderHeader(settings) {
  const header = document.getElementById("site-header");
  if (!header) return;

  header.innerHTML = `
    <div class="site-header__inner">
      <a class="site-logo" href="/">
        ${settings.logoUrl
          ? `<img src="${settings.logoUrl}" alt="${settings.siteName || "Christine ten Kate"}" class="site-logo__img">`
          : (settings.logoText || "Christine <span>ten Kate</span>")}
      </a>
      <div class="site-search" data-search-root></div>
      <button class="nav-toggle" aria-expanded="false" aria-controls="main-nav">Menu</button>
      <nav class="main-nav" id="main-nav" aria-label="Hoofdmenu">
        <ul class="main-nav__list" id="main-nav-list"></ul>
      </nav>
    </div>
  `;

  const toggle = header.querySelector(".nav-toggle");
  const nav = header.querySelector(".main-nav");
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  try {
    const menuSnap = await getDoc(doc(db, "menu", "main"));
    const items = menuSnap.exists() ? (menuSnap.data().items || []) : [];
    const list = document.getElementById("main-nav-list");
    items.filter((item) => !item.hidden).forEach((item) => list.appendChild(buildMenuItem(item)));
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
  await renderHeader(settings);
  renderFooter(settings);
  return settings;
}
