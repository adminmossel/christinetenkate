// admin-shell.js
// Bouwt de gedeelde zijbalk-navigatie voor het admin-paneel.

import { logout } from "./admin-auth.js";

const ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>`,
  stats: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  media: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5.5-5.5a2 2 0 0 0-2.8 0L3 20"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/></svg>`,
  messages: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  external: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
};

const NAV_ITEMS = [
  { key: "dashboard", label: "Pagina's", href: "/admin/index.html" },
  { key: "stats", label: "Statistieken", href: "/admin/stats.html" },
  { key: "media", label: "Mediabibliotheek", href: "/admin/media.html" },
  { key: "menu", label: "Menu", href: "/admin/menu.html" },
  { key: "messages", label: "Berichten", href: "/admin/messages.html" },
  { key: "settings", label: "Instellingen", href: "/admin/settings.html" },
];

export function renderAdminShell(activeKey, adminProfile, options = {}) {
  document.body.classList.add("admin");
  const shell = document.createElement("div");
  shell.className = "admin-shell";

  const collapsed = options.collapsedByDefault ?? (localStorage.getItem("admin-sidebar-collapsed") === "true");
  if (collapsed) shell.classList.add("is-sidebar-collapsed");

  const sidebar = document.createElement("aside");
  sidebar.className = "admin-sidebar";
  sidebar.innerHTML = `
    <button type="button" class="admin-sidebar__collapse-btn" aria-label="Menu in-/uitklappen" title="Menu in-/uitklappen">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <a class="admin-sidebar__logo" href="/">
      <img src="/img/logo-blocks.png" alt="Christine ten Kate" class="admin-sidebar__logo-img">
      <span class="admin-sidebar__logo-full">Christine ten Kate</span>
    </a>
    <nav>
      ${NAV_ITEMS.map((item) => `<a href="${item.href}" class="${item.key === activeKey ? "is-active" : ""}" title="${item.label}">${ICONS[item.key]}<span>${item.label}</span></a>`).join("")}
      <a href="/" target="_blank" rel="noopener" title="Bekijk site">${ICONS.external}<span>Bekijk site</span></a>
    </nav>
    <div class="admin-sidebar__user">
      <p>${adminProfile?.name || adminProfile?.email || ""}</p>
      <button type="button" id="logout-btn">Uitloggen</button>
    </div>
  `;

  sidebar.querySelector(".admin-sidebar__collapse-btn").addEventListener("click", () => {
    const isNowCollapsed = shell.classList.toggle("is-sidebar-collapsed");
    localStorage.setItem("admin-sidebar-collapsed", String(isNowCollapsed));
  });

  const main = document.createElement("main");
  main.className = "admin-main";
  main.id = "admin-main";

  const existingMain = document.getElementById("admin-main-content");
  if (existingMain) {
    main.innerHTML = existingMain.innerHTML;
    existingMain.remove();
  }

  shell.appendChild(sidebar);
  shell.appendChild(main);
  document.body.appendChild(shell);

  sidebar.querySelector("#logout-btn").addEventListener("click", () => {
    if (confirm("Weet je zeker dat je wilt uitloggen?")) logout();
  });

  forceRepaint(shell);
  // Nog een keer, iets later — vangt gevallen op waarbij de pagina zelf
  // daarna nóg meer content toevoegt (bijv. de pagina-tabel die pas na een
  // Firestore-call gevuld wordt).
  setTimeout(() => forceRepaint(shell), 400);

  return main;
}

export function showToast(message, isError = false) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " error" : ""}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/**
 * Dwingt de browser een net ingevoegd stuk pagina opnieuw te "tekenen".
 * Bepaalde Chromium-gebaseerde browsers (waaronder Brave) laten grote,
 * in één keer ingevoegde stukken HTML soms onzichtbaar totdat de
 * gebruiker ergens op klikt/hovert — dit forceert dat meteen, zonder dat
 * daar een interactie voor nodig is.
 */
export function forceRepaint(el = document.body) {
  requestAnimationFrame(() => {
    el.style.opacity = "0.999";
    requestAnimationFrame(() => { el.style.opacity = ""; });
  });
}
