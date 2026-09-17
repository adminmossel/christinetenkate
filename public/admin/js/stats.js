// stats.js
import { requireAdmin } from "./admin-auth.js";
import { renderAdminShell } from "./admin-shell.js";
import { db } from "../../js/firebase-init.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

async function boot() {
  const admin = await requireAdmin();
  renderAdminShell("stats", admin);
  await loadStats();
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

async function loadStats() {
  // We halen simpelweg alle bezoeken op en tellen zelf — voor een site van
  // deze omvang is dat ruim snel genoeg, en het voorkomt dat we (net als
  // eerder bij de pagina's) een handmatige Firestore-index nodig hebben.
  let docs = [];
  try {
    const snap = await getDocs(collection(db, "visits"));
    docs = snap.docs.map((d) => d.data()).filter((v) => v.createdAt?.toDate);
  } catch (err) {
    console.error("Kon bezoekstatistieken niet laden:", err);
  }

  const now = new Date();
  const today = startOfDay(now);
  const sevenDaysAgo = daysAgo(7);
  const thirtyDaysAgo = daysAgo(30);

  const countSince = (since) => docs.filter((v) => v.createdAt.toDate() >= since).length;

  document.getElementById("stat-today").textContent = countSince(today);
  document.getElementById("stat-7d").textContent = countSince(sevenDaysAgo);
  document.getElementById("stat-30d").textContent = countSince(thirtyDaysAgo);
  document.getElementById("stat-total").textContent = docs.length;

  renderDailyChart(docs);
  renderTopList("stat-top-pages", groupCount(docs, (v) => v.path || "onbekend"), "bezoeken");
  renderTopList("stat-top-locations", groupCount(docs, (v) => [v.city, v.country].filter(Boolean).join(", ") || "Onbekend"), "bezoeken");
  renderTopList("stat-devices", groupCount(docs, (v) => v.device || "Onbekend"), "bezoeken", true);
  renderTopList("stat-browsers", groupCount(docs, (v) => v.browser || "Onbekend"), "bezoeken", true);
}

function groupCount(docs, keyFn) {
  const map = new Map();
  docs.forEach((v) => {
    const key = keyFn(v);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function renderTopList(elementId, entries, unit, compact = false) {
  const el = document.getElementById(elementId);
  if (!entries.length) { el.innerHTML = `<p style="font-size:var(--fs-sm);color:var(--color-ink-soft);">Nog geen gegevens.</p>`; return; }
  const max = entries[0][1];
  el.innerHTML = entries.slice(0, compact ? 6 : 10).map(([label, count]) => `
    <div class="stat-bar-row">
      <span class="stat-bar-row__label">${label}</span>
      <div class="stat-bar-row__track"><div class="stat-bar-row__fill" style="width:${Math.max(6, (count / max) * 100)}%"></div></div>
      <span class="stat-bar-row__count">${count}</span>
    </div>
  `).join("");
}

function renderDailyChart(docs) {
  const el = document.getElementById("stat-daily-chart");
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const day = daysAgo(i);
    const next = daysAgo(i - 1);
    const count = docs.filter((v) => v.createdAt.toDate() >= day && v.createdAt.toDate() < next).length;
    days.push({ label: day.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" }), count });
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  el.innerHTML = `
    <div class="daily-chart__bars">
      ${days.map((d) => `
        <div class="daily-chart__col" title="${d.label}: ${d.count} bezoek(en)">
          <div class="daily-chart__bar" style="height:${Math.max(3, (d.count / max) * 100)}%"></div>
          <span class="daily-chart__label">${d.label}</span>
        </div>
      `).join("")}
    </div>
  `;
}

boot();
