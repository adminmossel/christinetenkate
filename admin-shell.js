// admin-shell.js
// Bouwt de gedeelde zijbalk-navigatie voor het admin-paneel.

import { logout } from "./admin-auth.js";

const NAV_ITEMS = [
  { key: "dashboard", label: "Pagina's", href: "/admin/index.html" },
  { key: "media", label: "Mediabibliotheek", href: "/admin/media.html" },
  { key: "menu", label: "Menu", href: "/admin/menu.html" },
  { key: "messages", label: "Berichten", href: "/admin/messages.html" },
  { key: "settings", label: "Instellingen", href: "/admin/settings.html" },
];

export function renderAdminShell(activeKey, adminProfile) {
  document.body.classList.add("admin");
  const shell = document.createElement("div");
  shell.className = "admin-shell";

  const sidebar = document.createElement("aside");
  sidebar.className = "admin-sidebar";
  sidebar.innerHTML = `
    <a class="admin-sidebar__logo" href="/">Christine ten Kate</a>
    <nav>
      ${NAV_ITEMS.map((item) => `<a href="${item.href}" class="${item.key === activeKey ? "is-active" : ""}">${item.label}</a>`).join("")}
      <a href="/" target="_blank" rel="noopener">Bekijk site ↗</a>
    </nav>
    <div class="admin-sidebar__user">
      <p>${adminProfile?.name || adminProfile?.email || ""}</p>
      <button type="button" id="logout-btn">Uitloggen</button>
    </div>
  `;

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
