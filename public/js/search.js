// search.js
// Zoekfunctie over alle gepubliceerde pagina's — doorzoekt niet alleen de
// titel en meta-omschrijving, maar ook de daadwerkelijke inhoud van elke
// pagina (tekstblokken, koppen, quotes, FAQ's, tegels, knoppen). Haalt
// éénmaal per bezoek een lichte, platte-tekst-index op en filtert lokaal
// terwijl de bezoeker typt — geen extra zoekserver nodig.

import { db } from "./firebase-init.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

let indexPromise = null;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Zet de gevonden zoekterm onderstreept in de tekst, voor overzicht in de resultatenlijst. */
function highlightTerm(text, term) {
  const escaped = escapeHtml(text);
  if (!term) return escaped;
  const escTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escaped.replace(new RegExp(`(${escTerm})`, "gi"), "<u>$1</u>");
}

/** Haalt alle platte tekst uit een blokken-array (alle bloktypes, ook geneste kolommen en vakken). */
const TEXT_KEYS = new Set(["text", "title", "lead", "eyebrow", "html", "question", "answer", "label", "name", "role", "cite", "caption", "features", "day", "time", "note", "intro", "address", "value", "prefix", "suffix", "price", "period", "date", "c1", "c2", "c3", "c4", "buttonText", "linkText"]);
function extractText(node, parts = []) {
  if (Array.isArray(node)) { node.forEach((n) => extractText(n, parts)); return parts.join(" "); }
  if (!node || typeof node !== "object") return parts.join(" ");
  for (const [key, val] of Object.entries(node)) {
    if (key === "style" || key === "link" || key === "buttonLink") continue;
    if (typeof val === "string") { if (TEXT_KEYS.has(key) && val) parts.push(key === "html" ? val.replace(/<[^>]*>/g, " ") : val); }
    else extractText(val, parts);
  }
  return parts.join(" ");
}

function snippetAround(text, term, length = 100) {
  const idx = text.toLowerCase().indexOf(term);
  if (idx === -1) return text.slice(0, length);
  const start = Math.max(0, idx - 40);
  return (start > 0 ? "…" : "") + text.slice(start, start + length) + "…";
}

async function loadIndex() {
  if (!indexPromise) {
    indexPromise = (async () => {
      const q = query(collection(db, "pages"), where("status", "==", "published"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data();
        const bodyText = extractText(data.blocks);
        return {
          title: data.title || "",
          slug: data.slug || "",
          summary: data.seo?.description || "",
          bodyText,
        };
      });
    })();
  }
  return indexPromise;
}

export function initSearch(root) {
  if (!root) return;
  root.innerHTML = `
    <input type="search" placeholder="Zoeken…" aria-label="Zoek op de website" />
    <div class="site-search__results" hidden></div>
  `;
  const input = root.querySelector("input");
  const results = root.querySelector(".site-search__results");
  let debounceTimer;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const term = input.value.trim().toLowerCase();
    if (!term) { results.hidden = true; results.innerHTML = ""; return; }
    debounceTimer = setTimeout(async () => {
      const pages = await loadIndex();
      const matches = pages
        .map((p) => {
          const inTitle = p.title.toLowerCase().includes(term);
          const inSummary = p.summary.toLowerCase().includes(term);
          const inBody = p.bodyText.toLowerCase().includes(term);
          if (!inTitle && !inSummary && !inBody) return null;
          const context = inSummary ? p.summary : inBody ? snippetAround(p.bodyText, term) : "";
          return { ...p, context, rank: inTitle ? 0 : inSummary ? 1 : 2 };
        })
        .filter(Boolean)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 8);

      results.innerHTML = matches.length
        ? matches.map((p) => `
            <a href="/${p.slug}">
              <span class="site-search__result-title">${escapeHtml(p.title)}</span>
              ${p.context ? `<span class="site-search__result-context">${highlightTerm(p.context, term)}</span>` : ""}
            </a>
          `).join("")
        : `<p class="site-search__empty">Geen resultaten gevonden.</p>`;
      results.hidden = false;
    }, 200);
  });

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) results.hidden = true;
  });
}
